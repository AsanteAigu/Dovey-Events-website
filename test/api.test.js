import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { sign, startServer, validBooking } from './helpers.js';

describe('booking API', () => {
  let t;
  beforeEach(async () => {
    await t?.close();
    t = await startServer();
  });
  after(() => t.close());

  it('creates a booking, holds the date and returns a Paystack checkout link', async () => {
    const res = await t.request('POST', '/api/bookings', { body: validBooking() });
    assert.equal(res.status, 201);
    assert.match(res.body.booking.reference, /^DVE-[A-Z0-9]{8}$/);
    assert.equal(res.body.booking.status, 'pending_payment');
    assert.equal(res.body.booking.depositAmount, 240_000);
    assert.match(res.body.authorizationUrl, /^https:\/\/checkout\.paystack\.test\//);

    const [init] = t.paystack.initialized;
    assert.equal(init.amount, 240_000, 'charges the server-computed deposit');
    assert.equal(init.email, 'ama@example.com');
  });

  it('ignores prices sent by the client', async () => {
    const res = await t.request('POST', '/api/bookings', { body: validBooking({ total: 1, deposit: 1 }) });
    assert.equal(res.body.booking.depositAmount, 240_000);
  });

  it('returns field errors for bad input', async () => {
    const res = await t.request('POST', '/api/bookings', { body: validBooking({ email: 'nope' }) });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.email);
  });

  it('refuses a date once it is fully booked and reports it as unavailable', async () => {
    const date = validBooking().eventDate;
    assert.equal((await t.request('POST', '/api/bookings', { body: validBooking() })).status, 201);
    assert.equal((await t.request('POST', '/api/bookings', { body: validBooking() })).status, 201);
    const third = await t.request('POST', '/api/bookings', { body: validBooking() });
    assert.equal(third.status, 409);

    const avail = await t.request('GET', `/api/availability?from=${date}&to=${date}`);
    assert.deepEqual(avail.body.unavailable, [date]);
  });

  it('confirms the booking when Paystack says the payment succeeded', async () => {
    await t.request('POST', '/api/bookings', { body: validBooking() });
    const payRef = t.paystack.initialized[0].reference;

    let res = await t.request('GET', `/api/payments/verify?reference=${payRef}`);
    assert.equal(res.body.paid, false);
    assert.equal(res.body.booking.status, 'pending_payment');

    t.paystack.markPaid(payRef);
    res = await t.request('GET', `/api/payments/verify?reference=${payRef}`);
    assert.equal(res.body.paid, true);
    assert.equal(res.body.booking.status, 'confirmed');
    assert.equal(res.body.booking.amountPaid, 240_000);

    // Verifying again must not double-count the payment.
    res = await t.request('GET', `/api/payments/verify?reference=${payRef}`);
    assert.equal(res.body.booking.amountPaid, 240_000);
  });

  it('keeps the date held if Paystack is down, and lets the customer retry', async () => {
    t.paystack.failNextInitialize = true;
    const res = await t.request('POST', '/api/bookings', { body: validBooking() });
    assert.equal(res.status, 502);
    const ref = res.body.booking.reference;

    const retry = await t.request('POST', `/api/bookings/${ref}/pay`);
    assert.equal(retry.status, 200);
    assert.ok(retry.body.authorizationUrl);
  });

  it('only shows a booking to someone who knows its email', async () => {
    const { body } = await t.request('POST', '/api/bookings', { body: validBooking() });
    const ref = body.booking.reference;
    assert.equal((await t.request('GET', `/api/bookings/${ref}?email=wrong@example.com`)).status, 404);
    const ok = await t.request('GET', `/api/bookings/${ref}?email=AMA@example.com`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.booking.customerEmail, undefined, 'public view has no contact details');
  });
});

