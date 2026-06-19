// CO₂ comparison modal: given a trip distance, show estimated emissions by
// transport mode using the server's emission factors, plus relatable units.

const btn = document.getElementById('compare-btn');
const modal = document.getElementById('compare-modal');
const close = document.getElementById('compare-close');
const kmInput = document.getElementById('compare-km');
const goBtn = document.getElementById('compare-go');
const result = document.getElementById('compare-result');

let factors = null; // { flightKgPerKm, shipKgPerKm, carKgPerKm, trainKgPerKm, treeKgPerYear }

async function ensureFactors() {
  if (factors) return factors;
  try {
    factors = await (await fetch('/api/factors')).json();
  } catch {
    factors = { flightKgPerKm: 11, shipKgPerKm: 40, carKgPerKm: 0.17, trainKgPerKm: 0.035, treeKgPerYear: 21 };
  }
  return factors;
}

const fmt = (kg) => (kg >= 1000 ? (kg / 1000).toFixed(1) + ' t' : Math.round(kg) + ' kg');

async function compute() {
  const km = Math.max(1, +kmInput.value || 0);
  const f = await ensureFactors();
  const modes = [
    { name: '✈ Flight', kg: f.flightKgPerKm * km, cls: 'm-flight' },
    { name: '🚢 Cargo ship', kg: f.shipKgPerKm * km, cls: 'm-ship' },
    { name: '🚗 Car', kg: f.carKgPerKm * km, cls: 'm-car' },
    { name: '🚆 Train', kg: f.trainKgPerKm * km, cls: 'm-train' },
  ];
  const max = Math.max(...modes.map((m) => m.kg));
  result.innerHTML = modes
    .map((m) => {
      const trees = (m.kg / f.treeKgPerYear).toFixed(1);
      return `<div class="cmp-row">
        <div class="cmp-head"><span>${m.name}</span><b>${fmt(m.kg)}</b></div>
        <div class="cmp-bar"><div class="${m.cls}" style="width:${(m.kg / max) * 100}%"></div></div>
        <div class="cmp-sub">${trees} trees needed for a year to absorb this</div>
      </div>`;
    })
    .join('');
}

btn.addEventListener('click', async () => {
  modal.classList.remove('hidden');
  await compute();
});
close.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});
goBtn.addEventListener('click', compute);
kmInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') compute();
});

// Allow other modules (e.g. tracking) to open the modal pre-filled with a
// tracked vehicle's route distance.
export function openCompareWith(km) {
  kmInput.value = Math.round(km);
  modal.classList.remove('hidden');
  compute();
}
