const editMap = L.map('edit-map').setView([33.8547, 35.8623], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(editMap);

const drawnItems = new L.FeatureGroup();
editMap.addLayer(drawnItems);

const polygonLayer = L.polygon(polygonData.coordinates, {
    color: polygonData.color,
    fillOpacity: 0.3
});

drawnItems.addLayer(polygonLayer);
editMap.fitBounds(polygonLayer.getBounds());

const drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems,
        edit: true,
        remove: false
    },
    draw: {
        polygon: false,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false
    }
});

editMap.addControl(drawControl);

const coordinatesField = document.getElementById("coordinates");

// Update coordinates when polygon is edited
editMap.on(L.Draw.Event.EDITED, function (event) {
    event.layers.eachLayer(function (layer) {
        const latLngs = layer.getLatLngs()[0];
        const coordinates = latLngs.map(point => [point.lat, point.lng]);
        coordinatesField.value = JSON.stringify(coordinates);
    });
});