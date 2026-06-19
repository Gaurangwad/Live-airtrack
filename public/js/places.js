// Airport / seaport search → fly the map there.
import { flyToPlace } from './map.js';

const input = document.getElementById('place-input');
const list = document.getElementById('place-results');

let items = [];
let active = -1;
let debounce = null;

function close() {
  list.classList.add('hidden');
  list.innerHTML = '';
  active = -1;
}

function choose(p) {
  input.value = p.label;
  close();
  flyToPlace(p);
}

function render() {
  if (!items.length) return close();
  list.innerHTML = items
    .map(
      (p, i) =>
        `<li data-i="${i}" class="${i === active ? 'active' : ''}">
           <span class="pl-ic">${p.type === 'airport' ? '✈' : '⚓'}</span>
           <span class="pl-tx"><b>${p.label}</b><i>${p.sub || ''}</i></span>
         </li>`
    )
    .join('');
  list.classList.remove('hidden');
}

async function search(q) {
  try {
    const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
    items = (await res.json()).places || [];
    active = -1;
    render();
  } catch {
    close();
  }
}

input.addEventListener('input', () => {
  const q = input.value.trim();
  clearTimeout(debounce);
  if (!q) return close();
  debounce = setTimeout(() => search(q), 150);
});

input.addEventListener('keydown', (e) => {
  if (list.classList.contains('hidden')) return;
  if (e.key === 'ArrowDown') {
    active = Math.min(active + 1, items.length - 1);
    render();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    active = Math.max(active - 1, 0);
    render();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    if (active >= 0 && items[active]) choose(items[active]);
    else if (items[0]) choose(items[0]);
  } else if (e.key === 'Escape') {
    close();
  }
});

list.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li) choose(items[+li.dataset.i]);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.place-search')) close();
});
