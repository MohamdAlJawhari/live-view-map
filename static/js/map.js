const map = L.map("map").setView([33.8547, 35.8623], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const USE_CLUSTERING = typeof useClustering === "boolean" ? useClustering : true;
const CAN_MANAGE_POLYGONS = typeof canManagePolygons === "boolean" ? canManagePolygons : false;

const markersById = {};
const newsCards = document.querySelectorAll(".news-card");
const typeFilter = document.getElementById("type-filter");
const polygonSaveForm = document.getElementById("polygon-save-form");
const polygonMapDataInput = document.getElementById("polygon-map-data");
const polygonNameInput = document.getElementById("polygon-name-input");
const polygonColorInput = document.getElementById("polygon-color-input");
const polygonDetailsPanel = document.getElementById("polygon-details-panel");
const polygonDetailsHint = document.getElementById("polygon-details-hint");

const createdPolygonsByTempId = {};
const updatedPolygonsById = {};
const deletedPolygonIds = new Set();
let activePolygonLayer = null;

let markerLayer;

if (USE_CLUSTERING) {
    markerLayer = L.markerClusterGroup();
    map.addLayer(markerLayer);
} else {
    markerLayer = map;
}

const drawnItems = CAN_MANAGE_POLYGONS ? new L.FeatureGroup() : null;
if (drawnItems) {
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: true,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        }
    });

    map.addControl(drawControl);
}

function extractPolygonCoordinates(layer) {
    if (typeof layer.getLatLngs !== "function") {
        return null;
    }

    const latLngs = layer.getLatLngs();
    if (!Array.isArray(latLngs) || latLngs.length === 0 || !Array.isArray(latLngs[0])) {
        return null;
    }

    return latLngs[0].map(point => [point.lat, point.lng]);
}

function normalizeColorForPicker(colorValue) {
    if (typeof colorValue !== "string") {
        return "#ff0000";
    }

    const trimmed = colorValue.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
        return trimmed.toLowerCase();
    }

    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }

    const probe = document.createElement("span");
    probe.style.color = trimmed;
    if (!probe.style.color) {
        return "#ff0000";
    }
    probe.style.display = "none";
    document.body.appendChild(probe);
    const computedColor = window.getComputedStyle(probe).color;
    document.body.removeChild(probe);

    const rgbMatch = computedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!rgbMatch) {
        return "#ff0000";
    }

    const red = Number(rgbMatch[1]).toString(16).padStart(2, "0");
    const green = Number(rgbMatch[2]).toString(16).padStart(2, "0");
    const blue = Number(rgbMatch[3]).toString(16).padStart(2, "0");
    return `#${red}${green}${blue}`;
}

function getFormPolygonName() {
    if (!polygonNameInput || !polygonNameInput.value.trim()) {
        return "New Polygon";
    }
    return polygonNameInput.value.trim();
}

function getFormPolygonColor() {
    if (!polygonColorInput || !polygonColorInput.value) {
        return "#ff0000";
    }
    return normalizeColorForPicker(polygonColorInput.value);
}

function applyPolygonPresentation(layer) {
    layer.setStyle({
        color: layer._color,
        fillOpacity: 0.3
    });
    layer.bindPopup(`<strong>${layer._name}</strong>`);
}

function showPolygonDetails(layer) {
    activePolygonLayer = layer;

    if (polygonDetailsPanel) {
        polygonDetailsPanel.hidden = false;
    }
    if (polygonDetailsHint) {
        polygonDetailsHint.hidden = true;
    }
    if (polygonNameInput) {
        polygonNameInput.value = layer._name || "New Polygon";
    }
    if (polygonColorInput) {
        polygonColorInput.value = normalizeColorForPicker(layer._color);
    }
}

function hidePolygonDetails() {
    activePolygonLayer = null;
    if (polygonDetailsPanel) {
        polygonDetailsPanel.hidden = true;
    }
    if (polygonDetailsHint) {
        polygonDetailsHint.hidden = false;
    }
}

function syncPolygonLayerData(layer) {
    const coordinates = extractPolygonCoordinates(layer);
    if (!coordinates) {
        return;
    }

    if (layer._tempId && createdPolygonsByTempId[layer._tempId]) {
        createdPolygonsByTempId[layer._tempId].name = layer._name;
        createdPolygonsByTempId[layer._tempId].color = layer._color;
        createdPolygonsByTempId[layer._tempId].coordinates = coordinates;
        return;
    }

    if (layer._id) {
        updatedPolygonsById[layer._id] = {
            id: layer._id,
            name: layer._name,
            color: layer._color,
            coordinates: coordinates
        };
    }
}

function attachPolygonLayerHandlers(layer) {
    layer.on("click", () => {
        showPolygonDetails(layer);
    });
}

