// AISStream.io ship provider (WebSocket). Maintains an in-memory cache of the
// most recent position report per vessel and exposes a snapshot getter.
// Docs: https://aisstream.io/documentation
import WebSocket from 'ws';
import { config } from '../../config.js';

const STREAM_URL = 'wss://stream.aisstream.io/v0/stream';

const vessels = new Map(); // mmsi -> normalised ship
let ws = null;
let connected = false;

function normaliseFrom(meta, pos) {
  const sog = pos.Sog; // speed over ground, knots
  return {
    id: String(meta.MMSI),
    name: (meta.ShipName || '').trim() || String(meta.MMSI),
    lat: meta.latitude ?? pos.Latitude,
    lon: meta.longitude ?? pos.Longitude,
    speedKmh: sog != null ? sog * 1.852 : 0,
    heading: pos.TrueHeading != null && pos.TrueHeading < 360 ? pos.TrueHeading : pos.Cog ?? 0,
    source: 'aisstream',
    ts: Date.now(),
  };
}

export function start() {
  const apiKey = config.ships.aisstream.apiKey;
  if (!apiKey) return false;

  const connect = () => {
    ws = new WebSocket(STREAM_URL);
    ws.on('open', () => {
      connected = true;
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FilterMessageTypes: ['PositionReport'],
        })
      );
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.MessageType !== 'PositionReport') return;
        const meta = msg.MetaData || {};
        const pos = msg.Message?.PositionReport || {};
        const ship = normaliseFrom(meta, pos);
        if (ship.lat == null || ship.lon == null) return;
        vessels.set(ship.id, ship);
      } catch {
        /* ignore malformed frames */
      }
    });
    ws.on('close', () => {
      connected = false;
      setTimeout(connect, 5000); // reconnect with backoff-ish delay
    });
    ws.on('error', () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    });
  };
  connect();
  return true;
}

// Drop vessels we haven't heard from in a while, then return the snapshot.
export function fetchShips() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of vessels) if (v.ts < cutoff) vessels.delete(k);
  return [...vessels.values()];
}

export const isConnected = () => connected;
