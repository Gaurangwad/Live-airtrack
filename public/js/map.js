// Map + marker layers with smooth client-side motion.
//
// Server fixes arrive only every several seconds. To make aircraft and ships
// glide continuously (rather than teleport on each poll), every marker keeps a
// kinematic "anchor" (last known position/time/heading/speed) and an animation
// loop dead-reckons its position along its heading between fixes. When a fresh
// fix arrives the anchor is reset, gently correcting any drift.

export const map = L.map('map', {
  worldCopyJump: true,
  zoomControl: true,
  preferCanvas: true,
  minZoom: 2,
}).setView([25, 10], 3);

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }
).addTo(map);

const flightLayer = L.layerGroup().addTo(map);
const shipLayer = L.layerGroup().addTo(map);

// id -> { marker, anchorLat, anchorLon, hd, speedKmh, mult, anchorTs, headShown }
const flightMarkers = new Map();
const shipMarkers = new Map();

let trackedKey = null; // normalised flight number / callsign being followed
const normKey = (s) => (s || '').replace(/\s+/g, '').toUpperCase();

// ── Geo: great-circle destination from a point given heading & distance ──
const R = 6371, D2R = Math.PI / 180, R2D = 180 / Math.PI;
function destPoint(lat, lon, brngDeg, distKm) {
  const d = distKm / R, b = brngDeg * D2R, la1 = lat * D2R, lo1 = lon * D2R;
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b)
  );
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2)
    );
  return [la2 * R2D, ((lo2 * R2D + 540) % 360) - 180];
}

// SVG glyphs — rotated via CSS transform on the inner element.
function planeIcon(color) {
  // Aircraft silhouette pointing "up" (north); rotated by heading.
  return `<svg width="22" height="22" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="M256 16c-18 0-30 30-30 80v66L42 274c-6 4-10 11-10 19v26c0 7 7 12 14 10l180-50v92l-46 34c-4 3-6 7-6 12v18c0 6 6 11 12 9l60-18 60 18c6 2 12-3 12-9v-18c0-5-2-9-6-12l-46-34v-92l180 50c7 2 14-3 14-10v-26c0-8-4-15-10-19L286 162V96c0-50-12-80-30-80z"/></svg>`;
}
function shipIcon(color) {
  return `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="M256 24l40 120H216l40-120zM120 176h272l28 80H92l28-80zM48 288h416l-44 132c-4 12-15 20-28 20H120c-13 0-24-8-28-20L48 288z"/></svg>`;
}

