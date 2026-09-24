import { api, formatDate, h, money, setBusy, STATUS_LABELS } from './common.js';
import { saveTicket } from './ticket-image.js';

const view = document.getElementById('view');
const pageHead = document.getElementById('page-head');
const params = new URLSearchParams(location.search);

const ICONS = {
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  pending: 'M12 7v5l3 2',
  bad: 'M7 7l10 10M17 7L7 17',
};

function mark(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (kind === 'pending') {
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '8.5');
    svg.append(circle);
  }
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', ICONS[kind]);
  svg.append(path);
  return h('div', { class: `ticket-mark ${kind === 'ok' ? '' : kind}`, 'aria-hidden': 'true' }, svg);
}

const COPY = {
  confirmed: ['ok', 'Your date is <em>held</em>.', "Your deposit is in and your date is confirmed. We'll be in touch within one working day to start planning."],
  completed: ['ok', 'What a <em>day</em>.', 'This event has taken place. Thank you for celebrating with us.'],
  pending_payment: ['pending', 'Almost <em>there</em>.', "We haven't received your deposit yet. Your date is held for a short while: complete the payment to confirm it."],
  expired: ['bad', 'Your hold has <em>lapsed</em>.', "We didn't receive the deposit in time, so the date was released. You can try paying again while it's still free."],
  payment_review: ['pending', "We've got your <em>payment</em>.", 'Your deposit arrived after the date was taken or the booking was closed. We will contact you shortly to rebook or refund you.'],
  cancelled: ['bad', 'This booking was <em>cancelled</em>.', 'If this is unexpected, please get in touch and quote your reference.'],
};

function heading(html) {
  // The only markup is our own <em> from COPY; there's no user data in here.
  const el = h('h1');
  el.innerHTML = html;
  return el;
}

function retryButton(reference) {
  const button = h('button', { class: 'btn btn-accent', type: 'button' }, 'Pay deposit now ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'));
  const alert = h('div', { class: 'alert alert-bad', role: 'alert' });
  button.addEventListener('click', async () => {
    alert.textContent = '';
    setBusy(button, true, 'Opening Paystack…');
    try {
      const { authorizationUrl } = await api(`/api/bookings/${encodeURIComponent(reference)}/pay`, { method: 'POST' });
      location.assign(authorizationUrl);
    } catch (err) {
      setBusy(button, false);
      alert.textContent = err.message;
    }
  });
  return [button, alert];
}

function ticket(booking) {
  const [kind, title, body] = COPY[booking.status] ?? COPY.pending_payment;
  const canPay = booking.status === 'pending_payment' || booking.status === 'expired';
  const balance = Math.max(booking.totalAmount - booking.amountPaid, 0);

  return h('article', { class: 'ticket' },
    h('div', { class: 'ticket-head' },
      mark(kind),
      heading(title),
      h('p', {}, body),
      h('span', { class: 'ticket-ref' }, booking.reference),
    ),
    h('div', { class: 'ticket-body' },
      h('dl', { class: 'details' },
        detail('Occasion', booking.occasion.name),
        detail('Package', booking.package.name),
        detail('Date', formatDate(booking.eventDate), true),
        detail('Guests', String(booking.guests)),
        detail('Status', STATUS_LABELS[booking.status] ?? booking.status),
        booking.venue && detail('Venue', booking.venue, true),
        booking.addOns.length > 0 && detail('Extras', booking.addOns.map((a) => a.name).join(', '), true),
        detail('Event total', money(booking.totalAmount)),
        booking.amountPaid > 0
          ? detail('Paid', money(booking.amountPaid))
          : detail('Deposit due', money(booking.depositAmount)),
        booking.amountPaid > 0 && balance > 0 && detail('Balance before the event', money(balance), true),
      ),
      h('div', { class: 'ticket-actions' },
        canPay ? retryButton(booking.reference) : ticketButtons(booking),
      ),
    ),
  );
}

