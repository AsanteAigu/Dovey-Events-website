import { createHmac } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

export const SECRET = 'sk_test_fake';

/** A stand-in for the Paystack client that records calls and lets tests set outcomes. */
export function fakePaystack() {
  const transactions = new Map(); // reference -> { amount, status }
  return {
    initialized: [],
    failNextInitialize: false,
    async initialize(params) {
      if (this.failNextInitialize) {
        this.failNextInitialize = false;
        const { PaystackError } = await import('../src/paystack.js');
        throw new PaystackError('boom');
      }
      this.initialized.push(params);
      transactions.set(params.reference, { amount: params.amount, status: 'abandoned' });
      return { authorization_url: `https://checkout.paystack.test/${params.reference}` };
    },
    async verify(reference) {
      const tx = transactions.get(reference);
      return { reference, amount: tx.amount, currency: 'GHS', status: tx.status, paid_at: '2026-10-01T10:00:00Z' };
    },
    markPaid(reference) {
      transactions.get(reference).status = 'success';
    },
    isValidSignature(raw, signature) {
      return signature === sign(raw);
    },
  };
}

export const sign = (raw) => createHmac('sha512', SECRET).update(raw).digest('hex');

export function isoDaysFromNow(days, now = new Date()) {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function validBooking(overrides = {}) {
  return {
    packageId: 'intimate',
    eventDate: isoDaysFromNow(30),
    guests: 20,
    addOns: ['photo'],
    name: 'Ama Mensah',
    email: 'ama@example.com',
    phone: '024 123 4567',
    venue: 'East Legon',
    ...overrides,
  };
}

/** Boots the app on a random port with an in-memory database. */
export async function startServer({ env = {}, clock } = {}) {
  const config = loadConfig({ ADMIN_PASSWORD: 'let-me-in', MAX_EVENTS_PER_DAY: '2', ...env });
  const db = openDatabase(':memory:');
  const paystack = fakePaystack();
  const silent = { warn() {}, error() {} };
  const app = createApp({ db, config, paystack, clock, logger: silent });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { body, headers = {}, raw } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json, headers: res.headers };
  }

  return {
    paystack,
    db,
    request,
    close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); })),
  };
}