describe('Paystack webhook', () => {
  let t;
  before(async () => (t = await startServer()));
  after(() => t.close());

  const event = (reference, amount) =>
    JSON.stringify({ event: 'charge.success', data: { reference, amount, currency: 'GHS', paid_at: '2026-10-01T10:00:00Z' } });

  it('rejects unsigned requests', async () => {
    const raw = event('whatever', 1);
    const res = await t.request('POST', '/api/paystack/webhook', { raw, headers: { 'x-paystack-signature': 'bad' } });
    assert.equal(res.status, 401);
  });

  it('confirms the booking on a signed charge.success, but not an underpayment', async () => {
    const { body } = await t.request('POST', '/api/bookings', { body: validBooking() });
    const payRef = t.paystack.initialized.at(-1).reference;
    const headers = (raw) => ({ 'content-type': 'application/json', 'x-paystack-signature': sign(raw) });

    const short = event(payRef, 100);
    assert.equal((await t.request('POST', '/api/paystack/webhook', { raw: short, headers: headers(short) })).status, 200);
    let lookup = await t.request('GET', `/api/bookings/${body.booking.reference}?email=ama@example.com`);
    assert.equal(lookup.body.booking.status, 'pending_payment');

    const full = event(payRef, 240_000);
    assert.equal((await t.request('POST', '/api/paystack/webhook', { raw: full, headers: headers(full) })).status, 200);
    lookup = await t.request('GET', `/api/bookings/${body.booking.reference}?email=ama@example.com`);
    assert.equal(lookup.body.booking.status, 'confirmed');
  });
});

describe('date holds', () => {
  it('releases an unpaid hold after it expires, and flags a late payment when the date is gone', async () => {
    let now = new Date();
    const t = await startServer({ env: { MAX_EVENTS_PER_DAY: '1', HOLD_MINUTES: '30' }, clock: () => now });
    try {
      const first = await t.request('POST', '/api/bookings', { body: validBooking() });
      const firstPayRef = t.paystack.initialized[0].reference;
      assert.equal((await t.request('POST', '/api/bookings', { body: validBooking() })).status, 409);

      now = new Date(now.getTime() + 31 * 60_000);
      const second = await t.request('POST', '/api/bookings', { body: validBooking({ email: 'kofi@example.com' }) });
      assert.equal(second.status, 201, 'expired hold frees the date');

      // The first customer finishes paying after their hold lapsed.
      t.paystack.markPaid(firstPayRef);
      const res = await t.request('GET', `/api/payments/verify?reference=${firstPayRef}`);
      assert.equal(res.body.booking.reference, first.body.booking.reference);
      assert.equal(res.body.booking.status, 'payment_review');
    } finally {
      await t.close();
    }
  });
});

describe('admin API', () => {
  let t;
  before(async () => (t = await startServer()));
  after(() => t.close());

  it('requires sign-in', async () => {
    assert.equal((await t.request('GET', '/api/admin/bookings')).status, 401);
    assert.equal((await t.request('POST', '/api/admin/login', { body: { password: 'nope' } })).status, 401);
  });

  it('lists bookings and updates status once signed in', async () => {
    const { body } = await t.request('POST', '/api/bookings', { body: validBooking() });
    const login = await t.request('POST', '/api/admin/login', { body: { password: 'let-me-in' } });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/i);

    const list = await t.request('GET', '/api/admin/bookings', { headers: { cookie } });
    assert.equal(list.status, 200);
    assert.equal(list.body.bookings[0].customerEmail, 'ama@example.com');

    const ref = body.booking.reference;
    const bad = await t.request('PATCH', `/api/admin/bookings/${ref}`, { headers: { cookie }, body: { status: 'payment_review' } });
    assert.equal(bad.status, 400);
    const ok = await t.request('PATCH', `/api/admin/bookings/${ref}`, { headers: { cookie }, body: { status: 'cancelled' } });
    assert.equal(ok.body.booking.status, 'cancelled');
  });

  it('rejects a forged session cookie', async () => {
    const forged = `dovey_admin=${Date.now() + 1e6}.deadbeef`;
    assert.equal((await t.request('GET', '/api/admin/bookings', { headers: { cookie: forged } })).status, 401);
  });
});
