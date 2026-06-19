// Ship simulator. Generates vessels travelling between major seaports along
// great-circle approximations of shipping lanes. Output matches the
// AISStream-normalised shape.
import { haversineKm, bearing, destination } from '../../lib/geo.js';
import { config } from '../../config.js';

export const PORTS = [
  { name: 'Shanghai', lat: 30.6, lon: 122.1 },
  { name: 'Singapore', lat: 1.26, lon: 103.8 },
  { name: 'Rotterdam', lat: 51.95, lon: 4.06 },
  { name: 'Los Angeles', lat: 33.73, lon: -118.26 },
  { name: 'New York', lat: 40.47, lon: -73.9 },
  { name: 'Santos', lat: -24.0, lon: -46.3 },
  { name: 'Durban', lat: -29.87, lon: 31.05 },
  { name: 'Mumbai', lat: 18.92, lon: 72.83 },
  { name: 'Hamburg', lat: 53.5, lon: 9.9 },
  { name: 'Dubai (Jebel Ali)', lat: 25.0, lon: 55.06 },
  { name: 'Busan', lat: 35.05, lon: 129.06 },
  { name: 'Sydney', lat: -33.85, lon: 151.25 },
  { name: 'Panama', lat: 8.9, lon: -79.5 },
  { name: 'Suez', lat: 29.9, lon: 32.55 },
];

const VESSEL_TYPES = [
  { type: 'Container Ship', kmh: 41 },
  { type: 'Bulk Carrier', kmh: 26 },
  { type: 'Oil Tanker', kmh: 28 },
  { type: 'LNG Carrier', kmh: 35 },
  { type: 'Car Carrier', kmh: 37 },
];

const SHIP_NAMES = [
  'Ever', 'Maersk', 'MSC', 'Cosco', 'Nordic', 'Pacific', 'Atlantic', 'Ocean',
  'Star', 'Global', 'Pioneer', 'Horizon', 'Voyager', 'Endeavour', 'Aurora',
];
const FLEET_SIZE = 140;

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
  const rnd = mulberry32(987654321);
  const list = [];
  for (let i = 0; i < FLEET_SIZE; i++) {
    let a = PORTS[Math.floor(rnd() * PORTS.length)];
    let b = PORTS[Math.floor(rnd() * PORTS.length)];
    let guard = 0;
    while (b.name === a.name && guard++ < 10) b = PORTS[Math.floor(rnd() * PORTS.length)];
    const vt = VESSEL_TYPES[Math.floor(rnd() * VESSEL_TYPES.length)];
    const nm = SHIP_NAMES[Math.floor(rnd() * SHIP_NAMES.length)];
    const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    list.push({
      id: String(200000000 + Math.floor(rnd() * 99999999)), // MMSI-like
      name: `${nm} ${String.fromCharCode(65 + (i % 26))}${100 + (i % 900)}`,
      vesselType: vt.type,
      kmh: vt.kmh,
      origin: a,
      destination: b,
      distKm,
      durationS: (distKm / vt.kmh) * 3600,
      phase: rnd(),
    });
  }
  return list;
}

export function fetchShips() {
  if (!fleet) fleet = buildFleet();
  const speed = config.sim.speed;
  const nowS = (Date.now() / 1000) * speed;
  return fleet.map((s) => {
    const portStayS = 14400; // 4h in port
    const cycle = s.durationS + portStayS;
    const t = (nowS + s.phase * cycle) % cycle;
    const inPort = t >= s.durationS;
    const frac = inPort ? 1 : t / s.durationS;
    const brng = bearing(s.origin.lat, s.origin.lon, s.destination.lat, s.destination.lon);
    const [lat, lon] = destination(s.origin.lat, s.origin.lon, brng, s.distKm * frac);
    const remainingKm = s.distKm * (1 - frac);
    return {
      id: s.id,
      name: s.name,
      vesselType: s.vesselType,
      lat,
      lon,
      speedKmh: inPort ? 0 : s.kmh,
      heading: brng,
      source: 'sim',
      origin: s.origin,
      dest: s.destination,
      etaTs: Date.now() + ((remainingKm / s.kmh) * 3600 * 1000) / speed,
      progress: frac,
      ts: Date.now(),
    };
  });
}
