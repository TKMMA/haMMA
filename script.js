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
function setMobilePaneStage(stage = "list") {
    if (!isMobileView() || !paneStageEl) return;
    paneStageEl.classList.toggle("is-info-view", stage === "info");
}

function setMobileVerticalState(isMinimized) {
    if (!isMobileView() || !paneStageEl) return;
    paneStageEl.classList.toggle("is-minimized", Boolean(isMinimized));
}

function setMobileInfoPaneVisibility(isVisible) {
    if (!infoSidebarEl || !isMobileView()) return;
    infoSidebarEl.classList.toggle("mobile-hidden", !isVisible);
}

function setMobileHomeState(options = {}) {
    if (!isMobileView() || !paneStageEl) return;

    // Reset Stage Position
    paneStageEl.style.setProperty("--stage-x", "0");
    paneStageEl.style.setProperty("--stage-y", "0px");
    paneStageEl.classList.remove("is-info-view", "is-minimized");
    
    setMapSidebarMobileState("open");
    setMobileVerticalState(false); 

    if (options.hideInfoAfterTransition) {
        if (mobileInfoHideTimer) clearTimeout(mobileInfoHideTimer);
        mobileInfoHideTimer = setTimeout(() => {
            setInfoSidebarState("hidden");
            setMobileInfoPaneVisibility(false);
            mobileInfoHideTimer = null;
        }, 400); 
    } else {
        setInfoSidebarState("hidden");
        setMobileInfoPaneVisibility(false);
    }
}

function setInfoSidebarState(state = "hidden") {
    if (!infoSidebarEl) return;
    const nextState = isMobileView() && state === "expanded" ? "open" : state;
    infoSidebarEl.dataset.mobileState = nextState;
    infoSidebarEl.classList.toggle("active", state !== "hidden");
    infoSidebarEl.classList.toggle("is-active-pane", nextState === "open");
    if (nextState === "open") setMobileVerticalState(false);
    if (isMobileView()) updateInfoBannerTitle();
}

function setMapSidebarMobileState(state = "minimized") {
    if (!mapSidebarEl || !isMobileView()) return;
    mapSidebarEl.dataset.mobileState = state;
    mapSidebarEl.classList.toggle("collapsed", state !== "open");
    mapSidebarEl.classList.toggle("is-active-pane", state === "open");
    setMobileVerticalState(state === "minimized");
    updateMapSidebarBanner();
}

/** --- OPEN INFO PANEL (The "App" transition) --- **/
function openInfoPanel(latlng, features, options = {}) {
    // Generate content using existing logic
    const headerTitle = features.length === 1 ? "1 Area Selected" : `${features.length} Areas Selected`;
    const summaryCardHtml = generateSummaryCard(features); // Placeholder for your summary logic
