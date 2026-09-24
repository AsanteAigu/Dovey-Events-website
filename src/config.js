function int(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} must be an integer`);
  return n;
}

export function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const config = {
    port: int(env, 'PORT', 3000),
    publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
    databasePath: env.DATABASE_PATH || 'data/dovey.db',
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
    for (const key of ['paystackSecretKey', 'adminPassword', 'sessionSecret']) {
      if (!config[key]) throw new Error(`Missing required setting in production: ${key}`);
    }
    if (config.sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return config;
}
