// Live carbon panel. Pulls authoritative totals from the server and then
// extrapolates locally every animation frame using the latest rate, so the
// counter ticks up smoothly between polls.

const elTotal = document.getElementById('carbon-total');
const elRate = document.getElementById('carbon-rate');
const elBdFlight = document.getElementById('bd-flight');
const elBdShip = document.getElementById('bd-ship');
const elBdFlightN = document.getElementById('bd-flight-n');
const elBdShipN = document.getElementById('bd-ship-n');

let snap = null; // { sinceStartKg, flightKg, shipKg, rates, ts }
let localBaseTs = 0;

export function applyCarbon(data) {
  snap = data;
  localBaseTs = performance.now();
}

function fmtTonnes(kg) {
  const t = kg / 1000;
  if (t >= 1000) return (t / 1000).toFixed(2) + 'k';
  if (t >= 10) return t.toFixed(1);
  return t.toFixed(2);
}

function frame() {
  if (snap) {
    const elapsedS = (performance.now() - localBaseTs) / 1000;
    const r = snap.rates;
    const total = snap.sinceStartKg + r.totalKgPerSec * elapsedS;
    const flight = snap.flightKg + r.flightKgPerSec * elapsedS;
    const ship = snap.shipKg + r.shipKgPerSec * elapsedS;

    elTotal.textContent = fmtTonnes(total);
    elRate.textContent = r.totalKgPerSec.toFixed(1);
    elBdFlight.textContent = fmtTonnes(flight) + ' t';
    elBdShip.textContent = fmtTonnes(ship) + ' t';
    elBdFlightN.textContent = r.flightCount + '✈';
    elBdShipN.textContent = r.shipCount + '🚢';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
