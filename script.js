const allIslandLayers = {};
const SERVICE_LAYER_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandDisplayOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kahoʻolawe"];
let activeSelectionMarker = null;
let activeAccordionLayer = null;
let activeHoverLayer = null;
let infoHintEl = null;
let infoHintTimer = null;
let hasEverSelected = false;
let activeAreaSelection = null;
let mobileInfoHideTimer = null;

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

  return lines
    .map((l) => `
      <div class="mm-bullet-container">
        <span class="mm-bullet-point">•</span>
        <span class="mm-bullet-text">${l.replace(/^[•●○◦*-]\s+/, "").trim()}</span>
      </div>
    `)
    .join("");
};

const formatDate = (dateVal) => {
  if (!dateVal || dateVal === "N/A") return "N/A";
  const date = new Date(dateVal);
  return Number.isNaN(date.getTime())
    ? dateVal
    : `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
};

const joinFields = (props, ...keys) => keys.map((k) => getVal(props, k)).filter(Boolean).join("<br>");

const normalizeHawaiianText = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ʻ\u02BB\u02BC'’‘`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const mapSidebarEl = document.getElementById("map-sidebar");
const sidebarToggleEl = document.getElementById("sidebar-toggle");
const infoSidebarEl = document.getElementById("info-sidebar");
const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
const mapInterfaceEl = document.querySelector(".map-interface");
const paneStageEl = document.getElementById("pane-stage");

const isMobileView = () => mobileMediaQuery.matches;

function setMobilePaneStage(stage = "list") {
  if (!isMobileView() || !paneStageEl) return;
  paneStageEl.classList.toggle("is-info-view", stage === "info");
}

function syncMobileBrowserInset() {
  if (!paneStageEl) return;

  if (!isMobileView()) {
    paneStageEl.style.setProperty("--browser-offset", "0px");
    return;
  }

  const vv = window.visualViewport;
  if (!vv) {
    paneStageEl.style.setProperty("--browser-offset", "0px");
    return;
  }

  const overlayInset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
  paneStageEl.style.setProperty("--browser-offset", `${overlayInset}px`);
}

function setMobileInfoPaneVisibility(isVisible) {
  if (!infoSidebarEl || !isMobileView()) return;
  infoSidebarEl.classList.toggle("mobile-hidden", !isVisible);
}

function setMobileVerticalState(isMinimized) {
  if (!isMobileView() || !paneStageEl) return;
  paneStageEl.classList.toggle("is-minimized", Boolean(isMinimized));
}

function setMobileHomeState(options = {}) {
  if (!isMobileView() || !paneStageEl) return;

  setMobilePaneStage("list");
  setMapSidebarMobileState("open");
  setMobileVerticalState(false);

  paneStageEl.style.setProperty("--stage-x", "0");
  paneStageEl.style.setProperty("--stage-y", "0px");

  if (options.hideInfoAfterTransition) {
    if (mobileInfoHideTimer) {
      clearTimeout(mobileInfoHideTimer);
      mobileInfoHideTimer = null;
    }
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

function toggleMobileStageMinimized() {
  if (!isMobileView() || !paneStageEl) return false;
  paneStageEl.classList.toggle("is-minimized");
  return paneStageEl.classList.contains("is-minimized");
}

function setInfoSidebarState(state = "hidden") {
  if (!infoSidebarEl) return;

  const nextState = isMobileView() && state === "expanded" ? "open" : state;
  infoSidebarEl.dataset.mobileState = nextState;
  infoSidebarEl.classList.toggle("active", state !== "hidden");
  infoSidebarEl.classList.toggle("is-active-pane", nextState === "open");

  if (nextState === "open") {
    setMobileInfoPaneVisibility(true);
    setMobileVerticalState(false);
  } else if (nextState === "hidden") {
    setMobileInfoPaneVisibility(false);
  }

  if (isMobileView()) updateInfoBannerTitle();
}

function setMapSidebarMobileState(state = "minimized") {
  if (!mapSidebarEl || !isMobileView()) return;

  mapSidebarEl.dataset.mobileState = state;
  mapSidebarEl.classList.toggle("collapsed", state !== "open");
  mapSidebarEl.classList.toggle("is-active-pane", state === "open");
  setMobileVerticalState(state !== "open");
  updateMapSidebarBanner();
}

function setMapSidebarDesktopState(state = "open") {
  if (!mapSidebarEl || isMobileView()) return;

  mapSidebarEl.classList.toggle("collapsed", state === "closed");
}

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

function ensureSidebarBanner(sidebarEl, options = {}) {
  if (!sidebarEl) return null;

  let banner = sidebarEl.querySelector(".sheet-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.className = "sheet-banner";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "sheet-handle";

    const title = document.createElement("span");
    title.className = "sheet-banner-title";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "sheet-banner-action";

    const rightAction = document.createElement("button");
    rightAction.type = "button";
    rightAction.className = "sheet-banner-right-action";

    banner.append(action, title, rightAction, handle);
    sidebarEl.prepend(banner);
  }

  const handleEl = banner.querySelector(".sheet-handle");
  const titleEl = banner.querySelector(".sheet-banner-title");
  const actionEl = banner.querySelector(".sheet-banner-action");
  const rightActionEl = banner.querySelector(".sheet-banner-right-action");

  titleEl.textContent = options.title || "";

  if (options.handleLabel) handleEl.setAttribute("aria-label", options.handleLabel);
  handleEl.classList.toggle("is-expanded", Boolean(options.expanded));
  handleEl.style.display = options.showHandle === false ? "none" : "inline-flex";
  handleEl.onclick = (event) => event.stopPropagation();

  if (options.actionText) {
    actionEl.textContent = options.actionText;
    actionEl.style.display = "inline-flex";
    actionEl.onclick = (event) => {
      event.stopPropagation();
      if (options.onAction) options.onAction();
    };
    if (options.actionLabel) actionEl.setAttribute("aria-label", options.actionLabel);
  } else {
    actionEl.style.display = "none";
    actionEl.onclick = null;
  }

  if (options.rightActionText) {
    rightActionEl.textContent = options.rightActionText;
    rightActionEl.style.display = "inline-flex";
    rightActionEl.onclick = (event) => {
      event.stopPropagation();
      if (options.onRightAction) options.onRightAction();
    };
    if (options.rightActionLabel) rightActionEl.setAttribute("aria-label", options.rightActionLabel);
  } else {
    rightActionEl.style.display = "none";
    rightActionEl.onclick = null;
  }

  actionEl.style.gridColumn = options.actionGridColumn || "1";
  titleEl.style.gridColumn = options.titleGridColumn || "2";
  rightActionEl.style.gridColumn = options.rightActionGridColumn || "3";
  handleEl.style.gridColumn = options.handleGridColumn || "3";

  banner.onclick = options.onToggle ? () => options.onToggle() : null;

  return banner;
}

function updateMapSidebarBanner() {
  if (!isMobileView()) return;

  const state = mapSidebarEl?.dataset.mobileState || "minimized";
  const isOpen = state === "open";

  ensureSidebarBanner(mapSidebarEl, {
    title: "AREAS LIST",
    handleLabel: isOpen ? "Collapse Areas List" : "Expand Areas List",
    expanded: isOpen,
    onToggle: () => {
      const minimized = toggleMobileStageMinimized();
      mapSidebarEl.dataset.mobileState = minimized ? "minimized" : "open";
      mapSidebarEl.classList.toggle("collapsed", minimized);
      updateMapSidebarBanner();
    },
    actionGridColumn: "1",
    titleGridColumn: "2",
    rightActionGridColumn: "3",
    handleGridColumn: "3"
  });
}

function updateInfoBannerTitle() {
  if (!isMobileView()) return;

  const state = infoSidebarEl?.dataset.mobileState || "hidden";
  const isOpen = state === "open";

  ensureSidebarBanner(infoSidebarEl, {
    title: "AREA INFO",
    handleLabel: "Area Info",
    expanded: isOpen,
    showHandle: false,
    onToggle: () => {
      if (infoSidebarEl.dataset.mobileState === "hidden") return;
      const minimized = toggleMobileStageMinimized();
      infoSidebarEl.dataset.mobileState = minimized ? "minimized" : "open";
      updateInfoBannerTitle();
    },
    actionText: "← BACK TO LIST",
    actionLabel: "Back to Areas List",
    onAction: () => {
      if (!isMobileView()) return;
      setMobileVerticalState(false);
      setMapSidebarMobileState("open");
      setMobilePaneStage("list");
      setTimeout(() => setInfoSidebarState("hidden"), 420);
    },
    rightActionText: "✕",
    rightActionLabel: "Close Area Info",
    onRightAction: () => clearMapSelection(),
    actionGridColumn: "1",
    titleGridColumn: "2",
    rightActionGridColumn: "3",
    handleGridColumn: "3"
  });
}

const syncSidebarToggleUI = () => {
  if (!mapSidebarEl || !sidebarToggleEl) return;
  const collapsed = mapSidebarEl.classList.contains("collapsed");
  sidebarToggleEl.textContent = collapsed ? "▶" : "◀";
  sidebarToggleEl.title = collapsed ? "Show Areas List" : "Collapse Areas List";
  sidebarToggleEl.setAttribute("aria-label", collapsed ? "Show Areas List" : "Collapse Areas List");
  if (mapInterfaceEl) mapInterfaceEl.classList.toggle("sidebar-collapsed", collapsed);
};

window.toggleSidebar = () => {
  if (!mapSidebarEl) return;

  if (isMobileView()) {
    const currentState = mapSidebarEl.dataset.mobileState || "minimized";
    setMapSidebarMobileState(currentState === "open" ? "minimized" : "open");
    return;
  }

  mapSidebarEl.classList.toggle("collapsed");
  syncSidebarToggleUI();
};

syncSidebarToggleUI();

const map = L.map("map", { zoomControl: false }).setView([20.4, -157.4], 7);
const zoomControl = L.control.zoom({ position: isMobileView() ? "bottomright" : "topright" }).addTo(map);

function syncLeafletControlPosition() {
  const targetPosition = isMobileView() ? "bottomright" : "topright";
  if (zoomControl.options.position === targetPosition) return;
  map.removeControl(zoomControl);
  zoomControl.setPosition(targetPosition);
  zoomControl.addTo(map);
}

function syncResponsiveSidebarState() {
  if (!mapSidebarEl) return;

  if (isMobileView()) {
    const listState = "open";
    setMapSidebarMobileState(listState);

    if (infoSidebarEl.classList.contains("active")) {
      const infoState = infoSidebarEl.dataset.mobileState === "open" ? "open" : "minimized";
      setInfoSidebarState(infoState);
      setMobilePaneStage("info");
    } else {
      setInfoSidebarState("hidden");
      setMobileInfoPaneVisibility(false);
      setMobilePaneStage("list");
      setMobileVerticalState(false);
    }

    updateMapSidebarBanner();
    updateInfoBannerTitle();
  } else {
    if (paneStageEl) paneStageEl.classList.remove("is-info-view", "is-minimized");
    mapSidebarEl.dataset.mobileState = "desktop";
    infoSidebarEl.dataset.mobileState = infoSidebarEl.classList.contains("active") ? "expanded" : "hidden";
    setMapSidebarDesktopState("open");
  }

  syncSidebarToggleUI();
  syncLeafletControlPosition();
  syncMobileBrowserInset();
}

mobileMediaQuery.addEventListener("change", syncResponsiveSidebarState);
window.addEventListener("resize", syncResponsiveSidebarState);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", syncMobileBrowserInset);
  window.visualViewport.addEventListener("scroll", syncMobileBrowserInset);
}
syncResponsiveSidebarState();

if (isMobileView()) {
  setMobileHomeState();
}

window.onload = () => {
  if (isMobileView()) setMobileHomeState();
};

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Esri" }
).addTo(map);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Labels", pane: "shadowPane" }
).addTo(map);

