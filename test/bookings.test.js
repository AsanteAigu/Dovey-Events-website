import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quote, validateBookingInput } from '../src/bookings.js';
import { validBooking } from './helpers.js';

const today = new Date('2026-09-24T12:00:00Z');
const opts = { today, minLeadDays: 7 };

describe('quote', () => {
  it('prices a package and takes the deposit percentage of the total', () => {
    const q = quote({ packageId: 'guests-50', guests: 40, addOns: [] }, 30);
    assert.equal(q.total, 800_000); // GH₵8,000
    assert.equal(q.deposit, 240_000);
    assert.deepEqual(q.lines, [{ label: '50 Guests package', amount: 800_000 }]);
  });

  it('never produces fractional pesewas', () => {
    const q = quote({ packageId: 'guests-150', guests: 120, addOns: [] }, 33);
    assert.ok(Number.isInteger(q.deposit));
  });
});

describe('validateBookingInput', () => {
  it('accepts and normalises a good booking', () => {
    const v = validateBookingInput(validBooking({ eventDate: '2026-10-20', email: ' AMA@Example.com ' }), opts);
    assert.equal(v.email, 'ama@example.com');
    assert.equal(v.occasion, 'birthday');
  });

  it('requires a known occasion', () => {
    assert.throws(
      () => validateBookingInput(validBooking({ eventDate: '2026-10-20', occasion: 'rave' }), opts),
      (err) => !!err.details.occasion,
    );
  });

  it('rejects dates inside the notice period, in the past, or impossible', () => {
    for (const eventDate of ['2026-09-28', '2025-01-01', '2026-02-30', 'soon']) {
      assert.throws(() => validateBookingInput(validBooking({ eventDate }), opts), (err) => {
        assert.ok(err.details.eventDate, eventDate);
        return true;
      });
    }
  });

  it('enforces the package guest limit', () => {
    assert.throws(
      () => validateBookingInput(validBooking({ eventDate: '2026-10-20', guests: 80 }), opts),
      (err) => /1–50 guests/.test(err.details.guests),
    );
  });

  it('rejects unknown extras', () => {
    assert.throws(
      () => validateBookingInput(validBooking({ eventDate: '2026-10-20', addOns: ['fireworks'] }), opts),
      (err) => !!err.details.addOns,
    );
  });

  it('reports every bad field at once', () => {
    assert.throws(
      () => validateBookingInput({ packageId: 'nope', email: 'x', phone: '1' }, opts),
      (err) => ['packageId', 'occasion', 'eventDate', 'guests', 'name', 'email', 'phone'].every((k) => k in err.details),
    );
  });
});
