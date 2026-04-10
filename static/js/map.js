// Backward-compatible loader.
// The map implementation was split into feature files under /static/js/map/.
(function bootstrapSplitMapScripts() {
    if (window.__liveMapSplitLoaded) {
        return;
    }

    window.__liveMapSplitLoaded = true;

    const scriptNames = [
        "state.js",
        "utils.js",
        "marker_type_picker.js",
        "markers.js",
        "polygons.js"
    ];

    const current = document.currentScript;
    const fallbackBase = "/static/js/map/";
    const base = current && current.src
        ? current.src.replace(/map\.js(?:\?.*)?$/, "map/")
        : fallbackBase;

    function loadAt(index) {
        if (index >= scriptNames.length) {
            return;
        }

        const script = document.createElement("script");
        script.src = `${base}${scriptNames[index]}`;
        script.defer = false;
        script.onload = () => loadAt(index + 1);
        script.onerror = () => {
            // Keep behavior predictable if one split file cannot load.
            console.error("Failed to load map script:", script.src);
        };
        document.head.appendChild(script);
    }

    loadAt(0);
})();