function makeIcon(html, cls, rotation) {
  return L.divIcon({
    className: `marker-icon ${cls}`,
    html: `<div style="transform:rotate(${rotation}deg);transform-origin:50% 50%">${html}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function flightPopup(f) {
  return `<b>${f.fn || f.cs}</b><br>${f.sp} km/h${
    f.al != null ? ` · ${(f.al / 1000).toFixed(1)} km alt` : ''
  }${f.og ? ' · on ground' : ''}<br><small>type it in the Track box to follow</small>`;
}
function shipPopup(s) {
  return `<b>${s.nm}</b><br>${s.ty || 'Vessel'}<br>${s.sp} km/h`;
}

// ── Data updates (called on each poll) ──────────────────────────
// mult scales dead-reckoning speed to match a server-side simulation speed
// (1 for real feeds, which already move at true speed).
export function renderFlights(flights, show, mult = 1) {
  if (!show) {
    flightLayer.clearLayers();
    flightMarkers.clear();
    return;
  }
  const now = performance.now();
  const seen = new Set();
  for (const f of flights) {
    seen.add(f.id);
    const isTracked =
      trackedKey && (normKey(f.fn) === trackedKey || normKey(f.cs) === trackedKey);
    const color = isTracked ? '#4ea1ff' : '#ffd34e';
    const cls = isTracked ? 'marker-flight marker-tracked' : 'marker-flight';
    let e = flightMarkers.get(f.id);
    if (!e) {
      const marker = L.marker([f.lat, f.lon], { icon: makeIcon(planeIcon(color), cls, f.hd) });
      marker.bindPopup(flightPopup(f));
      const trackId = f.fn || f.cs;
      marker.on('click', () =>
        document.dispatchEvent(new CustomEvent('track-flight', { detail: trackId }))
      );
      marker.addTo(flightLayer);
      e = { marker, headShown: Math.round(f.hd), color: '', cls: '' };
      flightMarkers.set(f.id, e);
    }
    // Reset kinematic anchor to the new server fix.
    e.anchorLat = f.lat;
    e.anchorLon = f.lon;
    e.hd = f.hd;
    e.speedKmh = f.og ? 0 : f.sp;
    e.mult = mult;
    e.anchorTs = now;
    e.marker.setPopupContent(flightPopup(f));
    // Re-skin only when colour/class (tracked state) or heading changed.
    const head = Math.round(f.hd);
    if (e.color !== color || e.cls !== cls || e.headShown !== head) {
      e.marker.setIcon(makeIcon(planeIcon(color), cls, f.hd));
      e.color = color;
      e.cls = cls;
      e.headShown = head;
    }
  }
  for (const [id, e] of flightMarkers) {
    if (!seen.has(id)) {
      flightLayer.removeLayer(e.marker);
      flightMarkers.delete(id);
    }
  }
}

export function renderShips(ships, show, mult = 1) {
  if (!show) {
    shipLayer.clearLayers();
    shipMarkers.clear();
    return;
  }
  const now = performance.now();
  const seen = new Set();
  for (const s of ships) {
    seen.add(s.id);
    let e = shipMarkers.get(s.id);
    if (!e) {
      const marker = L.marker([s.lat, s.lon], { icon: makeIcon(shipIcon('#4ed6c0'), 'marker-ship', s.hd) });
      marker.bindPopup(shipPopup(s));
      const shipId = s.id;
      marker.on('click', () =>
        document.dispatchEvent(new CustomEvent('track-ship', { detail: shipId }))
      );
      marker.addTo(shipLayer);
      e = { marker, headShown: Math.round(s.hd) };
      shipMarkers.set(s.id, e);
    }
    e.anchorLat = s.lat;
    e.anchorLon = s.lon;
    e.hd = s.hd;
    e.speedKmh = s.sp;
    e.mult = mult;
    e.anchorTs = now;
    e.marker.setPopupContent(shipPopup(s));
    const head = Math.round(s.hd);
    if (e.headShown !== head) {
      e.marker.setIcon(makeIcon(shipIcon('#4ed6c0'), 'marker-ship', s.hd));
      e.headShown = head;
    }
  }
  for (const [id, e] of shipMarkers) {
    if (!seen.has(id)) {
      shipLayer.removeLayer(e.marker);
      shipMarkers.delete(id);
    }
  }
}

// ── Animation loop: dead-reckon every marker between server fixes ──
function advance(entries, now) {
  for (const e of entries.values()) {
    if (!e.speedKmh) continue;
    const elapsedS = ((now - e.anchorTs) / 1000) * (e.mult || 1);
    const distKm = (e.speedKmh * elapsedS) / 3600;
    if (distKm <= 0) continue;
    const [lat, lon] = destPoint(e.anchorLat, e.anchorLon, e.hd, distKm);
    e.marker.setLatLng([lat, lon]);
  }
}

let lastFrame = 0;
function loop(now) {
  // Throttle to ~30fps — smooth enough, and far lighter than 60fps on
  // hundreds of DOM markers.
  if (now - lastFrame > 33) {
    advance(flightMarkers, now);
    advance(shipMarkers, now);
    lastFrame = now;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── Tracked-flight route + weather zones ────────────────────────
let routeLine = null;
let zoneMarkers = [];

export function showTracked(flight, zones) {
  trackedKey = normKey(flight.flightNo || flight.callsign);

  clearRoute();
  if (flight.origin && flight.dest && zones.length > 1) {
    const pts = zones.map((z) => [z.lat, z.lon]);
    routeLine = L.polyline(pts, { color: '#4ea1ff', weight: 2, dashArray: '6 6', opacity: 0.8 }).addTo(map);
  }
  for (const z of zones) {
    const wx = z.weather ? `${z.weather.condition}, ${Math.round(z.weather.tempC)}°C` : 'weather n/a';
    const mk = L.circleMarker([z.lat, z.lon], {
      radius: 5,
      color: '#4ea1ff',
      fillColor: '#0d1320',
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip(`${z.label}: ${z.localTime} ${z.offset}<br>${wx}`, { direction: 'top' })
      .addTo(map);
    zoneMarkers.push(mk);
  }
  map.flyTo([flight.lat, flight.lon], Math.max(map.getZoom(), 4), { duration: 1.2 });
}

export function clearTracked() {
  trackedKey = null;
  clearRoute();
}

// Fly to a searched airport/port and drop a temporary highlight marker.
let placeMarker = null;
export function flyToPlace(place) {
  if (placeMarker) map.removeLayer(placeMarker);
  placeMarker = L.marker([place.lat, place.lon], {
    icon: L.divIcon({
      className: 'place-pin',
      html: `<div class="pin ${place.type}"><span>${place.type === 'airport' ? '✈' : '⚓'}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    }),
  })
    .bindTooltip(`${place.label}`, { permanent: false, direction: 'top' })
    .addTo(map);
  map.flyTo([place.lat, place.lon], 7, { duration: 1.4 });
}

export function clearRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  for (const z of zoneMarkers) map.removeLayer(z);
  zoneMarkers = [];
}
