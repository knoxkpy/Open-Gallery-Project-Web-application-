function submitSignUp() {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', '/signup', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 201) {
            alert('Registered successfully!');
        } else if (this.readyState === 4 && this.status === 400) {
            alert('Something went wrong. Please try again.');           
        }
    };

    let data = {
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        AccountType: "Patrons"
    };

    xhr.send(JSON.stringify(data));
}