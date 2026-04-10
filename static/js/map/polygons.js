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

    closePanel(markerSaveForm);

    openPanel(polygonSaveForm);

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

    closePanel(polygonSaveForm);

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

    if (polygonPanelCloseButton) {
        polygonPanelCloseButton.addEventListener("click", () => {
            hidePolygonDetails();
        });
    }

    hidePolygonDetails();
}

applyTypeFilter();
