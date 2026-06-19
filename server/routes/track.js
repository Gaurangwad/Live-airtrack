// Tracking endpoint for both flights and ships.
//   GET /api/track?flight=UA123   — track a flight by number/callsign
//   GET /api/track?ship=<id>      — track a ship by id (MMSI)
// Resolves the vehicle from the live fleet, computes ETA/layover, samples
// weather "zones" along the route, reports the local time in the zone it is
// currently in, and returns CO2 figures plus relatable comparisons.
import { config } from '../config.js';
import { getFlights, getShips } from '../store.js';
import { samplePath, haversineKm } from '../lib/geo.js';
import { localTimeAt } from '../lib/timezone.js';
import { getWeather } from '../providers/weather/openmeteo.js';
import { flightRateKgPerSec, shipRateKgPerSec } from '../carbon.js';

// Normalise a flight-number query for matching ("BA 117" -> "BA117").
const norm = (s) => (s || '').replace(/\s+/g, '').toUpperCase();

function findFlight(query) {
  const q = norm(query);
  const flights = getFlights();
  let hit = flights.find((f) => norm(f.flightNo) === q || norm(f.callsign) === q);
  if (hit) return hit;
  const qLoose = q.replace(/([A-Z]+)0*(\d+)/, '$1$2');
  return flights.find((f) => norm(f.callsign).replace(/([A-Z]+)0*(\d+)/, '$1$2') === qLoose) || null;
}

// Weather cache so repeated polls don't hammer Open-Meteo (10 min TTL).
const wxCache = new Map();
async function weatherAt(lat, lon) {
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const cached = wxCache.get(key);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return cached.wx;
  const wx = await getWeather(lat, lon);
  wxCache.set(key, { wx, ts: Date.now() });
  return wx;
}

// Build weather + local-time zones along a route, or a single zone at the
// current position when no route is known.
async function buildZones(origin, dest, labels, cur) {
  if (origin && dest) {
    const pts = samplePath(origin.lat, origin.lon, dest.lat, dest.lon, 5);
    return Promise.all(
      pts.map(async ([lat, lon], i) => {
        const lt = localTimeAt(lat, lon);
        return {
          label: labels[i] || `Zone ${i + 1}`,
          lat,
          lon,
          timeZone: lt.timeZone,
          localTime: lt.localTime,
          offset: lt.offset,
          weather: await weatherAt(lat, lon),
        };
      })
    );
  }
  const lt = localTimeAt(cur.lat, cur.lon);
  return [
    {
      label: 'Current position',
      lat: cur.lat,
      lon: cur.lon,
      timeZone: lt.timeZone,
      localTime: lt.localTime,
      offset: lt.offset,
      weather: await weatherAt(cur.lat, cur.lon),
    },
  ];
}

// Relatable comparisons for a trip's total CO2 (kg).
function comparisons(tripKg) {
  if (tripKg == null) return null;
  const c = config.carbon;
  return {
    tripKg,
    carKm: Math.round(tripKg / c.carKgPerKm),
    trainKg: Math.round((tripKg / c.flightKgPerKm) * c.trainKgPerKm), // same distance by train
    treesYear: +(tripKg / c.treeKgPerYear).toFixed(1),
    vsCarPct: Math.round((c.flightKgPerKm / c.carKgPerKm) * 100), // per-km, plane vs car
  };
}

export async function handleTrack(req, res) {
  if (req.query.ship) return handleShip(req, res);
  return handleFlight(req, res);
}

