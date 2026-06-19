// Clocks: the viewer's local time (bottom-right, always on) and the local
// time in the zone a tracked flight is currently flying over.

const elLocalTime = document.getElementById('local-time');
const elLocalZone = document.getElementById('local-zone');
const elTracked = document.getElementById('tracked-clock');

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Tracked zone state — driven by tracking.js via setTrackedZone().
let tracked = null; // { timeZone, label }

export function setTrackedZone(info) {
  tracked = info;
  if (!info) {
    elTracked.classList.add('hidden');
  } else {
    elTracked.classList.remove('hidden');
  }
}

function fmt(tz) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function tick() {
  const now = new Date();
  elLocalTime.textContent = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  elLocalZone.textContent = localTz;

  if (tracked) {
    elTracked.innerHTML = `<div class="ck-label">TIME AT FLIGHT · ${tracked.label}</div>
      <div class="ck-time">${fmt(tracked.timeZone)}</div>
      <div class="ck-zone">${tracked.timeZone}</div>`;
  }
}
setInterval(tick, 1000);
tick();
