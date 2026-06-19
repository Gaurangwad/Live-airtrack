// Standalone server launcher (for local dev and long-running hosts such as
// Render, Railway, Fly.io). For serverless (Vercel) see api/index.js, which
// imports the same Express app from server/app.js.
import { config } from './config.js';
import app from './app.js';
import { startPolling } from './store.js';

// Keep fleet snapshots warm in the background (real WebSocket feeds, polling).
startPolling();

app.listen(config.port, () => {
  console.log(`Live AirTrack running at http://localhost:${config.port}`);
  console.log(
    `Flights mode=${config.flights.mode}  Ships mode=${config.ships.mode}  Weather=${
      config.weather.enabled ? 'on' : 'off'
    }`
  );
});
