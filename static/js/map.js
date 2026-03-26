document.addEventListener("DOMContentLoaded", () => {
    const status = document.getElementById("map-status");

    if (typeof L === "undefined") {
        status.textContent = "Leaflet failed to load.";
        return;
    }

    const map = L.map("map", {
        zoomControl: true,
    }).setView([33.8938, 35.5018], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([33.8938, 35.5018]).addTo(map);
    marker.bindPopup("Default tracked location").openPopup();

    status.textContent = "Map loaded and ready for live updates.";
});
