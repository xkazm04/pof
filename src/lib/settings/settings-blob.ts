// Shared read/write discipline for the subsystems that keep their ENTIRE
// configuration as one JSON string in a single `settings` row.
//
// The defect this exists to close: each of those stores wrapped `JSON.parse` in
// `try { … } catch { return defaults }`, so an unparseable value was
// indistinguishable from "nothing is configured" — and the next
// read-modify-write then serialised the reconstructed defaults OVER the original
// bytes. Nothing logged, nothing reported, the configuration gone. Every
// default on that path was also fail-OPEN: the size gate stopped failing builds,
// the gate webhook URL was erased, the nightly cron stopped.
//
// The rule enforced here:
//   A READ THAT CANNOT BE TRUSTED MUST NOT AUTHORISE A WRITE.
//
// and its corollary: a disabled gate must never be indistinguishable from a
// corrupt one, so `corrupt()` defaults are fail-CLOSED and every corrupt read is
// logged and carries a flag the caller can report.

import { getDb, getSetting, setSetting } from '@/lib/db';
import { logger } from '@/lib/logger';

export type SettingsBlobStatus =
  /** No row for the key — the ordinary "not configured yet" state. */
  | 'absent'
  /** The row parsed and hydrated cleanly. This is the ONLY trustworthy read. */
  | 'ok'
  /** The row exists but could not be read as configuration. */
  | 'corrupt';

export interface SettingsBlobRead<T> {
  /**
   * The value to use. On `corrupt` this is the spec's fail-CLOSED default — it
   * is NOT the user's configuration and must never be written back over the key
   * without preserving the original bytes first.
   */
  value: T;
  status: SettingsBlobStatus;
  /** Convenience for `status === 'corrupt'`; the flag a caller reports. */
  corrupt: boolean;
  /** The unreadable bytes, verbatim. Populated on `corrupt` only. */
  raw: string | null;
  /** Byte length of `raw`. Populated on `corrupt` only. */
  rawBytes: number | null;
  /** Parse/hydrate error message. Populated on `corrupt` only. */
  error: string | null;
  /** One sentence a caller can surface verbatim. `null` when the read is trustworthy. */
  reason: string | null;
}

export interface SettingsBlobSpec<T> {
  /** The `settings.key` the whole configuration lives under. */
  key: string;
  /** Value when the row does not exist. The ordinary "unconfigured" default. */
  absent: () => T;
  /**
   * Value when the row EXISTS but cannot be read. MUST be fail-CLOSED: never a
   * value that reads as "the gate is switched off", because the caller cannot
   * then tell a deliberate off from a corrupt one.
   */
  corrupt: () => T;
  /**
   * Shape a successfully parsed JSON value into `T`. THROW to reject a value
   * that parsed but is not this store's shape (e.g. an object where a list of
   * profiles belongs) — a throw here is treated exactly like a parse failure.
   */
  hydrate: (parsed: unknown) => T;
}

/** Separator between a live key and the timestamp of a preserved corrupt value. */
export const QUARANTINE_SEP = '.corrupt.';

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** The key an unreadable value for `key` is preserved under at time `at`. */
export function quarantineKeyFor(key: string, at: Date = new Date()): string {
  return `${key}${QUARANTINE_SEP}${at.toISOString()}`;
}

export function isQuarantineKey(key: string): boolean {
  return key.includes(QUARANTINE_SEP);
}

export interface QuarantinedBlob {
  key: string;
  value: string;
}

/** Every preserved unreadable value for `key`, newest first. */
export function listQuarantined(key: string): QuarantinedBlob[] {
  // `build_profiles` contains `_`, a LIKE single-char wildcard — escape it, or a
  // listing for one key silently reports another key's quarantine.
  const escaped = `${key}${QUARANTINE_SEP}`.replace(/[\\%_]/g, (c) => `\\${c}`);
  return getDb()
    .prepare("SELECT key, value FROM settings WHERE key LIKE ? ESCAPE '\\' ORDER BY key DESC")
    .all(`${escaped}%`) as QuarantinedBlob[];
}

/**
 * Thrown instead of overwriting bytes that could not be read. Carries the key the
 * original was preserved under so the message tells the operator how to recover.
 */
export class SettingsBlobCorruptError extends Error {
  readonly key: string;
  readonly quarantineKey: string | null;
  readonly rawBytes: number;
  readonly parseError: string | null;

  constructor(key: string, read: SettingsBlobRead<unknown>, quarantineKey: string | null) {
    super(
      `refusing to overwrite settings key '${key}': its ${read.rawBytes ?? 0} stored bytes could not be read as configuration (${read.error ?? 'unknown parse error'}), ` +
        `so writing would serialise reconstructed defaults over your real configuration. ` +
        (quarantineKey
          ? `The original bytes were preserved at '${quarantineKey}' — repair them there and restore, or delete '${key}' to start from defaults.`
          : `The original bytes could not be preserved (the row disappeared between the read and the write).`),
    );
    this.name = 'SettingsBlobCorruptError';
    this.key = key;
    this.quarantineKey = quarantineKey;
    this.rawBytes = read.rawBytes ?? 0;
    this.parseError = read.error;
  }
}

