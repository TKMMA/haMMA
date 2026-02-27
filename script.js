const allIslandLayers = {};
const SERVICE_LAYER_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandDisplayOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kahoʻolawe"];

let activeSelectionMarker = null;
let activeAccordionLayer = null;
let activeHoverLayer = null;
let hasEverSelected = false;
let activeAreaSelection = null;
let mobileInfoHideTimer = null;

// Cache DOM elements
const paneStageEl = document.getElementById("pane-stage");
const mapSidebarEl = document.getElementById("map-sidebar");
const infoSidebarEl = document.getElementById("info-sidebar");
const mobileMediaQuery = window.matchMedia("(max-width: 768px)");

const isMobileView = () => mobileMediaQuery.matches;

/**
 * --- APP STATE CONTROLLER ---
 * One function to rule them all. Prevents race conditions.
 */
function setMobileAppView(view) {
    if (!isMobileView() || !paneStageEl) return;

    // View = 'list', 'info', or 'minimized'
    if (view === 'info') {
        paneStageEl.classList.remove("is-minimized");
        paneStageEl.classList.add("is-info-view");
        setInfoSidebarState("open");
        setMapSidebarMobileState("hidden-left");
    } else if (view === 'list') {
        paneStageEl.classList.remove("is-minimized", "is-info-view");
        setMapSidebarMobileState("open");
        // Delay info hide to allow slide transition to finish
        setTimeout(() => setInfoSidebarState("hidden"), 350);
    } else if (view === 'minimized') {
        paneStageEl.classList.add("is-minimized");
    }
}

function setInfoSidebarState(state = "hidden") {
    if (!infoSidebarEl) return;
    infoSidebarEl.dataset.mobileState = state;
    infoSidebarEl.classList.toggle("active", state !== "hidden");
    if (isMobileView()) updateInfoBannerTitle();
}

function setMapSidebarMobileState(state = "open") {
    if (!mapSidebarEl || !isMobileView()) return;
    mapSidebarEl.dataset.mobileState = state;
    mapSidebarEl.classList.toggle("collapsed", state === "minimized");
    updateMapSidebarBanner();
}

/**
 * --- DATA & UI HELPERS ---
 */
window.showTab = function (btn, tabId) {
    const section = btn.closest(".area-section");
    if (!section) return;
    section.querySelectorAll(".tab-pane").forEach((p) => (p.style.display = "none"));
    btn.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    const target = section.querySelector("#" + CSS.escape(tabId));
    if (target) target.style.display = "block";
    btn.classList.add("active");
};

const getVal = (props, key) => {
    const foundKey = Object.keys(props).find((k) => k.toLowerCase() === key.toLowerCase());
    const val = foundKey ? props[foundKey] : null;
    return val === "N/A" || val === "" || val === null ? null : val;
};

const formatBulletsWithIndents = (text) => {
    if (!text || text === "N/A") return "N/A";
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((l) => `<div style="margin-bottom:4px; padding-left:12px; text-indent:-12px;">• ${l}</div>`).join("");
};

/**
 * --- MAP INITIALIZATION ---
 */
const map = L.map("map", { zoomControl: false }).setView([20.4, -157.4], 7);
const zoomControl = L.control.zoom({ position: isMobileView() ? "bottomright" : "topright" }).addTo(map);

function syncLeafletControlPosition() {
    const targetPosition = isMobileView() ? "bottomright" : "topright";
    if (zoomControl.options.position === targetPosition) return;
    map.removeControl(zoomControl);
    zoomControl.setPosition(targetPosition);
    zoomControl.addTo(map);
}

/**
 * --- SELECTION LOGIC ---
 */
function setActiveAreaItem(islandName, areaName) {
    activeAreaSelection = islandName && areaName ? { islandName, areaName } : null;
    document.querySelectorAll(".area-item.active-area").forEach((item) => item.classList.remove("active-area"));
    if (!activeAreaSelection) return;
    document.querySelectorAll(".area-item").forEach((item) => {
        if (item.dataset.island === islandName && item.dataset.area === areaName) {
            item.classList.add("active-area");
        }
    });
}

function clearMapSelection() {
    if (activeSelectionMarker) {
        map.removeLayer(activeSelectionMarker);
        activeSelectionMarker = null;
    }
    clearAccordionSelectionHighlight();
    clearHoverHighlight();
    setActiveAreaItem(null, null);

    if (isMobileView()) {
        setMobileAppView('list');
    } else {
        window.closeInfoPanel();
    }
}

function updateClickMarker(latlng) {
    if (activeSelectionMarker) map.removeLayer(activeSelectionMarker);
    activeSelectionMarker = L.marker(latlng).addTo(map);
}

/**
 * --- OPEN PANEL LOGIC ---
 */
function openInfoPanel(latlng, features, options = {}) {
    // Generate HTML content (Same as your previous logic)
    const summaryCardHtml = features.map(f => `<div class="info-card">${getVal(f.properties, 'Area_Name')}</div>`).join("");
    const content = document.getElementById("info-content");
    content.innerHTML = `<div class="mmpopup">${summaryCardHtml}</div>`;
    content.scrollTop = 0;

    if (isMobileView()) {
        setMobileAppView('info');
    } else {
        setInfoSidebarState("active");
    }

    if (options.source === "map" && latlng) {
        updateClickMarker(latlng);
    }
}

window.closeInfoPanel = () => {
    if (isMobileView()) {
        setMobileAppView('list');
    } else {
        setInfoSidebarState("hidden");
    }
};

/**
 * --- SIDEBAR BUILDERS ---
 */
function updateMapSidebarBanner() {
    if (!isMobileView()) return;
    ensureSidebarBanner(mapSidebarEl, {
        title: "Island Areas",
        actionText: "MINIMIZE",
        actionFn: () => setMobileAppView('minimized')
    });
}

function updateInfoBannerTitle() {
    if (!isMobileView()) return;
    ensureSidebarBanner(infoSidebarEl, {
        title: "Area Details",
        actionText: "BACK",
        actionFn: () => setMobileAppView('list')
    });
}

function ensureSidebarBanner(sidebarEl, options) {
    if (!sidebarEl) return;
    let banner = sidebarEl.querySelector(".sheet-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.className = "sheet-banner";
        sidebarEl.prepend(banner);
    }
    banner.innerHTML = `
        <button class="sheet-banner-action" onclick="(${options.actionFn.toString()})()">${options.actionText}</button>
        <div class="sheet-banner-title">${options.title}</div>
        <div style="width:60px"></div>
    `;
}

// Global filter function
window.filterSidebar = function() {
    const val = document.getElementById("area-search").value.toLowerCase();
    document.querySelectorAll(".area-item").forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(val) ? "block" : "none";
    });
};

// Initial Sync
function syncResponsiveSidebarState() {
    syncLeafletControlPosition();
    if (isMobileView()) {
        setMobileAppView('list');
    } else {
        if (paneStageEl) paneStageEl.classList.remove("is-info-view", "is-minimized");
        setMapSidebarMobileState("open");
    }
}

window.addEventListener("resize", syncResponsiveSidebarState);
document.addEventListener("DOMContentLoaded", syncResponsiveSidebarState);

// Placeholder for data fetching - replace with your actual fetchIslandData()
console.log("App Reset Complete. Ready for data.");
