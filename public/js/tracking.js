// Tracking UI for flights AND ships. Triggered by typing a flight number or
// by clicking any plane/ship marker (via the track-flight / track-ship events
// dispatched from map.js). Renders the detail panel — route, ETA, weather
// zones, per-zone clocks — plus a CO₂ footprint with relatable comparisons.
import { showTracked, clearTracked } from './map.js';
import { setTrackedZone } from './clock.js';
import { openCompareWith } from './compare.js';

const input = document.getElementById('flight-input');
const btn = document.getElementById('track-btn');
const msg = document.getElementById('search-msg');
const panel = document.getElementById('track-panel');
const content = document.getElementById('track-content');
const closeBtn = document.getElementById('track-close');

let current = null; // { kind: 'flight'|'ship', key } for periodic refresh

const fmtKg = (kg) => (kg >= 1000 ? (kg / 1000).toFixed(1) + ' t' : Math.round(kg) + ' kg');

function fmtEta(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const mins = Math.round((ts - Date.now()) / 60000);
  if (mins <= 0) return 'Arriving';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · in ${h > 0 ? h + 'h ' : ''}${m}m`;
}

function zonesHtml(zones) {
  return zones
    .map((z) => {
      const wx = z.weather
        ? `${z.weather.condition}, ${Math.round(z.weather.tempC)}°C, wind ${z.weather.windKmh ?? '?'} km/h`
        : 'weather unavailable';
      return `<div class="tk-zone">
        <div class="z-head"><span class="z-label">${z.label}</span><span class="z-time">${z.localTime} ${z.offset}</span></div>
        <div class="z-wx">${wx} · ${z.timeZone}</div>
      </div>`;
    })
    .join('');
}

function carbonHtml(co2, kindWord) {
  const cmp = co2.comparison;
  if (!cmp) {
    return `<div class="tk-section-title">Carbon</div>
      <div class="tk-note">Live emission rate: <span class="tk-co2">${co2.ratePerHourKg.toFixed(0)} kg/h</span>.</div>`;
  }
  return `<div class="tk-section-title">Carbon footprint</div>
    <div class="tk-co2box">
      <div class="co2-big"><span class="tk-co2">${fmtKg(cmp.tripKg)}</span> for this ${kindWord} <i>(${co2.routeKm.toLocaleString()} km)</i></div>
      <ul class="cmp-list">
        <li>🚗 ≈ <b>${cmp.carKm.toLocaleString()} car-km</b> (same CO₂ as driving that far)</li>
        <li>🌳 ≈ <b>${cmp.treesYear}</b> trees soaking up CO₂ for a year</li>
        <li>🚆 same distance by train ≈ <b>${fmtKg(cmp.trainKg)}</b> — this ${kindWord} is ~<b>${(cmp.vsCarPct / 100).toFixed(0)}×</b> a car per km</li>
      </ul>
      <button class="cmp-open" id="tk-compare" data-km="${co2.routeKm}">⚖ Compare all transport modes</button>
    </div>`;
}

function renderFlight(data) {
  const f = data.flight;
  const route = f.origin && f.dest
    ? `<div class="tk-route">
         <div><div class="tk-iata">${f.origin.iata}</div><div class="tk-city">${f.origin.city}</div></div>
         <div class="arrow">✈ ───▶</div>
         <div><div class="tk-iata">${f.dest.iata}</div><div class="tk-city">${f.dest.city}</div></div>
       </div>
       <div class="tk-progress"><div style="width:${Math.round((f.progress || 0) * 100)}%"></div></div>`
    : '';
  const status = f.onGround ? 'On ground / layover' : 'Airborne';

  content.innerHTML = `
    <div class="tk-fn">${f.flightNo}</div>
    <div class="tk-airline">${f.airline || f.callsign} · source: ${f.source}</div>
    ${route}
    <div class="tk-grid">
      <div class="tk-stat"><div class="k">Speed</div><div class="v">${f.speedKmh} km/h</div></div>
      <div class="tk-stat"><div class="k">Altitude</div><div class="v">${f.altitudeM != null ? (f.altitudeM / 1000).toFixed(1) + ' km' : '—'}</div></div>
      <div class="tk-stat"><div class="k">Heading</div><div class="v">${f.heading}°</div></div>
      <div class="tk-stat"><div class="k">Status</div><div class="v">${status}</div></div>
      <div class="tk-stat"><div class="k">ETA</div><div class="v" style="font-size:13px">${fmtEta(f.etaTs)}</div></div>
      <div class="tk-stat"><div class="k">CO₂ now</div><div class="v tk-co2">${data.carbon.ratePerHourKg.toFixed(0)} kg/h</div></div>
    </div>
    <div class="tk-section-title">Weather &amp; local time along route</div>
    ${zonesHtml(data.zones)}
    ${carbonHtml(data.carbon, 'flight')}
    ${data.note ? `<div class="tk-note">${data.note}</div>` : ''}
  `;
  finishRender(f, data, f.flightNo);
}

function renderShip(data) {
  const s = data.ship;
  const route = s.origin && s.dest
    ? `<div class="tk-route">
         <div><div class="tk-iata">${s.origin.name}</div><div class="tk-city">port</div></div>
         <div class="arrow">🚢 ──▶</div>
         <div><div class="tk-iata">${s.dest.name}</div><div class="tk-city">port</div></div>
       </div>
       <div class="tk-progress"><div style="width:${Math.round((s.progress || 0) * 100)}%"></div></div>`
    : '';

  content.innerHTML = `
    <div class="tk-fn">${s.name}</div>
    <div class="tk-airline">${s.vesselType} · source: ${s.source}</div>
    ${route}
    <div class="tk-grid">
      <div class="tk-stat"><div class="k">Speed</div><div class="v">${s.speedKmh} km/h</div></div>
      <div class="tk-stat"><div class="k">Heading</div><div class="v">${s.heading}°</div></div>
      <div class="tk-stat"><div class="k">ETA</div><div class="v" style="font-size:13px">${fmtEta(s.etaTs)}</div></div>
      <div class="tk-stat"><div class="k">CO₂ now</div><div class="v tk-co2">${data.carbon.ratePerHourKg.toFixed(0)} kg/h</div></div>
    </div>
    <div class="tk-section-title">Weather &amp; local time along route</div>
    ${zonesHtml(data.zones)}
    ${carbonHtml(data.carbon, 'voyage')}
    ${data.note ? `<div class="tk-note">${data.note}</div>` : ''}
  `;
  finishRender(s, data, s.name);
}

function finishRender(vehicle, data, label) {
  panel.classList.remove('hidden');
  showTracked(vehicle, data.zones);
  setTrackedZone({ timeZone: data.positionLocalTime.timeZone, label });
  const cmpBtn = document.getElementById('tk-compare');
  if (cmpBtn) cmpBtn.addEventListener('click', () => openCompareWith(+cmpBtn.dataset.km));
}

async function track(query) {
  msg.textContent = '';
  try {
    const res = await fetch(`/api/track?flight=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok || !data.found) {
      msg.textContent = data.error || 'Flight not found.';
      return;
    }
    current = { kind: 'flight', key: query };
    renderFlight(data);
  } catch {
    msg.textContent = 'Network error contacting tracker.';
  }
}

async function trackShip(id) {
  msg.textContent = '';
  try {
    const res = await fetch(`/api/track?ship=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok || !data.found) {
      msg.textContent = data.error || 'Ship not found.';
      return;
    }
    current = { kind: 'ship', key: id };
    renderShip(data);
  } catch {
    msg.textContent = 'Network error contacting tracker.';
  }
}

// Triggers: search box + marker clicks.
btn.addEventListener('click', () => {
  const v = input.value.trim();
  if (v) track(v);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && input.value.trim()) track(input.value.trim());
});
document.addEventListener('track-flight', (e) => track(e.detail));
document.addEventListener('track-ship', (e) => trackShip(e.detail));

closeBtn.addEventListener('click', () => {
  panel.classList.add('hidden');
  current = null;
  clearTracked();
  setTrackedZone(null);
});

// Keep the tracked vehicle's panel live.
setInterval(() => {
  if (!current) return;
  if (current.kind === 'flight') track(current.key);
  else trackShip(current.key);
}, 10000);
