function ensureMarkerTypeInputOption(type) {
    if (!markerTypeInput || !markerTypeInput.options) {
        return;
    }

    const value = normalizeMarkerType(type);
    const exists = Array.from(markerTypeInput.options).some(option => option.value === value);
    if (exists) {
        return;
    }

    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    markerTypeInput.appendChild(option);
    buildMarkerTypePickerOptions();
    syncMarkerTypePickerFromInput();
}

function humanizeMarkerType(value) {
    const normalized = normalizeMarkerType(value);
    if (!normalized) {
        return "Warning";
    }

    return normalized
        .split("-")
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getMarkerTypeOptionLabel(value) {
    if (!markerTypeInput || !markerTypeInput.options) {
        return humanizeMarkerType(value);
    }

    const normalized = normalizeMarkerType(value);
    const matched = Array.from(markerTypeInput.options).find(
        option => normalizeMarkerType(option.value) === normalized
    );

    if (!matched || !matched.textContent) {
        return humanizeMarkerType(normalized);
    }

    const text = matched.textContent.trim();
    return text || humanizeMarkerType(normalized);
}

function applyBadgeStyle(element, markerType) {
    if (!element) {
        return;
    }

    const style = resolveMarkerStyle(markerType);
    const encodedIconUrl = encodeURI(style.iconUrl);

    element.style.setProperty("--marker-bg", style.bgColor);
    element.style.setProperty("--marker-border", style.borderColor);
    element.style.setProperty("--marker-icon-color", style.iconColor);
    element.style.setProperty("--marker-icon-url", `url('${encodedIconUrl}')`);
}

function updateMarkerTypePickerSelectionState() {
    if (!markerTypePickerMenu) {
        return;
    }

    const selectedValue = normalizeMarkerType(markerTypeInput ? markerTypeInput.value : "warning");
    markerTypePickerMenu.querySelectorAll(".marker-type-picker__option").forEach(option => {
        option.setAttribute("aria-selected", option.dataset.value === selectedValue ? "true" : "false");
    });
}

function syncMarkerTypePickerFromInput() {
    if (!markerTypeInput || !markerTypePickerTrigger || !markerTypePickerLabel || !markerTypePickerBadge) {
        return;
    }

    const selectedValue = normalizeMarkerType(markerTypeInput.value || "warning");
    markerTypePickerLabel.textContent = getMarkerTypeOptionLabel(selectedValue);
    applyBadgeStyle(markerTypePickerBadge, selectedValue);
    updateMarkerTypePickerSelectionState();
}

function closeMarkerTypePickerMenu() {
    if (!markerTypePickerMenu || !markerTypePickerTrigger) {
        return;
    }

    markerTypePickerMenu.hidden = true;
    markerTypePickerTrigger.setAttribute("aria-expanded", "false");
}

function openMarkerTypePickerMenu() {
    if (!markerTypePickerMenu || !markerTypePickerTrigger) {
        return;
    }

    buildMarkerTypePickerOptions();
    markerTypePickerMenu.hidden = false;
    markerTypePickerTrigger.setAttribute("aria-expanded", "true");
}

function toggleMarkerTypePickerMenu() {
    if (!markerTypePickerMenu || !markerTypePickerTrigger) {
        return;
    }

    if (markerTypePickerMenu.hidden) {
        openMarkerTypePickerMenu();
        return;
    }

    closeMarkerTypePickerMenu();
}

function setMarkerTypeValue(value, dispatchChange = true) {
    if (!markerTypeInput) {
        return;
    }

    const normalized = normalizeMarkerType(value);
    ensureMarkerTypeInputOption(normalized);
    markerTypeInput.value = normalized;
    syncMarkerTypePickerFromInput();

    if (dispatchChange) {
        markerTypeInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
}

function buildMarkerTypePickerOptions() {
    if (!markerTypeInput || !markerTypePickerMenu) {
        return;
    }

    markerTypePickerMenu.innerHTML = "";

    const seen = new Set();
    Array.from(markerTypeInput.options).forEach(option => {
        const value = normalizeMarkerType(option.value);
        if (!value || seen.has(value)) {
            return;
        }
        seen.add(value);

        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "marker-type-picker__option";
        optionButton.setAttribute("role", "option");
        optionButton.dataset.value = value;

        const badge = document.createElement("span");
        badge.className = "marker-badge marker-badge--tiny marker-type-picker__option-badge";
        badge.setAttribute("aria-hidden", "true");
        applyBadgeStyle(badge, value);

        const label = document.createElement("span");
        label.className = "marker-type-picker__option-label";
        label.textContent = option.textContent ? option.textContent.trim() : humanizeMarkerType(value);

        optionButton.appendChild(badge);
        optionButton.appendChild(label);
        optionButton.addEventListener("click", () => {
            setMarkerTypeValue(value, true);
            closeMarkerTypePickerMenu();
        });

        markerTypePickerMenu.appendChild(optionButton);
    });

    updateMarkerTypePickerSelectionState();
}
