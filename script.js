/**
 * 1. CONFIG & STATE
 */
const SERVICE_LAYER_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandDisplayOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kahoʻolawe"];

const appState = {
  allIslandLayers: {},
  activeAccordionLayer: null,
  activeHoverLayer: null,
  isFetching: false,
  hintTimer: null
};

/**
 * 2. PERFORMANCE: SIDEBAR BUILDER
 * Uses DocumentFragment to prevent layout thrashing.
 */
function populateSidebar(islandName, features) {
  const container = document.getElementById("island-list");
  if (!container) return;

  // Remove loading notice on first success
  const status = document.getElementById("status-message");
  if (status) status.remove();

  const fragment = document.createDocumentFragment();
  const islandId = islandName.replace(/[^a-zA-Z0-9]/g, "");

  const group = document.createElement("div");
  group.className = "island-group";

  // Island Header (Accessibility: Button)
  const header = document.createElement("button");
  header.className = "island-header";
  header.setAttribute("aria-expanded", "false");
  header.onclick = () => window.toggleIsland(islandId);
  
  header.innerHTML = `
    <div class="header-left">
      <input type="checkbox" checked onclick="event.stopPropagation(); window.toggleLayerVisibility(event, '${islandName}')">
      <span>${islandName}</span>
    </div>
    <span class="chevron">▼</span>
  `;

  const list = document.createElement("div");
  list.id = `list-${islandId}`;
  list.className = "area-list";

  // Build items efficiently
  features.sort((a, b) => {
    const nameA = getVal(a.properties, "Full_Name") || "";
    const nameB = getVal(b.properties, "Full_Name") || "";
    return nameA.localeCompare(nameB);
  }).forEach(f => {
    const areaName = getVal(f.properties, "Full_Name") || "Unknown Area";
    const item = document.createElement("div");
    item.className = "area-item";
    item.tabIndex = 0; // Keyboard focus
    item.role = "button";
    item.textContent = areaName;
    
    // Listeners
    item.onclick = () => window.zoomToArea(islandName, areaName);
    item.onkeydown = (e) => { if (e.key === "Enter") window.zoomToArea(islandName, areaName); };
    item.onmouseenter = () => window.hoverArea(islandName, areaName);
    item.onmouseleave = () => clearHoverHighlight();

    list.appendChild(item);
  });

  group.appendChild(header);
  group.appendChild(list);
  fragment.appendChild(group);
  container.appendChild(fragment);
}

/**
 * 3. UX: COMPACT MODE & HINTS
 */
function setCompactMode(isCompact) {
  document.getElementById("brand-panel")?.classList.toggle("compact", isCompact);
}

function showInfoHint() {
  const host = document.querySelector(".map-interface");
  let el = document.getElementById("info-empty-hint");

  if (!el) {
    el = document.createElement("div");
    el.id = "info-empty-hint";
    el.className = "info-empty-hint";
    el.innerHTML = `
      <span>Click a shape on the map for area details.</span>
      <button class="hint-dismiss" onclick="this.parentElement.classList.remove('active')">✕</button>
    `;
    host.appendChild(el);
  }

  if (appState.hintTimer) clearTimeout(appState.hintTimer);
  el.classList.add("active");
  
  // Increased to 8 seconds per suggestion #7
  appState.hintTimer = setTimeout(() => el.classList.remove("active"), 8000);
}

/**
 * 4. DATA FETCHING & ERROR HANDLING
 */
async function loadMapData() {
  const statusEl = document.getElementById("status-message");
  try {
    const response = await fetch(`${SERVICE_LAYER_URL}/query?where=1%3D1&outFields=*&f=geojson`);
    if (!response.ok) throw new Error("Network response was not ok");
    
    const data = await response.json();
    processFeatures(data.features);
  } catch (error) {
    if (statusEl) {
      statusEl.className = "error-notice";
      statusEl.innerHTML = `
        <p>Unable to load map data.</p>
        <button class="retry-btn" onclick="location.reload()">Try Again</button>
      `;
    }
  }
}

/**
 * 5. MAP LOGIC (KEEPING SMART CENTERING)
 */
// ... Include your existing flySelectionIntoVisibleArea, tile layers, and pointInFeatureGeometry here ...

// Add trigger for Compact Mode
map.on('movestart', () => setCompactMode(true));

/**
 * INITIALIZE
 */
loadMapData();
