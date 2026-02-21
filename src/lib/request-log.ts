import { getDb } from './db';

/** TTL for idempotency keys — 1 hour. Entries older than this are ignored. */
const IDEMPOTENCY_TTL_SECONDS = 3600;

interface CachedResponse {
  statusCode: number;
  responseBody: string;
}

/**
 * Check if an idempotency key has been seen before (within TTL).
 * Returns the cached response if found, null otherwise.
 */
export function checkIdempotencyKey(key: string): CachedResponse | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT status_code, response_body FROM request_log
     WHERE idempotency_key = ?
       AND created_at > datetime('now', '-' || ? || ' seconds')`
  ).get(key, IDEMPOTENCY_TTL_SECONDS) as { status_code: number; response_body: string } | undefined;

  if (!row) return null;
  return { statusCode: row.status_code, responseBody: row.response_body };
}

/**
 * Save a response for an idempotency key so subsequent requests with the same key
 * return the cached result instead of re-executing.
 */
export function saveIdempotencyResult(
  key: string,
  route: string,
  statusCode: number,
  responseData: unknown,
): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO request_log (idempotency_key, route, status_code, response_body)
     VALUES (?, ?, ?, ?)`
  ).run(key, route, statusCode, JSON.stringify(responseData));
}

/**
 * Purge expired idempotency entries. Call periodically to keep the table small.
 */
export function purgeExpiredKeys(): number {
  const db = getDb();
  const result = db.prepare(
    `DELETE FROM request_log WHERE created_at < datetime('now', '-' || ? || ' seconds')`
  ).run(IDEMPOTENCY_TTL_SECONDS);
  return result.changes;
}
