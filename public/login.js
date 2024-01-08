function login() {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', '/login', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (this.readyState === XMLHttpRequest.DONE) {
            const response = JSON.parse(this.responseText);
            
            if (this.status === 200 && response.success) {
                window.location.href = response.redirect;
            } else {
                alert(response.message || 'An error occurred.');
            }
        }
    };

    let data = {
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
    };

    xhr.send(JSON.stringify(data));
}
