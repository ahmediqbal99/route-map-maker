/* Route Map Maker — Leaflet annotation tool */

const ICONS = [
  { key: 'mobile',    emo: '🚓', name: 'Mobile Unit' },
  { key: 'bike',      emo: '🏍️', name: 'Police Bike' },
  { key: 'police',    emo: '👮', name: 'HC / PC' },
  { key: 'lady',      emo: '👩‍✈️', name: 'Lady Police' },
  { key: 'asi',       emo: '⭐', name: 'ASI / SI' },
  { key: 'officer',   emo: '🎖️', name: 'DSP / SP' },
  { key: 'scout',     emo: '🧑‍🤝‍🧑', name: 'Scout' },
  { key: 'iron',      emo: '🚧', name: 'Iron Barricade' },
  { key: 'cement',    emo: '🧱', name: 'Cement Barricade' },
  { key: 'post',      emo: '🛖', name: 'Picket / Post' },
  { key: 'command',   emo: '🏠', name: 'Command Post' },
  { key: 'check',     emo: '🛑', name: 'Check Point' },
  { key: 'snr',       emo: '👁️', name: 'Snap Checking' },
  { key: 'parking',   emo: '🅿️', name: 'Parking' },
  { key: 'camera',    emo: '📷', name: 'CCTV' },
  { key: 'ambulance', emo: '🚑', name: 'Ambulance' },
  { key: 'fire',      emo: '🚒', name: 'Fire / Rescue' },
  { key: 'bomb',      emo: '💣', name: 'Bomb Disposal' },
  { key: 'dog',       emo: '🐕', name: 'Dog Squad' },
  { key: 'flag',      emo: '🚩', name: 'Point' },
];
const iconByKey = Object.fromEntries(ICONS.map(i => [i.key, i]));

const STORE_KEY = 'routemap.project.v1';

/* ---------- Map + base layers ---------- */
const map = L.map('map', { doubleClickZoom: true, zoomControl: true }).setView([24.8607, 67.0011], 16);

const bases = {
  sat: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, crossOrigin: true, attribution: 'Esri World Imagery' }),
  street: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, crossOrigin: true, attribution: '© OpenStreetMap' }),
};
const labelsOverlay = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 20, crossOrigin: true });

/* ---------- Mobile sidebar toggle (defined early: setBase() calls maybeCloseSidebar) ---------- */
const sidebarEl = document.getElementById('sidebar');
const backdropEl = document.getElementById('backdrop');
function openSidebar(o) { sidebarEl.classList.toggle('open', o); backdropEl.classList.toggle('show', o); }
function maybeCloseSidebar() { if (window.innerWidth <= 760) openSidebar(false); }
document.getElementById('menu-toggle').addEventListener('click', () => openSidebar(!sidebarEl.classList.contains('open')));
backdropEl.addEventListener('click', () => openSidebar(false));

let currentBase = 'sat';
function setBase(name) {
  Object.values(bases).forEach(l => map.removeLayer(l));
  map.removeLayer(labelsOverlay);
  if (name === 'hybrid') { bases.sat.addTo(map); labelsOverlay.addTo(map); }
  else { bases[name].addTo(map); }
  currentBase = name;
  document.querySelectorAll('.base-btn').forEach(b => b.classList.toggle('active', b.dataset.base === name));
  if (typeof maybeCloseSidebar === 'function') maybeCloseSidebar();
}
setBase('sat');
document.querySelectorAll('.base-btn').forEach(b =>
  b.addEventListener('click', () => setBase(b.dataset.base)));

/* ---------- State ---------- */
let tool = 'select';          // 'select' | 'callout' | 'route' | 'icon:<key>'
let selected = null;          // selected item
const items = new Set();      // all annotation items
let draft = null;             // route being drawn

function setTool(t) {
  if (tool === 'route' && t !== 'route') finishRoute();
  tool = t;
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  document.querySelectorAll('.pal').forEach(b => b.classList.toggle('active', 'icon:' + b.dataset.icon === t));
  map.getContainer().style.cursor = (t === 'select') ? '' : 'crosshair';
  maybeCloseSidebar();
}

