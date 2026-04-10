const map = L.map("map").setView([33.8547, 35.8623], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const CAN_MANAGE_MARKERS = typeof canManageMarkers === "boolean" ? canManageMarkers : false;
const CAN_MANAGE_POLYGONS = typeof canManagePolygons === "boolean" ? canManagePolygons : false;
const USE_CLUSTERING = typeof useClustering === "boolean" ? useClustering : true;
const MARKER_TYPE_STYLES = typeof markerTypeStyles === "object" && markerTypeStyles ? markerTypeStyles : {};
const DEFAULT_MARKER_STYLE = {
    iconUrl: "/static/icons/default.svg",
    bgColor: "#ff0000",
    borderColor: "#ffff00",
    iconColor: "#ffffff"
};

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
const markerTypePicker = document.getElementById("marker-type-picker");
const markerTypePickerTrigger = document.getElementById("marker-type-picker-trigger");
const markerTypePickerLabel = document.getElementById("marker-type-picker-label");
const markerTypePickerBadge = document.getElementById("marker-type-picker-badge");
const markerTypePickerMenu = document.getElementById("marker-type-picker-menu");
const markerRegionInput = document.getElementById("marker-region-input");
const markerSourceInput = document.getElementById("marker-source-input");
const markerVisibleInput = document.getElementById("marker-visible-input");
const markerPositionLabel = document.getElementById("marker-position-label");
const markerPanelCloseButton = document.getElementById("marker-panel-close");

const polygonSaveForm = document.getElementById("polygon-save-form");
const polygonMapDataInput = document.getElementById("polygon-map-data");
const polygonNameInput = document.getElementById("polygon-name-input");
const polygonColorInput = document.getElementById("polygon-color-input");
const polygonDetailsPanel = document.getElementById("polygon-details-panel");
const polygonDetailsHint = document.getElementById("polygon-details-hint");
const polygonPanelCloseButton = document.getElementById("polygon-panel-close");

const markersById = {};
const createdMarkersByTempId = {};
const updatedMarkersById = {};
const deletedMarkerIds = new Set();

const createdPolygonsByTempId = {};
const updatedPolygonsById = {};
const deletedPolygonIds = new Set();

let markerLayer;
let activeMarker = null;
let selectedMarker = null;
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
