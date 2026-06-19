// Geospatial helpers shared across providers.

const R = 6371; // Earth radius in km
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

// Great-circle distance in km between two [lat, lon] points.
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Initial bearing (degrees, 0=N) from point 1 to point 2.
export function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Destination point given start, bearing (deg) and distance (km).
export function destination(lat, lon, brngDeg, distKm) {
  const d = distKm / R;
  const brng = toRad(brngDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [toDeg(lat2), ((toDeg(lon2) + 540) % 360) - 180];
}

// Sample N evenly spaced points along the great-circle path between two
// points (inclusive of both ends). Used to place weather "zones".
export function samplePath(lat1, lon1, lat2, lon2, n) {
  const total = haversineKm(lat1, lon1, lat2, lon2);
  const brng = bearing(lat1, lon1, lat2, lon2);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const frac = n === 1 ? 0 : i / (n - 1);
    pts.push(destination(lat1, lon1, brng, total * frac));
  }
  return pts;
}
