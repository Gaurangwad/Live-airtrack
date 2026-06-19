# Live AirTrack ✈ 🚢

Real-time global flight **and** ship tracking on a single map, with a live
worldwide carbon-emission counter, flight-number lookup, weather-along-route,
ETA/layover, and per-zone clocks.

Built as a small, modular **Node/Express + Leaflet** app. Every external data
feed has a **built-in simulation fallback**, so the app runs fully even with no
API keys and no internet — and seamlessly upgrades to live data when keys are
present.

---

## Features

| Feature | Description |
|---|---|
| 🌍 Global map | All flights and ships rendered as rotated, heading-aware glyphs on a dark CARTO basemap (Leaflet). Toggle each layer on/off. |
| 🔎 Flight lookup | Type a flight number (e.g. `UA123`, `BA117`) **or click any plane/ship** to follow it: live speed, altitude, heading, status, ETA and layover. Ships show vessel type and voyage route. |
| 📍 Place search | Search any airport or seaport in the navbar and the map flies to it. |
| ⚖ CO₂ comparison | Each tracked vehicle shows its trip footprint as "= X car-km", trees/year and vs-train. A navbar **Compare** modal pits flight vs ship vs car vs train for any distance. |
| 🌦 Weather along route | The route is split into zones; each shows local weather (Open-Meteo) sampled at intervals. |
| 🕐 Per-zone clocks | The **time at the flight** (its current timezone) shows bottom-right, above **your local time**. Each route zone shows its own local time. |
| 🌫 Live CO₂ counter | Top-left running total of CO₂ emitted since you opened the app, ticking in real time. **Hover** to break it down by flights vs ships, plus per-vehicle CO₂ for a tracked flight. |
| 🔌 Pluggable feeds | OpenSky (flights), AISStream (ships), Open-Meteo (weather) — each with a simulator fallback. |

> **PNR note:** Real PNR lookup isn't possible — PNRs are airline-private and
> not exposed by any public API. The app uses **flight-number** tracking, which
> is the publicly available identifier.

---

## Quick start

```bash
npm install
npm start
# open http://localhost:3000
```

With **no configuration**, the app boots on simulated fleets (≈240 flights,
≈140 ships) so you can see everything working immediately. The status line
(bottom-left) shows which source each layer is using.

### Enable live data

Copy `.env.example` to `.env` and fill in any keys you have:

```bash
cp .env.example .env
```

- **Flights — OpenSky Network:** works anonymously (rate-limited). For reliable
  live data, create a free account and set `OPENSKY_CLIENT_ID` /
  `OPENSKY_CLIENT_SECRET`. If OpenSky is unreachable or rate-limited, the app
  falls back to the simulator automatically (`FLIGHTS_MODE=auto`).
- **Ships — AISStream.io:** free API key → `AISSTREAM_API_KEY`. Without it, the
  ship simulator runs.
- **Weather — Open-Meteo:** free, **no key needed**. Set `WEATHER=off` to
  disable.

Force a source with `FLIGHTS_MODE` / `SHIPS_MODE` = `auto` | `real` | `sim`.

---

## Deployment

### Vercel (serverless)

The app ships with `vercel.json` and `api/index.js`, so it deploys to Vercel
out of the box:

1. Import the repo in Vercel (no build command needed).
2. Static assets are served from `public/`; all `/api/*` routes run as a
   serverless function (`api/index.js`) that reuses the same Express app.
3. Add any API keys as **Environment Variables** in the Vercel dashboard
   (`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, etc.).

Because serverless functions are stateless and short-lived, data is computed
**per request** instead of via background polling. Two consequences on Vercel:

- **Ships** use the simulator — live AIS needs a persistent WebSocket, which a
  serverless function can't hold open.
- **Flights** use OpenSky if credentials are set, otherwise the simulator.
- The CO₂ counter reports the running total **for the current UTC day** (a
  stateless, deterministic figure) rather than "since the process started".

### Long-running hosts (Render / Railway / Fly.io / a VPS)

For **fully live** data including real-time AIS ships, deploy as a normal
Node process:

```bash
npm install && npm start   # runs server/index.js with background polling
```

These platforms keep the process alive, so the persistent AIS WebSocket and
background refresh loops work.

## Architecture

```
vercel.json             Vercel routing (static + serverless function)
api/
  index.js              Vercel serverless entry (exports the Express app)
server/
  app.js                Express app factory (routes, used by both entries)
  index.js              standalone launcher (listen + background polling)
  config.js             env-driven config (+ tiny .env loader)
  store.js              polls providers, caches snapshots, picks real-vs-sim
  carbon.js             emission model + running accumulator
  lib/geo.js            haversine / bearing / great-circle sampling
  lib/timezone.js       offline IANA tz resolution (tz-lookup) + formatting
  routes/track.js       flight lookup, ETA, weather zones, zone clocks
  providers/
    flights/opensky.js  OpenSky REST (OAuth2 client-credentials)
    flights/simulator.js great-circle flight fleet
    ships/aisstream.js  AISStream WebSocket cache
    ships/simulator.js  shipping-lane fleet
    weather/openmeteo.js Open-Meteo current conditions
    airports.js         airport reference data
public/
  index.html, styles.css
  js/app.js             polling + orchestration
  js/map.js             Leaflet map + marker layers
  js/carbon.js          live CO₂ panel (smooth client-side extrapolation)
  js/tracking.js        flight detail panel
  js/clock.js           local + tracked-zone clocks
```

### API

| Endpoint | Purpose |
|---|---|
| `GET /api/flights` | All flights (optional `?lamin&lomin&lamax&lomax` bbox) |
| `GET /api/ships` | All ships (optional bbox) |
| `GET /api/track?flight=UA123` | Tracked flight + ETA + weather zones + clocks |
| `GET /api/carbon` | Live global CO₂ totals and instantaneous rates |
| `GET /api/status` | Active data sources, counts, last errors |

---

## Carbon model

Public feeds don't expose fuel burn, so emissions are **estimated** with a
transparent distance model:

```
rate (kg CO₂/s) = factor (kg CO₂/km) × speed (km/h) ÷ 3600
```

summed across the live fleets and integrated over time. Factors live in
`server/config.js` (`flightKgPerKm`, `shipKgPerKm`) and are easy to tune. These
are estimates for visualisation, **not** certified emissions accounting.

## License

MIT
