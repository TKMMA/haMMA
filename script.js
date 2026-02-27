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
 */
function setMobileAppView(view) {
    if (!isMobileView() || !paneStageEl) return;

    if (view === 'info') {
        paneStageEl.classList.remove("is-minimized");
        paneStageEl.classList.add("is-info-view");
        setInfoSidebarState("open");
        setMapSidebarMobileState("hidden-left");
    } else if (view === 'list') {
        paneStageEl.classList.remove("is-minimized", "is-info-view");
        setMapSidebarMobileState("open");
        setTimeout(() => setInfoSidebarState("hidden"), 350);
    } else if (view === 'minimized') {
        paneStageEl.classList.add("is-minimized");
        setMapSidebarMobileState("minimized");
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
    mapSidebarEl.classList.toggle("collapsed", state !== "open");
    updateMapSidebarBanner();
}

/**
 * --- MAP INITIALIZATION ---
 */
const map = L.map("map", { zoomControl: false, attributionControl: false }).setView([20.4, -157.4], 7);

// ADDING TILES (The missing piece!)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 13
}).addTo(map);

const zoomControl = L.control.zoom({ position: isMobileView() ? "bottomright" : "topright" }).addTo(map);

function syncLeafletControlPosition() {
    const targetPosition = isMobileView() ? "bottomright" : "topright";
    if (zoomControl.options.position === targetPosition) return;
    map.removeControl(zoomControl);
    zoomControl.setPosition(targetPosition);
    zoomControl.addTo(map);
}

/**
 * --- DATA FETCHING ---
 */
async function fetchIslandData() {
    try {
        const response = await fetch(`${SERVICE_LAYER_URL}/query?where=1%3D1&outFields=*&f=geojson`);
        const data = await response.json();
        
        // Group features by Island
        const grouped = {};
        data.features.forEach(f => {
            const island = f.properties.Island || "Other";
            if (!grouped[island]) grouped[island] = [];
            grouped[island].push(f);
        });

        const listContainer = document.getElementById("island-list");
        listContainer.innerHTML = "";

        islandDisplayOrder.forEach(island => {
            if (grouped[island]) {
                const islandLayer = L.geoJSON(grouped[island], {
                    style: { color: "#005a87", weight: 2, fillOpacity: 0.2 },
                    onEachFeature: (feature, layer) => {
                        layer.on('click', (e) => {
                            L.DomEvent.stopPropagation(e);
                            openInfoPanel(e.latlng, [feature], { source: 'map' });
                        });
                    }
                }).addTo(map);
                
                allIslandLayers[island] = islandLayer;
                renderIslandUI(island, grouped[island]);
            }
        });
    } catch (err) {
        console.error("Error loading map data:", err);
    }
}

function renderIslandUI(islandName, features) {
    const container = document.getElementById("island-list");
    const section = document.createElement("div");
    section.className = "island-section";
    section.innerHTML = `
        <div class="island-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
            <strong>${islandName}</strong>
            <span>▼</span>
        </div>
        <div class="island-areas">
            ${features.map(f => `
                <div class="area-item" onclick="selectAreaFromList('${islandName}', '${f.properties.Area_Name}')">
                    ${f.properties.Area_Name}
                </div>
            `).join('')}
        </div>
    `;
    container.appendChild(section);
}

window.selectAreaFromList = (island, areaName) => {
    const layer = allIslandLayers[island].getLayers().find(l => l.feature.properties.Area_Name === areaName);
    if (layer) {
        const bounds = layer.getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
        openInfoPanel(bounds.getCenter(), [layer.feature], { source: 'list' });
    }
};

/**
 * --- PANEL LOGIC ---
 */
function openInfoPanel(latlng, features, options = {}) {
    const content = document.getElementById("info-content");
    const f = features[0].properties;
    
    content.innerHTML = `
        <div class="mmpopup">
            <h3>${f.Area_Name}</h3>
            <p><strong>Island:</strong> ${f.Island}</p>
            <hr>
            <div class="info-body">
                <p>${f.Description || "No description available."}</p>
            </div>
        </div>
    `;
    content.scrollTop = 0;

    if (isMobileView()) {
        setMobileAppView('info');
    } else {
        setInfoSidebarState("active");
    }

    if (latlng) updateClickMarker(latlng);
}

function updateClickMarker(latlng) {
    if (activeSelectionMarker) map.removeLayer(activeSelectionMarker);
    activeSelectionMarker = L.marker(latlng).addTo(map);
}

/**
 * --- UI BANNERS ---
 */
function updateMapSidebarBanner() {
    if (!isMobileView()) return;
    ensureSidebarBanner(mapSidebarEl, {
        title: "Island Areas",
        actionText: paneStageEl.classList.contains('is-minimized') ? "EXPAND" : "MINIMIZE",
        actionFn: () => {
            const isMin = paneStageEl.classList.contains('is-minimized');
            setMobileAppView(isMin ? 'list' : 'minimized');
        }
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
document.addEventListener("DOMContentLoaded", () => {
    syncResponsiveSidebarState();
    fetchIslandData(); // Start the data fetch
});