function getLeftOverlayWidth() {
  if (isMobileView()) return 0;

  const mapRect = map.getContainer().getBoundingClientRect();
  const sidebarRect = document.getElementById("map-sidebar")?.getBoundingClientRect();
  const infoRect = document.getElementById("info-sidebar")?.classList.contains("active")
    ? document.getElementById("info-sidebar")?.getBoundingClientRect()
    : null;

  const rightEdges = [sidebarRect?.right, infoRect?.right].filter(Boolean);
  if (!rightEdges.length) return 0;

  const leftOverlayRight = Math.max(...rightEdges);
  return Math.max(0, leftOverlayRight - mapRect.left);
}

function flySelectionIntoVisibleArea(latlng, duration = 1.0) {
  if (!latlng) return;

  const mapSize = map.getSize();
  const leftOverlayWidth = getLeftOverlayWidth();
  const visibleCenterX = leftOverlayWidth + ((mapSize.x - leftOverlayWidth) / 2);

  const point = map.latLngToContainerPoint(latlng);
  const deltaX = Math.round(visibleCenterX - point.x);
  if (Math.abs(deltaX) < 2) return;

  const targetPoint = L.point(point.x + deltaX, point.y);
  const targetLatLng = map.containerPointToLatLng(targetPoint);
  map.flyTo(targetLatLng, map.getZoom(), { animate: true, duration, easeLinearity: 0.2 });
}

