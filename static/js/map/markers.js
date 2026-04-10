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

function getMarkerIcon(type, isSelected = false) {
    const style = resolveMarkerStyle(type);
    const encodedIconUrl = encodeURI(style.iconUrl);
    const html = `
        <span
            class="marker-badge${isSelected ? " marker-badge--active" : ""}"
            style="
                --marker-bg:${style.bgColor};
                --marker-border:${style.borderColor};
                --marker-icon-color:${style.iconColor};
                --marker-icon-url:url('${encodedIconUrl}');
            "
        ></span>
    `;

    return L.divIcon({
        className: "marker-pin",
        html: html.trim(),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
}

function updateMarkerIconSelectionState(marker) {
    if (!marker || !marker._data) {
        return;
    }

    marker.setIcon(getMarkerIcon(marker._data.marker_type, marker === selectedMarker));
}

function setSelectedMarker(marker) {
    if (selectedMarker === marker) {
        return;
    }

    const previousSelectedMarker = selectedMarker;
    selectedMarker = marker || null;

    if (previousSelectedMarker) {
        updateMarkerIconSelectionState(previousSelectedMarker);
    }

    if (selectedMarker) {
        updateMarkerIconSelectionState(selectedMarker);
    }
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
        card.style.display = selectedType === "all" || cardType === selectedType ? "" : "none";
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
        empty.className = "news-empty";
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
        ? `<p class="news-meta"><strong>Visible</strong><span>${markerData.is_visible ? "Yes" : "No"}</span></p>`
        : "";
    const descriptionLine = markerData.description
        ? `<p class="news-description">${escapeHtml(markerData.description)}</p>`
        : "";
    const sourceLine = markerData.source_url
        ? `<p class="news-source"><a href="${escapeHtml(markerData.source_url)}" target="_blank" rel="noopener noreferrer">Read source</a></p>`
        : "";

    card.innerHTML = `
        <h3>${escapeHtml(markerData.title)}</h3>
        <p class="news-meta"><strong>Type</strong><span>${escapeHtml(markerData.marker_type)}</span></p>
        <p class="news-meta"><strong>Region</strong><span>${escapeHtml(markerData.region_name || "Unknown")}</span></p>
        ${visibilityLine}
        ${descriptionLine}
        ${sourceLine}
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

function openPanel(panel) {
    if (!panel) {
        return;
    }
    panel.hidden = false;
    panel.classList.add("is-open");
}

function closePanel(panel) {
    if (!panel) {
        return;
    }
    panel.hidden = true;
    panel.classList.remove("is-open");
}

function showMarkerDetails(marker) {
    setSelectedMarker(marker);
    activeMarker = marker;

    closePanel(polygonSaveForm);

    openPanel(markerSaveForm);

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
        ensureMarkerTypeInputOption(marker._data.marker_type);
        markerTypeInput.value = marker._data.marker_type;
        syncMarkerTypePickerFromInput();
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
    setSelectedMarker(null);
    activeMarker = null;

    closePanel(markerSaveForm);
    closeMarkerTypePickerMenu();

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

function initializeMarkerTypePicker() {
    if (!markerTypeInput || !markerTypePicker || !markerTypePickerTrigger || !markerTypePickerMenu) {
        return;
    }

    if (markerTypePicker.dataset.initialized === "true") {
        return;
    }

    buildMarkerTypePickerOptions();
    syncMarkerTypePickerFromInput();

    markerTypeInput.addEventListener("change", syncMarkerTypePickerFromInput);
    markerTypePickerTrigger.addEventListener("click", () => {
        toggleMarkerTypePickerMenu();
    });

    markerTypePickerTrigger.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            openMarkerTypePickerMenu();
            return;
        }

        if (event.key === "Escape") {
            closeMarkerTypePickerMenu();
        }
    });

    markerTypePickerMenu.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeMarkerTypePickerMenu();
            markerTypePickerTrigger.focus();
        }
    });

    document.addEventListener("click", event => {
        if (!markerTypePicker.contains(event.target)) {
            closeMarkerTypePickerMenu();
        }
    });

    markerTypePicker.dataset.initialized = "true";
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
    updateMarkerIconSelectionState(marker);
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
    } else {
        marker.on("click", () => {
            setSelectedMarker(marker);
        });
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

    if (selectedMarker === marker) {
        setSelectedMarker(null);
    }

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

initializeMarkerTypePicker();

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
        markerTypeInput.addEventListener("change", applyMarkerFormToActiveMarker);
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

    if (markerPanelCloseButton) {
        markerPanelCloseButton.addEventListener("click", () => {
            hideMarkerDetails();
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

        setSelectedMarker(marker);
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
