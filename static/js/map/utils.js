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

function normalizeHexColor(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }

    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
        return trimmed.toLowerCase();
    }

    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }

    return fallback;
}

function resolveMarkerStyle(type) {
    const normalized = normalizeMarkerType(type);
    const warningStyle = MARKER_TYPE_STYLES.warning || {};
    const style = MARKER_TYPE_STYLES[normalized] || warningStyle;

    return {
        iconUrl: typeof style.iconUrl === "string" && style.iconUrl.trim()
            ? style.iconUrl
            : DEFAULT_MARKER_STYLE.iconUrl,
        hasBackground: toBoolean(style.hasBackground, DEFAULT_MARKER_STYLE.hasBackground),
        bgColor: normalizeHexColor(style.bgColor, DEFAULT_MARKER_STYLE.bgColor),
        borderColor: normalizeHexColor(style.borderColor, DEFAULT_MARKER_STYLE.borderColor),
        iconColor: normalizeHexColor(style.iconColor, DEFAULT_MARKER_STYLE.iconColor)
    };
}
