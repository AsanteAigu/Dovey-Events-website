// Long-running server for local development and hosts like Railway.
import { createServerApp } from './bootstrap.js';

const { app, db, config, ensureReady } = await createServerApp();

if (!config.databaseUrl) console.warn(`DATABASE_URL is not set: using a local database in ${config.localDataDir}.`);
if (!config.paystackSecretKey) console.warn('PAYSTACK_SECRET_KEY is not set: bookings will be held but not payable.');
if (!config.adminPassword) console.warn('ADMIN_PASSWORD is not set: the admin dashboard is disabled.');

await ensureReady();

const server = app.listen(config.port, () => {
  console.log(`Dovey Events is running at http://localhost:${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
