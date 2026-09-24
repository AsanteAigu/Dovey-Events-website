# Dovey Events

*Where every detail matters.* Booking site for Dovey Events, event décor and styling in Ghana. Customers pick the occasion and a package (50, 100, 150 or 200 guests), choose a date, and pay a deposit with **Paystack** (Mobile Money or card) to confirm it. Bookings are stored in **Supabase** (Postgres), and an admin dashboard lists them all.

## Run it locally

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:3000
npm test
```

Leave `DATABASE_URL` empty to develop against a local embedded Postgres (stored in `data/pglite`); set it to use Supabase.

| Page | What it's for |
| --- | --- |
| `/` | Homepage with the silk-ribbon hero |
| `/packages` | Packages, what's included, how booking works |
| `/about` | About Dovey Events |
| `/book` | Booking form with a live quote and date availability |
| `/confirmation` | Where Paystack sends customers back; also "find my booking" |
| `/admin` | Bookings dashboard (password in `ADMIN_PASSWORD`) |

## Deploy to Vercel

The repo is set up for Vercel (`vercel.json`): pages are served statically from `public/`, and everything under `/api` runs as one serverless function (`api/index.js`).

In the Vercel project, go to **Settings → Environment Variables** and add:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase → **Connect** → **Transaction pooler** URI (port `6543`). URL-encode the password (a space becomes `%20`). The direct `db.<ref>.supabase.co` URL is IPv6-only and won't work from Vercel. |
| `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys (`sk_test_…` or `sk_live_…`) |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `SESSION_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PUBLIC_URL` | Optional. Defaults to the Vercel production domain; set it if you use a custom domain. |

Then redeploy. The database tables are created automatically on the first request (see `src/schema.js`), with row-level security switched on so Supabase's public API can't read customer data.

Finally, in Paystack set the **webhook URL** to `https://<your-domain>/api/paystack/webhook`.

It also runs as a normal Node server (`npm start`) on hosts like Railway or Render.

## How bookings work

- **Prices are computed on the server** (`src/catalog.js`); the browser's numbers are never trusted. All money is stored in pesewas.
- A new booking **holds its date** for `HOLD_MINUTES` while the deposit is paid. Each day takes at most `MAX_EVENTS_PER_DAY` events; a per-date database lock stops two customers taking the last slot at once.
- If a hold lapses, the date is released. If a payment still arrives and the date has since been taken, the booking is marked **Needs review** so the team can rebook or refund.
- Payments are confirmed two ways, both safe to repeat: when the customer returns (the server verifies with Paystack) and through the signed webhook, which covers customers who close the tab first.
- Admins can mark bookings confirmed, completed or cancelled.

To change packages, prices, occasions, what every package includes, or to add optional extras, edit `src/catalog.js`.

> **The package prices are placeholders** (GH₵8,000 / 14,000 / 19,000 / 24,000). Set the real prices in `src/catalog.js` before going live.

## Project layout

```
api/index.js    Vercel serverless entry point
src/
  server.js     long-running server (local dev, Railway, Render)
  bootstrap.js  wires config, database and Paystack together
  app.js        routes and security headers
  bookings.js   validation, pricing, date holds, payment settlement
  paystack.js   Paystack API client and webhook signature check
  auth.js       admin sign-in (signed, HttpOnly cookie)
  catalog.js    packages, occasions, inclusions and extras
  db.js         Postgres connection (Supabase, or PGlite locally)
  schema.js     tables, indexes and row-level security
public/         HTML, CSS and browser JS (no framework)
scripts/        copies three.js into public/vendor at install/build time
test/           node:test suites against an in-memory Postgres, with a fake Paystack
```