function ensureInfoHint() {
  if (infoHintEl) return infoHintEl;

  const host = document.querySelector(".map-interface");
  if (!host) return null;

  const el = document.createElement("div");
  el.id = "info-empty-hint";
  el.className = "info-empty-hint";
  el.textContent = "Click a shape on the map for area details.";
  host.appendChild(el);
  infoHintEl = el;
  return el;
}

function showInfoHint() {
  const el = ensureInfoHint();
  if (!el) return;

  if (infoHintTimer) clearTimeout(infoHintTimer);

  el.classList.add("active");
  infoHintTimer = setTimeout(() => {
    el.classList.remove("active");
    infoHintTimer = null;
  }, 4000);
}

function hideInfoHint() {
  const el = ensureInfoHint();
  if (!el) return;

  if (infoHintTimer) {
    clearTimeout(infoHintTimer);
    infoHintTimer = null;
  }

  el.classList.remove("active");
}

function getLayerBaseStyle(layer) {
  if (!layer.__baseStyle) {
    layer.__baseStyle = {
      color: layer.options.color ?? "#005a87",
      weight: layer.options.weight ?? 1.2,
      fillOpacity: layer.options.fillOpacity ?? 0.3,
      opacity: layer.options.opacity ?? 1
    };
  }

  return layer.__baseStyle;
}

