// Fleet store. Works in two modes:
//   • Long-running server: startPolling() keeps snapshots fresh in the
//     background (real WebSocket feeds, intervals).
//   • Serverless (e.g. Vercel): no background loops survive between
//     invocations, so refreshIfStale() recomputes data on demand per request.
// Simulators are time-deterministic, so on-demand computation is correct.
import { config } from './config.js';
import * as openSky from './providers/flights/opensky.js';
import * as flightSim from './providers/flights/simulator.js';
import * as aisStream from './providers/ships/aisstream.js';
import * as shipSim from './providers/ships/simulator.js';

const state = {
  flights: [],
  ships: [],
  flightSource: 'sim',
  shipSource: 'sim',
  lastFlightError: null,
  lastShipError: null,
  startedAt: Date.now(),
  flightsAt: 0,
  shipsAt: 0,
};

// ── Flights ────────────────────────────────────────────────────
async function pollFlights() {
  const mode = config.flights.mode;
  const canTryReal = mode === 'auto' || mode === 'real';
  if (canTryReal) {
    try {
      const data = await openSky.fetchFlights();
      if (data.length) {
        state.flights = data;
        state.flightSource = 'opensky';
        state.lastFlightError = null;
        state.flightsAt = Date.now();
        return;
      }
      throw new Error('OpenSky returned no states');
    } catch (err) {
      state.lastFlightError = err.message;
      if (mode === 'real') {
        state.flights = [];
        state.flightSource = 'opensky(error)';
        state.flightsAt = Date.now();
        return;
      }
      // fall through to simulator in auto mode
    }
  }
  state.flights = flightSim.fetchFlights();
  state.flightSource = 'sim';
  state.flightsAt = Date.now();
}

// ── Ships ──────────────────────────────────────────────────────
// AISStream needs a persistent WebSocket, which only works in a
// long-running process. In serverless we always use the simulator.
let aisStarted = false;
function pollShips() {
  const mode = config.ships.mode;
  const canTryReal = mode === 'auto' || mode === 'real';
  if (canTryReal && config.ships.aisstream.apiKey && !config.serverless) {
    if (!aisStarted) aisStarted = aisStream.start();
    const data = aisStream.fetchShips();
    if (data.length || mode === 'real') {
      state.ships = data;
      state.shipSource = aisStream.isConnected() ? 'aisstream' : 'aisstream(connecting)';
      state.shipsAt = Date.now();
      return;
    }
  }
  state.ships = shipSim.fetchShips();
  state.shipSource = 'sim';
  state.shipsAt = Date.now();
}

// Long-running mode: keep snapshots warm in the background.
export function startPolling() {
  pollFlights();
  pollShips();
  setInterval(pollFlights, config.flights.refreshMs);
  setInterval(pollShips, config.ships.refreshMs);
}

// Serverless / on-demand mode: refresh only when the cached snapshot is
// older than the configured cadence. Cheap no-op when polling keeps it warm.
export async function refreshIfStale() {
  const now = Date.now();
  const jobs = [];
  if (now - state.flightsAt > config.flights.refreshMs) jobs.push(pollFlights());
  if (now - state.shipsAt > config.ships.refreshMs) pollShips();
  if (jobs.length) await Promise.all(jobs);
}

export function getFlights() {
  return state.flights;
}
export function getShips() {
  return state.ships;
}
export function getStatus() {
  return {
    flightSource: state.flightSource,
    shipSource: state.shipSource,
    flightCount: state.flights.length,
    shipCount: state.ships.length,
    lastFlightError: state.lastFlightError,
    lastShipError: state.lastShipError,
    startedAt: state.startedAt,
    serverTime: Date.now(),
    simSpeed: config.sim.speed,
  };
}
