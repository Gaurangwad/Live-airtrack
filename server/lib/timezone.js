// Timezone helpers. Uses tz-lookup for fully offline IANA timezone
// resolution from coordinates, then Intl for formatting.
import tzlookup from 'tz-lookup';

export function tzFor(lat, lon) {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

// Returns { timeZone, localTime, offset } for a coordinate at "date".
export function localTimeAt(lat, lon, date = new Date()) {
  const timeZone = tzFor(lat, lon);
  let localTime = '';
  let offset = '';
  try {
    localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);

    // Compute UTC offset string (e.g. "+05:30").
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    offset = parts.find((p) => p.type === 'timeZoneName')?.value || '';
  } catch {
    localTime = date.toISOString().slice(11, 19);
    offset = 'UTC';
  }
  return { timeZone, localTime, offset };
}
