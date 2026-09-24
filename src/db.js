import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../db/schema.sql'), 'utf8');

const DATE_OID = 1082;

/**
 * A small database interface shared by production (Supabase via node-postgres)
 * and local development/tests (PGlite, an in-process Postgres):
 *
 *   query(text, params)  -> rows
 *   transaction(fn)      -> fn receives { query } bound to one transaction
 *   exec(sql)            -> runs multi-statement SQL (migrations)
 *   close()
 */
export async function createDatabase({ databaseUrl, localDataDir }) {
  return databaseUrl ? createPostgres(databaseUrl) : createPglite(localDataDir);
}

function createPostgres(databaseUrl) {
  const url = new URL(databaseUrl);
  const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
  url.searchParams.delete('sslmode'); // TLS is configured below instead

  const pool = new pg.Pool({
    connectionString: url.toString(),
    // Supabase requires TLS. Its pooler certificate isn't in Node's default CA
    // store, so set DATABASE_CA_CERT (from Supabase → Database settings) to verify it.
    ssl: isLocal ? false : process.env.DATABASE_CA_CERT
      ? { ca: process.env.DATABASE_CA_CERT }
      : { rejectUnauthorized: false },
    max: 3, // serverless: keep each instance's footprint small; Supabase's pooler does the rest
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // Keep DATE columns as 'YYYY-MM-DD' strings instead of local-midnight Date objects.
  const types = { getTypeParser: (oid, format) => (oid === DATE_OID ? (v) => v : pg.types.getTypeParser(oid, format)) };
  const run = (client) => async (text, params) => (await client.query({ text, values: params, types })).rows;

  return {
    query: run(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: run(client) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
  };
}

async function createPglite(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite(dataDir, { parsers: { [DATE_OID]: (v) => v } });
  const run = (target) => async (text, params) => (await target.query(text, params)).rows;

  return {
    query: run(db),
    transaction: (fn) => db.transaction((tx) => fn({ query: run(tx) })),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}

export async function migrate(db) {
  await db.exec(SCHEMA);
}
