const allIslandLayers = {};
let activeSelectionMarker = null;
let activeAccordionLayer = null;
let activeHoverLayer = null;
let hasEverSelected = false;
let activeAreaSelection = null;
let mobileInfoHideTimer = null;

const SERVICE_LAYER_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandDisplayOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kaho‘olawe"];

/** --- HELPERS --- **/
const getVal = (props, key) => {
    const foundKey = Object.keys(props).find(k => k.toLowerCase() === key.toLowerCase());
    const val = foundKey ? props[foundKey] : null;
    return (val === "N/A" || val === "" || val === null) ? null : val;
};

const formatBullets = (text) => {
    if (!text || text === "N/A") return "N/A";
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(l => `<div class="mm-bullet-container"><span class="mm-bullet-point">•</span><span class="mm-bullet-text">${l}</span></div>`).join("");
};

const mapSidebarEl = document.getElementById("map-sidebar");
const infoSidebarEl = document.getElementById("info-sidebar");
const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
const paneStageEl = document.getElementById("pane-stage");

const isMobileView = () => mobileMediaQuery.matches;

/** --- MOBILE STATE MACHINE --- **/
function setMobileHomeState(options = {}) {
    if (!isMobileView() || !paneStageEl) return;
    paneStageEl.style.setProperty("--stage-x", "0");
    paneStageEl.classList.remove("is-info-view");
    setMapSidebarMobileState("open");
    if (options.hideInfoAfterTransition) {
        if (mobileInfoHideTimer) clearTimeout(mobileInfoHideTimer);
        mobileInfoHideTimer = setTimeout(() => {
            setInfoSidebarState("hidden");
        }, 400);
    } else {
        setInfoSidebarState("hidden");
    }
}

function setInfoSidebarState(state = "hidden") {
    if (!infoSidebarEl) return;
    infoSidebarEl.classList.toggle("active", state !== "hidden");
}

function setMapSidebarMobileState(state = "open") {
    if (!mapSidebarEl || !isMobileView()) return;
    mapSidebarEl.classList.toggle("collapsed", state !== "open");
}

/** --- OPEN INFO PANEL --- **/
function openInfoPanel(latlng, features, options = {}) {
    // Generate your specialized cards here
    const individualCardsHtml = features.map(f => {
        const p = f.properties;
        return `
            <div class="mmcard">
                <div class="mmcard__body">
                    <h3 class="mmcard__title">${getVal(p, 'Area_Name')}</h3>
                    <div class="mmcard__subtitle">${getVal(p, 'Island')}</div>
                    <div class="mm-bullet-text">${formatBullets(getVal(p, 'Fishing_Rules_Summary'))}</div>
                </div>
            </div>`;
    }).join("");

    const content = document.getElementById("info-content");
    content.innerHTML = `<div class="mmpopup"><div class="mmpopup__scroll">${individualCardsHtml}</div></div>`;
    content.scrollTop = 0;

    if (isMobileView()) {
        if (mobileInfoHideTimer) clearTimeout(mobileInfoHideTimer);
        paneStageEl.style.setProperty("--stage-x", "-50%");
        paneStageEl.classList.add("is-info-view");
        setMapSidebarMobileState("hidden-left"); 
        setInfoSidebarState("open");
    } else {
        setInfoSidebarState("active");
    }
    if (latlng) updateClickMarker(latlng);
}

/** --- INITIALIZATION --- **/
const map = L.map("map", { zoomControl: false }).setView([20.4, -157.4], 7);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(map);

window.closeInfoPanel = () => {
    if (isMobileView()) setMobileHomeState({ hideInfoAfterTransition: true });
    else setInfoSidebarState("hidden");
};

function updateClickMarker(latlng) {
    if (activeSelectionMarker) map.removeLayer(activeSelectionMarker);
    activeSelectionMarker = L.marker(latlng).addTo(map);
}

// ... include your fetchIslandData() logic here to populate allIslandLayers ...
