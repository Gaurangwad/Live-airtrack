// Centralised runtime configuration. Reads from process.env with sane
// defaults so the app boots with zero configuration.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (avoids an extra dependency).
function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const config = {
  port: num(process.env.PORT, 3000),

  // True on serverless platforms (Vercel sets VERCEL=1). Disables anything
  // that depends on a long-running process (persistent WebSockets, intervals).
  serverless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),

  flights: {
    mode: process.env.FLIGHTS_MODE || 'auto', // auto | real | sim
    refreshMs: num(process.env.FLIGHTS_REFRESH_MS, 8000),
    opensky: {
      clientId: process.env.OPENSKY_CLIENT_ID || '',
      clientSecret: process.env.OPENSKY_CLIENT_SECRET || '',
    },
  },

  ships: {
    mode: process.env.SHIPS_MODE || 'auto', // auto | real | sim
    refreshMs: num(process.env.SHIPS_REFRESH_MS, 10000),
    aisstream: {
      apiKey: process.env.AISSTREAM_API_KEY || '',
    },
  },

  weather: {
    enabled: (process.env.WEATHER || 'on').toLowerCase() !== 'off',
  },

  // Simulation time-lapse. Simulated flights/ships advance this many times
  // faster than real time so their movement is clearly visible on a world
  // map (real positions at 1× barely move per second). Real feeds (OpenSky /
  // AISStream) always move at true speed regardless of this value.
  sim: {
    speed: Math.max(1, num(process.env.SIM_SPEED, 60)),
  },

  // Carbon emission model. Values are deliberately transparent and
  // tunable; see server/carbon.js for how they are applied.
  carbon: {
    // kg CO2 emitted per kilometre travelled, by transport class.
    flightKgPerKm: 11.0, // typical narrow/wide-body blended average
    shipKgPerKm: 40.0, // ocean cargo/tanker blended average
    // Reference modes used for the "this trip = X" comparisons.
    carKgPerKm: 0.17, // average petrol passenger car
    trainKgPerKm: 0.035, // electric/diesel intercity rail
    treeKgPerYear: 21.0, // CO2 a mature tree absorbs per year
  },
};
