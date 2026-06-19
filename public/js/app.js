// App entry point: polls the fleet + carbon APIs and drives the UI modules.
import { renderFlights, renderShips } from './map.js';
import { applyCarbon } from './carbon.js';
import './tracking.js';
import './clock.js';
import './places.js';
import './compare.js';

const elFlightCount = document.getElementById('flight-count');
const elShipCount = document.getElementById('ship-count');
const elSource = document.getElementById('source-line');
const toggleFlights = document.getElementById('toggle-flights');
const toggleShips = document.getElementById('toggle-ships');

const state = { flights: [], ships: [], flightSource: 'sim', shipSource: 'sim', simSpeed: 1 };

// Simulated data advances at the server's sim speed; real feeds move at true
// speed (multiplier 1). The map uses this to dead-reckon at the right rate.
const flightMult = () => (state.flightSource && state.flightSource.startsWith('sim') ? state.simSpeed : 1);
const shipMult = () => (state.shipSource && state.shipSource.startsWith('sim') ? state.simSpeed : 1);

async function pollFlights() {
  try {
    const res = await fetch('/api/flights');
    const data = await res.json();
    state.flights = data.flights;
    state.flightSource = data.source;
    elFlightCount.textContent = data.count;
    renderFlights(state.flights, toggleFlights.checked, flightMult());
  } catch {
    /* ignore */
  }
}

async function pollShips() {
  try {
    const res = await fetch('/api/ships');
    const data = await res.json();
    state.ships = data.ships;
    state.shipSource = data.source;
    elShipCount.textContent = data.count;
    renderShips(state.ships, toggleShips.checked, shipMult());
  } catch {
    /* ignore */
  }
}

async function pollCarbon() {
  try {
    const res = await fetch('/api/carbon');
    applyCarbon(await res.json());
  } catch {
    /* ignore */
  }
}

async function updateSources() {
  try {
    const s = await (await fetch('/api/status')).json();
    if (s.simSpeed) state.simSpeed = s.simSpeed;
    const tag = s.simSpeed && s.simSpeed !== 1 ? ` · ${s.simSpeed}× time-lapse` : '';
    elSource.textContent = `flights: ${s.flightSource} · ships: ${s.shipSource}${tag}`;
  } catch {
    /* ignore */
  }
}

toggleFlights.addEventListener('change', () => renderFlights(state.flights, toggleFlights.checked, flightMult()));
toggleShips.addEventListener('change', () => renderShips(state.ships, toggleShips.checked, shipMult()));

// Initial + interval polling.
function start() {
  updateSources(); // learn simSpeed first
  pollFlights();
  pollShips();
  pollCarbon();
  setInterval(pollFlights, 5000);
  setInterval(pollShips, 7000);
  setInterval(pollCarbon, 2000);
  setInterval(updateSources, 15000);
}
start();
