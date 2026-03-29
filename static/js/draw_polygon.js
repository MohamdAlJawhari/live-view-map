const drawMap = L.map('draw-map').setView([33.8547, 35.8623], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(drawMap);

const drawnItems = new L.FeatureGroup();
drawMap.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems,
        edit: false,
        remove: false
    },
    draw: {
        polygon: true,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false
    }
});

drawMap.addControl(drawControl);

const coordinatesField = document.getElementById("coordinates");

drawMap.on(L.Draw.Event.CREATED, function (event) {
    drawnItems.clearLayers(); // allow only one polygon
    const layer = event.layer;
    drawnItems.addLayer(layer);

    const latLngs = layer.getLatLngs()[0];
    const coordinates = latLngs.map(point => [point.lat, point.lng]);

    coordinatesField.value = JSON.stringify(coordinates);
});