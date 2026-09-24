import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminAuth } from './auth.js';
import { ADMIN_STATUSES, createBookingService, toAdminBooking, toPublicBooking } from './bookings.js';
import { ADD_ONS, INCLUDED, OCCASIONS, PACKAGES } from './catalog.js';
import { AppError, notFound } from './errors.js';
import { PaystackError } from './paystack.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Keep in sync with the headers in vercel.json, which covers the static pages there.
export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

/**
 * Builds the Express app. API requests first await `ensureReady` (which creates the
 * database schema once), so the first request after a cold start is safe.
 */
export function createApp({ db, config, paystack, clock, ensureReady = async () => {}, logger = console }) {
  const bookings = createBookingService(db, config, { clock });
  const auth = createAdminAuth(config);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS);
    next();
  });
  app.use('/api', async (req, res, next) => {
    await ensureReady();
    next();
  });

  // ---------- Paystack webhook (needs the raw body to check the signature) ----------
  app.post('/api/paystack/webhook', express.raw({ type: '*/*', limit: '100kb' }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!paystack.isValidSignature(raw, req.get('x-paystack-signature'))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    let event;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    if (event.event === 'charge.success') {
      const { reference, amount, currency, paid_at: paidAt } = event.data ?? {};
      try {
        await bookings.settlePayment(reference, { amount, currency, paidAt });
      } catch (err) {
        if (!(err instanceof AppError)) throw err; // database trouble: let Paystack retry
        // Acknowledge anyway: retrying won't fix an unknown reference or a short payment.
        logger.warn(`Webhook for ${reference} not applied: ${err.message}`);
      }
    }
    res.sendStatus(200);
  });

  app.use('/api', express.json({ limit: '20kb' }));

  // ---------- Public API ----------
  app.get('/api/catalog', (req, res) => {
    res.json({
      packages: PACKAGES,
      included: INCLUDED,
      occasions: OCCASIONS,
      addOns: ADD_ONS,
      depositPercent: config.depositPercent,
      minLeadDays: config.minLeadDays,
      holdMinutes: config.holdMinutes,
    });
  });

  app.post('/api/quote', (req, res) => {
    const { packageId, guests, addOns } = req.body ?? {};
    const validAddOns = Array.isArray(addOns) ? addOns.filter((id) => ADD_ONS.some((a) => a.id === id)) : [];
    const count = Number.isInteger(guests) && guests > 0 ? guests : 0;
    res.json(bookings.quote({ packageId, guests: count, addOns: [...new Set(validAddOns)] }));
  });

  app.get('/api/availability', async (req, res) => {
    res.json({ unavailable: await bookings.unavailableDates(String(req.query.from), String(req.query.to)) });
  });

  async function checkoutUrl(reference) {
    const { booking, paymentReference, amount } = await bookings.startPayment(reference);
    const checkout = await paystack.initialize({
      email: booking.customer_email,
      amount,
      reference: paymentReference,
      callbackUrl: `${config.publicUrl}/confirmation`,
      metadata: { booking_reference: booking.reference, cancel_action: `${config.publicUrl}/confirmation?booking=${booking.reference}` },
    });
    return checkout.authorization_url;
  }

  app.post('/api/bookings', async (req, res) => {
    const booking = await bookings.create(req.body);
    try {
      const authorizationUrl = await checkoutUrl(booking.reference);
      res.status(201).json({ booking: toPublicBooking(await bookings.get(booking.reference)), authorizationUrl });
    } catch (err) {
      if (!(err instanceof PaystackError)) throw err;
      logger.error(`Paystack initialize failed for ${booking.reference}: ${err.message}`);
      res.status(502).json({
        error: "Your date is held, but we couldn't open the payment page. Please try again.",
        booking: toPublicBooking(await bookings.get(booking.reference)),
      });
    }
  });

  app.post('/api/bookings/:reference/pay', async (req, res) => {
    res.json({ authorizationUrl: await checkoutUrl(req.params.reference) });
  });

  // Customers look up their own booking with its reference plus the email they booked with.
  app.get('/api/bookings/:reference', async (req, res) => {
    const booking = await bookings.get(req.params.reference);
    if (String(req.query.email ?? '').trim().toLowerCase() !== booking.customer_email) {
      throw notFound('Booking not found');
    }
    res.json({ booking: toPublicBooking(booking) });
  });

  // Paystack redirects the customer back with ?reference=; we confirm the result server-side.
  app.get('/api/payments/verify', async (req, res) => {
    const reference = String(req.query.reference ?? '');
    let booking = await bookings.bookingForPayment(reference);
    const transaction = await paystack.verify(reference);
    if (transaction.status === 'success') {
      booking = await bookings.settlePayment(reference, {
        amount: transaction.amount,
        currency: transaction.currency,
        paidAt: transaction.paid_at,
      });
    }
    res.json({ paid: transaction.status === 'success', booking: toPublicBooking(booking) });
  });

  // ---------- Admin API ----------
  app.get('/api/admin/session', (req, res) => res.json({ authenticated: auth.isAuthenticated(req) }));
  app.post('/api/admin/login', auth.login);
  app.post('/api/admin/logout', auth.logout);

  app.get('/api/admin/bookings', auth.requireAdmin, async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json({ bookings: (await bookings.list({ status })).map(toAdminBooking), statuses: ADMIN_STATUSES });
  });

  app.patch('/api/admin/bookings/:reference', auth.requireAdmin, async (req, res) => {
    res.json({ booking: toAdminBooking(await bookings.setStatus(req.params.reference, req.body?.status)) });
  });

  app.use('/api', (req, res, next) => next(notFound('No such endpoint')));

  // ---------- Pages & assets (on Vercel, these are served statically instead) ----------
  app.use(express.static(join(ROOT, 'public'), { extensions: ['html'] }));
  app.use((req, res) => res.status(404).sendFile(join(ROOT, 'public/404.html')));

  // ---------- Errors ----------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err instanceof PaystackError) {
      logger.error(`Paystack: ${err.message}`);
      return res.status(502).json({ error: 'The payment service is unavailable right now. Please try again shortly.' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    logger.error(err);
    res.status(500).json({ error: 'Something went wrong on our side.' });
  });

  return app;
}
