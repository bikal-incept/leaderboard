import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

/**
 * Helper to ensure the password in a connection string is properly URL-encoded.
 * If the password contains special characters like < > ( ) and isn't already
 * encoded, this will encode it.
 */
function ensureEncodedPassword(url: string): string {
  try {
    const match = url.match(/^(postgresql:\/\/[^:]+:)([^@]+)(@.+)$/);
    if (!match) {
      return url; // Can't parse, return as-is
    }
    const [, prefix, password, suffix] = match;
    
    // Check if password is already encoded (contains %XX sequences)
    const isAlreadyEncoded = /%[0-9A-Fa-f]{2}/.test(password);
    if (isAlreadyEncoded) {
      return url; // Already encoded
    }
    
    // Check if password needs encoding (contains special chars)
    const needsEncoding = /[<>(){}[\]\\^`|~\s"']/.test(password);
    if (!needsEncoding) {
      return url; // No special chars, safe to use
    }
    
    // Encode the password
    const encodedPassword = encodeURIComponent(password);
    return `${prefix}${encodedPassword}${suffix}`;
  } catch (err) {
    console.warn('Failed to parse DATABASE_URL for encoding, using as-is:', err);
    return url;
  }
}

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  // In a real service you might want to fail fast rather than silently misconfigure.
  throw new Error('DATABASE_URL environment variable is not set');
}

const connectionString = ensureEncodedPassword(rawConnectionString);

/**
 * Shared Postgres connection pool.
 *
 * This module is intended to be used from a Node.js environment (backend jobs,
 * API routes, scripts). It should NOT be imported from browser code.
 */
export const pool = new Pool({
  connectionString,
  // Most hosted Postgres providers require SSL; tweak as needed for your env.
  ssl: {
    rejectUnauthorized: false,
  },
});

export type DbClient = pg.PoolClient;
export type DbResult<T = any> = pg.QueryResult<T>;

/**
 * Convenience helper for simple one‑off queries.
 *
 * Example:
 *   const { rows } = await query('SELECT 1 as value');
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<DbResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Run a series of queries inside a single transaction.
 *
 * Example:
 *   await withTransaction(async (client) => {
 *     await client.query('INSERT ...');
 *     await client.query('UPDATE ...');
 *   });
 */
export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