/* ---------- Icon palette ---------- */
const palette = document.getElementById('icon-palette');
ICONS.forEach(ic => {
  const b = document.createElement('button');
  b.className = 'pal';
  b.dataset.icon = ic.key;
  b.innerHTML = `<span class="emo">${ic.emo}</span><span>${ic.name}</span>`;
  b.addEventListener('click', () => setTool('icon:' + ic.key));
  palette.appendChild(b);
});
document.querySelectorAll('.tool').forEach(b =>
  b.addEventListener('click', () => setTool(b.dataset.tool)));

/* ---------- Selection helpers ---------- */
function select(item) {
  if (selected && selected.el) selected.el.classList.remove('selected');
  if (selected && selected.type === 'route') styleRoute(selected, false);
  selected = item;
  if (item && item.el) item.el.classList.add('selected');
  if (item && item.type === 'route') {
    styleRoute(item, true);
    document.getElementById('route-color').value = item.color;
    document.getElementById('route-width').value = item.width;
  }
  updateActions();
}

/* Floating action bar for the selected item (touch-friendly edit/delete) */
function updateActions() {
  const bar = document.getElementById('item-actions');
  if (!bar) return;
  if (!selected) { bar.hidden = true; return; }
  bar.hidden = false;
  document.getElementById('ia-edit').style.display = selected.edit ? '' : 'none';
}

/* ---------- Icon markers ---------- */
function addIcon(latlng, key, label) {
  const ic = iconByKey[key];
  const html = `<div class="marker-icon"><span class="emo">${ic.emo}</span><span class="lbl" data-key="${key}">${label ?? ic.name}</span></div>`;
  const marker = L.marker(latlng, {
    draggable: true,
    icon: L.divIcon({ html, className: '', iconSize: null, iconAnchor: [0, 0] }),
  }).addTo(map);

  const item = { type: 'icon', key, marker, el: null };
  marker.on('add', () => { item.el = marker.getElement().querySelector('.marker-icon'); wireMarker(item); });
  // getElement is available right after add:
  item.el = marker.getElement()?.querySelector('.marker-icon');
  if (item.el) wireMarker(item);
  items.add(item);
  ensureLegend(key);
  return item;
}

function wireMarker(item) {
  const el = item.el;
  const lbl = el.querySelector('.lbl');
  item.marker.on('click', () => select(item));
  item.edit = () => {
    select(item);
    item.marker.dragging.disable();
    lbl.setAttribute('contenteditable', 'true');
    lbl.focus();
    window.getSelection().selectAllChildren(lbl);
  };
  el.addEventListener('dblclick', (e) => { e.stopPropagation(); item.edit(); });
  lbl.addEventListener('blur', () => {
    lbl.removeAttribute('contenteditable');
    item.marker.dragging.enable();
  });
  lbl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lbl.blur(); } });
}

/* ---------- Callout boxes ---------- */
function addCallout(latlng, title, body) {
  const html = `<div class="callout"><div class="ttl">${title ?? 'Title'}</div><div class="body">${body ?? 'Details…'}</div></div>`;
  const marker = L.marker(latlng, {
    draggable: true,
    icon: L.divIcon({ html, className: '', iconSize: null, iconAnchor: [0, 0] }),
  }).addTo(map);
  const item = { type: 'callout', marker, el: marker.getElement()?.querySelector('.callout') };
  const wire = () => {
    item.el = marker.getElement().querySelector('.callout');
    const ttl = item.el.querySelector('.ttl');
    const body = item.el.querySelector('.body');
    marker.on('click', () => select(item));
    const editField = (f) => {
      select(item);
      marker.dragging.disable();
      f.setAttribute('contenteditable', 'true');
      f.focus();
      window.getSelection().selectAllChildren(f);
    };
    item.edit = () => editField(ttl);
    item.el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      editField(e.target.closest('.body') ? body : ttl);
    });
    [ttl, body].forEach(f => {
      f.addEventListener('blur', () => { f.removeAttribute('contenteditable'); marker.dragging.enable(); });
    });
    ttl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ttl.blur(); } });
  };
  if (item.el) wire(); else marker.on('add', wire);
  items.add(item);
  return item;
}

