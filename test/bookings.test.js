import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quote, validateBookingInput } from '../src/bookings.js';
import { validBooking } from './helpers.js';

const today = new Date('2026-09-24T12:00:00Z');
const opts = { today, minLeadDays: 7 };

describe('quote', () => {
  it('adds base price, per-guest price and add-ons, and rounds the deposit up', () => {
    const q = quote({ packageId: 'intimate', guests: 20, addOns: ['photo'] }, 30);
    // 3500 + 20 × 40 + 2500 = 6800 GHS
    assert.equal(q.total, 680_000);
    assert.equal(q.deposit, 204_000);
    assert.equal(q.lines.length, 3);
  });

  it('never produces fractional pesewas', () => {
    const q = quote({ packageId: 'intimate', guests: 11, addOns: [] }, 33);
    assert.ok(Number.isInteger(q.deposit));
  });
});

describe('validateBookingInput', () => {
  it('accepts and normalises a good booking', () => {
    const v = validateBookingInput(
      validBooking({ eventDate: '2026-10-20', email: ' AMA@Example.com ', addOns: ['cake', 'photo', 'photo'] }),
      opts,
    );
    assert.equal(v.email, 'ama@example.com');
    assert.deepEqual(v.addOns, ['photo', 'cake']);
  });

  it('rejects dates inside the notice period, in the past, or impossible', () => {
    for (const eventDate of ['2026-09-28', '2025-01-01', '2026-02-30', 'soon']) {
      assert.throws(() => validateBookingInput(validBooking({ eventDate }), opts), (err) => {
        assert.ok(err.details.eventDate, eventDate);
        return true;
      });
    }
  });

  it('enforces the package guest range', () => {
    assert.throws(
      () => validateBookingInput(validBooking({ eventDate: '2026-10-20', guests: 200 }), opts),
      (err) => /10–60 guests/.test(err.details.guests),
    );
  });

  it('reports every bad field at once', () => {
    assert.throws(
      () => validateBookingInput({ packageId: 'nope', email: 'x', phone: '1' }, opts),
      (err) => ['packageId', 'eventDate', 'guests', 'name', 'email', 'phone'].every((k) => k in err.details),
    );
  });
});
