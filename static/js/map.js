const map = L.map('map').setView([33.8547, 35.8623], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const USE_CLUSTERING = true; // change to true or false
const markersById = {};
const newsCards = document.querySelectorAll(".news-card");
const typeFilter = document.getElementById("type-filter");

// Create one marker layer only
let markerLayer;

if (USE_CLUSTERING) {
    markerLayer = L.markerClusterGroup();
    map.addLayer(markerLayer);
} else {
    markerLayer = map;
}

// Add markers from database
if (typeof newsData !== "undefined" && Array.isArray(newsData)) {
    newsData.forEach(item => {
        const marker = L.marker([item.latitude, item.longitude]);

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

        if (USE_CLUSTERING) {
            markerLayer.addLayer(marker);
        } else {
            marker.addTo(map);
        }

        markersById[item.id] = {
            marker: marker,
            type: item.marker_type
        };
    });
}

// Make sidebar cards clickable
newsCards.forEach(card => {
    card.addEventListener("click", () => {
        if (card.style.display === "none") return;

        const newsId = card.dataset.id;
        const markerEntry = markersById[newsId];

        if (markerEntry) {
            map.setView(markerEntry.marker.getLatLng(), 10);
            markerEntry.marker.openPopup();
        }
    });
});

// Filter logic
if (typeFilter) {
    typeFilter.addEventListener("change", () => {
        const selectedType = typeFilter.value;

        // Show/hide markers
        Object.keys(markersById).forEach(id => {
            const markerEntry = markersById[id];

            if (selectedType === "all" || markerEntry.type === selectedType) {
                if (USE_CLUSTERING) {
                    markerLayer.addLayer(markerEntry.marker);
                } else {
                    markerEntry.marker.addTo(map);
                }
            } else {
                if (USE_CLUSTERING) {
                    markerLayer.removeLayer(markerEntry.marker);
                } else {
                    map.removeLayer(markerEntry.marker);
                }
            }
        });

        // Show/hide sidebar cards
        newsCards.forEach(card => {
            const cardType = card.dataset.type;

            if (selectedType === "all" || cardType === selectedType) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }
        });
    });
}