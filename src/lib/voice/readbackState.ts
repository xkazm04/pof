/**
 * Where a take's read-back stands, derived from what is stored (pure; no db). Failure is a first-class state
 * with its reason, never a `null` that looks like "still coming" (registry `async-ui-states`).
 *
 * Rules: a stored WER means `measured` (a number is the only proof). Without one, the stored status stands
 * (`pending` queued/running, `failed` + reason, `off` disabled by env). A row from before the status column
 * (no status, no WER) was never read back and nothing is running for it: it reads `failed` ("never read back"),
 * not a `pending` that could never resolve; the manual re-run (`POST voice/readback`, `voice.mjs readback`) retries it.
 */
import type { ReadbackStatus, TakeRow } from '@/lib/voice/types';

export const LEGACY_REASON = 'never read back (taken before read-back status was recorded)';
export const MAX_REASON = 160;

type Stored = Pick<TakeRow, 'readbackWer' | 'readbackStatus' | 'readbackReason'>;

export function readbackStateOf(t: Stored): { readbackStatus: ReadbackStatus; readbackReason: string | null } {
  if (t.readbackWer !== null && t.readbackWer !== undefined) return { readbackStatus: 'measured', readbackReason: null };
  const s = t.readbackStatus;
  if (s === 'pending' || s === 'off') return { readbackStatus: s, readbackReason: null };
  if (s === 'failed') return { readbackStatus: 'failed', readbackReason: t.readbackReason ?? 'read-back failed' };
  return { readbackStatus: 'failed', readbackReason: LEGACY_REASON };
}

/** The take was never screened by the read-back: it failed or is switched off. */
export const isUnscreened = (t: Stored): boolean => {
  const s = readbackStateOf(t).readbackStatus;
  return s === 'failed' || s === 'off';
};

/** A reason fit for a tag: one line, bounded. */
export const shortReason = (r: string): string => {
  const one = r.replace(/\s+/g, ' ').trim();
  return one.length > MAX_REASON ? `${one.slice(0, MAX_REASON - 3)}...` : one;
};
