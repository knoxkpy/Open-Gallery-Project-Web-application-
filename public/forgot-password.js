function submitConfirmation() {
    const email = document.getElementById('Email').value;

    if ((!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}$/.test(email))) {
        alert('Invalid email!');
        return;
    }

    alert('An confirmation has been sent to your email. Please follow the instruction to recover your password!');
}