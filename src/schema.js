// Dovey Events database schema. Kept in JS (not a .sql file) so serverless bundles
// always include it. Safe to run repeatedly: every statement is idempotent.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS bookings (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference       text        NOT NULL UNIQUE,
  package_id      text        NOT NULL,
  occasion        text        NOT NULL,
  event_date      date        NOT NULL,
  guests          integer     NOT NULL CHECK (guests > 0),
  add_ons         jsonb       NOT NULL DEFAULT '[]',
  venue           text        NOT NULL DEFAULT '',
  notes           text        NOT NULL DEFAULT '',
  customer_name   text        NOT NULL,
  customer_email  text        NOT NULL,
  customer_phone  text        NOT NULL,
  total_amount    integer     NOT NULL,           -- pesewas
  deposit_amount  integer     NOT NULL,           -- pesewas
  amount_paid     integer     NOT NULL DEFAULT 0, -- pesewas
  status          text        NOT NULL DEFAULT 'pending_payment'
                  CHECK (status IN ('pending_payment', 'confirmed', 'completed', 'cancelled', 'expired', 'payment_review')),
  hold_expires_at timestamptz,                    -- unpaid bookings release their date after this
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_date_status ON bookings (event_date, status);

CREATE TABLE IF NOT EXISTS payments (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference   text        NOT NULL UNIQUE,        -- Paystack transaction reference
  booking_id  integer     NOT NULL REFERENCES bookings (id),
  amount      integer     NOT NULL,               -- pesewas
  status      text        NOT NULL DEFAULT 'initialized' CHECK (status IN ('initialized', 'success')),
  paid_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_booking ON payments (booking_id);

-- Supabase exposes tables in the public schema through its REST API. Row-level
-- security with no policies closes that door: only the server's own database
-- connection (which bypasses RLS) can read or write customer data.
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
`;
