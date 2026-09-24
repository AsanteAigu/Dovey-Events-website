import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bookings (
  id              INTEGER PRIMARY KEY,
  reference       TEXT    NOT NULL UNIQUE,
  package_id      TEXT    NOT NULL,
  occasion        TEXT    NOT NULL,
  event_date      TEXT    NOT NULL,             -- YYYY-MM-DD
  guests          INTEGER NOT NULL,
  add_ons         TEXT    NOT NULL DEFAULT '[]', -- JSON array of add-on ids
  venue           TEXT    NOT NULL DEFAULT '',
  notes           TEXT    NOT NULL DEFAULT '',
  customer_name   TEXT    NOT NULL,
  customer_email  TEXT    NOT NULL,
  customer_phone  TEXT    NOT NULL,
  total_amount    INTEGER NOT NULL,             -- pesewas
  deposit_amount  INTEGER NOT NULL,             -- pesewas
  amount_paid     INTEGER NOT NULL DEFAULT 0,   -- pesewas
  status          TEXT    NOT NULL DEFAULT 'pending_payment',
  hold_expires_at TEXT,                         -- unpaid bookings release their date after this
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_date_status ON bookings (event_date, status);

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY,
  reference   TEXT    NOT NULL UNIQUE,          -- Paystack transaction reference
  booking_id  INTEGER NOT NULL REFERENCES bookings(id),
  amount      INTEGER NOT NULL,                 -- pesewas
  status      TEXT    NOT NULL DEFAULT 'initialized', -- initialized | success
  paid_at     TEXT,
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_booking ON payments (booking_id);
`;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

/** Runs fn inside a write transaction; rolls back if it throws. */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
