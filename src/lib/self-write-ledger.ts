/**
 * The write door tells the watch boundary what this process is about to put on
 * disk, so the watcher can drop its own echo.
 *
 * `file-watcher.ts` watches `<project>/Source` recursively and
 * `blueprint-transpiler-write.ts` writes `.h`/`.cpp` into that same tree, under
 * names indistinguishable from hand-authored ones — there is no path, extension
 * or directory that separates our output from the user's input. So the origin
 * cannot be recovered at the read boundary; it has to be *recorded* at the
 * write door, before the write, and matched by content when the event arrives.
 *
 * Three properties keep this from becoming a mute button on a path:
 *
 * - A claim is matched on CONTENT, not on the path alone. If the bytes on disk
 *   are not the bytes we said we were writing, somebody else wrote them and the
 *   event is real.
 * - A claim is consumed on the first match. The next change to that path is a
 *   foreign edit as far as this module is concerned.
 * - A claim expires. An unmatched claim (the write failed, the watcher was not
 *   running, the platform coalesced the notification away) must not silence a
 *   path forever, so every claim carries a deadline and a reaper runs on each
 *   touch of the ledger.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';

/** How long an unmatched claim stays able to suppress an event. */
export const CLAIM_TTL_MS = 30_000;
/** Hard cap on outstanding claims, so a leak is bounded rather than unbounded. */
export const MAX_CLAIMS = 512;

interface Claim {
  /** sha256 of the exact bytes we said we were writing. */
  digest: string;
  expiresAt: number;
}

const claims = new Map<string, Claim>();

function key(absPath: string): string {
  return path.resolve(absPath).replace(/\\/g, '/').toLowerCase();
}

function digestOf(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function reap(now: number): void {
  for (const [k, c] of claims) {
    if (c.expiresAt <= now) claims.delete(k);
  }
}

/**
 * Record, BEFORE the write happens, that this process is about to put exactly
 * `content` at `absPath`. Called by every door of ours that writes into a
 * watched tree; a door that writes without claiming is reported as a foreign
 * edit, which is the safe direction to fail.
 */
export function claimSelfWrite(absPath: string, content: string): void {
  const now = Date.now();
  reap(now);
  if (claims.size >= MAX_CLAIMS) {
    // Drop the oldest rather than refuse: a full ledger must not stop a write.
    const oldest = [...claims.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) claims.delete(oldest[0]);
  }
  claims.set(key(absPath), { digest: digestOf(content), expiresAt: now + CLAIM_TTL_MS });
}

/**
 * True when this change event is our own write coming back: a live claim for
 * this path whose digest matches what is on disk now. Consumes the claim.
 *
 * `currentContent` is null when the file could not be read (deleted, or gone by
 * the time the event was flushed) — that is not a match, because we cannot show
 * the bytes are ours.
 */
export function consumeSelfWrite(absPath: string, currentContent: string | null): boolean {
  const now = Date.now();
  reap(now);
  const k = key(absPath);
  const claim = claims.get(k);
  if (!claim) return false;
  if (currentContent === null) return false;
  if (claim.digest !== digestOf(currentContent)) return false;
  claims.delete(k);
  return true;
}

/** Outstanding claims. For tests and for a diagnostic surface. */
export function pendingClaimCount(): number {
  reap(Date.now());
  return claims.size;
}

/** Drop every claim — used when the watcher switches projects or stops. */
export function clearSelfWrites(): void {
  claims.clear();
}
