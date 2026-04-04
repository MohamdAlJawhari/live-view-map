const map = L.map('admin-map').setView([33.8547, 35.8623], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Track changes
const created = [];
const updated = [];
const deleted = [];

// Load existing polygons
polygons.forEach(p => {
    const layer = L.polygon(p.coordinates, {
        color: p.color,
        fillOpacity: 0.3
    });

    layer._id = p.id; // store DB id
    layer._name = p.name;
    layer._color = p.color;

    drawnItems.addLayer(layer);
});

// Draw control
const drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems
    },
    draw: {
        polygon: true,
        rectangle: false,
        circle: false,
        marker: false,
        polyline: false
    }
});
map.addControl(drawControl);

// CREATE
map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;

    layer._name = prompt("Polygon name:", "New Polygon");
    layer._color = prompt("Color:", "red");

    drawnItems.addLayer(layer);

    const coords = layer.getLatLngs()[0].map(p => [p.lat, p.lng]);

    created.push({
        name: layer._name,
        color: layer._color,
        coordinates: coords
    });
});

// EDIT
map.on(L.Draw.Event.EDITED, function (e) {
    e.layers.eachLayer(layer => {
        const coords = layer.getLatLngs()[0].map(p => [p.lat, p.lng]);

        if (layer._id) {
            updated.push({
                id: layer._id,
                name: layer._name,
                color: layer._color,
                coordinates: coords
            });
        }
    });
});

// DELETE
map.on(L.Draw.Event.DELETED, function (e) {
    e.layers.eachLayer(layer => {
        if (layer._id) {
            deleted.push(layer._id);
        }
    });
});

// SAVE
document.getElementById("save-form").addEventListener("submit", function () {
    const data = {
        created: created,
        updated: updated,
        deleted: deleted
    };

    document.getElementById("map-data").value = JSON.stringify(data);
});