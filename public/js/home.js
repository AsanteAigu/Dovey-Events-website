import { api, h, money } from './common.js';

const list = document.getElementById('package-list');
const included = document.getElementById('included-list');

function packageCard(pkg, index) {
  const priceNote = pkg.perGuest ? `+ ${money(pkg.perGuest)} per guest` : `Up to ${pkg.maxGuests} guests`;
  return h('a', { class: 'package', href: `/book?package=${encodeURIComponent(pkg.id)}` },
    h('span', { class: 'package-index' }, `No. ${String(index + 1).padStart(2, '0')}`),
    h('h3', {}, pkg.name),
    h('p', {}, pkg.description),
    h('div', { class: 'package-price' },
      h('small', {}, pkg.perGuest ? 'From' : 'Package price'),
      h('strong', {}, money(pkg.basePrice)),
      h('div', { class: 'choice-sub' }, priceNote),
    ),
    h('span', { class: 'package-link' }, 'Book this ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')),
  );
}

try {
  const catalog = await api('/api/catalog');
  document.querySelector('[data-deposit]').textContent = `${catalog.depositPercent}%`;
  list.replaceChildren(...catalog.packages.map(packageCard));
  included.replaceChildren(...catalog.included.map((item) => h('li', {}, item)));
} catch (err) {
  list.replaceChildren(h('p', { class: 'alert alert-bad span-all' }, err.message));
}
