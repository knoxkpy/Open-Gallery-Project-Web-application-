const pug = require('pug');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const session = require('express-session');
const { request } = require('http');
const { allowedNodeEnvironmentFlags } = require('process');

//Mongoose schema for the gallery items
const reviewSchema = new mongoose.Schema({
    text: String,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    artwork: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GalleryItem'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const gallerySchema = new mongoose.Schema({
    Title: String,
    Artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    Year: String,
    Category: String,
    Medium: String,
    Description: String,
    Poster: String,
    reviews: [reviewSchema],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
});


const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    accountType: { type: String, enum: ['Patron', 'Artist'], default: 'Patron' },
    followedArtists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likedArtworks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GalleryItem' }],
    notifications: [{
        message: String,
        date: Date,
        link: String,
        seen: { type: Boolean, default: false }
    }],
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }]
});

const workshopSchema = new mongoose.Schema({
    Title: { type: String, required: true, unique: true },
    Artist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    Description: { type: String, required: true },
    Date: { type: Date, required: true },
    enrolledUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
  
const Workshop = mongoose.model('Workshop', workshopSchema);
const GalleryItem = mongoose.model('GalleryItem', gallerySchema);
const Review = mongoose.model('Review', reviewSchema);
const Users = mongoose.model('User', userSchema);

const importData = async () => {
    try {
        const data = fs.readFileSync('gallery.json', 'utf8');
        const galleryItems = JSON.parse(data);
        const artistMap = {};

        for (const item of galleryItems) {
            if (!artistMap[item.Artist]) {
                let artistUser = await Users.findOne({ username: item.Artist });
                if (!artistUser) {
                    artistUser = new Users({ 
                        username: item.Artist,
                        email: `${item.Artist.split(' ').join('.')}@gallery.com`,
                        password: 'defaultPassword',
                        accountType: 'Artist'
                    });
                    await artistUser.save();
                }
                artistMap[item.Artist] = artistUser._id;
            }
        }

        for (const item of galleryItems) {
            item.Artist = artistMap[item.Artist];
            const exists = await GalleryItem.findOne({ Title: item.Title, Artist: item.Artist });
            if (!exists) {
                const newItem = new GalleryItem(item);
                await newItem.save();
            }
        }
    } catch (error) {
        console.error('Error reading file or saving item:', error);
    }
};


mongoose.connect('mongodb://127.0.0.1:27017/Gallery');
let db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  //We're connected
    console.log("Connected to Gallery database.");
    importData();

    let app = express();

    app.use(express.json());
    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: true }));

    app.use(session({
        secret: 'some secret here',
        resave: true,
        saveUninitialized: false,
        cookie: { secure: false }
    })); 

    app.set('view engine', 'pug');
    app.set('views', './views');

    app.get('/', (request, response) => {
        response.render('login');
    });

    app.get('/login', (request, response) => {
        response.render('login');
    });

    app.get('/signup', (request, response) => {
        response.render('signup');
    })

    app.get('/forgot-password',(request, response) => {
        response.render('forgot-password');
    });

    app.post('/signup', (request, response) => {
        const { username, email, password, accountType } = request.body;
        const newUser = new Users({
            username,
            email,
            password,
            accountType,
            followedArtists: [],
            likedArtworks: [],
            notifications: []
        });
    
        newUser.save()
            .then(() => response.status(201).send('Account created'))
            .catch(err => response.status(400).send('Account creation failed: ' + err.message));
    });
    

    app.post('/login', async (request, response) => {
        const { username, password } = request.body;

        console.log(request.body);
    
        try {
            const user = await Users.findOne({ username: username });
    
            if (!user || password !== user.password) {
                return response.status(401).json({ success: false, message: 'Authentication failed' });
            }

            request.session.loggedin = true;
            request.session.username = user.username;
            request.session.userId = user._id;

            console.log(request.session);
            
            response.json({ success: true, redirect: '/gallery' });
        } catch (err) {
            response.status(500).json({ success: false, message: 'An error occurred during authentication' });
        }
    });

    function isAuthenticated(req, res, next) {
        if (req.session && req.session.userId) {
            return next();
        } else {
            res.status(401).send('You are not authenticated');
        }
    }
    
    app.get('/gallery', isAuthenticated, async (request, response) => {
        try {
            const galleryItems = await GalleryItem.find({});
            response.render('gallery', { galleryItems });
        } catch (error) {
            response.status(500).send('Error fetching gallery items');
        }
    });


    app.get('/artwork/:id', isAuthenticated, async (request, response) => {
        try {
            const artwork = await GalleryItem.findById(request.params.id).populate('Artist', 'username');
    
            if (!artwork) {
                return response.status(404).send('Artwork not found');
            }
    
            response.render('artworkPage', { artwork: artwork });
        } catch (error) {
            console.error(error);
            response.status(500).send('Error retrieving artwork');
        }
    });


    async function getFollowedArtists(userId) {
        const user = await Users.findById(userId).populate('followedArtists');
        return user.followedArtists;
    }
    
    async function getLikedArtworks(userId) {
        const user = await Users.findById(userId).populate('likedArtworks');
        return user.likedArtworks;
    }
    
    async function getUserNotifications(userId) {
        const user = await Users.findById(userId).populate('notifications');
        return user.notifications;
    }
    
    async function getUserReviews(userId) {
        const user = await Users.findById(userId).populate({
            path: 'reviews',
            populate: [
                { path: 'user', select: 'username' },
                { path: 'artwork', select: 'Title' }
            ]
        });

        return user.reviews;
    }
    

    app.get('/account-management', isAuthenticated, async (request, response) => {
        try {
            const user = await Users.findById(request.session.userId);
            if (!user) {
                response.status(404).send('User not found');
                return;
            }
            
            const followedArtists = await getFollowedArtists(request.session.userId);
            const likedArtworks = await getLikedArtworks(request.session.userId);
            const userNotifications = await getUserNotifications(request.session.userId);
            const userReviews = await getUserReviews(request.session.userId);
            
            response.render('account-management', {
                user: user,
                followedArtists: followedArtists,
                likedArtworks: likedArtworks,
                notifications: userNotifications,
                reviews: userReviews
            });
        } catch (error) {
            console.error('Error loading account management page:', error);
            response.status(500).send('Internal Server Error');
        }
    });

    app.get('/logout', (request, response) => {
        if (request.session.loggedin) {
            request.session.destroy((err) => {
                if(err) {
                    return response.status(500).send('Error in logout');
                }

                response.redirect(`http://localhost:3000/`);
            });
        } else {
            response.redirect(`http://localhost:3000/`);
        }
    });

    //upgrade the account to artist.
    app.put('/upgrade-account', isAuthenticated, async (request, response) => {
        try {
            const artworks = await GalleryItem.find({ Artist: request.session.userId });
            if (artworks.length > 0) {
                await Users.findByIdAndUpdate(request.session.userId, { accountType: 'Artist' });
                response.status(200).json({success: true, redirect: '/account-management'});
            } else {
                response.status(200).json({success: false, redirect: '/addArtwork'});
            }
        } catch (error) {
            console.error('Error upgrading account:', error);
            response.status(500).send('Error upgrading account');
        }
    });
    
    //downgrade the account to artist.
    app.put('/downgrade-account', isAuthenticated, async (request, response) => {
        if (request.session.loggedin) {
            try {
                const updatedUser = await Users.findByIdAndUpdate(
                    request.session.userId,
                    { accountType: 'Patron' },
                    { new: true }
                );

                if (!updatedUser) {
                    return response.status(404).send('User not found');
                }
                response.status(200).json({success: true, redirect: '/account-management'});
            } catch (err) {
                console.error('Error upgrading account:', err);
                response.status(500).send('Error upgrading account');
            }
        } else {
            response.status(401).send('User not logged in');
        }
    });

    app.get('/search', isAuthenticated, async (request, response) => {
        let { query, page } = request.query;
    
        page = page ? parseInt(page, 10) : 1;
        const limit = 10;
    
        try {
            if (query) {
                const artists = await Users.find({
                    username: new RegExp(query, 'i')
                }).select('_id');
        
                const artistIds = artists.map(artist => artist._id);
        
                const searchQuery = query ? {
                    $or: [
                        { Title: new RegExp(query, 'i') },
                        { Artist: { $in: artistIds } },
                        { Category: new RegExp(query, 'i') }
                    ]
                } : {};
        
                const artworks = await GalleryItem.find(searchQuery)
                    .populate('Artist', 'username')
                    .limit(limit)
                    .skip((page - 1) * limit)
                    .exec();
        
                const totalArtworks = await GalleryItem.countDocuments(searchQuery);
                const totalPages = Math.ceil(totalArtworks / limit);
        
                response.render('search', {
                    artworks,
                    query,
                    currentPage: page,
                    hasNextPage: totalPages > page,
                    hasPrevPage: page > 1,
                    nextPage: page + 1,
                    prevPage: page - 1,
                    totalPages
                });
            } else {
                response.render('search', {
                    artworks: [],
                    query: '',
                    currentPage: page,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: page + 1,
                    prevPage: page - 1,
                    totalPages: 0
                });
            }
        } catch (error) {
            console.error(error);
            response.status(500).send('Error performing the search');
        }
    });

    app.post('/artwork/:id/add-like', isAuthenticated, async (request, response) => {
        try {
            const artworkId = request.params.id;
            const userId = request.session.userId;
    
            const artwork = await GalleryItem.findById(artworkId).populate('Artist');
            const user = await Users.findById(userId);
    
            if (!artwork) {
                return response.status(404).send('Artwork not found');
            }
    
            if (artwork.Artist && artwork.Artist._id.equals(userId)) {
                return response.status(403).send('Artists cannot like their own artwork');
            }
    
            if (!artwork.likes.includes(userId)) {
                artwork.likes.push(userId);
                await artwork.save();
            }
    
            if (!user.likedArtworks.includes(artworkId)) {
                user.likedArtworks.push(artworkId);
                await user.save();
            }
    
            response.redirect(`/artwork/${artworkId}`);
        } catch (error) {
            response.status(500).send('Error adding like');
        }
    });
    

    app.post('/unlike-artwork/:id', isAuthenticated, async (request, response) => {
        try {
            const artworkId = request.params.id;
            const userId = request.session.userId;
    
            await Users.findByIdAndUpdate(userId, {
                $pull: { likedArtworks: artworkId }
            });
    
            await GalleryItem.findByIdAndUpdate(artworkId, {
                $pull: { likes: userId }
            });
    
            response.json({ message: 'Artwork unliked successfully.' });
        } catch (error) {
            response.status(500).json({ message: 'Error unliking artwork' });
        }
    });

    app.post('/artwork/:id/add-review', isAuthenticated, async (request, response) => {
        const { review } = request.body;
        try {
            const artwork = await GalleryItem.findById(request.params.id).populate('Artist');
    
            if (!artwork) {
                return response.status(404).send('Artwork not found');
            }
    
            if (artwork.Artist && artwork.Artist._id.equals(request.session.userId)) {
                return response.status(403).send('Artists cannot review their own artwork');
            }
    
            const newReview = new Review({
                text: review,
                user: request.session.userId,
                artwork: artwork._id
            });
    
            await newReview.save();
    
            artwork.reviews.push(newReview);
            await artwork.save();
    
            const user = await Users.findById(request.session.userId);
            if (user) {
                user.reviews.push(newReview);
                await user.save();
            }
    
            response.status(200).redirect(`http://localhost:3000/artwork/${artwork._id}`);
        } catch (error) {
            console.error('Error adding review:', error);
            response.status(500).send('Error adding review');
        }
    });
    

    app.delete('/review/:id', isAuthenticated, async (request, response) => {
        try {
            const reviewId = request.params.id;
            const review = await Review.findById(reviewId);
            if (!review) {
                return response.status(404).json({ message: 'Review not found' });
            }
    
            if (review.user.toString() !== request.session.userId) {
                return response.status(403).json({ message: 'Unauthorized' });
            }
    
            const galleryUpdateResult = await GalleryItem.updateOne(
                { _id: review.artwork }, 
                { $pull: { reviews: { _id: reviewId } } }
            );
            
    
            const userUpdateResult = await Users.updateOne(
                { _id: request.session.userId }, 
                { $pull: { reviews: reviewId } }
            );
    
            console.log('Gallery Update Result:', galleryUpdateResult);
            console.log('User Update Result:', userUpdateResult);
    
            await Review.deleteOne({ _id: reviewId });
    
            response.status(200).json({ message: 'Review deleted successfully'});
        } catch (error) {
            console.error('Error deleting review:', error);
            response.status(500).json({ message: 'Error deleting review' });
        }
    });

    
    app.get('/artist/:id', isAuthenticated, async (request, response) => {
        try {
            const artistId = request.params.id;
            const artist = await Users.findOne({ _id: artistId, accountType: 'Artist' });
            const artistArtworks = await GalleryItem.find({ Artist: artistId });
            const artistWorkshops = await Workshop.find({ Artist: artistId });
    
            response.render('artistProfile', {
                artist: artist,
                artistArtworks: artistArtworks,
                artistWorkshops: artistWorkshops,
            });
        } catch (error) {
            console.error('Error loading artist profile:', error);
            response.status(500).send('Error loading the artist profile page');
        }
    });

    app.post('/followArtist/:artistId', isAuthenticated, async (request, response) => {
        const userId = request.session.userId;
        const artistId = request.params.artistId;

        if (userId === artistId) {
            return response.status(400).json({ message: "You cannot follow yourself." });
        }
    
        try {
            const userUpdate = await Users.findByIdAndUpdate(userId, 
                { $addToSet: { followedArtists: artistId } },
                { new: true }
            );
    
            if (userUpdate) {
                response.status(200).json({ redirect: '/account-management' });
            } else {
                response.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            console.error('Error following artist:', error);
            response.status(500).json({ message: 'Error processing request' });
        }
    });

    app.post('/unfollowArtist/:artistId', isAuthenticated, async (request, response) => {
        const userId = request.session.userId;
        const artistId = request.params.artistId;
    
        try {
            const userUpdate = await Users.findByIdAndUpdate(userId, 
                { $pull: { followedArtists: artistId } },
                { new: true }
            );
    
            if (userUpdate) {
                response.status(200).json({ redirect: '/account-management' });
            } else {
                response.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            console.error('Error unfollowing artist:', error);
            response.status(500).json({ message: 'Error processing request' });
        }
    });

    app.get('/addArtwork', isAuthenticated, async (request, response) => {
        try {
            response.render('addArtwork');
        } catch (error) {
            console.error('Error rendering the add artwork page:', error);
            response.status(500).send('Internal Server Error');
        }
    });

    app.post('/addArtwork', isAuthenticated, async (request, response) => {
        try {
            const { title, year, category, medium, description, poster } = request.body;
            
            const existingArtwork = await GalleryItem.findOne({ Title: title });
            if (existingArtwork) {
                return response.status(400).send('Artwork with this title already exists.');
            }
            
            const artist = await Users.findById(request.session.userId);
            if (!artist) {
                return response.status(404).send('Artist not found.');
            }
            
            const newArtwork = new GalleryItem({
                Title: title,
                Artist: request.session.userId,
                Year: year,
                Category: category,
                Medium: medium,
                Description: description,
                Poster: poster
            });
            
            await newArtwork.save();
            
            await Users.findByIdAndUpdate(request.session.userId, { accountType: 'Artist' });
    
            const artistName = artist.username;
            const followers = await Users.find({ followedArtists: request.session.userId });
            followers.forEach(follower => {
                const notificationMessage = `New artwork added by ${artistName}`;
                const notificationLink = `/artwork/${newArtwork._id}`;

                //add notifications to all followers
                addNotification(follower._id, notificationMessage, notificationLink);
            });
            
            response.redirect('/account-management');
        } catch (error) {
            console.error('Error adding new artwork:', error);
            response.status(500).send('Error adding new artwork');
        }
    });    
    
    app.get('/addWorkshop', isAuthenticated, async (request, response) => {
        try {
            response.render('addWorkshop');
        } catch (error) {
            console.error('Error rendering the add artwork page:', error);
            response.status(500).send('Internal Server Error');
        }
    });

    app.post('/addWorkshop', isAuthenticated, async (request, response) => {
        try {
            const { title, description, date } = request.body;
            
            const user = await Users.findById(request.session.userId);
            if (user.accountType !== 'Artist') {
                return response.status(403).send('Only artists can add workshops.');
            }
    
            const existingWorkshop = await Workshop.findOne({ title: title });
            if (existingWorkshop) {
                return response.status(400).send('A workshop with this title already exists.');
            }
    
            const newWorkshop = new Workshop({
                Title: title,
                Artist: request.session.userId,
                Description: description,
                Date: date
            });
    
            await newWorkshop.save();
    
            const followers = await Users.find({ followedArtists: request.session.userId });
    
            followers.forEach(async (follower) => {
                const notificationMessage = `New workshop added by ${user.username}: "${title}"`;
                const notificationLink = `/workshop/${newWorkshop._id}`;
                
                // Add notification to all followers
                await addNotification(follower._id, notificationMessage, notificationLink);
            });
    
            response.redirect('/account-management');
        } catch (error) {
            console.error('Error adding new workshop:', error);
            response.status(500).send('Error adding new workshop');
        }
    });



    app.get('/workshop/:id', isAuthenticated, async (request, response) => {
        try {
            const workshopId = request.params.id;
            const workshopDetails = await Workshop.findById(workshopId)
                .populate('Artist')
                .populate({ path: 'enrolledUsers', select: 'username' });

            const enrolledUsers = workshopDetails.enrolledUsers.map(user => user.username);
    
            response.render('workshopDetails', {
                workshop: workshopDetails,
                enrolledUsers: enrolledUsers,
            });
        } catch (error) {
            console.error('Error loading workshop details:', error);
            response.status(500).send('Error loading the workshop page');
        }
    });
    
    app.post('/enrollWorkshop/:workshopId', isAuthenticated, async (request, response) => {
        try {
            const workshopId = request.params.workshopId;
            const userId = request.session.userId;
        
            const workshop = await Workshop.findById(workshopId);
    
            if (!workshop) {
                return response.status(404).json({ message: 'Workshop not found' });
            }
    
            if (workshop.Artist.equals(userId)) {
                return response.status(403).json({ message: "Cannot enroll in your own workshop!" });
            }
    
            const workshopUpdate = await Workshop.findByIdAndUpdate(
                workshopId,
                { $addToSet: { enrolledUsers: userId } },
                { new: true }
            );
    
            if (workshopUpdate) {
                response.status(200).json({ message: 'Enrolled successfully' });
            } else {
                response.status(404).json({ message: 'Workshop not found' });
            }
        } catch (error) {
            console.error('Error enrolling in workshop:', error);
            response.status(500).json({ message: 'Error processing enrollment' });
        }
    });
    
    async function addNotification(userId, message, link) {
        await Users.findByIdAndUpdate(userId, {
            $push: {
                notifications: {
                message: message,
                date: new Date(),
                link: link,
                seen: false
                }
            }
        });
    }
    
    app.listen(3000);
    console.log("Server listening at http://localhost:3000");

});