/* ---------- Route arrows ---------- */
function newRoute(color, width) {
  const route = {
    type: 'route',
    latlngs: [],
    color: color || document.getElementById('route-color').value,
    width: +(width || document.getElementById('route-width').value),
    polyline: null, decorator: null, vertices: [],
  };
  route.polyline = L.polyline([], { color: route.color, weight: route.width, opacity: .95 }).addTo(map);
  route.decorator = L.polylineDecorator(route.polyline, { patterns: [] }).addTo(map);
  route.polyline.on('click', () => { if (tool === 'select') select(route); });
  items.add(route);
  return route;
}

function styleRoute(route, sel) {
  route.polyline.setStyle({ color: route.color, weight: route.width });
  route.decorator.setPatterns([{
    offset: '100%', repeat: 0,
    symbol: L.Symbol.arrowHead({ pixelSize: 12 + route.width, polygon: true,
      pathOptions: { stroke: false, fillOpacity: 1, color: route.color } }),
  }]);
  if (sel) route.polyline.setStyle({ dashArray: '8 6' });
  else route.polyline.setStyle({ dashArray: null });
}

function redrawRoute(route) {
  route.polyline.setLatLngs(route.latlngs);
  route.decorator.setPaths(route.polyline);
  styleRoute(route, selected === route);
}

function addVertex(route, latlng) {
  route.latlngs.push(latlng);
  const vm = L.marker(latlng, {
    draggable: true,
    icon: L.divIcon({ className: '', html: '<div class="vertex" style="width:16px;height:16px"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
  }).addTo(map);
  const idx = route.vertices.length;
  vm.on('drag', () => { route.latlngs[idx] = vm.getLatLng(); redrawRoute(route); });
  vm.on('click', () => { if (tool === 'select') select(route); });
  route.vertices.push(vm);
  redrawRoute(route);
}

function finishRoute() {
  if (draft && draft.latlngs.length < 2) removeItem(draft);
  draft = null;
  document.getElementById('route-hint').textContent = 'Click points on the map to draw. Double-click to finish.';
}

/* route style controls */
document.getElementById('route-color').addEventListener('input', e => {
  if (selected && selected.type === 'route') { selected.color = e.target.value; styleRoute(selected, true); }
});
document.getElementById('route-width').addEventListener('input', e => {
  if (selected && selected.type === 'route') { selected.width = +e.target.value; styleRoute(selected, true); }
});

/* ---------- Map clicks ---------- */
map.on('click', (e) => {
  if (tool.startsWith('icon:')) {
    addIcon(e.latlng, tool.split(':')[1]);
  } else if (tool === 'callout') {
    select(addCallout(e.latlng));
  } else if (tool === 'route') {
    if (!draft) { draft = newRoute(); select(draft); document.getElementById('route-hint').textContent = 'Double-click to finish the route.'; }
    addVertex(draft, e.latlng);
  } else {
    select(null);
  }
});
map.on('dblclick', (e) => { if (tool === 'route') { L.DomEvent.stop(e); finishRoute(); } });

/* The polyline decorator (arrowhead) does not auto-redraw on zoom/pan — refresh it. */
map.on('zoomend moveend', () => {
  items.forEach(it => {
    if (it.type === 'route' && it.latlngs.length >= 2) {
      it.decorator.setPaths(it.polyline);
      styleRoute(it, selected === it);
    }
  });
});

/* ---------- Delete ---------- */
function removeItem(item) {
  if (!item) return;
  if (item.marker) map.removeLayer(item.marker);
  if (item.polyline) map.removeLayer(item.polyline);
  if (item.decorator) map.removeLayer(item.decorator);
  if (item.vertices) item.vertices.forEach(v => map.removeLayer(v));
  items.delete(item);
  if (selected === item) { selected = null; updateActions(); }
}
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
    const editing = document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true';
    if (editing) return;
    removeItem(selected); selected = null; updateActions();
  }
});

