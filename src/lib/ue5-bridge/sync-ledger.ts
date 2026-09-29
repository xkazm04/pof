/**
 * Write ledger for the UE5 live channel - pure functions, no I/O.
 *
 * The WS client (`ws-live-state.ts`) records every `set.property` it is asked
 * to send as a `SyncWrite` keyed `objectPath::propertyName`, and re-classifies
 * it as watch read-backs arrive on that exact key. Conflict detection is the
 * three-way compare against the last common state:
 *
 *   base    = the watched value on the key when we wrote
 *   written = what we sent
 *   inbound = the first read-back on the key after the write
 *
 * inbound == written is convergence (`confirmed`), never a conflict;
 * inbound == base means UE has not applied it yet (`pending`); anything else is
 * `diverged`, the only outcome `deriveConflicts` reports. The plugin sends no
 * ack for `set.property`, so the ledger claims no more than socket delivery
 * plus read-back. Ordering is the client's own arrival sequence - UE
 * timestamps are a second clock and are not compared.
 */

import type { SyncConflict, SyncWrite, SyncWriteOutcome } from '@/types/ue5-bridge';

/** Distinct keys the ledger keeps; the oldest write is evicted past this. */
export const MAX_LEDGER_ENTRIES = 100;

export type Ledger = ReadonlyMap<string, SyncWrite>;

/** The ledger key: one property on one object - never a name alone. */
export function writeKey(objectPath: string, propertyName: string): string {
  return `${objectPath}::${propertyName}`;
}

/** Structural equality for property values (numbers, strings, vectors, arrays). */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && valuesEqual(ra[k], rb[k]));
}

interface WritePoint {
  base: unknown;
  /** Defaults to true; false when nothing was watched on the key at write time. */
  baseKnown?: boolean;
  written: unknown;
  sent: boolean;
  seq: number;
}

/** Classify one write against a read-back on the same key (if any). */
export function classifyWrite(
  write: WritePoint,
  observed?: { value: unknown; seq: number } | null,
): SyncWriteOutcome {
  if (!write.sent) return 'dropped';
  if (!observed || observed.seq <= write.seq) return 'unobserved';
  if (valuesEqual(observed.value, write.written)) return 'confirmed';
  if (write.baseKnown !== false && valuesEqual(observed.value, write.base)) return 'pending';
  return 'diverged';
}

/** Outcomes a later read-back may still move; the rest are settled history. */
function isOpen(outcome: SyncWriteOutcome): boolean {
  return outcome === 'unobserved' || outcome === 'pending';
}

/** Record a write (replacing any earlier write on the key). Returns a new map. */
export function recordWrite(
  ledger: Ledger,
  input: Omit<SyncWrite, 'key' | 'outcome' | 'inbound'>,
): Map<string, SyncWrite> {
  const key = writeKey(input.objectPath, input.propertyName);
  const next = new Map(ledger);
  next.delete(key); // re-insert so Map order stays write order
  next.set(key, { ...input, key, outcome: classifyWrite(input) });
  while (next.size > MAX_LEDGER_ENTRIES) {
    const oldest = next.keys().next().value as string;
    next.delete(oldest);
  }
  return next;
}

/**
 * Apply one watch read-back. Only the write on the exact key moves, and only
 * while its outcome is still open. Returns the SAME map when nothing changed.
 */
export function observeUpdate(
  ledger: Ledger,
  update: { objectPath: string; propertyName: string; value: unknown },
  seq: number,
): Ledger {
  const key = writeKey(update.objectPath, update.propertyName);
  const write = ledger.get(key);
  if (!write || !isOpen(write.outcome)) return ledger;
  const outcome = classifyWrite(write, { value: update.value, seq });
  if (outcome === write.outcome && outcome === 'unobserved') return ledger;
  const next = new Map(ledger);
  next.set(key, { ...write, outcome, inbound: update.value });
  return next;
}

/** Diverged writes only, with all three points as typed values. */
export function deriveConflicts(ledger: Ledger): SyncConflict[] {
  const found: SyncConflict[] = [];
  for (const w of ledger.values()) {
    if (w.outcome !== 'diverged') continue;
    found.push({
      key: w.key,
      objectPath: w.objectPath,
      propertyName: w.propertyName,
      base: w.base,
      written: w.written,
      inbound: w.inbound,
    });
  }
  return found;
}

/** Same entries by reference - lets a subscriber skip a re-render on a cloned map. */
export function sameLedger(a: Ledger, b: Ledger): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

/** Append one entry to a bounded log, keeping the newest `max`. */
export function appendLog<T>(prev: readonly T[], entry: T, max: number): T[] {
  const next = [...prev, entry];
  return next.length > max ? next.slice(-max) : next;
}
