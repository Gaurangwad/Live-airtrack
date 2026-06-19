// OpenSky Network flight provider.
// Docs: https://openskynetwork.github.io/opensky-api/rest.html
//
// Returns a normalised array of flight objects:
//   { id, callsign, country, lat, lon, altitudeM, speedKmh, heading,
//     verticalRateMs, onGround, source:'opensky' }
import { config } from '../../config.js';

const STATES_URL = 'https://opensky-network.org/api/states/all';
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

let cachedToken = null; // { value, expiresAt }

async function getToken() {
  const { clientId, clientSecret } = config.flights.opensky;
  if (!clientId || !clientSecret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`OpenSky auth failed: ${res.status}`);
  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 1800) * 1000,
  };
  return cachedToken.value;
}

function normalise(states) {
  if (!Array.isArray(states)) return [];
  const out = [];
  for (const s of states) {
    const lon = s[5];
    const lat = s[6];
    if (lat == null || lon == null) continue;
    const velocity = s[9]; // m/s
    out.push({
      id: s[0], // icao24
      callsign: (s[1] || '').trim() || s[0],
      country: s[2] || '',
      lat,
      lon,
      altitudeM: s[13] ?? s[7] ?? null,
      speedKmh: velocity != null ? velocity * 3.6 : 0,
      heading: s[10] ?? 0,
      verticalRateMs: s[11] ?? 0,
      onGround: !!s[8],
      source: 'opensky',
    });
  }
  return out;
}

// bbox: optional { lamin, lomin, lamax, lomax }
export async function fetchFlights(bbox) {
  const url = new URL(STATES_URL);
  if (bbox) {
    url.searchParams.set('lamin', bbox.lamin);
    url.searchParams.set('lomin', bbox.lomin);
    url.searchParams.set('lamax', bbox.lamax);
    url.searchParams.set('lomax', bbox.lomax);
  }
  const headers = {};
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`OpenSky states failed: ${res.status}`);
  const json = await res.json();
  return normalise(json.states);
}