/* ---------- Floating action bar buttons ---------- */
document.getElementById('ia-edit').addEventListener('click', () => { if (selected && selected.edit) selected.edit(); });
document.getElementById('ia-delete').addEventListener('click', () => { if (selected) { removeItem(selected); select(null); } });
document.getElementById('ia-close').addEventListener('click', () => select(null));

/* ---------- Legend ---------- */
const legendState = new Map(); // key -> label
function ensureLegend(key) {
  if (!legendState.has(key)) { legendState.set(key, iconByKey[key].name); renderLegend(); }
}
function renderLegend() {
  // sidebar editor
  const ed = document.getElementById('legend-editor');
  ed.innerHTML = '';
  legendState.forEach((label, key) => {
    const row = document.createElement('div');
    row.className = 'leg-row';
    row.innerHTML = `<span class="emo">${iconByKey[key].emo}</span>`;
    const inp = document.createElement('input');
    inp.value = label;
    inp.addEventListener('input', () => { legendState.set(key, inp.value); renderLegendBox(); });
    const del = document.createElement('button');
    del.textContent = '✕';
    del.addEventListener('click', () => { legendState.delete(key); renderLegend(); });
    row.append(inp, del);
    ed.appendChild(row);
  });
  renderLegendBox();
}
function renderLegendBox() {
  const box = document.getElementById('legend-box');
  const show = document.getElementById('show-legend').checked;
  box.style.display = show && legendState.size ? 'block' : 'none';
  box.innerHTML = '<h4>Legend</h4>';
  legendState.forEach((label, key) => {
    const row = document.createElement('div');
    row.className = 'lg';
    row.innerHTML = `<span class="emo">${iconByKey[key].emo}</span>`;
    const span = document.createElement('span');
    span.className = 'lg-label';
    span.textContent = label;
    span.title = 'Tap to edit';
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      if (span.getAttribute('contenteditable') === 'true') return;
      span.setAttribute('contenteditable', 'true');
      span.focus();
      window.getSelection().selectAllChildren(span);
    });
    span.addEventListener('blur', () => {
      span.removeAttribute('contenteditable');
      legendState.set(key, span.textContent.trim() || iconByKey[key].name);
      renderLegend();
    });
    span.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); span.blur(); } });
    row.appendChild(span);
    box.appendChild(row);
  });
}
document.getElementById('show-legend').addEventListener('change', renderLegendBox);

/* ---------- Icon / callout size ---------- */
const iconSizeInput = document.getElementById('icon-size');
const calloutSizeInput = document.getElementById('callout-size');
function applyIconScale(v) { document.documentElement.style.setProperty('--icon-scale', v); }
function applyCalloutScale(v) { document.documentElement.style.setProperty('--callout-scale', v); }
iconSizeInput.addEventListener('input', () => applyIconScale(iconSizeInput.value));
calloutSizeInput.addEventListener('input', () => applyCalloutScale(calloutSizeInput.value));

/* ---------- Save / Load ---------- */
function serialize() {
  const out = { title: document.getElementById('map-title').innerText, base: currentBase,
    iconScale: iconSizeInput.value, calloutScale: calloutSizeInput.value,
    showLegend: document.getElementById('show-legend').checked,
    legend: [...legendState.entries()].map(([key, label]) => ({ key, label })),
    view: { center: map.getCenter(), zoom: map.getZoom() }, items: [] };
  items.forEach(it => {
    if (it.type === 'icon') {
      out.items.push({ type: 'icon', key: it.key, latlng: it.marker.getLatLng(), label: it.el?.querySelector('.lbl')?.innerText });
    } else if (it.type === 'callout') {
      out.items.push({ type: 'callout', latlng: it.marker.getLatLng(),
        title: it.el?.querySelector('.ttl')?.innerText, body: it.el?.querySelector('.body')?.innerText });
    } else if (it.type === 'route' && it.latlngs.length >= 2) {
      out.items.push({ type: 'route', latlngs: it.latlngs.map(p => [p.lat, p.lng]), color: it.color, width: it.width });
    }
  });
  return out;
}

