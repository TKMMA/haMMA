const allIslandLayers = {};
const SERVICE_LAYER_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandDisplayOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kahoʻolawe"];
let activeSelectionMarker = null;

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

const syncSidebarToggleUI = () => {
  if (!mapSidebarEl || !sidebarToggleEl) return;
  const collapsed = mapSidebarEl.classList.contains("collapsed");
  sidebarToggleEl.textContent = collapsed ? "▶" : "◀";
  sidebarToggleEl.title = collapsed ? "Open Menu" : "Close Menu";
  sidebarToggleEl.setAttribute("aria-label", collapsed ? "Open Menu" : "Close Menu");
};

window.toggleSidebar = () => {
  if (!mapSidebarEl) return;
  mapSidebarEl.classList.toggle("collapsed");
  syncSidebarToggleUI();
};

syncSidebarToggleUI();

const map = L.map("map", { zoomControl: false }).setView([20.4, -157.4], 7);
L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Esri" }
).addTo(map);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Labels", pane: "shadowPane" }
).addTo(map);

function getLeftOverlayWidth() {
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

function panSelectionIntoVisibleArea(latlng) {
  if (!latlng) return;

  const mapSize = map.getSize();
  const leftOverlayWidth = getLeftOverlayWidth();
  const visibleCenterX = leftOverlayWidth + ((mapSize.x - leftOverlayWidth) / 2);

  const point = map.latLngToContainerPoint(latlng);
  const deltaX = Math.round(visibleCenterX - point.x);

  map.panBy([deltaX, 0], { animate: true, duration: 0.35 });
}

function flashLayerBorder(layer) {
  if (!layer || typeof layer.setStyle !== "function") return;

  const originalStyle = {
    color: layer.options.color,
    weight: layer.options.weight,
    fillOpacity: layer.options.fillOpacity
  };

  layer.setStyle({ color: "#ffd60a", weight: 5, fillOpacity: originalStyle.fillOpacity ?? 0.3 });

  setTimeout(() => {
    layer.setStyle({
      color: originalStyle.color ?? "#005a87",
      weight: originalStyle.weight ?? 1.2,
      fillOpacity: originalStyle.fillOpacity ?? 0.3
    });
  }, 550);
}

function updateClickMarker(latlng) {
  if (activeSelectionMarker) {
    map.removeLayer(activeSelectionMarker);
  }

  activeSelectionMarker = L.marker(latlng).addTo(map);
}

function getTargetFitZoom(bounds) {
  const leftOverlayWidth = getLeftOverlayWidth();
  return map.getBoundsZoom(bounds, false, L.point(leftOverlayWidth + 30, 30));
}

function panSelectionToFeatureCenter(bounds) {
  const center = bounds.getCenter();
  panSelectionIntoVisibleArea(center);
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
  list.classList.toggle("active");
  header.classList.toggle("expanded");
};

window.toggleLayerVisibility = (event, islandName) => {
  event.stopPropagation();
  const layer = allIslandLayers[islandName];
  if (!layer) return;

  if (event.target.checked) map.addLayer(layer);
  else map.removeLayer(layer);
};

window.zoomToArea = (islandName, areaName) => {
  const layerGroup = allIslandLayers[islandName];
  if (!layerGroup) return;

  layerGroup.eachLayer((layer) => {
    const name = getVal(layer.feature.properties, "Full_Name") || getVal(layer.feature.properties, "Full_name");
    if (name === areaName) {
      const bounds = layer.getBounds();

      openInfoPanel(bounds.getCenter(), [layer.feature], { source: "menu" });

      const targetFitZoom = getTargetFitZoom(bounds);
      const currentZoom = map.getZoom();

      if (currentZoom < targetFitZoom) {
        const leftOverlayWidth = getLeftOverlayWidth();
        map.fitBounds(bounds, {
          animate: true,
          paddingTopLeft: [leftOverlayWidth + 30, 30],
          paddingBottomRight: [30, 30]
        });
      } else {
        panSelectionToFeatureCenter(bounds);
      }

      flashLayerBorder(layer);
    }
  });
};

window.filterSidebar = () => {
  const raw = document.getElementById("area-search")?.value || "";
  const term = normalizeHawaiianText(raw);

  document.querySelectorAll(".island-group").forEach((group) => {
    let hasMatch = false;

    const items = group.querySelectorAll(".area-item");
    items.forEach((item) => {
      const itemNorm = normalizeHawaiianText(item.innerText);
      const match = term === "" ? true : itemNorm.includes(term);

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

      <div class="mmpopup__scroll" style="padding: 15px;">
        ${summaryCardHtml}
        ${sectionDividerHtml}
        ${individualCardsHtml}
      </div>
    </div>
  `;

  document.getElementById("info-sidebar").classList.add("active");

  if (options.source === "map" && latlng) {
    updateClickMarker(latlng);
  }

}

window.closeInfoPanel = () => document.getElementById("info-sidebar").classList.remove("active");

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
                  if (l.getBounds().contains(e.latlng)) hits.push(l.feature);
                });
              }
            });

            if (hits.length) {
              openInfoPanel(e.latlng, hits, { source: "map" });
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

loadAllFromSingleService();
