function upgradeAccount() {
    let xhr = new XMLHttpRequest();
    xhr.open('PUT', '/upgrade-account', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            const response = JSON.parse(this.responseText);
            if (response.success) {
                alert("Changed to Artist successfully");
                window.location.href = response.redirect;
            } else {
                window.location.href = response.redirect;
            }
        } else if (this.readyState === 4) {
            alert('Something went wrong. Please try again.');           
        }
    };
    xhr.send();
}

function downgradeAccount() {
    let xhr = new XMLHttpRequest();
    xhr.open('PUT', '/downgrade-account', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            const response = JSON.parse(this.responseText);
            alert("Changed to patron successfully");
            window.location.href = response.redirect;
        } else if (this.readyState === 4) {
            alert('Something went wrong. Please try again.');           
        }
    };
    xhr.send();
}

function unlikeArtwork(artworkId) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", `/unlike-artwork/${artworkId}`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
        const response = JSON.parse(this.responseText);
        if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
            alert(response.message);
            window.location.reload();
        } else if (this.readyState === 4) {
            alert(response.message);
        }
    };

    xhr.send(JSON.stringify({ artworkId: artworkId }));
}

function deleteReview(reviewId) {
    const xhr = new XMLHttpRequest();
    xhr.open('DELETE', `/review/${reviewId}`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
        const response = JSON.parse(this.responseText);

        if (xhr.readyState === 4 && xhr.status === 200) {
            alert(response.message);
            window.location.reload();
        } else if (xhr.readyState === 4) {
            alert(response.message);
        }
    };

    xhr.send();
}

function unfollowArtist(artistId) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/unfollowArtist/' + artistId);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        const response = JSON.parse(this.responseText);
        if (xhr.readyState === 4 && xhr.status === 200) {
            alert("Unfollowed successfully!");
            window.location.href = response.redirect;
        } else if (this.readyState === 4) {
            alert('Something went wrong. Please try again.');           
        }
    }
    xhr.send();
}