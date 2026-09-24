import { api, formatDate, h, money, setBusy } from './common.js';

const form = document.getElementById('booking-form');
// form.elements.namedItem, not form.name: the form's own properties shadow fields called 'name'.
const field = (name) => form.elements.namedItem(name);
const packageChoices = document.getElementById('package-choices');
const addOnChoices = document.getElementById('addon-choices');
const summary = document.getElementById('summary-content');
const dateInput = field('eventDate');
const guestsInput = field('guests');
const dateStatus = document.getElementById('date-status');
const guestHint = document.getElementById('guest-hint');
const submit = document.getElementById('submit');
const alertBox = document.getElementById('form-alert');

const DRAFT_KEY = 'dovim:booking-draft';
let catalog;
let dateIsFree = null;

const addDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const selectedPackage = () => catalog.packages.find((p) => p.id === field('packageId')?.value);
const selectedAddOns = () => [...form.querySelectorAll('input[name="addOns"]:checked')].map((el) => el.value);

function readForm() {
  return {
    packageId: field('packageId')?.value || '',
    eventDate: dateInput.value,
    guests: guestsInput.value === '' ? null : Number(guestsInput.value),
    addOns: selectedAddOns(),
    venue: field('venue').value,
    name: field('name').value,
    email: field('email').value,
    phone: field('phone').value,
    notes: field('notes').value,
  };
}

// ---------- Rendering ----------

function renderChoices() {
  packageChoices.replaceChildren(
    ...catalog.packages.map((pkg) =>
      h('label', { class: 'choice' },
        h('input', { type: 'radio', name: 'packageId', value: pkg.id, required: true }),
        h('span', { class: 'choice-body' },
          h('span', { class: 'choice-title' }, pkg.name),
          h('span', { class: 'choice-sub' }, pkg.tagline),
          h('span', { class: 'choice-price' },
            `From ${money(pkg.basePrice)}${pkg.perGuest ? ` + ${money(pkg.perGuest)}/guest` : ''}`),
        ),
      ),
    ),
  );

  addOnChoices.replaceChildren(
    ...catalog.addOns.map((addOn) =>
      h('label', { class: 'choice' },
        h('input', { type: 'checkbox', name: 'addOns', value: addOn.id }),
        h('span', { class: 'choice-body' },
          h('span', { class: 'choice-title' }, addOn.name),
          h('span', { class: 'choice-price' }, `+ ${money(addOn.price)}`),
        ),
      ),
    ),
  );
}

function updateGuestLimits() {
  const pkg = selectedPackage();
  if (!pkg) return;
  guestsInput.min = pkg.minGuests;
  guestsInput.max = pkg.maxGuests;
  guestHint.textContent = `${pkg.minGuests}–${pkg.maxGuests} guests for this package`;
  if (guestsInput.value === '') guestsInput.value = pkg.minGuests;
}

let quoteSeq = 0;
async function updateQuote() {
  const pkg = selectedPackage();
  if (!pkg) return;
  const seq = ++quoteSeq;
  const { packageId, guests, addOns } = readForm();
  try {
    const quote = await api('/api/quote', { method: 'POST', body: { packageId, guests: guests || 0, addOns } });
    if (seq !== quoteSeq) return; // a newer quote is on its way
    renderSummary(pkg, quote);
  } catch {
    /* the quote is a convenience; the server re-prices on submit */
  }
}

function renderSummary(pkg, quote) {
  const date = dateInput.value && dateIsFree !== false ? formatDate(dateInput.value) : null;
  summary.replaceChildren(
    h('ul', { class: 'summary-lines' },
      quote.lines.map((line) => h('li', {}, h('span', {}, line.label), h('span', {}, money(line.amount)))),
    ),
    h('div', { class: 'summary-total' }, h('span', {}, 'Event total'), h('strong', {}, money(quote.total))),
    h('div', { class: 'summary-deposit' },
      h('div', {}, h('span', {}, `Deposit today (${catalog.depositPercent}%)`), h('strong', {}, money(quote.deposit))),
      h('p', {}, date ? `Holds ${date} for ${pkg.name.toLowerCase()}.` : 'Pick a date to hold it.'),
    ),
  );
}

// ---------- Date availability ----------

