const map = L.map("map").setView([33.8547, 35.8623], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const CAN_MANAGE_MARKERS = typeof canManageMarkers === "boolean" ? canManageMarkers : false;
const CAN_MANAGE_POLYGONS = typeof canManagePolygons === "boolean" ? canManagePolygons : false;
const USE_CLUSTERING = !CAN_MANAGE_MARKERS && (typeof useClustering === "boolean" ? useClustering : true);

const newsList = document.getElementById("news-list");
const typeFilter = document.getElementById("type-filter");

const markerSaveForm = document.getElementById("marker-save-form");
const markerMapDataInput = document.getElementById("marker-map-data");
const markerDeleteButton = document.getElementById("marker-delete-button");
const markerDetailsPanel = document.getElementById("marker-details-panel");
const markerDetailsHint = document.getElementById("marker-details-hint");
const markerTitleInput = document.getElementById("marker-title-input");
const markerDescriptionInput = document.getElementById("marker-description-input");
const markerTypeInput = document.getElementById("marker-type-input");
const markerRegionInput = document.getElementById("marker-region-input");
const markerSourceInput = document.getElementById("marker-source-input");
const markerVisibleInput = document.getElementById("marker-visible-input");
const markerPositionLabel = document.getElementById("marker-position-label");

const polygonSaveForm = document.getElementById("polygon-save-form");
const polygonMapDataInput = document.getElementById("polygon-map-data");
const polygonNameInput = document.getElementById("polygon-name-input");
const polygonColorInput = document.getElementById("polygon-color-input");
const polygonDetailsPanel = document.getElementById("polygon-details-panel");
const polygonDetailsHint = document.getElementById("polygon-details-hint");

const markersById = {};
const createdMarkersByTempId = {};
const updatedMarkersById = {};
const deletedMarkerIds = new Set();

const createdPolygonsByTempId = {};
const updatedPolygonsById = {};
const deletedPolygonIds = new Set();

let markerLayer;
let activeMarker = null;
let nextTempMarkerId = -1;

let activePolygonLayer = null;

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
            marker: CAN_MANAGE_MARKERS,
            polyline: false
        }
    });

    map.addControl(drawControl);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = true) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const lowered = value.trim().toLowerCase();
        if (lowered === "false" || lowered === "0" || lowered === "") {
            return false;
        }
        if (lowered === "true" || lowered === "1") {
            return true;
        }
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    if (value === null || typeof value === "undefined") {
        return fallback;
    }

    return Boolean(value);
}

function normalizeMarkerType(type) {
    if (typeof type !== "string") {
        return "warning";
    }

    const normalized = type.trim().toLowerCase();
    return normalized || "warning";
}

function normalizeMarkerData(rawData) {
    return {
        id: toNumber(rawData.id, nextTempMarkerId),
        title: String(rawData.title ?? "New marker").trim() || "New marker",
        description: String(rawData.description ?? ""),
        latitude: toNumber(rawData.latitude, 33.8547),
        longitude: toNumber(rawData.longitude, 35.8623),
        marker_type: normalizeMarkerType(rawData.marker_type),
        region_name: String(rawData.region_name ?? ""),
        source_url: String(rawData.source_url ?? ""),
        is_visible: toBoolean(rawData.is_visible, true)
    };
}

