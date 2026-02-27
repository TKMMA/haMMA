const SERVICE_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kahoʻolawe"];
const allLayers = {};
let activeMarker = null;

const paneStage = document.getElementById("pane-stage");
const isMobile = () => window.innerWidth <= 768;

// HELPER: Case-insensitive attribute finder to stop "undefined"
const getAttr = (props, key) => {
    const found = Object.keys(props).find(k => k.toLowerCase() === key.toLowerCase());
    return found ? props[found] : null;
};

/** --- MAP SETUP --- **/
const map = L.map("map", { zoomControl: false }).setView([20.4, -157.4], 7);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}').addTo(map);

/** --- DATA LOADING --- **/
async function init() {
    try {
        const res = await fetch(`${SERVICE_URL}/query?where=1%3D1&outFields=*&f=geojson`);
        const data = await res.json();
        const grouped = {};

        data.features.forEach(f => {
            const isl = getAttr(f.properties, "Island") || "Other";
            if (!grouped[isl]) grouped[isl] = [];
            grouped[isl].push(f);
        });

        const list = document.getElementById("island-list");
        islandOrder.forEach(name => {
            if (grouped[name]) {
                const layer = L.geoJSON(grouped[name], {
                    style: (feat) => ({ color: getAttr(feat.properties, "FillColor") || "#005a87", weight: 2, fillOpacity: 0.4 }),
                    onEachFeature: (f, l) => l.on('click', (e) => { L.DomEvent.stopPropagation(e); showInfo(f.properties, e.latlng); })
                }).addTo(map);
                allLayers[name] = layer;
                
                const div = document.createElement("div");
                div.innerHTML = `
                    <div class="island-header" onclick="this.nextElementSibling.classList.toggle('is-open')">
                        <span>${name}</span><span>▼</span>
                    </div>
                    <div class="island-areas">
                        ${grouped[name].map(f => `<div class="area-item" onclick="focusArea('${name}','${getAttr(f.properties, 'Area_Name')}')">${getAttr(f.properties, "Area_Name")}</div>`).join('')}
                    </div>`;
                list.appendChild(div);
            }
        });
        updateBanners();
    } catch (e) { console.error(e); }
}

window.focusArea = (island, area) => {
    const l = allLayers[island].getLayers().find(x => getAttr(x.feature.properties, "Area_Name") === area);
    if (l) {
        map.fitBounds(l.getBounds(), { padding: [100, 100] });
        showInfo(l.feature.properties, l.getBounds().getCenter());
    }
};

/** --- PANEL LOGIC --- **/
function showInfo(props, latlng) {
    const title = getAttr(props, "Area_Name") || "Details";
    const rules = getAttr(props, "Fishing_Rules_Summary") || "No summary available.";
    
    document.getElementById("info-content").innerHTML = `
        <div style="padding:20px; background:#fff; border-bottom:1px solid #eee;">
            <h3 style="margin:0;">${title}</h3>
            <small>Island: ${getAttr(props, "Island")}</small>
        </div>
        <div class="info-card">
            <h4>Fishing Rules</h4>
            <div style="font-size:13px; line-height:1.6;">${rules.replace(/\n/g, '<br>• ')}</div>
        </div>`;

    if (isMobile()) paneStage.classList.add("is-info-view");
    else document.getElementById("info-sidebar").classList.add("active");

    if (latlng) {
        if (activeMarker) map.removeLayer(activeMarker);
        activeMarker = L.marker(latlng).addTo(map);
    }
}

function updateBanners() {
    if (!isMobile()) return;
    const create = (el, title, btn, fn) => {
        let b = el.querySelector(".sheet-banner") || document.createElement("div");
        b.className = "sheet-banner";
        b.innerHTML = `<button onclick="${fn}">${btn}</button><strong>${title}</strong><div style="width:50px"></div>`;
        if (!el.querySelector(".sheet-banner")) el.prepend(b);
    };
    create(document.getElementById("map-sidebar"), "Areas", "HIDE", "document.getElementById('pane-stage').classList.add('is-minimized')");
    create(document.getElementById("info-sidebar"), "Details", "BACK", "document.getElementById('pane-stage').classList.remove('is-info-view')");
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", updateBanners);