let dateSeq = 0;
async function checkDate() {
  const date = dateInput.value;
  dateIsFree = null;
  setDateStatus('', '');
  if (!date) return;
  if (date < dateInput.min || date > dateInput.max) {
    dateIsFree = false;
    setDateStatus('bad', date < dateInput.min
      ? `We need at least ${catalog.minLeadDays} days' notice.`
      : 'We take bookings up to 18 months ahead.');
    return updateQuote();
  }
  const seq = ++dateSeq;
  setDateStatus('checking', 'Checking availability…');
  try {
    const { unavailable } = await api(`/api/availability?from=${date}&to=${date}`);
    if (seq !== dateSeq) return;
    dateIsFree = !unavailable.includes(date);
    setDateStatus(dateIsFree ? 'ok' : 'bad', dateIsFree
      ? `${formatDate(date)} is available`
      : 'That date is fully booked. Please try another.');
  } catch {
    setDateStatus('', '');
  }
  updateQuote();
}

function setDateStatus(kind, message) {
  dateStatus.className = `date-status ${kind}`;
  dateStatus.textContent = message;
}

// ---------- Errors ----------

function clearErrors() {
  alertBox.textContent = '';
  form.querySelectorAll('[data-error-for]').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
}

function showErrors(details) {
  let first;
  for (const [field, message] of Object.entries(details)) {
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (slot) slot.textContent = message;
    const wrapper = form.querySelector(`[data-field="${field}"]`);
    wrapper?.classList.add('has-error');
    first ??= wrapper?.querySelector('input') ?? slot;
  }
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (first?.focus) first.focus({ preventScroll: true });
}

// ---------- Draft (so a refresh doesn't lose their answers) ----------

function saveDraft() {
  try {
    const { name, email, phone, venue, notes, packageId, eventDate, guests, addOns } = readForm();
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ name, email, phone, venue, notes, packageId, eventDate, guests, addOns }));
  } catch { /* storage unavailable */ }
}

function restoreDraft() {
  let draft = {};
  try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'); } catch { /* ignore */ }
  const wanted = new URLSearchParams(location.search).get('package') || draft.packageId;
  const radio = form.querySelector(`input[name="packageId"][value="${CSS.escape(wanted || '')}"]`);
  if (radio) radio.checked = true;
  for (const key of ['name', 'email', 'phone', 'venue', 'notes', 'eventDate']) {
    if (draft[key]) field(key).value = draft[key];
  }
  if (draft.guests) guestsInput.value = draft.guests;
  for (const id of draft.addOns || []) {
    const box = form.querySelector(`input[name="addOns"][value="${CSS.escape(id)}"]`);
    if (box) box.checked = true;
  }
}

// ---------- Wiring ----------

form.addEventListener('change', (event) => {
  if (event.target.name === 'packageId') {
    guestsInput.value = '';
    updateGuestLimits();
  }
  if (event.target === dateInput) checkDate();
  else updateQuote();
  saveDraft();
});
form.addEventListener('input', (event) => {
  if (event.target === guestsInput) updateQuote();
  event.target.closest('.has-error')?.classList.remove('has-error');
});
form.addEventListener('focusout', saveDraft);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();
  if (dateIsFree === false) {
    showErrors({ eventDate: dateStatus.textContent || 'Please choose another date.' });
    return;
  }

  setBusy(submit, true, 'Holding your date…');
  try {
    const { authorizationUrl, booking } = await api('/api/bookings', { method: 'POST', body: readForm() });
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    try { sessionStorage.setItem('dovim:last-booking', booking.reference); } catch { /* ignore */ }
    location.assign(authorizationUrl);
  } catch (err) {
    setBusy(submit, false);
    if (err.body?.details) showErrors(err.body.details);
    alertBox.textContent = err.message;
    if (err.status === 502 && err.body?.booking) {
      // The date is held; send them to the page that can retry the payment.
      location.assign(`/confirmation?booking=${encodeURIComponent(err.body.booking.reference)}`);
    }
    if (err.status === 409) checkDate();
  }
});

try {
  catalog = await api('/api/catalog');
  dateInput.min = addDays(catalog.minLeadDays);
  dateInput.max = addDays(540);
  document.querySelector('[data-hold]').textContent = `${catalog.holdMinutes} minutes`;
  renderChoices();
  restoreDraft();
  updateGuestLimits();
  if (dateInput.value) checkDate();
  else updateQuote();
} catch (err) {
  packageChoices.replaceChildren(h('p', { class: 'alert alert-bad span-all' }, err.message));
  submit.disabled = true;
}