if (typeof newsData !== "undefined" && Array.isArray(newsData)) {
    newsData.forEach(item => {
        const marker = L.marker([item.latitude, item.longitude], {
            icon: getMarkerIcon(item.marker_type)
        });

        marker.bindPopup(`
            <div>
                <h3>${item.title}</h3>
                <p><strong>Type:</strong> ${item.marker_type}</p>
                <p><strong>Region:</strong> ${item.region_name || "Unknown"}</p>
                <p>${item.description}</p>
                ${item.source_url
                ? `<p><a href="${item.source_url}" target="_blank">Read source</a></p>`
                : ""}
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

if (typeof polygons !== "undefined" && Array.isArray(polygons)) {
    polygons.forEach(p => {
        const layer = L.polygon(p.coordinates, {
            color: p.color,
            fillOpacity: 0.3
        });

        layer.bindPopup(`<strong>${p.name}</strong>`);

        if (drawnItems) {
            layer._id = p.id;
            layer._name = p.name;
            layer._color = p.color;
            drawnItems.addLayer(layer);
            attachPolygonLayerHandlers(layer);
        } else {
            layer.addTo(map);
        }
    });
}

if (drawnItems) {
    map.on(L.Draw.Event.CREATED, event => {
        const layer = event.layer;
        const coordinates = extractPolygonCoordinates(layer);

        if (!coordinates) {
            alert("Only polygon shapes are supported.");
            return;
        }

        const nameValue = getFormPolygonName();
        const colorValue = getFormPolygonColor();

        layer._name = nameValue;
        layer._color = colorValue;
        applyPolygonPresentation(layer);

        drawnItems.addLayer(layer);
        attachPolygonLayerHandlers(layer);

        const tempId = `tmp-${L.Util.stamp(layer)}`;
        layer._tempId = tempId;
        createdPolygonsByTempId[tempId] = {
            name: layer._name,
            color: layer._color,
            coordinates: coordinates
        };

        showPolygonDetails(layer);
    });

    map.on(L.Draw.Event.EDITED, event => {
        event.layers.eachLayer(layer => {
            syncPolygonLayerData(layer);
        });
    });

    map.on(L.Draw.Event.DELETED, event => {
        let deletedActiveLayer = false;

        event.layers.eachLayer(layer => {
            if (activePolygonLayer === layer) {
                deletedActiveLayer = true;
            }

            if (layer._id) {
                deletedPolygonIds.add(layer._id);
                delete updatedPolygonsById[layer._id];
                return;
            }

            if (layer._tempId && createdPolygonsByTempId[layer._tempId]) {
                delete createdPolygonsByTempId[layer._tempId];
            }
        });

        if (deletedActiveLayer) {
            hidePolygonDetails();
        }
    });

    if (polygonNameInput) {
        polygonNameInput.addEventListener("input", () => {
            if (!activePolygonLayer) {
                return;
            }

            activePolygonLayer._name = getFormPolygonName();
            applyPolygonPresentation(activePolygonLayer);
            syncPolygonLayerData(activePolygonLayer);
        });
    }

    if (polygonColorInput) {
        polygonColorInput.addEventListener("input", () => {
            if (!activePolygonLayer) {
                return;
            }

            activePolygonLayer._color = getFormPolygonColor();
            applyPolygonPresentation(activePolygonLayer);
            syncPolygonLayerData(activePolygonLayer);
        });
    }

    if (polygonSaveForm && polygonMapDataInput) {
        polygonSaveForm.addEventListener("submit", () => {
            const payload = {
                created: Object.values(createdPolygonsByTempId),
                updated: Object.values(updatedPolygonsById),
                deleted: Array.from(deletedPolygonIds)
            };

            polygonMapDataInput.value = JSON.stringify(payload);
        });
    }
}

newsCards.forEach(card => {
    card.addEventListener("click", () => {
        if (card.style.display === "none") {
            return;
        }

        const newsId = card.dataset.id;
        const markerEntry = markersById[newsId];

        if (markerEntry) {
            map.setView(markerEntry.marker.getLatLng(), 10);
            markerEntry.marker.openPopup();
        }
    });
});

if (typeFilter) {
    typeFilter.addEventListener("change", () => {
        const selectedType = typeFilter.value;

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

        newsCards.forEach(card => {
            const cardType = card.dataset.type;
            card.style.display = selectedType === "all" || cardType === selectedType ? "block" : "none";
        });
    });
}

function getMarkerIcon(type) {
    const allowedTypes = ["rocket", "fire", "warning", "protest", "rocket", "drone", "bomb"];
    const iconName = allowedTypes.includes(type) ? type : "default";

    return L.icon({
        iconUrl: `/static/icons/${iconName}.svg`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}
