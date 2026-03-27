const map = L.map('map').setView([33.8547, 35.8623], 9); // Lebanon center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Store markers by news id
const markersById = {};

// Add markers from database
if (typeof newsData !== "undefined" && Array.isArray(newsData)) {
    newsData.forEach(item => {
        const marker = L.marker([item.latitude, item.longitude]).addTo(map);

        marker.bindPopup(`
            <div>
                <h3>${item.title}</h3>
                <p><strong>Type:</strong> ${item.marker_type}</p>
                <p><strong>Region:</strong> ${item.region_name || "Unknown"}</p>
                <p>${item.description}</p>
                ${
                    item.source_url
                        ? `<p><a href="${item.source_url}" target="_blank">Read source</a></p>`
                        : ""
                }
            </div>
        `);

        markersById[item.id] = marker;
    });
}

// Make sidebar cards clickable
const newsCards = document.querySelectorAll(".news-card");

newsCards.forEach(card => {
    card.addEventListener("click", () => {
        const newsId = card.dataset.id;
        const marker = markersById[newsId];

        if (marker) {
            map.setView(marker.getLatLng(), 10);
            marker.openPopup();
        }
    });
});