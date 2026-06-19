// Deterministic-ish flight simulator. Generates a fleet of flights between
// real airport pairs, each cruising along its great-circle route. Positions
// are computed from wall-clock time so every poll returns fresh movement.
//
// Output matches the OpenSky-normalised shape plus extra route metadata used
// by the tracking endpoint (origin/destination/etaTs).
import { AIRPORTS } from '../airports.js';
import { haversineKm, bearing, destination } from '../../lib/geo.js';
import { config } from '../../config.js';

const AIRLINES = [
  { code: 'AA', name: 'American Airlines' },
  { code: 'UA', name: 'United Airlines' },
  { code: 'DL', name: 'Delta Air Lines' },
  { code: 'BA', name: 'British Airways' },
  { code: 'AF', name: 'Air France' },
  { code: 'LH', name: 'Lufthansa' },
  { code: 'EK', name: 'Emirates' },
  { code: 'QR', name: 'Qatar Airways' },
  { code: 'SQ', name: 'Singapore Airlines' },
  { code: 'AI', name: 'Air India' },
  { code: 'CX', name: 'Cathay Pacific' },
  { code: 'NH', name: 'ANA' },
  { code: 'QF', name: 'Qantas' },
];

const CRUISE_KMH = 880; // typical jet cruise
const FLEET_SIZE = 240;

// Simple seeded PRNG so the fleet is stable across restarts within a run.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let fleet = null;

function buildFleet() {
  const rnd = mulberry32(20260616);
  const list = [];
  for (let i = 0; i < FLEET_SIZE; i++) {
    let a = AIRPORTS[Math.floor(rnd() * AIRPORTS.length)];
    let b = AIRPORTS[Math.floor(rnd() * AIRPORTS.length)];
    let guard = 0;
    while (b.iata === a.iata && guard++ < 10) {
      b = AIRPORTS[Math.floor(rnd() * AIRPORTS.length)];
    }
    const airline = AIRLINES[Math.floor(rnd() * AIRLINES.length)];
    const number = 100 + Math.floor(rnd() * 8900);
    const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    const durationS = (distKm / CRUISE_KMH) * 3600;
    // Random phase so flights are at different points along their route.
    const phase = rnd();
    list.push({
      flightNo: `${airline.code}${number}`,
      airline: airline.name,
      origin: a,
      destination: b,
      distKm,
      durationS,
      phase,
      icao24: (0x100000 + Math.floor(rnd() * 0xefffff)).toString(16),
    });
  }
  return list;
}

// Progress 0..1 along route, looping with a layover gap between cycles.
function progressFor(f, nowS) {
  const layoverS = 2700; // 45 min turnaround
  const cycle = f.durationS + layoverS;
  const t = (nowS * 1 + f.phase * cycle) % cycle;
  if (t >= f.durationS) return { frac: 1, onGround: true, layoverLeftS: cycle - t };
  return { frac: t / f.durationS, onGround: false, layoverLeftS: 0 };
}

export function fetchFlights() {
  if (!fleet) fleet = buildFleet();
  const speed = config.sim.speed;
  const nowS = (Date.now() / 1000) * speed;
  return fleet.map((f) => {
    const { frac, onGround } = progressFor(f, nowS);
    const brng = bearing(f.origin.lat, f.origin.lon, f.destination.lat, f.destination.lon);
    const [lat, lon] = destination(f.origin.lat, f.origin.lon, brng, f.distKm * frac);
    const remainingKm = f.distKm * (1 - frac);
    // ETA reflects the (time-lapsed) rate at which the flight actually arrives.
    const etaTs = Date.now() + ((remainingKm / CRUISE_KMH) * 3600 * 1000) / speed;
    return {
      id: f.icao24,
      callsign: f.flightNo,
      flightNo: f.flightNo,
      airline: f.airline,
      country: '',
      lat,
      lon,
      altitudeM: onGround ? 0 : 10500,
      speedKmh: onGround ? 0 : CRUISE_KMH,
      heading: brng,
      verticalRateMs: 0,
      onGround,
      source: 'sim',
      // route metadata (extra; ignored by the global map layer)
      origin: f.origin,
      dest: f.destination,
      etaTs,
      progress: frac,
    };
  });
}

// Look up a single simulated flight by flight number (case-insensitive).
export function findFlight(flightNo) {
  const all = fetchFlights();
  const q = flightNo.replace(/\s+/g, '').toUpperCase();
  return all.find((f) => (f.flightNo || '').toUpperCase() === q) || null;
}
