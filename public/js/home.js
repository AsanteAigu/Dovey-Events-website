import { api, h, money } from './common.js';

const list = document.getElementById('package-list');

function packageCard(pkg, index) {
  const priceNote = pkg.perGuest ? `+ ${money(pkg.perGuest)} per guest` : 'Flat rate';
  return h('a', { class: 'package', href: `/book?package=${encodeURIComponent(pkg.id)}` },
    h('span', { class: 'package-index' }, `No. ${String(index + 1).padStart(2, '0')}`),
    h('h3', {}, pkg.name),
    h('p', {}, pkg.description),
    h('ul', {}, pkg.includes.map((item) => h('li', {}, item))),
    h('div', { class: 'package-price' },
      h('small', {}, 'From'),
      h('strong', {}, money(pkg.basePrice)),
      h('div', { class: 'choice-sub' }, `${priceNote} · ${pkg.minGuests}–${pkg.maxGuests} guests`),
    ),
    h('span', { class: 'package-link' }, 'Book this ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')),
  );
}

try {
  const { packages, depositPercent } = await api('/api/catalog');
  document.querySelector('[data-deposit]').textContent = `${depositPercent}%`;
  list.replaceChildren(...packages.map(packageCard));
} catch (err) {
  list.replaceChildren(h('p', { class: 'alert alert-bad span-all' }, err.message));
}
