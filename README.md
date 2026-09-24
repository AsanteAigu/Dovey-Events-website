# Dovey Events

*Where every detail matters.* Booking site for Dovey Events, event décor and styling in Ghana. Customers pick the occasion and a package (50, 100, 150 or 200 guests), choose a date, and pay a deposit with **Paystack** (Mobile Money or card) to confirm their date. An admin dashboard lists every booking.

## Run it

Requires Node.js 22.13 or newer (it uses Node's built-in SQLite, so nothing needs compiling).

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:3000
npm test
```

| Page | What it's for |
| --- | --- |
| `/` | Homepage with the silk-ribbon hero and packages |
| `/book` | Booking form with a live quote and date availability |
| `/confirmation` | Where Paystack sends customers back; also "find my booking" |
| `/admin` | Bookings dashboard (password in `ADMIN_PASSWORD`) |

## Paystack setup

1. In the Paystack dashboard, go to **Settings → API Keys & Webhooks**.
2. Put the **secret key** in `PAYSTACK_SECRET_KEY` (start with `sk_test_…`).
3. Set the **webhook URL** to `https://<your-domain>/api/paystack/webhook`.
4. Set `PUBLIC_URL` to the site's public address so Paystack can send customers back.

Payments are confirmed two ways, both safe to repeat: when the customer returns (the server asks Paystack to verify the transaction) and through the signed webhook, which also covers customers who close the tab before returning.

## How bookings work

- **Prices are computed on the server** (`src/catalog.js`); the browser's numbers are never trusted. All money is stored in pesewas.
- A new booking **holds its date** for `HOLD_MINUTES` while the deposit is paid. Each day takes at most `MAX_EVENTS_PER_DAY` events.
- If a hold lapses, the date is released. If a payment still arrives and the date has since been taken, the booking is marked **Needs review** so the team can rebook or refund.
- Admins can mark bookings confirmed, completed or cancelled.

To change packages, prices, occasions, what every package includes, or to add optional extras, edit `src/catalog.js`.

> **The package prices are placeholders** (GH₵8,000 / 14,000 / 19,000 / 24,000). Set the real prices in `src/catalog.js` before going live.

## Project layout

```
src/
  server.js     starts the app
  app.js        routes and security headers
  bookings.js   validation, pricing, date holds, payment settlement
  paystack.js   Paystack API client and webhook signature check
  auth.js       admin sign-in (signed, HttpOnly cookie)
  catalog.js    packages, occasions, inclusions and extras
  db.js         SQLite schema
public/         HTML, CSS and browser JS (no build step)
test/           node:test suites (a fake Paystack stands in for the real one)
```

## Deploying

Any Node host works (Render, Railway, a VPS). Set `NODE_ENV=production` along with `PAYSTACK_SECRET_KEY`, `ADMIN_PASSWORD` and a `SESSION_SECRET` of 32+ characters; the server refuses to start in production without them. Put `DATABASE_PATH` on a persistent disk.
