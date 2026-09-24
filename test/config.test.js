import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';

const prod = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db.example.com:6543/postgres',
  PAYSTACK_SECRET_KEY: 'sk_test_x',
  ADMIN_PASSWORD: 'x',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('public URL (where Paystack sends customers back)', () => {
  it('uses the Vercel production domain by default', () => {
    const config = loadConfig({ ...prod, VERCEL_PROJECT_PRODUCTION_URL: 'doveyevents.vercel.app' });
    assert.equal(config.publicUrl, 'https://doveyevents.vercel.app');
  });

  it('ignores a localhost PUBLIC_URL copied into production', () => {
    const config = loadConfig({ ...prod, PUBLIC_URL: 'http://localhost:3000', VERCEL_PROJECT_PRODUCTION_URL: 'doveyevents.vercel.app' });
    assert.equal(config.publicUrl, 'https://doveyevents.vercel.app');
  });

  it('keeps a real custom domain', () => {
    const config = loadConfig({ ...prod, PUBLIC_URL: 'https://doveyevents.com/', VERCEL_PROJECT_PRODUCTION_URL: 'doveyevents.vercel.app' });
    assert.equal(config.publicUrl, 'https://doveyevents.com');
  });

  it('allows localhost during development', () => {
    assert.equal(loadConfig({ PUBLIC_URL: 'http://localhost:3000' }).publicUrl, 'http://localhost:3000');
  });
});
