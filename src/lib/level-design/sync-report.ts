/**
 * The sync callback contract — the ONE validator standing between an LLM's
 * free-text output and a level design document's stored sync verdict.
 *
 * The sync check used to tell Claude to drop a JSON file into `.pof/` that
 * nothing read, so `syncReport` was permanently empty and two of the five sync
 * states were unreachable. Now the task carries a real `@@CALLBACK`, and this
 * module decides what is allowed through it.
 *
 * The rule is: nothing lands unless it can be attributed and is internally
 * consistent. An empty body, a missing document id, a missing code fingerprint,
 * a bogus severity, or a `synced` verdict that ships divergences alongside it is
 * REJECTED with a reason naming exactly what was wrong — never silently stored,
 * and never rounded down to an empty report that would read as a clean bill of
 * health.
 */

import type { SyncDivergence, SyncStatus } from '@/types/level-design';
import { ok, err, type Result } from '@/types/result';

/**
 * The four verdicts a comparison can produce. `unlinked` is deliberately absent:
 * it means "no code was ever generated", which is a fact about the document, not
 * something a code-vs-doc comparison can conclude.
 */
export const COMPARISON_STATUSES: readonly SyncStatus[] = ['synced', 'doc-ahead', 'code-ahead', 'diverged'] as const;

const SEVERITIES: readonly SyncDivergence['severity'][] = ['info', 'warning', 'critical'] as const;

/** Longest accepted code fingerprint — a full git SHA and then some. */
const MAX_CODE_HASH = 128;

export interface SyncCallbackPayload {
  /** The level design document this report belongs to (from the task's staticFields). */
  docId: number;
  status: SyncStatus;
  /** Fingerprint of the code that was compared — the proof a comparison happened. */
  codeHash: string;
  divergences: SyncDivergence[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A required, non-empty string field, or the reason it was unacceptable. */
function requireString(raw: unknown, label: string): Result<string, string> {
  if (typeof raw !== 'string') return err(`${label} must be a string`);
  const trimmed = raw.trim();
  if (!trimmed) return err(`${label} must not be empty`);
  return ok(trimmed);
}

/** Coerce a reported value to the display string the panel renders. */
function valueText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return JSON.stringify(raw);
}

function parseDivergence(raw: unknown, index: number): Result<SyncDivergence, string> {
  const at = `divergences[${index}]`;
  if (!isRecord(raw)) return err(`${at} must be an object`);

  const roomId = requireString(raw.roomId, `${at}.roomId`);
  if (!roomId.ok) return err(roomId.error);
  const field = requireString(raw.field, `${at}.field`);
  if (!field.ok) return err(field.error);

  const severity = typeof raw.severity === 'string' ? raw.severity : '';
  if (!(SEVERITIES as readonly string[]).includes(severity)) {
    return err(`${at}.severity must be one of ${SEVERITIES.join(', ')} (got ${JSON.stringify(raw.severity)})`);
  }

  // A divergence with identical values on both sides is not a divergence — it
  // would render as a "Fix" button for a field that already matches.
  const docValue = valueText(raw.docValue);
  const codeValue = valueText(raw.codeValue);
  if (docValue === codeValue) {
    return err(`${at} reports the same value on both sides (${JSON.stringify(docValue)}) — that is not a divergence`);
  }

  return ok({
    roomId: roomId.data,
    roomName: typeof raw.roomName === 'string' && raw.roomName.trim() ? raw.roomName.trim() : roomId.data,
    field: field.data,
    docValue,
    codeValue,
    severity: severity as SyncDivergence['severity'],
    suggestion: typeof raw.suggestion === 'string' ? raw.suggestion : '',
  });
}

/**
 * Validate a raw sync-callback body into a storable report.
 *
 * Returns the reason on the first problem found; the caller turns that into a
 * 400 so the CLI run sees WHY its submission was refused.
 */
export function parseSyncCallback(body: unknown): Result<SyncCallbackPayload, string> {
  if (!isRecord(body)) return err('Body must be a JSON object');
  if (Object.keys(body).length === 0) return err('Body is empty — a sync report must carry docId, status, codeHash and divergences');

  const rawDocId = typeof body.docId === 'string' ? Number(body.docId) : body.docId;
  if (typeof rawDocId !== 'number' || !Number.isInteger(rawDocId) || rawDocId <= 0) {
    return err('docId must be a positive integer — a sync report that cannot be attributed to a document is not stored');
  }

  const status = typeof body.status === 'string' ? body.status.trim() : '';
  if (!(COMPARISON_STATUSES as readonly string[]).includes(status)) {
    return err(
      `status must be one of ${COMPARISON_STATUSES.join(', ')} (got ${JSON.stringify(body.status)}) — "unlinked" is a document fact, not a comparison verdict`,
    );
  }

  const codeHash = requireString(body.codeHash, 'codeHash');
  if (!codeHash.ok) {
    return err(`${codeHash.error} — without a code fingerprint there is no evidence a comparison ran`);
  }
  if (codeHash.data.length > MAX_CODE_HASH) {
    return err(`codeHash must be at most ${MAX_CODE_HASH} characters`);
  }

  if (!Array.isArray(body.divergences)) {
    return err('divergences must be an array (use [] when nothing diverged)');
  }

  const divergences: SyncDivergence[] = [];
  for (let i = 0; i < body.divergences.length; i++) {
    const parsed = parseDivergence(body.divergences[i], i);
    if (!parsed.ok) return err(parsed.error);
    divergences.push(parsed.data);
  }

  if (status === 'synced' && divergences.length > 0) {
    return err(
      `status "synced" contradicts the ${divergences.length} divergence(s) reported alongside it — report "diverged" or "code-ahead" instead`,
    );
  }
  if (status === 'diverged' && divergences.length === 0) {
    return err('status "diverged" was reported with no divergences — name at least one field that differs, or report "synced"');
  }

  return ok({ docId: rawDocId, status: status as SyncStatus, codeHash: codeHash.data, divergences });
}
