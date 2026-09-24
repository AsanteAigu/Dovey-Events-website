import { api, formatDate, h, money, setBusy, STATUS_LABELS } from './common.js';

const loginForm = document.getElementById('login');
const dashboard = document.getElementById('dashboard');
const rows = document.getElementById('rows');
const stats = document.getElementById('stats');
const tabs = document.getElementById('tabs');
const search = document.getElementById('search');
const dashAlert = document.getElementById('dash-alert');

const FILTERS = [
  ['upcoming', 'Upcoming'],
  ['pending_payment', 'Awaiting deposit'],
  ['payment_review', 'Needs review'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['all', 'All'],
];

let bookings = [];
let editableStatuses = [];
let filter = 'upcoming';
const today = new Date().toISOString().slice(0, 10);

function showLogin() {
  dashboard.hidden = true;
  loginForm.hidden = false;
  loginForm.elements.namedItem('password').focus();
}

async function showDashboard() {
  loginForm.hidden = true;
  dashboard.hidden = false;
  await load();
}

async function load() {
  dashAlert.textContent = '';
  try {
    const data = await api('/api/admin/bookings');
    bookings = data.bookings;
    editableStatuses = data.statuses;
    render();
  } catch (err) {
    if (err.status === 401) return showLogin();
    dashAlert.textContent = err.message;
  }
}

function matchesFilter(b, value = filter) {
  if (value === 'all') return true;
  if (value === 'upcoming') return b.eventDate >= today && ['confirmed', 'pending_payment'].includes(b.status);
  return b.status === value;
}

function matchesSearch(b) {
  const q = search.value.trim().toLowerCase();
  if (!q) return true;
  return [b.reference, b.customerName, b.customerEmail, b.customerPhone, b.package.name, b.occasion.name, b.venue]
    .some((v) => v && v.toLowerCase().includes(q));
}

function render() {
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const upcoming = confirmed.filter((b) => b.eventDate >= today);
  const collected = bookings.reduce((sum, b) => sum + b.amountPaid, 0);
  const review = bookings.filter((b) => b.status === 'payment_review').length;

  stats.replaceChildren(
    stat('Upcoming events', upcoming.length),
    stat('Deposits collected', money(collected)),
    stat('Booked value', money(confirmed.reduce((sum, b) => sum + b.totalAmount, 0))),
    stat('Needs review', review),
  );

  tabs.replaceChildren(...FILTERS.map(([value, label]) => {
    const count = bookings.filter((b) => matchesFilter(b, value)).length;
    return h('button', {
      class: 'tab',
      type: 'button',
      'aria-pressed': String(filter === value),
      onclick: () => { filter = value; render(); },
    }, `${label} · ${count}`);
  }));

  const visible = bookings.filter((b) => matchesFilter(b) && matchesSearch(b));
  rows.replaceChildren(
    ...(visible.length
      ? visible.map(row)
      : [h('tr', {}, h('td', { colspan: '7', class: 'empty' }, 'No bookings here yet.'))]),
  );
}

const stat = (label, value) => h('div', { class: 'stat' }, h('small', {}, label), h('strong', {}, String(value)));

function row(b) {
  return h('tr', {},
    h('td', { class: 'num' }, formatDate(b.eventDate, 'short')),
    h('td', {}, h('span', { class: 'mono' }, b.reference)),
    h('td', {},
      b.customerName,
      h('span', { class: 'sub' }, h('a', { href: `mailto:${b.customerEmail}` }, b.customerEmail)),
      h('span', { class: 'sub' }, h('a', { href: `tel:${b.customerPhone.replace(/[^\d+]/g, '')}` }, b.customerPhone)),
    ),
    h('td', {},
      `${b.occasion.name} · ${b.package.name}`,
      h('span', { class: 'sub' }, `${b.guests} guests${b.venue ? ` · ${b.venue}` : ''}`),
      b.addOns.length ? h('span', { class: 'sub' }, b.addOns.map((a) => a.name).join(', ')) : null,
      b.notes ? h('span', { class: 'sub', title: b.notes }, `“${b.notes.length > 80 ? `${b.notes.slice(0, 80)}…` : b.notes}”`) : null,
    ),
    h('td', { class: 'num' }, money(b.totalAmount)),
    h('td', { class: 'num' }, money(b.amountPaid)),
    h('td', {}, statusControl(b)),
  );
}

function statusControl(b) {
  const pill = h('span', { class: `pill pill-${b.status}` }, STATUS_LABELS[b.status] ?? b.status);
  const options = editableStatuses.filter((s) => s !== b.status);
  const select = h('select', { class: 'status-select', 'aria-label': `Change status of ${b.reference}` },
    h('option', { value: '' }, 'Change…'),
    options.map((s) => h('option', { value: s }, STATUS_LABELS[s])),
  );
  select.addEventListener('change', async () => {
    const status = select.value;
    if (!status) return;
    select.disabled = true;
    try {
      const { booking } = await api(`/api/admin/bookings/${encodeURIComponent(b.reference)}`, { method: 'PATCH', body: { status } });
      bookings = bookings.map((x) => (x.reference === booking.reference ? booking : x));
      render();
    } catch (err) {
      select.disabled = false;
      select.value = '';
      dashAlert.textContent = err.message;
    }
  });
  return h('div', { class: 'fields' }, pill, select);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const alert = loginForm.querySelector('.alert');
  const button = loginForm.querySelector('button');
  alert.textContent = '';
  setBusy(button, true, 'Signing in…');
  try {
    await api('/api/admin/login', { method: 'POST', body: { password: loginForm.elements.namedItem('password').value } });
    loginForm.reset();
    await showDashboard();
  } catch (err) {
    alert.textContent = err.message;
  } finally {
    setBusy(button, false);
  }
});

document.getElementById('logout').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  bookings = [];
  showLogin();
});
document.getElementById('refresh').addEventListener('click', load);
search.addEventListener('input', render);

const { authenticated } = await api('/api/admin/session').catch(() => ({ authenticated: false }));
if (authenticated) showDashboard();
else showLogin();
