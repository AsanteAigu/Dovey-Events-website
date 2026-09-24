import { randomInt } from 'node:crypto';
import { ADD_ONS, findAddOn, findPackage } from './catalog.js';
import { transaction } from './db.js';
import { badRequest, conflict, notFound } from './errors.js';

export const STATUSES = ['pending_payment', 'confirmed', 'completed', 'cancelled', 'expired', 'payment_review'];

// Statuses an admin may set by hand. Payment-driven statuses are set by the system only.
export const ADMIN_STATUSES = ['confirmed', 'completed', 'cancelled'];

// Bookings in these statuses occupy one of the day's event slots.
const HOLDING = `status IN ('confirmed', 'completed') OR (status = 'pending_payment' AND hold_expires_at > :now)`;

const MAX_BOOKING_DAYS_AHEAD = 540;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return out;
}

const isoDay = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  return isoDay(new Date(`${value}T00:00:00Z`)) === value;
}

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Price breakdown for a package, guest count and add-ons. Amounts in pesewas. */
export function quote({ packageId, guests, addOns = [] }, depositPercent) {
  const pkg = findPackage(packageId);
  if (!pkg) throw badRequest('Unknown package');
  const lines = [{ label: `${pkg.name} (base)`, amount: pkg.basePrice }];
  if (pkg.perGuest) lines.push({ label: `${guests} guests`, amount: pkg.perGuest * guests });
  for (const id of addOns) {
    const addOn = findAddOn(id);
    lines.push({ label: addOn.name, amount: addOn.price });
  }
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const deposit = Math.ceil((total * depositPercent) / 100);
  return { lines, total, deposit };
}

/** Validates and normalises a booking request. Throws a 400 listing every bad field. */
export function validateBookingInput(body, { today, minLeadDays }) {
  const errors = {};
  const input = body && typeof body === 'object' ? body : {};

  const pkg = findPackage(input.packageId);
  if (!pkg) errors.packageId = 'Choose a package.';

  const eventDate = text(input.eventDate, 10);
  const earliest = isoDay(addDays(today, minLeadDays));
  const latest = isoDay(addDays(today, MAX_BOOKING_DAYS_AHEAD));
  if (!isRealDate(eventDate)) errors.eventDate = 'Choose a valid date.';
  else if (eventDate < earliest) errors.eventDate = `We need at least ${minLeadDays} days' notice.`;
  else if (eventDate > latest) errors.eventDate = 'We take bookings up to 18 months ahead.';

  const guests = Number(input.guests);
  if (!Number.isInteger(guests)) errors.guests = 'Enter the number of guests.';
  else if (pkg && (guests < pkg.minGuests || guests > pkg.maxGuests)) {
    errors.guests = `${pkg.name} is for ${pkg.minGuests}–${pkg.maxGuests} guests.`;
  }

  const rawAddOns = Array.isArray(input.addOns) ? input.addOns : [];
  const addOns = [...new Set(rawAddOns)].filter((id) => typeof id === 'string');
  if (addOns.some((id) => !findAddOn(id))) errors.addOns = 'Unknown add-on selected.';

  const name = text(input.name, 120);
  const email = text(input.email, 254).toLowerCase();
  const phone = text(input.phone, 30);
  if (name.length < 2) errors.name = 'Enter your name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email.';
  if (phone.replace(/\D/g, '').length < 9) errors.phone = 'Enter a valid phone number.';

  if (Object.keys(errors).length) throw badRequest('Please check the highlighted fields.', errors);

  return {
    packageId: pkg.id,
    eventDate,
    guests,
    addOns: ADD_ONS.map((a) => a.id).filter((id) => addOns.includes(id)), // stable order
    name,
    email,
    phone,
    venue: text(input.venue, 200),
    notes: text(input.notes, 2000),
  };
}

