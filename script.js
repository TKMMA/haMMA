/**
 * 1. CONFIGURATION & STATE
 */
const SERVICE_LAYER_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandDisplayOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kahoʻolawe"];

const appState = {
  allIslandLayers: {},
  activeAccordionLayer: null,
  activeHoverLayer: null,
  activeSelectionMarker: null,
  hintTimer: null,
  isCompact: false
};

/**
 * 2. CORE UTILITIES
 */
const getVal = (props, key) => {
  const foundKey = Object.keys(props).find((k) => k.toLowerCase() === key.toLowerCase());
  const val = foundKey ? props[foundKey] : null;
  return val === "N/A" || val === "" || val === null ? null : val;
};

const normalizeHawaiianText = (str) => {
  if (!str) return "";
  return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[ʻ\u02BB\u02BC'’‘`]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
};

/**
 * 3. SIDEBAR & UI BUILDER
 * Uses DocumentFragment for performance (Suggestion #2)
 */
function populateSidebar(islandName, features) {
  const container = document.getElementById("island-list");
  if (!container) return;

  const fragment = document.createDocumentFragment();
  const islandId = islandName.replace(/[^a-zA-Z0-9]/g, "");

  const group = document.createElement("div");
  group.className = "island-group";

  const header = document.createElement("button");
  header.className = "island-header";
  header.id = `header-${islandId}`;
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

  features.sort((a, b) => {
    const nameA = getVal(a.properties, "Full_Name") || "";
    const nameB = getVal(b.properties, "Full_Name") || "";
    return nameA.localeCompare(nameB);
  }).forEach(f => {
    const areaName = getVal(f.properties, "Full_Name") || "Unknown Area";
    const item = document.createElement("div");
    item.className = "area-item";
    item.tabIndex = 0; // Keyboard Accessibility (Suggestion #9)
    item.role = "button";
    item.textContent = areaName;
    item.dataset.island = islandName;
    item.dataset.area = areaName;
    
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

  // Remove loading notice on first success
  const status = document.getElementById("status-message");
  if (status && status.classList.contains("loading-notice")) status.remove();
}

/**
 * 4. UX: HINTS & COMPACT MODE
 */
function setCompactMode(enabled) {
  if (appState.isCompact === enabled) return;
  appState.isCompact = enabled;
  document.getElementById("brand-panel").classList.toggle("compact", enabled);
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
  // Increased duration (Suggestion #7)
  appState.hintTimer = setTimeout(() => el.classList.remove("active"), 8000);
}

/**
 * 5. MAP LOGIC & DATA FETCH
 */
const map = L.map("map", { zoomControl: false }).setView([20.4, -157.4], 7);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Esri" }).addTo(map);

// Trigger Compact Mode on interaction (Suggestion #8)
map.on('movestart', () => setCompactMode(true));

async function loadMapData() {
  const statusEl = document.getElementById("status-message");
  try {
    const response = await fetch(`${SERVICE_LAYER_URL}/query?where=1%3D1&outFields=*&f=geojson`);
    if (!response.ok) throw new Error("Fetch failed");
    
    const data = await response.json();
    
    // Grouping by island
    const groups = {};
    data.features.forEach(f => {
      const island = getVal(f.properties, "Island") || "Other";
      if (!groups[island]) groups[island] = [];
      groups[island].push(f);
    });

    islandDisplayOrder.forEach(name => {
      if (groups[name]) {
        // ... include your Leaflet layer creation logic here ...
        populateSidebar(name, groups[name]);
      }
    });
    
    showInfoHint();
  } catch (error) {
    // Error Handling (Suggestion #11)
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
 * 6. INITIALIZATION
 */
loadMapData();

// ... Append your existing flySelectionIntoVisibleArea and toggle logic here ...
