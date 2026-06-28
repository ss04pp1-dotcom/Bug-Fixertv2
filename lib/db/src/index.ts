import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  // Be explicit: production connections MUST verify SSL certificates.
  // (rejectUnauthorized defaults to true, but explicit intent prevents accidental flips.)
  ssl: process.env['NODE_ENV'] === 'production'
    ? { rejectUnauthorized: true }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// pg emits 'error' on idle connections when the backend closes them.
// Without this listener, Node would crash the process on such errors.
pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err);
  // Don't crash the process — the pool will create a new connection on next query
});

export const db = drizzle(pool, { schema });
export * from './schema';