export function createBookingService(db, config, { clock = () => new Date() } = {}) {
  const nowIso = () => clock().toISOString();

  const stmt = {
    expireHolds: db.prepare(
      `UPDATE bookings SET status = 'expired', updated_at = :now
       WHERE status = 'pending_payment' AND hold_expires_at <= :now`,
    ),
    countHolding: db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE event_date = :date AND (${HOLDING})`),
    fullDates: db.prepare(
      `SELECT event_date FROM bookings WHERE event_date BETWEEN :from AND :to AND (${HOLDING})
       GROUP BY event_date HAVING COUNT(*) >= :max`,
    ),
    insert: db.prepare(
      `INSERT INTO bookings (reference, package_id, event_date, guests, add_ons, venue, notes,
         customer_name, customer_email, customer_phone, total_amount, deposit_amount,
         status, hold_expires_at, created_at, updated_at)
       VALUES (:reference, :packageId, :eventDate, :guests, :addOns, :venue, :notes,
         :name, :email, :phone, :total, :deposit, 'pending_payment', :holdUntil, :now, :now)`,
    ),
    byReference: db.prepare('SELECT * FROM bookings WHERE reference = ?'),
    byId: db.prepare('SELECT * FROM bookings WHERE id = ?'),
    renewHold: db.prepare(
      `UPDATE bookings SET status = 'pending_payment', hold_expires_at = :holdUntil, updated_at = :now WHERE id = :id`,
    ),
    insertPayment: db.prepare(
      `INSERT INTO payments (reference, booking_id, amount, created_at) VALUES (:reference, :bookingId, :amount, :now)`,
    ),
    paymentByReference: db.prepare('SELECT * FROM payments WHERE reference = ?'),
    markPaymentPaid: db.prepare(`UPDATE payments SET status = 'success', paid_at = :paidAt WHERE id = :id`),
    applyPayment: db.prepare(
      `UPDATE bookings SET amount_paid = amount_paid + :amount, status = :status, hold_expires_at = NULL,
         updated_at = :now WHERE id = :id`,
    ),
    setStatus: db.prepare('UPDATE bookings SET status = :status, updated_at = :now WHERE id = :id'),
  };

  function expireStaleHolds() {
    stmt.expireHolds.run({ now: nowIso() });
  }

  function slotsTaken(date) {
    return stmt.countHolding.get({ date, now: nowIso() }).n;
  }

  function holdUntil() {
    return new Date(clock().getTime() + config.holdMinutes * 60_000).toISOString();
  }

  function newReference() {
    for (;;) {
      const reference = `DVM-${randomCode(8)}`;
      if (!stmt.byReference.get(reference)) return reference;
    }
  }

  function requireBooking(reference) {
    const booking = typeof reference === 'string' && stmt.byReference.get(reference.toUpperCase());
    if (!booking) throw notFound('Booking not found');
    return booking;
  }

  return {
    quote: (input) => quote(input, config.depositPercent),

    /** Fully booked dates between from and to (inclusive), for greying out the calendar. */
    unavailableDates(from, to) {
      if (!isRealDate(from) || !isRealDate(to)) throw badRequest('from and to must be YYYY-MM-DD dates');
      return stmt.fullDates.all({ from, to, now: nowIso(), max: config.maxEventsPerDay }).map((r) => r.event_date);
    },

    /** Creates a booking that holds its date for `holdMinutes` while the deposit is paid. */
    create(body) {
      const input = validateBookingInput(body, { today: clock(), minLeadDays: config.minLeadDays });
      const { total, deposit } = quote(input, config.depositPercent);

      return transaction(db, () => {
        expireStaleHolds();
        if (slotsTaken(input.eventDate) >= config.maxEventsPerDay) {
          throw conflict('Sorry, that date is fully booked. Please choose another day.');
        }
        const reference = newReference();
        stmt.insert.run({
          ...input,
          reference,
          addOns: JSON.stringify(input.addOns),
          total,
          deposit,
          holdUntil: holdUntil(),
          now: nowIso(),
        });
        return stmt.byReference.get(reference);
      });
    },

    get: requireBooking,

    bookingForPayment(paymentReference) {
      const payment = typeof paymentReference === 'string' && stmt.paymentByReference.get(paymentReference);
      if (!payment) throw notFound('Unknown payment reference');
      return stmt.byId.get(payment.booking_id);
    },

    /**
     * Prepares a booking for a (new) payment attempt, re-holding its date if the
     * previous hold lapsed. Returns the payment reference and amount to charge.
     */
    startPayment(reference) {
      return transaction(db, () => {
        expireStaleHolds();
        const booking = requireBooking(reference);
        if (!['pending_payment', 'expired'].includes(booking.status)) {
          throw conflict('This booking does not need a payment.');
        }
        if (booking.status === 'expired' && slotsTaken(booking.event_date) >= config.maxEventsPerDay) {
          throw conflict('Sorry, this date was booked by someone else while your hold was open.');
        }
        stmt.renewHold.run({ id: booking.id, holdUntil: holdUntil(), now: nowIso() });

        const paymentReference = `${booking.reference}-${randomCode(4)}`;
        stmt.insertPayment.run({
          reference: paymentReference,
          bookingId: booking.id,
          amount: booking.deposit_amount,
          now: nowIso(),
        });
        return { booking: stmt.byId.get(booking.id), paymentReference, amount: booking.deposit_amount };
      });
    },

    /**
     * Records a successful Paystack transaction. Safe to call more than once for
     * the same reference (callback redirect and webhook both arrive).
     */
    settlePayment(paymentReference, { amount, currency, paidAt }) {
      return transaction(db, () => {
        const payment = stmt.paymentByReference.get(paymentReference);
        if (!payment) throw notFound('Unknown payment reference');
        const booking = stmt.byId.get(payment.booking_id);
        if (payment.status === 'success') return booking;

        if (currency !== 'GHS' || !Number.isInteger(amount) || amount < payment.amount) {
          throw badRequest('Payment amount does not match the booking');
        }

        stmt.markPaymentPaid.run({ id: payment.id, paidAt: paidAt || nowIso() });

        // A payment can land after the hold lapsed or the booking was cancelled.
        // Confirm when the date is still free; otherwise flag it for a refund.
        let status = booking.status;
        if (booking.status === 'pending_payment') {
          status = 'confirmed';
        } else if (booking.status === 'expired') {
          status = slotsTaken(booking.event_date) < config.maxEventsPerDay ? 'confirmed' : 'payment_review';
        } else if (booking.status === 'cancelled') {
          status = 'payment_review';
        }
        stmt.applyPayment.run({ id: booking.id, amount, status, now: nowIso() });
        return stmt.byId.get(booking.id);
      });
    },

    list({ status } = {}) {
      expireStaleHolds();
      if (status && !STATUSES.includes(status)) throw badRequest('Unknown status');
      const sql = `SELECT * FROM bookings ${status ? 'WHERE status = ?' : ''} ORDER BY event_date ASC, id ASC`;
      return status ? db.prepare(sql).all(status) : db.prepare(sql).all();
    },

    setStatus(reference, status) {
      if (!ADMIN_STATUSES.includes(status)) throw badRequest(`Status must be one of: ${ADMIN_STATUSES.join(', ')}`);
      const booking = requireBooking(reference);
      stmt.setStatus.run({ id: booking.id, status, now: nowIso() });
      return stmt.byId.get(booking.id);
    },

    expireStaleHolds,
  };
}

/** The customer-facing view of a booking. */
export function toPublicBooking(row) {
  const pkg = findPackage(row.package_id);
  return {
    reference: row.reference,
    status: row.status,
    package: { id: pkg.id, name: pkg.name },
    eventDate: row.event_date,
    guests: row.guests,
    addOns: JSON.parse(row.add_ons).map((id) => ({ id, name: findAddOn(id)?.name ?? id })),
    venue: row.venue,
    customerName: row.customer_name,
    totalAmount: row.total_amount,
    depositAmount: row.deposit_amount,
    amountPaid: row.amount_paid,
    holdExpiresAt: row.hold_expires_at,
  };
}

/** Everything, for the admin dashboard. */
export function toAdminBooking(row) {
  return {
    ...toPublicBooking(row),
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
