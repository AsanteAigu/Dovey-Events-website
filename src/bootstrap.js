import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, migrate } from './db.js';
import { createPaystackClient } from './paystack.js';

/** Wires config, database and Paystack into an app. Shared by the server and the Vercel function. */
export async function createServerApp(env = process.env) {
  const config = loadConfig(env);
  const db = await createDatabase(config);

  // Create the schema on first use. If it fails (say the database is briefly
  // unreachable), the next request tries again instead of the instance staying broken.
  let schema;
  const ensureReady = () => (schema ??= migrate(db).catch((err) => {
    schema = undefined;
    throw err;
  }));

  const paystack = createPaystackClient(config.paystackSecretKey);
  const app = createApp({ db, config, paystack, ensureReady });
  return { app, db, config, ensureReady };
}