function clearHoverHighlight() {
  if (!activeHoverLayer || activeHoverLayer === activeAccordionLayer) {
    activeHoverLayer = null;
    return;
  }

  const base = getLayerBaseStyle(activeHoverLayer);
  activeHoverLayer.setStyle({
    color: base.color,
    weight: base.weight,
    opacity: base.opacity,
    fillOpacity: base.fillOpacity
  });

  activeHoverLayer = null;
}

function applyHoverHighlight(layer) {
  if (!layer || layer === activeAccordionLayer) return;

  if (activeHoverLayer && activeHoverLayer !== layer) {
    clearHoverHighlight();
  }

  const base = getLayerBaseStyle(layer);
  layer.setStyle({
    color: "#ffd60a",
    weight: Math.max(base.weight + 0.6, 2),
    opacity: 0.5,
    fillOpacity: base.fillOpacity
  });

  activeHoverLayer = layer;
}

function clearAccordionSelectionHighlight() {
  if (!activeAccordionLayer || typeof activeAccordionLayer.setStyle !== "function") return;

  const base = getLayerBaseStyle(activeAccordionLayer);
  activeAccordionLayer.setStyle({
    color: base.color,
    weight: base.weight,
    fillOpacity: base.fillOpacity,
    opacity: base.opacity
  });

  activeAccordionLayer = null;
}

function flashLayerBorder(layer) {
  if (!layer || typeof layer.setStyle !== "function") return;

  const base = getLayerBaseStyle(layer);
  if (activeAccordionLayer && activeAccordionLayer !== layer) {
    clearAccordionSelectionHighlight();
  }

  clearHoverHighlight();
  activeAccordionLayer = layer;

  layer.setStyle({
    color: "#ffe066",
    weight: 5,
    opacity: 1,
    fillOpacity: base.fillOpacity
  });

  setTimeout(() => {
    layer.setStyle({
      color: "#ffd60a",
      weight: Math.max(base.weight + 0.8, 2.2),
      opacity: 1,
      fillOpacity: base.fillOpacity
    });
  }, 1200);
}

function updateClickMarker(latlng) {
  if (activeSelectionMarker) {
    map.removeLayer(activeSelectionMarker);
  }

  activeSelectionMarker = L.marker(latlng).addTo(map);
}

function clearMapSelection(options = {}) {
  const hadSelection = Boolean(activeSelectionMarker || activeAccordionLayer || infoSidebarEl?.classList.contains("active"));

  if (activeSelectionMarker) {
    map.removeLayer(activeSelectionMarker);
    activeSelectionMarker = null;
  }

  clearAccordionSelectionHighlight();
  clearHoverHighlight();
  setActiveAreaItem(null, null);

  if (isMobileView()) {
    setMobileHomeState({ hideInfoAfterTransition: true });
  } else {
    window.closeInfoPanel();
  }

  if (options.fromClick && hadSelection && hasEverSelected) {
    showInfoHint();
  }
}

function getVisibleMapRect(padding = 30) {
  if (isMobileView()) {
    const size = map.getSize();
    const brandBottom = document.querySelector(".brand-panel")?.getBoundingClientRect().bottom || 0;
    const mapTop = map.getContainer().getBoundingClientRect().top;
    const topInset = Math.max(padding, Math.ceil(brandBottom - mapTop) + 10);

    const overlayHeights = [mapSidebarEl, infoSidebarEl]
      .filter((el) => el && (el === mapSidebarEl || el.classList.contains("active")))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return Math.max(0, map.getContainer().getBoundingClientRect().bottom - rect.top);
      });

    const bottomInset = Math.max(...overlayHeights, Math.round(size.y * 0.35));

    return {
      left: padding,
      right: size.x - padding,
      top: topInset,
      bottom: Math.max(topInset + 20, size.y - bottomInset),
      centerX: size.x / 2
    };
  }

  const size = map.getSize();
  const leftOverlayWidth = getLeftOverlayWidth();

  return {
    left: leftOverlayWidth + padding,
    right: size.x - padding,
    top: padding,
    bottom: size.y - padding,
    centerX: leftOverlayWidth + ((size.x - leftOverlayWidth) / 2)
  };
}

function getTargetFitZoom(bounds) {
  if (isMobileView()) {
    const mobileRect = getVisibleMapRect();
    const padX = Math.max(30, map.getSize().x - (mobileRect.right - mobileRect.left));
    const padY = Math.max(30, map.getSize().y - (mobileRect.bottom - mobileRect.top));
    return map.getBoundsZoom(bounds, false, L.point(padX, padY));
  }

  const leftOverlayWidth = getLeftOverlayWidth();
  return map.getBoundsZoom(bounds, false, L.point(leftOverlayWidth + 30, 30));
}

