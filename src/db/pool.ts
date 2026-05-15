import { Pool, PoolConfig } from 'pg';
import logger from '../utils/logger';

/**
 * Singleton PostgreSQL connection pool.
 *
 * Why a pool (not per-request connections)?
 * - Opening a TLS + TCP connection to Postgres takes ~20–50ms; a pool keeps
 *   hot connections ready, eliminating that overhead on every request.
 * - Postgres limits total connections (default 100); pooling ensures we stay
 *   well within that limit even under high concurrency.
 *
 * Pool sizing follows the rule of thumb: max = (CPU cores × 2) + disk spindles.
 * We default to 10 which suits a 4-core API server with SSD storage.
 */

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'media_pipeline',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'password',
  min: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
  max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
  // Close idle connections after 30 s to avoid holding sockets unnecessarily
  idleTimeoutMillis: 30_000,
  // Fail fast if a new connection cannot be established in 5 s
  connectionTimeoutMillis: 5_000,
  // Let Postgres reject stale connections; we will reconnect automatically
  allowExitOnIdle: false,
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

pool.on('connect', () => {
  logger.debug('PostgreSQL: new client connected to pool');
});

/**
 * Execute a parameterised query.
 * Automatically checks out a client from the pool and releases it when done.
 */
export async function query<T extends object>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const durationMs = Date.now() - start;
  logger.debug({ query: text.slice(0, 80), durationMs, rows: result.rowCount }, 'DB query executed');
  return result;
}

/**
 * Get a client for multi-statement transactions.
 * Caller MUST release() the client when done, even on error.
 */
export async function getClient() {
  return pool.connect();
}

/** Graceful shutdown: drain the pool before process exit. */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

export default pool;
