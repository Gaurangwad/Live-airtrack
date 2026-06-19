// Express application factory. Exported as the default handler so it can run
// both as a standalone server (server/index.js) and as a serverless function
// (Vercel @vercel/node treats an Express app as a (req,res) handler).
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  refreshIfStale,
  getFlights,
  getShips,
  getStatus,
} from './store.js';
import { computeCarbon } from './carbon.js';
import { handleTrack } from './routes/track.js';
import { config } from './config.js';
import { AIRPORTS } from './providers/airports.js';
import { PORTS } from './providers/ships/simulator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(compression());

// Ensure fleet snapshots are fresh for every API request. In a long-running
// server this is a cheap no-op (background polling keeps data warm); in
// serverless it lazily computes data on each invocation.
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    try {
      await refreshIfStale();
    } catch {
      /* providers self-handle errors; never block the request */
    }
  }
  next();
});

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// ── API ────────────────────────────────────────────────────────

// All flights (optionally trimmed to a viewport via bbox query params).
app.get('/api/flights', (req, res) => {
  let flights = getFlights();
  const { lamin, lomin, lamax, lomax } = req.query;
  if (lamin && lomin && lamax && lomax) {
    const a = +lamin, b = +lomin, c = +lamax, d = +lomax;
    flights = flights.filter((f) => f.lat >= a && f.lat <= c && f.lon >= b && f.lon <= d);
  }
  res.json({
    count: flights.length,
    source: getStatus().flightSource,
    flights: flights.map((f) => ({
      id: f.id,
      cs: f.callsign,
      fn: f.flightNo || null,
      lat: +f.lat.toFixed(4),
      lon: +f.lon.toFixed(4),
      hd: Math.round(f.heading || 0),
      sp: Math.round(f.speedKmh || 0),
      al: f.altitudeM != null ? Math.round(f.altitudeM) : null,
      og: f.onGround ? 1 : 0,
    })),
  });
});

// All ships.
app.get('/api/ships', (req, res) => {
  let ships = getShips();
  const { lamin, lomin, lamax, lomax } = req.query;
  if (lamin && lomin && lamax && lomax) {
    const a = +lamin, b = +lomin, c = +lamax, d = +lomax;
    ships = ships.filter((s) => s.lat >= a && s.lat <= c && s.lon >= b && s.lon <= d);
  }
  res.json({
    count: ships.length,
    source: getStatus().shipSource,
    ships: ships.map((s) => ({
      id: s.id,
      nm: s.name,
      ty: s.vesselType || null,
      lat: +s.lat.toFixed(4),
      lon: +s.lon.toFixed(4),
      hd: Math.round(s.heading || 0),
      sp: Math.round(s.speedKmh || 0),
    })),
  });
});

// Live carbon snapshot (computed deterministically; serverless-safe).
app.get('/api/carbon', (_req, res) => {
  res.json(computeCarbon(getFlights(), getShips()));
});

// Flight-number / ship tracking with weather/ETA/zone clocks.
app.get('/api/track', handleTrack);

// Place search (airports + seaports) for "zoom to" navigation.
app.get('/api/places', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const airports = AIRPORTS.map((a) => ({
    type: 'airport',
    label: `${a.iata} · ${a.name}`,
    sub: a.city,
    lat: a.lat,
    lon: a.lon,
  }));
  const ports = PORTS.map((p) => ({
    type: 'port',
    label: p.name,
    sub: 'Seaport',
    lat: p.lat,
    lon: p.lon,
  }));
  let all = [...airports, ...ports];
  if (q) {
    all = all.filter(
      (p) => p.label.toLowerCase().includes(q) || (p.sub || '').toLowerCase().includes(q)
    );
  }
  res.json({ places: all.slice(0, 12) });
});

// Carbon reference factors (used by the comparison modal).
app.get('/api/factors', (_req, res) => res.json(config.carbon));

// Health / data-source status.
app.get('/api/status', (_req, res) => res.json(getStatus()));

// SPA fallback (used when this app also serves static assets, e.g. locally).
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

export default app;