function featureFitsVisibleArea(bounds, padding = 30) {
  const rect = getVisibleMapRect(padding);
  const nw = map.latLngToContainerPoint(bounds.getNorthWest());
  const se = map.latLngToContainerPoint(bounds.getSouthEast());

  const left = Math.min(nw.x, se.x);
  const right = Math.max(nw.x, se.x);
  const top = Math.min(nw.y, se.y);
  const bottom = Math.max(nw.y, se.y);

  return left >= rect.left && right <= rect.right && top >= rect.top && bottom <= rect.bottom;
}

function featureIsCenteredInVisibleArea(bounds, tolerancePx = 6) {
  const rect = getVisibleMapRect();
  const center = map.latLngToContainerPoint(bounds.getCenter());
  const visibleCenterY = map.getSize().y / 2;

  return Math.abs(center.x - rect.centerX) <= tolerancePx && Math.abs(center.y - visibleCenterY) <= tolerancePx;
}

function pointInRing(point, ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect = ((yi > point[1]) !== (yj > point[1]))
      && (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-12) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

function pointInPolygonCoords(point, polygonCoords) {
  if (!polygonCoords?.length) return false;
  if (!pointInRing(point, polygonCoords[0])) return false;

  for (let i = 1; i < polygonCoords.length; i += 1) {
    if (pointInRing(point, polygonCoords[i])) return false;
  }

  return true;
}

function pointInFeatureGeometry(latlng, feature) {
  const geometry = feature?.geometry;
  if (!geometry) return false;

  const point = [latlng.lng, latlng.lat];

  if (geometry.type === "Polygon") {
    return pointInPolygonCoords(point, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((poly) => pointInPolygonCoords(point, poly));
  }

  return false;
}

function populateSidebar(islandName, features) {
  const container = document.getElementById("island-list");
  if (!container) return;

  const notice = document.getElementById("loading-notice");
  if (notice) notice.remove();

  const islandId = islandName.replace(/[^a-zA-Z0-9]/g, "");
  const group = document.createElement("div");
  group.className = "island-group";

  const header = document.createElement("div");
  header.className = "island-header";
  header.id = `header-${islandId}`;
  header.addEventListener("click", () => window.toggleIsland(islandId));

  const headerLeft = document.createElement("div");
  headerLeft.className = "header-left";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.addEventListener("click", (event) => window.toggleLayerVisibility(event, islandName));

  const islandLabel = document.createElement("span");
  islandLabel.textContent = islandName;

  headerLeft.appendChild(checkbox);
  headerLeft.appendChild(islandLabel);

  const chevron = document.createElement("span");
  chevron.className = "chevron";
  chevron.textContent = "▼";

  header.appendChild(headerLeft);
  header.appendChild(chevron);

  const list = document.createElement("div");
  list.id = `list-${islandId}`;
  list.className = "area-list";

  const names = features
    .map((f) => getVal(f.properties, "Full_Name") || getVal(f.properties, "Full_name") || "Unknown")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  names.forEach((areaName) => {
    const item = document.createElement("div");
    item.className = "area-item";
    item.textContent = areaName;
    item.dataset.island = islandName;
    item.dataset.area = areaName;
    item.addEventListener("click", () => window.zoomToArea(islandName, areaName));
    item.addEventListener("mouseenter", () => window.hoverArea(islandName, areaName));
    item.addEventListener("mouseleave", () => clearHoverHighlight());
    list.appendChild(item);
  });

  group.appendChild(header);
  group.appendChild(list);
  container.appendChild(group);
}

window.toggleIsland = (id) => {
  const list = document.getElementById(`list-${id}`);
  const header = document.getElementById(`header-${id}`);
  if (!list || !header) return;

  const shouldOpen = !list.classList.contains("active");

  if (isMobileView()) {
    document.querySelectorAll(".area-list.active").forEach((openList) => {
      if (openList.id !== `list-${id}`) openList.classList.remove("active");
    });

    document.querySelectorAll(".island-header.expanded").forEach((openHeader) => {
      if (openHeader.id !== `header-${id}`) openHeader.classList.remove("expanded");
    });
  }

  list.classList.toggle("active", shouldOpen);
  header.classList.toggle("expanded", shouldOpen);

  if (isMobileView() && shouldOpen) {
    const scroller = document.getElementById("island-list");
    if (scroller) {
      scroller.scrollTo({ top: header.offsetTop - 2, behavior: "smooth" });
    }
  }
};

window.toggleLayerVisibility = (event, islandName) => {
  event.stopPropagation();
  const layer = allIslandLayers[islandName];
  if (!layer) return;

  if (event.target.checked) map.addLayer(layer);
  else map.removeLayer(layer);
};

window.zoomToArea = (islandName, areaName) => {
  setActiveAreaItem(islandName, areaName);
  const layerGroup = allIslandLayers[islandName];
  if (!layerGroup) return;

  layerGroup.eachLayer((layer) => {
    const name = getVal(layer.feature.properties, "Full_Name") || getVal(layer.feature.properties, "Full_name");
    if (name === areaName) {
      const bounds = layer.getBounds();

      const alreadyFits = featureFitsVisibleArea(bounds);
      const alreadyCentered = featureIsCenteredInVisibleArea(bounds);
      const targetFitZoom = getTargetFitZoom(bounds);
      const currentZoom = map.getZoom();
      const needsFlyToBounds = !alreadyFits || currentZoom < (targetFitZoom - 0.05);
      const needsMove = needsFlyToBounds || !alreadyCentered;
      const noSelectionVisible = !infoSidebarEl.classList.contains("active");

      map.stop();

      const openPanel = () => openInfoPanel(bounds.getCenter(), [layer.feature], { source: "menu" });

      if (needsFlyToBounds) {
        const leftOverlayWidth = getLeftOverlayWidth();

        if (noSelectionVisible) {
          map.once("moveend", () => {
            openPanel();
            flashLayerBorder(layer);
          });
        } else {
          openPanel();
          map.once("moveend", () => flashLayerBorder(layer));
        }

        map.flyToBounds(bounds, {
          animate: true,
          duration: 2.0,
          easeLinearity: 0.2,
          paddingTopLeft: [leftOverlayWidth + 30, 30],
          paddingBottomRight: [30, 30]
        });
      } else if (!alreadyCentered) {
        if (noSelectionVisible) {
          map.once("moveend", () => {
            openPanel();
            flashLayerBorder(layer);
          });
        } else {
          openPanel();
          map.once("moveend", () => flashLayerBorder(layer));
        }

        flySelectionIntoVisibleArea(bounds.getCenter(), 1.0);
      } else {
        openPanel();
        flashLayerBorder(layer);
      }
    }
  });
};

window.hoverArea = (islandName, areaName) => {
  const layerGroup = allIslandLayers[islandName];
  if (!layerGroup) return;

  let matchedLayer = null;
  layerGroup.eachLayer((layer) => {
    const name = getVal(layer.feature.properties, "Full_Name") || getVal(layer.feature.properties, "Full_name");
    if (!matchedLayer && name === areaName) matchedLayer = layer;
  });

  if (!matchedLayer) return;
  if (!map.getBounds().intersects(matchedLayer.getBounds())) return;

  applyHoverHighlight(matchedLayer);
};

window.filterSidebar = () => {
  const raw = document.getElementById("area-search")?.value || "";
  const term = normalizeHawaiianText(raw);

  document.querySelectorAll(".island-group").forEach((group) => {
    let hasMatch = false;

    const islandLabel = group.querySelector(".header-left span")?.innerText || "";
    const islandMatch = term !== "" && normalizeHawaiianText(islandLabel).includes(term);

    const items = group.querySelectorAll(".area-item");
    items.forEach((item) => {
      const itemNorm = normalizeHawaiianText(item.innerText);
      const match = term === "" ? true : islandMatch || itemNorm.includes(term);

      item.style.display = match ? "block" : "none";
      if (match) hasMatch = true;
    });

    const list = group.querySelector(".area-list");
    const header = group.querySelector(".island-header");

    if (term !== "" && hasMatch) {
      list?.classList.add("active");
      header?.classList.add("expanded");
      group.style.display = "block";
    } else if (term !== "" && !hasMatch) {
      group.style.display = "none";
    } else {
      group.style.display = "block";
      list?.classList.remove("active");
      header?.classList.remove("expanded");
    }
  });
};

function openInfoPanel(latlng, features, options = {}) {
  let summaryCardHtml = "";
  let sectionDividerHtml = "";

  if (features.length > 1) {
    const areaNamesHtml = features
      .map((f) => `
        <div class="mm-bullet-container">
          <span class="mm-bullet-point">•</span>
          <span class="mm-bullet-text">${getVal(f.properties, "Full_name") || getVal(f.properties, "Full_Name") || "Unknown Area"}</span>
        </div>
      `)
      .join("");

    const stateRegsUrl =
      getVal(features[0].properties, "State_Fishing_Regs_URL") ||
      "https://dlnr.hawaii.gov/dar/fishing/fishing-regulations/";

    const buildSummaryBlock = (title, fieldKey) => {
      const items = features
        .map((f) => ({
          name: getVal(f.properties, "Full_name") || getVal(f.properties, "Full_Name"),
          val: getVal(f.properties, fieldKey),
        }))
        .filter((i) => i.val);

      if (!items.length) return "";

      return (
        `<div class="summary-section-title">${title}</div>` +
        items
          .map(
            (item) => `
              <div class="area-label">${item.name}:</div>
              <div style="margin-bottom:8px;">${formatBulletsWithIndents(item.val)}</div>
            `
          )
          .join("")
      );
    };

    summaryCardHtml = `
      <div class="area-section mmcard mmcard--summary">
        <div class="mmcard__body">
          <h3 class="mmcard__title">Fishing Rules Summary</h3>

          <span class="mmcard__subtitle-label">Managed Areas at this Location:</span>
          <div class="mmcard__subtitle">${areaNamesHtml}</div>

          <div class="mm-statewide-notice">
            The site-specific rules below apply in addition to all
            <a href="${stateRegsUrl}" target="_blank">Statewide Fishing Regulations</a>.
          </div>

          <div class="mmtabs">
            <button class="active" type="button">CONSOLIDATED RULES</button>
          </div>

          <div class="tab-pane">
            ${buildSummaryBlock("Gear Restrictions", "Rules_Gear")}
            ${buildSummaryBlock("Species & Bag Limits", "Rules_Species_Size_Bag")}
            ${buildSummaryBlock("Prohibited Activities", "Rules_Activities")}
            ${buildSummaryBlock("Seasons & Times Rules", "Rules_Seasons_Times")}
            ${buildSummaryBlock("Transit & Anchor Rules", "Rules_Transit_Anchor")}
          </div>
        </div>
      </div>
    `;

    sectionDividerHtml = `<div class="section-divider">Detailed Area Information Below</div>`;
  }

  const individualCardsHtml = features
    .map((feature, index) => {
      const props = feature.properties;
      const uid = `area-${index}`;
      const name = getVal(props, "Full_name") || getVal(props, "Full_Name") || "Unknown Area";
      const img = getVal(props, "Area_Image_URL_1") || getVal(props, "Area_Image_URL_2") || getVal(props, "Area_Image_URL_3");
      const stateUrl = getVal(props, "State_Fishing_Regs_URL") || "https://dlnr.hawaii.gov/dar/fishing/fishing-regulations/";

      const renderFieldIndented = (alias, value, isBullet = false, isDate = false) => {
        if (!value || value === "N/A" || value === "") return "";
        const displayValue = isDate ? formatDate(value) : isBullet ? formatBulletsWithIndents(value) : value;
        return `<div style="margin-bottom:12px;">
          <div style="font-weight:700; margin-bottom:2px;">${alias}</div>
          <div>${displayValue}</div>
        </div>`;
      };

      return `
        <div class="area-section mmcard">
          ${img ? `<img style="width:100%; aspect-ratio:16/9; object-fit:cover; display:block;" src="${img}">` : ""}
          <div class="mmcard__body">
            <h3 class="mmcard__title">${name}</h3>

            <div class="mmtabs">
              <button class="active" type="button" onclick="showTab(this,'about-${uid}')">ABOUT</button>
              <button type="button" onclick="showTab(this,'rules-${uid}')">RULES</button>
              <button type="button" onclick="showTab(this,'laws-${uid}')">LAWS</button>
            </div>

            <div id="about-${uid}" class="tab-pane" style="display:block;">
              ${renderFieldIndented("Designation", joinFields(props, "Designation_1", "Designation_2", "Designation_3"))}
              ${renderFieldIndented("Island", getVal(props, "Island"))}
              ${renderFieldIndented("Purpose", getVal(props, "Purpose"), true)}
              ${renderFieldIndented("Cultural Info", getVal(props, "Cultural"), true)}
              ${renderFieldIndented("Fishing Info", getVal(props, "Fishing_Info"), true)}
              ${renderFieldIndented("Date Established", getVal(props, "Establish_Date"), false, true)}
              ${renderFieldIndented("Location", getVal(props, "Location"))}
              ${getVal(props, "DAR_URL") ? `<a class="reg-link" href="${getVal(props, "DAR_URL")}" target="_blank">OFFICIAL DAR PAGE ›</a>` : ""}
            </div>

            <div id="rules-${uid}" class="tab-pane" style="display:none;">
              <div class="mm-statewide-notice">
                The site-specific rules below apply in addition to all
                <a href="${stateUrl}" target="_blank">Statewide Fishing Regulations</a>.
              </div>
              ${renderFieldIndented("Gear Rules", getVal(props, "Rules_Gear"), true)}
              ${renderFieldIndented("Species & Bag Limits", getVal(props, "Rules_Species_Size_Bag"), true)}
              ${renderFieldIndented("Activities Rules", getVal(props, "Rules_Activities"), true)}
              ${renderFieldIndented("Seasons & Times Rules", getVal(props, "Rules_Seasons_Times"), true)}
              ${renderFieldIndented("Transit & Anchor Rules", getVal(props, "Rules_Transit_Anchor"), true)}
            </div>

            <div id="laws-${uid}" class="tab-pane" style="display:none;">
              ${getVal(props, "HAR_Name") ? `<div><strong>HAR Name:</strong> ${getVal(props, "HAR_Name")}</div>` : ""}
              ${getVal(props, "HAR_Link") ? `<a class="reg-link" href="${getVal(props, "HAR_Link")}" target="_blank">VIEW HAR PDF ›</a>` : ""}
              ${renderFieldIndented("Penalties", getVal(props, "Penalties"), true)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const headerTitle = features.length === 1 ? "1 Area Selected" : `${features.length} Areas Selected`;

  const content = document.getElementById("info-content");
  content.innerHTML = `
    <div class="mmpopup">
      <div class="mmpopup__header">
        <div class="mmpopup__header-title">${headerTitle}</div>
      </div>

      <div class="mmpopup__scroll">
        ${summaryCardHtml}
        ${sectionDividerHtml}
        ${individualCardsHtml}
      </div>
    </div>
  `;

  content.scrollTop = 0;
  updateInfoBannerTitle();

  if (isMobileView()) {
    paneStageEl?.classList.remove("is-minimized");
    paneStageEl?.classList.add("is-info-view");
    setMobileInfoPaneVisibility(true);
    setMapSidebarMobileState("open");
    setInfoSidebarState("open");
    setMobilePaneStage("info");
  } else {
    setInfoSidebarState("expanded");
  }

  hasEverSelected = true;
  hideInfoHint();

  if (options.source === "map" && latlng) {
    clearAccordionSelectionHighlight();
    updateClickMarker(latlng);
  }

}

window.closeInfoPanel = () => {
  if (isMobileView()) {
    setMobileHomeState({ hideInfoAfterTransition: true });
    return;
  }

  setInfoSidebarState("hidden");

  if (isMobileView()) {
    setMapSidebarMobileState("minimized");
  }
};

function splitFeaturesByIsland(features) {
  const grouped = {};

  features.forEach((feature) => {
    const islandName = getVal(feature.properties, "Island") || "Unknown";
    if (!grouped[islandName]) grouped[islandName] = [];
    grouped[islandName].push(feature);
  });

  const orderedKeys = [
    ...islandDisplayOrder.filter((name) => grouped[name]),
    ...Object.keys(grouped)
      .filter((name) => !islandDisplayOrder.includes(name))
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
  ];

  return orderedKeys.map((name) => ({ name, features: grouped[name] }));
}

async function loadAllFromSingleService() {
  try {
    const metadataResp = await fetch(`${SERVICE_LAYER_URL}?f=json`);
    const metadata = await metadataResp.json();

    const renderer = metadata?.drawingInfo?.renderer;
    const globalOpacity = (100 - (metadata?.drawingInfo?.transparency || 0)) / 100;

    const dataResp = await fetch(`${SERVICE_LAYER_URL}/query?where=1=1&outFields=*&f=geojson&returnGeometry=true`);
    const geojsonData = await dataResp.json();
    const groupedByIsland = splitFeaturesByIsland(geojsonData.features || []);

    groupedByIsland.forEach(({ name, features }) => {
      const islandLayer = L.geoJSON({ type: "FeatureCollection", features }, {
        style: (feature) => {
          const fName = (getVal(feature.properties, "Full_Name") || getVal(feature.properties, "Full_name") || "").toLowerCase();
          const match = renderer?.uniqueValueInfos?.find((info) => String(info.value || "").toLowerCase() === fName);

          if (match) {
            const c = match.symbol.color;
            return {
              fillColor: `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`,
              fillOpacity: globalOpacity,
              color: `rgb(${match.symbol.outline.color[0]},${match.symbol.outline.color[1]},${match.symbol.outline.color[2]})`,
              weight: 1.5
            };
          }

          return { weight: 1.2, fillOpacity: 0.3, color: "#005a87" };
        },

        onEachFeature: (feature, layer) => {
          layer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);

            const hits = [];
            Object.values(allIslandLayers).forEach((islandLayerGroup) => {
              if (map.hasLayer(islandLayerGroup)) {
                islandLayerGroup.eachLayer((l) => {
                  if (pointInFeatureGeometry(e.latlng, l.feature)) hits.push(l.feature);
                });
              }
            });

            if (hits.length) {
              if (hits.length === 1) {
                const selectedIsland = getVal(hits[0].properties, "Island");
                const selectedArea = getVal(hits[0].properties, "Full_Name") || getVal(hits[0].properties, "Full_name");
                setActiveAreaItem(selectedIsland, selectedArea);
              } else {
                setActiveAreaItem(null, null);
              }

              openInfoPanel(e.latlng, hits, { source: "map" });
            } else {
              clearMapSelection({ fromClick: true });
            }
          });
        }
      }).addTo(map);

      allIslandLayers[name] = islandLayer;
      populateSidebar(name, features);
    });
  } catch (e) {
    console.error(e);
  }
}

map.on("click", () => {
  clearMapSelection({ fromClick: true });
});

loadAllFromSingleService();
