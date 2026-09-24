function int(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} must be an integer`);
  return n;
}

const isLocalUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url);

/**
 * Where Paystack sends customers back after paying. On Vercel it defaults to the
 * production domain. A localhost PUBLIC_URL (easily copied over from a local .env)
 * would strand paying customers on their own machine, so production ignores it.
 */
function resolvePublicUrl(env, isProd) {
  const vercelUrl = env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '';
  let url = env.PUBLIC_URL || vercelUrl || 'http://localhost:3000';
  if (isProd && isLocalUrl(url)) {
    if (!vercelUrl) throw new Error('PUBLIC_URL must be the public site address in production, not localhost');
    console.warn(`Ignoring PUBLIC_URL=${url} in production; using ${vercelUrl}`);
    url = vercelUrl;
  }
  return url.replace(/\/$/, '');
}

export function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const config = {
    port: int(env, 'PORT', 3000),
    publicUrl: resolvePublicUrl(env, isProd),
    // Supabase (or any Postgres) connection string. Without it, local development
    // uses an embedded Postgres stored in localDataDir.
    databaseUrl: env.DATABASE_URL || '',
    localDataDir: env.LOCAL_DATA_DIR || 'data/pglite',
    paystackSecretKey: env.PAYSTACK_SECRET_KEY || '',
    adminPassword: env.ADMIN_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    depositPercent: int(env, 'DEPOSIT_PERCENT', 30),
    maxEventsPerDay: int(env, 'MAX_EVENTS_PER_DAY', 2),
    minLeadDays: int(env, 'MIN_LEAD_DAYS', 7),
    holdMinutes: int(env, 'HOLD_MINUTES', 30),
    isProd,
  };

  if (config.depositPercent < 1 || config.depositPercent > 100) {
    throw new Error('DEPOSIT_PERCENT must be between 1 and 100');
  }
  if (isProd) {
    for (const key of ['databaseUrl', 'paystackSecretKey', 'adminPassword', 'sessionSecret']) {
      if (!config[key]) throw new Error(`Missing required setting in production: ${key}`);
    }
    if (config.sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return config;
}
