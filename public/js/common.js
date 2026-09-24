const cedis = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 2 });

/** Formats pesewas as cedis, e.g. 680000 -> "GH₵6,800.00". */
export const money = (pesewas) => cedis.format(pesewas / 100).replace(/\.00$/, '');

export function formatDate(iso, style = 'long') {
  const date = new Date(`${iso}T00:00:00Z`);
  const options = style === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

export const STATUS_LABELS = {
  pending_payment: 'Awaiting deposit',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Hold expired',
  payment_review: 'Needs review',
};

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** fetch() for our JSON API that throws ApiError with the server's message. */
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, null);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || 'Something went wrong.', res.status, data);
  return data;
}

/** Tiny element builder so we never assemble HTML from untrusted strings. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

export function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), label);
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

const year = document.querySelector('[data-year]');
if (year) year.textContent = new Date().getFullYear();
