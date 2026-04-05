const map = L.map('admin-markers-map').setView([33.8547, 35.8623], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function getMarkerIcon(type) {
    const iconMap = {
        airstrike: "rocket",
        fire: "fire",
        warning: "warning",
        protest: "protest"
    };

    const iconName = iconMap[type] || "default";

    return L.icon({
        iconUrl: `/static/icons/${iconName}.svg`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

const created = [];
const updated = [];
const deleted = [];
const markersById = {};
let tempId = -1;

// Existing markers
markersData.forEach(item => {
    const marker = L.marker([item.latitude, item.longitude], {
        draggable: true,
        icon: getMarkerIcon(item.marker_type)
    }).addTo(map);

    marker._data = { ...item };

    marker.bindPopup(makePopupContent(marker._data));

    marker.on("dragend", () => {
        const latLng = marker.getLatLng();
        marker._data.latitude = latLng.lat;
        marker._data.longitude = latLng.lng;

        if (marker._data.id > 0) {
            upsertUpdated(marker._data);
        } else {
            updateCreated(marker._data);
        }
    });

    marker.on("click", () => {
        editMarkerData(marker);
    });

    markersById[item.id] = marker;
});

// Add new marker on map click
map.on("click", function (e) {
    const newData = {
        id: tempId--,
        title: "New marker",
        description: "",
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
        marker_type: "warning",
        region_name: "",
        source_url: "",
        is_visible: true
    };

    const marker = L.marker([newData.latitude, newData.longitude], {
        draggable: true,
        icon: getMarkerIcon(newData.marker_type)
    }).addTo(map);

    marker._data = newData;
    marker.bindPopup(makePopupContent(marker._data));

    marker.on("dragend", () => {
        const latLng = marker.getLatLng();
        marker._data.latitude = latLng.lat;
        marker._data.longitude = latLng.lng;
        updateCreated(marker._data);
    });

    marker.on("click", () => {
        editMarkerData(marker);
    });

    markersById[newData.id] = marker;
    created.push({ ...newData });
});

function makePopupContent(data) {
    return `
        <div>
            <h3>${data.title}</h3>
            <p><strong>Type:</strong> ${data.marker_type}</p>
            <p><strong>Region:</strong> ${data.region_name || "Unknown"}</p>
            <p>${data.description || ""}</p>
            <button onclick="deleteMarkerById(${data.id})">Delete</button>
        </div>
    `;
}

function editMarkerData(marker) {
    const data = marker._data;

    const title = prompt("Title:", data.title);
    if (title === null) return;

    const description = prompt("Description:", data.description);
    if (description === null) return;

    const markerType = prompt("Marker type (airstrike, fire, warning, protest):", data.marker_type);
    if (markerType === null) return;

    const regionName = prompt("Region name:", data.region_name || "");
    if (regionName === null) return;

    const sourceUrl = prompt("Source URL:", data.source_url || "");
    if (sourceUrl === null) return;

    data.title = title;
    data.description = description;
    data.marker_type = markerType;
    data.region_name = regionName;
    data.source_url = sourceUrl;

    marker.setIcon(getMarkerIcon(data.marker_type));
    marker.setPopupContent(makePopupContent(data));

    if (data.id > 0) {
        upsertUpdated(data);
    } else {
        updateCreated(data);
    }
}

function deleteMarkerById(id) {
    const marker = markersById[id];
    if (!marker) return;

    map.removeLayer(marker);

    if (id > 0) {
        if (!deleted.includes(id)) {
            deleted.push(id);
        }
    } else {
        const index = created.findIndex(item => item.id === id);
        if (index !== -1) {
            created.splice(index, 1);
        }
    }

    delete markersById[id];
}

function upsertUpdated(data) {
    const index = updated.findIndex(item => item.id === data.id);
    if (index !== -1) {
        updated[index] = { ...data };
    } else {
        updated.push({ ...data });
    }
}

function updateCreated(data) {
    const index = created.findIndex(item => item.id === data.id);
    if (index !== -1) {
        created[index] = { ...data };
    }
}

document.getElementById("save-form").addEventListener("submit", function () {
    document.getElementById("map-data").value = JSON.stringify({
        created: created,
        updated: updated,
        deleted: deleted
    });
});