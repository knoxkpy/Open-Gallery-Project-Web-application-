function followArtist(artistId) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/followArtist/' + artistId);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        const response = JSON.parse(this.responseText);
        if (xhr.readyState === 4 && xhr.status === 200) {
            alert("Followed successfully!");
            window.location.href = response.redirect;
        } else if (this.readyState === 4) {
            alert(response.message);           
        }
    }
    xhr.send();

}

function enrollWorkshop(workshopId) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/enrollWorkshop/${workshopId}`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
        const response = JSON.parse(this.responseText);
        if (xhr.readyState === 4 && xhr.status === 200) {
            alert(response.message);
        } else {
            alert(response.message);
        }
    };
    xhr.send();
}