/**
 * Read one whole-configuration blob. Never throws: a corrupt row yields the
 * spec's fail-closed default, an error in the log, and `corrupt: true`.
 */
export function readSettingsBlob<T>(spec: SettingsBlobSpec<T>): SettingsBlobRead<T> {
  const raw = getSetting(spec.key);
  if (raw == null) {
    return { value: spec.absent(), status: 'absent', corrupt: false, raw: null, rawBytes: null, error: null, reason: null };
  }
  try {
    return { value: spec.hydrate(JSON.parse(raw)), status: 'ok', corrupt: false, raw: null, rawBytes: null, error: null, reason: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const rawBytes = byteLength(raw);
    const reason =
      `settings key '${spec.key}' holds ${rawBytes} bytes that could not be read as configuration (${error}). ` +
      `The value in use is a fail-closed default, NOT your configuration — this is "unreadable", not "unconfigured".`;
    logger.error(`[settings-blob] ${reason}`);
    return { value: spec.corrupt(), status: 'corrupt', corrupt: true, raw, rawBytes, error, reason };
  }
}

/**
 * Copy unreadable bytes to a timestamped key before anything overwrites them.
 * Never clobbers an earlier quarantine that holds DIFFERENT bytes.
 */
function preserveCorrupt(key: string, raw: string): string {
  const base = quarantineKeyFor(key);
  let candidate = base;
  for (let n = 2; n < 100; n++) {
    const existing = getSetting(candidate);
    if (existing == null || existing === raw) break;
    candidate = `${base}-${n}`;
  }
  setSetting(candidate, raw);
  logger.warn(`[settings-blob] preserved ${byteLength(raw)} unreadable bytes from '${key}' at '${candidate}'`);
  return candidate;
}

export type CorruptWritePolicy =
  /**
   * Preserve the bytes, then THROW. For a read-modify-write of user
   * configuration, where continuing means serialising reconstructed defaults
   * over real data.
   */
  | 'refuse'
  /**
   * Preserve the bytes, then continue. Only for a write whose value does NOT
   * derive from the unreadable read — a full replacement, or runtime state
   * written by a background job that must not crash.
   */
  | 'preserve-and-continue';

export interface UpdateOptions {
  onCorrupt?: CorruptWritePolicy;
}

export interface SettingsBlobWrite<T> {
  value: T;
  /** Where unreadable original bytes were preserved, when the prior value was corrupt. */
  quarantineKey: string | null;
  /** What the stored value looked like before this write. */
  priorStatus: SettingsBlobStatus;
}

/**
 * Read-modify-write one whole-configuration blob.
 *
 * With the default `refuse` policy this is the enforcement point of the rule at
 * the top of this file: the mutation is never applied on top of a value that
 * could not be read.
 */
export function updateSettingsBlob<T>(
  spec: SettingsBlobSpec<T>,
  mutate: (current: T, read: SettingsBlobRead<T>) => T,
  opts: UpdateOptions = {},
): SettingsBlobWrite<T> {
  const read = readSettingsBlob(spec);
  let quarantineKey: string | null = null;

  if (read.corrupt) {
    quarantineKey = read.raw == null ? null : preserveCorrupt(spec.key, read.raw);
    if ((opts.onCorrupt ?? 'refuse') === 'refuse') {
      throw new SettingsBlobCorruptError(spec.key, read, quarantineKey);
    }
    logger.warn(
      `[settings-blob] '${spec.key}' was unreadable and is being replaced; the original is at '${quarantineKey ?? '(not preserved)'}'`,
    );
  }

  const next = mutate(read.value, read);
  setSetting(spec.key, JSON.stringify(next));
  return { value: next, quarantineKey, priorStatus: read.status };
}

/**
 * Replace a whole-configuration blob outright. The new value does not derive
 * from the stored one, so an unreadable original is preserved and the write
 * proceeds rather than blocking the operator from repairing the key.
 */
export function writeSettingsBlob<T>(spec: SettingsBlobSpec<T>, value: T, opts: UpdateOptions = {}): SettingsBlobWrite<T> {
  return updateSettingsBlob(spec, () => value, { onCorrupt: opts.onCorrupt ?? 'preserve-and-continue' });
}

// ── hydrate guards ───────────────────────────────────────────────────────────
// A value that PARSED but is not this store's shape is exactly as untrustworthy
// as one that did not parse. Spreading a string over defaults yields
// `{0:'a',1:'b',…}`; calling `.find` on an object throws deep in a caller.

export function expectRecord(parsed: unknown, what: string): Record<string, unknown> {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return failShape(what, parsed);
  }
  return parsed as Record<string, unknown>;
}

export function expectArray(parsed: unknown, what: string): unknown[] {
  if (!Array.isArray(parsed)) return failShape(what, parsed);
  return parsed;
}

function failShape(what: string, parsed: unknown): never {
  const actual = parsed === null ? 'null' : Array.isArray(parsed) ? 'an array' : typeof parsed;
  throw new TypeError(`${what}: stored value parsed as ${actual}, which is not this store's shape`);
}