function getMarkerIcon(type) {
    const aliases = {
        airstrike: "rocket"
    };

    const normalized = normalizeMarkerType(type);
    const resolved = aliases[normalized] || normalized;
    const allowed = ["rocket", "fire", "warning", "protest", "drone", "bomb"];
    const iconName = allowed.includes(resolved) ? resolved : "default";

    return L.icon({
        iconUrl: `/static/icons/${iconName}.svg`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

function makeMarkerPopupContent(data) {
    const sourceLink = data.source_url
        ? `<p><a href="${escapeHtml(data.source_url)}" target="_blank" rel="noopener noreferrer">Read source</a></p>`
        : "";

    const visibility = CAN_MANAGE_MARKERS
        ? `<p><strong>Visible:</strong> ${data.is_visible ? "Yes" : "No"}</p>`
        : "";

    return `
        <div>
            <h3>${escapeHtml(data.title)}</h3>
            <p><strong>Type:</strong> ${escapeHtml(data.marker_type)}</p>
            <p><strong>Region:</strong> ${escapeHtml(data.region_name || "Unknown")}</p>
            ${visibility}
            <p>${escapeHtml(data.description || "")}</p>
            ${sourceLink}
        </div>
    `;
}

function ensureFilterOption(type) {
    if (!typeFilter) {
        return;
    }

    const value = normalizeMarkerType(type);
    const exists = Array.from(typeFilter.options).some(option => option.value === value);
    if (exists) {
        return;
    }

    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    typeFilter.appendChild(option);
}

function showMarker(marker) {
    if (USE_CLUSTERING) {
        if (!markerLayer.hasLayer(marker)) {
            markerLayer.addLayer(marker);
        }
        return;
    }

    if (!map.hasLayer(marker)) {
        marker.addTo(map);
    }
}

function hideMarker(marker) {
    if (USE_CLUSTERING) {
        if (markerLayer.hasLayer(marker)) {
            markerLayer.removeLayer(marker);
        }
        return;
    }

    if (map.hasLayer(marker)) {
        map.removeLayer(marker);
    }
}

function currentFilterType() {
    return typeFilter ? typeFilter.value : "all";
}

function markerMatchesCurrentFilter(marker) {
    const selectedType = currentFilterType();
    if (selectedType === "all") {
        return true;
    }

    return marker._data.marker_type === selectedType;
}

function applyTypeFilter() {
    const selectedType = currentFilterType();

    Object.values(markersById).forEach(marker => {
        const shouldShow = selectedType === "all"
            || marker._data.marker_type === selectedType
            || marker === activeMarker;

        if (shouldShow) {
            showMarker(marker);
        } else {
            hideMarker(marker);
        }
    });

    if (!newsList) {
        return;
    }

    newsList.querySelectorAll(".news-card").forEach(card => {
        const cardType = card.dataset.type;
        card.style.display = selectedType === "all" || cardType === selectedType ? "block" : "none";
    });
}

function ensureNewsListPlaceholderState() {
    if (!newsList) {
        return;
    }

    const cards = newsList.querySelectorAll(".news-card");
    const placeholders = Array.from(newsList.children).filter(node => node.tagName === "P");

    if (cards.length === 0 && placeholders.length === 0) {
        const empty = document.createElement("p");
        empty.dataset.empty = "true";
        empty.textContent = "No news available.";
        newsList.appendChild(empty);
    }

    if (cards.length > 0 && placeholders.length > 0) {
        placeholders.forEach(placeholder => {
            placeholder.remove();
        });
    }
}

function renderNewsCard(data) {
    if (!newsList) {
        return;
    }

    const markerData = normalizeMarkerData(data);
    let card = newsList.querySelector(`.news-card[data-id="${markerData.id}"]`);

    if (!card) {
        card = document.createElement("div");
        card.className = "news-card";
        newsList.prepend(card);
    }

    card.dataset.id = String(markerData.id);
    card.dataset.type = markerData.marker_type;

    const visibilityLine = CAN_MANAGE_MARKERS
        ? `<p><strong>Visible:</strong> ${markerData.is_visible ? "Yes" : "No"}</p>`
        : "";

    card.innerHTML = `
        <h3>${escapeHtml(markerData.title)}</h3>
        <p><strong>Type:</strong> ${escapeHtml(markerData.marker_type)}</p>
        <p><strong>Region:</strong> ${escapeHtml(markerData.region_name || "Unknown")}</p>
        ${visibilityLine}
        <p>${escapeHtml(markerData.description || "")}</p>
    `;

    ensureNewsListPlaceholderState();
}

function removeNewsCard(markerId) {
    if (!newsList) {
        return;
    }

    const card = newsList.querySelector(`.news-card[data-id="${markerId}"]`);
    if (card) {
        card.remove();
    }

    ensureNewsListPlaceholderState();
}

function updateMarkerPositionLabel(data) {
    if (!markerPositionLabel) {
        return;
    }

    markerPositionLabel.textContent = `Lat: ${Number(data.latitude).toFixed(6)} | Lng: ${Number(data.longitude).toFixed(6)}`;
}

function showMarkerDetails(marker) {
    activeMarker = marker;

    if (markerDetailsPanel) {
        markerDetailsPanel.hidden = false;
    }

    if (markerDetailsHint) {
        markerDetailsHint.hidden = true;
    }

    if (markerDeleteButton) {
        markerDeleteButton.hidden = false;
    }

    if (markerTitleInput) {
        markerTitleInput.value = marker._data.title;
    }

    if (markerDescriptionInput) {
        markerDescriptionInput.value = marker._data.description;
    }

    if (markerTypeInput) {
        markerTypeInput.value = marker._data.marker_type;
    }

    if (markerRegionInput) {
        markerRegionInput.value = marker._data.region_name;
    }

    if (markerSourceInput) {
        markerSourceInput.value = marker._data.source_url;
    }

    if (markerVisibleInput) {
        markerVisibleInput.checked = marker._data.is_visible;
    }

    updateMarkerPositionLabel(marker._data);
}

function hideMarkerDetails() {
    activeMarker = null;

    if (markerDetailsPanel) {
        markerDetailsPanel.hidden = true;
    }

    if (markerDetailsHint) {
        markerDetailsHint.hidden = false;
    }

    if (markerDeleteButton) {
        markerDeleteButton.hidden = true;
    }

    if (markerPositionLabel) {
        markerPositionLabel.textContent = "";
    }
}

function serializeMarkerData(data, includeId) {
    const payload = {
        title: data.title,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        marker_type: data.marker_type,
        region_name: data.region_name,
        source_url: data.source_url,
        is_visible: data.is_visible
    };

    if (includeId) {
        payload.id = data.id;
    }

    return payload;
}

function syncMarkerTracking(marker) {
    marker.setIcon(getMarkerIcon(marker._data.marker_type));
    marker.setPopupContent(makeMarkerPopupContent(marker._data));
    renderNewsCard(marker._data);
    ensureFilterOption(marker._data.marker_type);

    if (marker._data.id > 0) {
        updatedMarkersById[marker._data.id] = serializeMarkerData(marker._data, true);
    } else if (marker._tempId && createdMarkersByTempId[marker._tempId]) {
        createdMarkersByTempId[marker._tempId] = serializeMarkerData(marker._data, false);
    }

    if (activeMarker === marker) {
        updateMarkerPositionLabel(marker._data);
    }

    applyTypeFilter();
}

function attachManagedMarkerHandlers(marker) {
    marker.on("click", event => {
        if (event && event.originalEvent) {
            L.DomEvent.stop(event.originalEvent);
        }

        showMarkerDetails(marker);
        marker.openPopup();
    });

    marker.on("dragend", () => {
        const latLng = marker.getLatLng();
        marker._data.latitude = latLng.lat;
        marker._data.longitude = latLng.lng;
        syncMarkerTracking(marker);
    });
}

function createMarkerLayer(rawData) {
    const markerData = normalizeMarkerData(rawData);
    const marker = L.marker([markerData.latitude, markerData.longitude], {
        icon: getMarkerIcon(markerData.marker_type),
        draggable: CAN_MANAGE_MARKERS
    });

    marker._data = markerData;
    marker.bindPopup(makeMarkerPopupContent(markerData));

    if (CAN_MANAGE_MARKERS) {
        attachManagedMarkerHandlers(marker);
    }

    showMarker(marker);
    markersById[String(markerData.id)] = marker;
    ensureFilterOption(markerData.marker_type);

    return marker;
}

function buildNewMarkerDraft(latLng) {
    return {
        id: nextTempMarkerId--,
        title: markerTitleInput && markerTitleInput.value.trim() ? markerTitleInput.value.trim() : "New marker",
        description: markerDescriptionInput ? markerDescriptionInput.value : "",
        latitude: latLng.lat,
        longitude: latLng.lng,
        marker_type: markerTypeInput ? markerTypeInput.value : "warning",
        region_name: markerRegionInput ? markerRegionInput.value : "",
        source_url: markerSourceInput ? markerSourceInput.value : "",
        is_visible: markerVisibleInput ? markerVisibleInput.checked : true
    };
}

function deleteMarker(marker) {
    const markerId = marker._data.id;

    if (markerId > 0) {
        deletedMarkerIds.add(markerId);
        delete updatedMarkersById[markerId];
    } else if (marker._tempId) {
        delete createdMarkersByTempId[marker._tempId];
    }

    hideMarker(marker);
    delete markersById[String(markerId)];
    removeNewsCard(markerId);

    if (activeMarker === marker) {
        hideMarkerDetails();
    }
}

function applyMarkerFormToActiveMarker() {
    if (!activeMarker) {
        return;
    }

    activeMarker._data.title = markerTitleInput && markerTitleInput.value.trim()
        ? markerTitleInput.value.trim()
        : "New marker";
    activeMarker._data.description = markerDescriptionInput ? markerDescriptionInput.value : "";
    activeMarker._data.marker_type = markerTypeInput ? normalizeMarkerType(markerTypeInput.value) : "warning";
    activeMarker._data.region_name = markerRegionInput ? markerRegionInput.value : "";
    activeMarker._data.source_url = markerSourceInput ? markerSourceInput.value : "";
    activeMarker._data.is_visible = markerVisibleInput ? markerVisibleInput.checked : true;

    syncMarkerTracking(activeMarker);
}

if (Array.isArray(newsData)) {
    newsData.forEach(item => {
        createMarkerLayer(item);
    });
}

if (CAN_MANAGE_MARKERS) {
    if (markerDeleteButton) {
        markerDeleteButton.addEventListener("click", () => {
            if (!activeMarker) {
                return;
            }

            deleteMarker(activeMarker);
            applyTypeFilter();
        });
    }

    if (markerTitleInput) {
        markerTitleInput.addEventListener("input", applyMarkerFormToActiveMarker);
    }

    if (markerDescriptionInput) {
        markerDescriptionInput.addEventListener("input", applyMarkerFormToActiveMarker);
    }

    if (markerTypeInput) {
        markerTypeInput.addEventListener("input", applyMarkerFormToActiveMarker);
    }

    if (markerRegionInput) {
        markerRegionInput.addEventListener("input", applyMarkerFormToActiveMarker);
    }

    if (markerSourceInput) {
        markerSourceInput.addEventListener("input", applyMarkerFormToActiveMarker);
    }

    if (markerVisibleInput) {
        markerVisibleInput.addEventListener("change", applyMarkerFormToActiveMarker);
    }

    if (markerSaveForm && markerMapDataInput) {
        markerSaveForm.addEventListener("submit", () => {
            markerMapDataInput.value = JSON.stringify({
                created: Object.values(createdMarkersByTempId),
                updated: Object.values(updatedMarkersById),
                deleted: Array.from(deletedMarkerIds)
            });
        });
    }

    hideMarkerDetails();
}

if (newsList) {
    newsList.addEventListener("click", event => {
        const card = event.target.closest(".news-card");
        if (!card || card.style.display === "none") {
            return;
        }

        const marker = markersById[card.dataset.id];
        if (!marker) {
            return;
        }

        map.setView(marker.getLatLng(), 10);
        marker.openPopup();

        if (CAN_MANAGE_MARKERS) {
            showMarkerDetails(marker);
        }
    });
}

if (typeFilter) {
    typeFilter.addEventListener("change", () => {
        applyTypeFilter();
    });
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

if (Array.isArray(polygons)) {
    polygons.forEach(polygon => {
        const layer = L.polygon(polygon.coordinates, {
            color: polygon.color,
            fillOpacity: 0.3
        });

        layer.bindPopup(`<strong>${escapeHtml(polygon.name)}</strong>`);

        if (drawnItems) {
            layer._id = polygon.id;
            layer._name = polygon.name;
            layer._color = polygon.color;
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

        if (event.layerType === "marker" && CAN_MANAGE_MARKERS) {
            const markerData = normalizeMarkerData(buildNewMarkerDraft(layer.getLatLng()));

            layer._data = markerData;
            layer.setIcon(getMarkerIcon(markerData.marker_type));
            layer.bindPopup(makeMarkerPopupContent(markerData));

            if (layer.dragging) {
                layer.dragging.enable();
            }

            attachManagedMarkerHandlers(layer);
            showMarker(layer);

            const tempId = `tmp-${L.Util.stamp(layer)}`;
            layer._tempId = tempId;
            markersById[String(markerData.id)] = layer;
            createdMarkersByTempId[tempId] = serializeMarkerData(markerData, false);

            ensureFilterOption(markerData.marker_type);
            renderNewsCard(markerData);
            showMarkerDetails(layer);
            layer.openPopup();
            applyTypeFilter();
            return;
        }

        const coordinates = extractPolygonCoordinates(layer);

        if (!coordinates) {
            alert("Only polygon shapes are supported.");
            return;
        }

        layer._name = getFormPolygonName();
        layer._color = getFormPolygonColor();
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
        let removedActiveLayer = false;

        event.layers.eachLayer(layer => {
            if (activePolygonLayer === layer) {
                removedActiveLayer = true;
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

        if (removedActiveLayer) {
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
            polygonMapDataInput.value = JSON.stringify({
                created: Object.values(createdPolygonsByTempId),
                updated: Object.values(updatedPolygonsById),
                deleted: Array.from(deletedPolygonIds)
            });
        });
    }
}

applyTypeFilter();
