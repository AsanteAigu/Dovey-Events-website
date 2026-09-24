import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { createPaystackClient } from './paystack.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const paystack = createPaystackClient(config.paystackSecretKey);
const app = createApp({ db, config, paystack });

if (!config.paystackSecretKey) console.warn('PAYSTACK_SECRET_KEY is not set: bookings will be held but not payable.');
if (!config.adminPassword) console.warn('ADMIN_PASSWORD is not set: the admin dashboard is disabled.');

const server = app.listen(config.port, () => {
  console.log(`Dovey Events is running at http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
