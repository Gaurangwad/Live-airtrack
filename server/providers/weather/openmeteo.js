// Weather provider using Open-Meteo (free, no API key required).
// Docs: https://open-meteo.com/en/docs
import { config } from '../../config.js';

const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
  55: 'Dense drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
  81: 'Rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm',
  96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm',
};

export async function getWeather(lat, lon) {
  if (!config.weather.enabled) return null;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toFixed(3));
  url.searchParams.set('longitude', lon.toFixed(3));
  url.searchParams.set('current', 'temperature_2m,wind_speed_10m,weather_code');
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const c = j.current || {};
    return {
      tempC: c.temperature_2m ?? null,
      windKmh: c.wind_speed_10m != null ? Math.round(c.wind_speed_10m) : null,
      code: c.weather_code ?? null,
      condition: WMO[c.weather_code] ?? 'Unknown',
    };
  } catch {
    return null; // weather is best-effort; never block tracking on it
  }
}