async function handleFlight(req, res) {
  const query = req.query.flight || req.query.q || '';
  if (!query.trim()) return res.status(400).json({ error: 'Provide ?flight=<flight number>' });

  const f = findFlight(query);
  if (!f) {
    return res.status(404).json({
      error: `Flight "${query}" not found among ${getFlights().length} live flights.`,
      hint: 'Try a flight number currently airborne. Real feeds use ICAO callsigns (e.g. UAL123); the demo fleet uses IATA codes (e.g. UA123).',
    });
  }

  const hasRoute = !!(f.origin && f.dest);
  const here = localTimeAt(f.lat, f.lon);
  const zones = await buildZones(
    f.origin,
    f.dest,
    ['Departure', 'Early cruise', 'Mid route', 'Late cruise', 'Arrival'],
    f
  );

  const rateKgPerSec = flightRateKgPerSec(f.speedKmh);
  const routeKm = hasRoute ? haversineKm(f.origin.lat, f.origin.lon, f.dest.lat, f.dest.lon) : null;
  const tripKg = routeKm != null ? config.carbon.flightKgPerKm * routeKm : null;

  res.json({
    query,
    found: true,
    kind: 'flight',
    flight: {
      flightNo: f.flightNo || f.callsign,
      callsign: f.callsign,
      airline: f.airline || null,
      lat: f.lat,
      lon: f.lon,
      speedKmh: Math.round(f.speedKmh),
      altitudeM: f.altitudeM,
      heading: Math.round(f.heading),
      onGround: f.onGround,
      source: f.source,
      progress: f.progress ?? null,
      etaTs: f.etaTs ?? null,
      origin: f.origin ? { iata: f.origin.iata, city: f.origin.city, name: f.origin.name } : null,
      dest: f.dest ? { iata: f.dest.iata, city: f.dest.city, name: f.dest.name } : null,
    },
    positionLocalTime: here,
    zones,
    carbon: {
      rateKgPerSec,
      ratePerHourKg: rateKgPerSec * 3600,
      estimatedTripKg: tripKg,
      routeKm: routeKm != null ? Math.round(routeKm) : null,
      comparison: comparisons(tripKg),
    },
    note: hasRoute
      ? null
      : 'This is a live real-feed flight; origin/destination/ETA are not published by the open data source, so only live position, speed and altitude are shown.',
  });
}

async function handleShip(req, res) {
  const id = String(req.query.ship);
  const s = getShips().find((v) => String(v.id) === id);
  if (!s) {
    return res.status(404).json({ error: `Ship "${id}" not found among live vessels.` });
  }

  const hasRoute = !!(s.origin && s.dest);
  const here = localTimeAt(s.lat, s.lon);
  const zones = await buildZones(
    s.origin,
    s.dest,
    ['Departure port', 'Early leg', 'Mid ocean', 'Late leg', 'Arrival port'],
    s
  );

  const rateKgPerSec = shipRateKgPerSec(s.speedKmh);
  const routeKm = hasRoute ? haversineKm(s.origin.lat, s.origin.lon, s.dest.lat, s.dest.lon) : null;
  // Reuse the car/train comparison shape but with the ship per-km factor.
  const tripKg = routeKm != null ? config.carbon.shipKgPerKm * routeKm : null;
  const cmp = tripKg != null
    ? {
        tripKg,
        carKm: Math.round(tripKg / config.carbon.carKgPerKm),
        trainKg: Math.round((tripKg / config.carbon.shipKgPerKm) * config.carbon.trainKgPerKm),
        treesYear: +(tripKg / config.carbon.treeKgPerYear).toFixed(1),
        vsCarPct: Math.round((config.carbon.shipKgPerKm / config.carbon.carKgPerKm) * 100),
      }
    : null;

  res.json({
    found: true,
    kind: 'ship',
    ship: {
      id: s.id,
      name: s.name,
      vesselType: s.vesselType || 'Vessel',
      lat: s.lat,
      lon: s.lon,
      speedKmh: Math.round(s.speedKmh),
      heading: Math.round(s.heading),
      source: s.source,
      progress: s.progress ?? null,
      etaTs: s.etaTs ?? null,
      origin: s.origin ? { name: s.origin.name } : null,
      dest: s.dest ? { name: s.dest.name } : null,
    },
    positionLocalTime: here,
    zones,
    carbon: {
      rateKgPerSec,
      ratePerHourKg: rateKgPerSec * 3600,
      estimatedTripKg: tripKg,
      routeKm: routeKm != null ? Math.round(routeKm) : null,
      comparison: cmp,
    },
    note: hasRoute
      ? null
      : 'Live AIS vessel; route/ETA are not broadcast, so only live position and speed are shown.',
  });
}