// Paid bookings get a ticket to keep: an image for phones, or print / save as PDF.
function ticketButtons(booking) {
  if (!['confirmed', 'completed'].includes(booking.status)) {
    return h('a', { class: 'btn', href: '/' }, 'Back to Dovey Events');
  }
  const alert = h('div', { class: 'alert alert-bad', role: 'alert' });
  const save = h('button', { class: 'btn btn-accent', type: 'button' },
    'Save ticket ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '↓'));
  save.addEventListener('click', async () => {
    alert.textContent = '';
    setBusy(save, true, 'Preparing…');
    try {
      await saveTicket(booking);
    } catch {
      alert.textContent = "Couldn't create the ticket image. Try Print / PDF instead.";
    } finally {
      setBusy(save, false);
    }
  });
  const print = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Print / PDF');
  print.addEventListener('click', () => window.print());
  return [save, print, alert];
}

function detail(label, value, full = false) {
  return h('div', { class: full ? 'full' : null }, h('dt', {}, label), h('dd', {}, value));
}

function problem(title, message, ...actions) {
  return h('article', { class: 'ticket' },
    h('div', { class: 'ticket-head' },
      mark('bad'),
      h('h1', {}, title),
      h('p', {}, message),
      actions.length ? h('div', { class: 'ticket-actions' }, actions) : null,
    ),
  );
}

// Returning from Paystack: ?reference=<payment reference>
async function showPaymentResult(paymentReference) {
  try {
    const { booking } = await api(`/api/payments/verify?reference=${encodeURIComponent(paymentReference)}`);
    history.replaceState(null, '', `/confirmation?booking=${encodeURIComponent(booking.reference)}&paid=${booking.amountPaid > 0 ? 1 : 0}`);
    view.replaceChildren(ticket(booking));
  } catch (err) {
    view.replaceChildren(problem(
      "We couldn't confirm that payment",
      `${err.message} If money left your account, don't pay again. Your booking will update automatically once Paystack confirms it.`,
      h('a', { class: 'btn btn-ghost', href: '/confirmation' }, 'Look up my booking'),
    ));
  }
}

// Back from a cancelled checkout, or the payment page failed to open: ?booking=<reference>
function showUnpaid(reference) {
  view.replaceChildren(
    h('article', { class: 'ticket' },
      h('div', { class: 'ticket-head' },
        mark('pending'),
        heading(COPY.pending_payment[1]),
        h('p', {}, COPY.pending_payment[2]),
        h('span', { class: 'ticket-ref' }, reference),
        h('div', { class: 'ticket-actions' }, retryButton(reference)),
      ),
    ),
  );
}

function showLookup(prefill = {}) {
  pageHead.hidden = false;
  const form = h('form', { class: 'lookup', novalidate: true },
    h('div', { class: 'field' },
      h('label', { for: 'ref' }, 'Booking reference'),
      h('input', { class: 'input mono', id: 'ref', name: 'ref', placeholder: 'DVE-XXXXXXXX', required: true, value: prefill.ref ?? '', autocomplete: 'off' }),
    ),
    h('div', { class: 'field' },
      h('label', { for: 'lookup-email' }, 'Email'),
      h('input', { class: 'input', id: 'lookup-email', name: 'email', type: 'email', required: true, autocomplete: 'email' }),
    ),
    h('button', { class: 'btn btn-block', type: 'submit' }, 'Find booking'),
    h('div', { class: 'alert alert-bad', role: 'alert' }),
  );
  const alert = form.querySelector('.alert');
  const button = form.querySelector('button');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.textContent = '';
    const ref = form.elements.namedItem('ref').value.trim().toUpperCase();
    const email = form.elements.namedItem('email').value.trim();
    if (!ref || !email) {
      alert.textContent = 'Enter both your reference and email.';
      return;
    }
    setBusy(button, true, 'Looking…');
    try {
      const { booking } = await api(`/api/bookings/${encodeURIComponent(ref)}?email=${encodeURIComponent(email)}`);
      pageHead.hidden = true;
      view.replaceChildren(ticket(booking));
    } catch (err) {
      setBusy(button, false);
      alert.textContent = err.status === 404 ? "We couldn't find a booking with those details." : err.message;
    }
  });

  view.replaceChildren(form);
}

const paymentReference = params.get('reference') || params.get('trxref');
const bookingReference = params.get('booking');

if (paymentReference) showPaymentResult(paymentReference);
else if (bookingReference && params.get('paid') !== '1') showUnpaid(bookingReference);
else showLookup({ ref: bookingReference ?? '' });
