import { randomInt } from 'node:crypto';
import { ADD_ONS, findAddOn, findOccasion, findPackage } from './catalog.js';
import { badRequest, conflict, notFound } from './errors.js';

export const STATUSES = ['pending_payment', 'confirmed', 'completed', 'cancelled', 'expired', 'payment_review'];

// Statuses an admin may set by hand. Payment-driven statuses are set by the system only.
export const ADMIN_STATUSES = ['confirmed', 'completed', 'cancelled'];

// Bookings in these statuses occupy one of the day's event slots. `now` is the SQL placeholder for the current time.
const holding = (now) => `(status IN ('confirmed', 'completed') OR (status = 'pending_payment' AND hold_expires_at > ${now}))`;

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
  const lines = [{ label: pkg.perGuest ? `${pkg.name} (base)` : `${pkg.name} package`, amount: pkg.basePrice }];
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

  const occasion = findOccasion(input.occasion);
  if (!occasion) errors.occasion = 'Tell us the occasion.';

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
    occasion: occasion.id,
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
  const now = () => clock().toISOString();
  const holdUntil = () => new Date(clock().getTime() + config.holdMinutes * 60_000).toISOString();
  const one = async (q, text, params) => (await q(text, params))[0];

  const expireStaleHolds = (q = db.query) =>
    q(`UPDATE bookings SET status = 'expired', updated_at = $1
       WHERE status = 'pending_payment' AND hold_expires_at <= $1`, [now()]);

  async function slotsTaken(q, date) {
    const row = await one(q, `SELECT count(*)::int AS n FROM bookings WHERE event_date = $1 AND ${holding('$2')}`, [date, now()]);
    return row.n;
  }

  // Serialises everything that decides who gets a date, so two customers can't
  // both take the last slot. The lock is released when the transaction ends.
  const lockDate = (q, date) => q('SELECT pg_advisory_xact_lock(hashtext($1))', [`dovey:${date}`]);

  async function requireBooking(q, reference, { forUpdate = false } = {}) {
    const booking = typeof reference === 'string'
      && await one(q, `SELECT * FROM bookings WHERE reference = $1${forUpdate ? ' FOR UPDATE' : ''}`, [reference.toUpperCase()]);
    if (!booking) throw notFound('Booking not found');
    return booking;
  }

  return {
    quote: (input) => quote(input, config.depositPercent),

    /** Fully booked dates between from and to (inclusive), for greying out the calendar. */
    async unavailableDates(from, to) {
      if (!isRealDate(from) || !isRealDate(to)) throw badRequest('from and to must be YYYY-MM-DD dates');
      const rows = await db.query(
        `SELECT event_date FROM bookings WHERE event_date BETWEEN $1 AND $2 AND ${holding('$3')}
         GROUP BY event_date HAVING count(*) >= $4 ORDER BY event_date`,
        [from, to, now(), config.maxEventsPerDay],
      );
      return rows.map((r) => r.event_date);
    },

    /** Creates a booking that holds its date for `holdMinutes` while the deposit is paid. */
    async create(body) {
      const input = validateBookingInput(body, { today: clock(), minLeadDays: config.minLeadDays });
      const { total, deposit } = quote(input, config.depositPercent);

      return db.transaction(async ({ query }) => {
        await lockDate(query, input.eventDate);
        await expireStaleHolds(query);
        if (await slotsTaken(query, input.eventDate) >= config.maxEventsPerDay) {
          throw conflict('Sorry, that date is fully booked. Please choose another day.');
        }
        // 31^8 possible references: a collision is vanishingly rare, but retry rather than fail.
        for (;;) {
          const row = await one(query,
            `INSERT INTO bookings (reference, package_id, occasion, event_date, guests, add_ons, venue, notes,
               customer_name, customer_email, customer_phone, total_amount, deposit_amount,
               hold_expires_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
             ON CONFLICT (reference) DO NOTHING
             RETURNING *`,
            [`DVE-${randomCode(8)}`, input.packageId, input.occasion, input.eventDate, input.guests,
              JSON.stringify(input.addOns), input.venue, input.notes, input.name, input.email, input.phone,
              total, deposit, holdUntil(), now()]);
          if (row) return row;
        }
      });
    },

    get: (reference) => requireBooking(db.query, reference),

    async bookingForPayment(paymentReference) {
      const booking = typeof paymentReference === 'string' && await one(db.query,
        'SELECT b.* FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.reference = $1', [paymentReference]);
      if (!booking) throw notFound('Unknown payment reference');
      return booking;
    },

    /**
     * Prepares a booking for a (new) payment attempt, re-holding its date if the
     * previous hold lapsed. Returns the payment reference and amount to charge.
     */
    async startPayment(reference) {
      return db.transaction(async ({ query }) => {
        let booking = await requireBooking(query, reference);
        await lockDate(query, booking.event_date);
        await expireStaleHolds(query);
        booking = await requireBooking(query, reference, { forUpdate: true });

        if (!['pending_payment', 'expired'].includes(booking.status)) {
          throw conflict('This booking does not need a payment.');
        }
        if (booking.status === 'expired' && await slotsTaken(query, booking.event_date) >= config.maxEventsPerDay) {
          throw conflict('Sorry, this date was booked by someone else while your hold was open.');
        }
        booking = await one(query,
          `UPDATE bookings SET status = 'pending_payment', hold_expires_at = $2, updated_at = $3
           WHERE id = $1 RETURNING *`, [booking.id, holdUntil(), now()]);

        const paymentReference = `${booking.reference}-${randomCode(4)}`;
        await query('INSERT INTO payments (reference, booking_id, amount, created_at) VALUES ($1, $2, $3, $4)',
          [paymentReference, booking.id, booking.deposit_amount, now()]);
        return { booking, paymentReference, amount: booking.deposit_amount };
      });
    },

    /**
     * Records a successful Paystack transaction. Safe to call more than once, even
     * concurrently, for the same reference (the redirect and the webhook both arrive).
     */
    async settlePayment(paymentReference, { amount, currency, paidAt }) {
      return db.transaction(async ({ query }) => {
        const found = await one(query,
          'SELECT b.event_date FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.reference = $1',
          [paymentReference]);
        if (!found) throw notFound('Unknown payment reference');
        await lockDate(query, found.event_date);

        const payment = await one(query, 'SELECT * FROM payments WHERE reference = $1 FOR UPDATE', [paymentReference]);
        const booking = await one(query, 'SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [payment.booking_id]);
        if (payment.status === 'success') return booking;

        if (currency !== 'GHS' || !Number.isInteger(amount) || amount < payment.amount) {
          throw badRequest('Payment amount does not match the booking');
        }

        await query(`UPDATE payments SET status = 'success', paid_at = $2 WHERE id = $1`, [payment.id, paidAt || now()]);

        // A payment can land after the hold lapsed or the booking was cancelled.
        // Confirm when the date is still free; otherwise flag it for a refund.
        let status = booking.status;
        if (booking.status === 'pending_payment') {
          status = 'confirmed';
        } else if (booking.status === 'expired') {
          status = await slotsTaken(query, booking.event_date) < config.maxEventsPerDay ? 'confirmed' : 'payment_review';
        } else if (booking.status === 'cancelled') {
          status = 'payment_review';
        }
        return one(query,
          `UPDATE bookings SET amount_paid = amount_paid + $2, status = $3, hold_expires_at = NULL, updated_at = $4
           WHERE id = $1 RETURNING *`, [booking.id, amount, status, now()]);
      });
    },

    async list({ status } = {}) {
      if (status && !STATUSES.includes(status)) throw badRequest('Unknown status');
      await expireStaleHolds();
      return status
        ? db.query('SELECT * FROM bookings WHERE status = $1 ORDER BY event_date, id', [status])
        : db.query('SELECT * FROM bookings ORDER BY event_date, id');
    },

    async setStatus(reference, status) {
      if (!ADMIN_STATUSES.includes(status)) throw badRequest(`Status must be one of: ${ADMIN_STATUSES.join(', ')}`);
      const booking = await one(db.query,
        'UPDATE bookings SET status = $2, updated_at = $3 WHERE reference = $1 RETURNING *',
        [typeof reference === 'string' ? reference.toUpperCase() : '', status, now()]);
      if (!booking) throw notFound('Booking not found');
      return booking;
    },
  };
}

const iso = (value) => (value instanceof Date ? value.toISOString() : value);

/** The customer-facing view of a booking. */
export function toPublicBooking(row) {
  const pkg = findPackage(row.package_id);
  return {
    reference: row.reference,
    status: row.status,
    package: { id: row.package_id, name: pkg?.name ?? row.package_id },
    occasion: { id: row.occasion, name: findOccasion(row.occasion)?.name ?? row.occasion },
    eventDate: row.event_date,
    guests: row.guests,
    addOns: row.add_ons.map((id) => ({ id, name: findAddOn(id)?.name ?? id })),
    venue: row.venue,
    customerName: row.customer_name,
    totalAmount: row.total_amount,
    depositAmount: row.deposit_amount,
    amountPaid: row.amount_paid,
    holdExpiresAt: iso(row.hold_expires_at),
  };
}

/** Everything, for the admin dashboard. */
export function toAdminBooking(row) {
  return {
    ...toPublicBooking(row),
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    notes: row.notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