function load(data) {
  // clear
  [...items].forEach(removeItem);
  legendState.clear();
  document.getElementById('map-title').innerText = data.title || 'Security Arrangements';
  if (data.base) setBase(data.base);
  if (data.iconScale) { iconSizeInput.value = data.iconScale; applyIconScale(data.iconScale); }
  if (data.calloutScale) { calloutSizeInput.value = data.calloutScale; applyCalloutScale(data.calloutScale); }
  if (data.view) map.setView(data.view.center, data.view.zoom);
  (data.legend || []).forEach(l => legendState.set(l.key, l.label));
  document.getElementById('show-legend').checked = data.showLegend !== false;
  (data.items || []).forEach(it => {
    if (it.type === 'icon') addIcon(it.latlng, it.key, it.label);
    else if (it.type === 'callout') addCallout(it.latlng, it.title, it.body);
    else if (it.type === 'route') {
      const r = newRoute(it.color, it.width);
      it.latlngs.forEach(p => addVertex(r, L.latLng(p[0], p[1])));
    }
  });
  renderLegend();
}

document.getElementById('btn-save').addEventListener('click', () => {
  localStorage.setItem(STORE_KEY, JSON.stringify(serialize()));
  toast('Saved to this browser');
});
document.getElementById('btn-export-json').addEventListener('click', () => {
  download('route-map.json', JSON.stringify(serialize(), null, 2), 'application/json');
});
document.getElementById('file-import').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { load(JSON.parse(r.result)); toast('Project imported'); } catch { toast('Invalid file'); } };
  r.readAsText(f);
});

/* ---------- PNG export ---------- */
document.getElementById('btn-png').addEventListener('click', async () => {
  const prevTool = tool; setTool('select'); select(null);
  toast('Rendering PNG…');
  const node = document.getElementById('map-wrap');
  try {
    const canvas = await html2canvas(node, { useCORS: true, allowTaint: false, backgroundColor: null, scale: 2,
      ignoreElements: el => el.classList && el.classList.contains('leaflet-control-zoom') });
    canvas.toBlob(blob => { downloadBlob('route-map.png', blob); toast('PNG exported'); });
  } catch (err) {
    console.error(err); toast('Export failed — see console');
  }
  setTool(prevTool);
});

/* ---------- utils ---------- */
function download(name, text, mime) { downloadBlob(name, new Blob([text], { type: mime })); }
function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Location search (Nominatim / OSM) ---------- */
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimer;

async function geocode(q) {
  if (!q.trim()) { searchResults.innerHTML = ''; return; }
  searchResults.innerHTML = '<div class="sr-msg">Searching…</div>';
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(q);
    const res = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } });
    const list = await res.json();
    if (!list.length) { searchResults.innerHTML = '<div class="sr-msg">No results.</div>'; return; }
    searchResults.innerHTML = '';
    list.forEach(r => {
      const d = document.createElement('div');
      d.className = 'sr-item';
      d.textContent = r.display_name;
      d.title = r.display_name;
      d.addEventListener('click', () => {
        map.setView([+r.lat, +r.lon], r.boundingbox ? 17 : 16);
        searchResults.innerHTML = '';
        maybeCloseSidebar();
      });
      searchResults.appendChild(d);
    });
  } catch (e) {
    searchResults.innerHTML = '<div class="sr-msg">Search failed (no connection?).</div>';
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => geocode(searchInput.value), 500);
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { clearTimeout(searchTimer); geocode(searchInput.value); }
});
document.getElementById('search-btn').addEventListener('click', () => geocode(searchInput.value));

/* ---------- boot ---------- */
setTool('select');
const saved = localStorage.getItem(STORE_KEY);
if (saved) { try { load(JSON.parse(saved)); } catch {} }
