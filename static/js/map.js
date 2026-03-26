const map = L.map('map').setView([33.8547, 35.8623], 9); // Lebanon center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);