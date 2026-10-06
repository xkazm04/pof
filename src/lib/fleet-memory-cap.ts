/**
 * Planning logic for the `.claude/fleet-memory.md` artifact cap. Pure: text and a cap in, the
 * kept text and the archived lines out. The I/O (confirm-then-rename of the live file, append to
 * the archive) lives in `scripts/fleet-memory-cap.mjs`; this file has no imports so Node can load
 * it directly through `node --no-warnings`.
 *
 * The cap counts ENTRY lines (`- [date] [area] KIND: ...`), not file lines: the header is
 * documentation, not memory. Only DELIVERED entries are ever archived, oldest (= first) first;
 * DECISION and CONVENTION entries outlive them and are never removed by this function.
 */

/** One memory entry line. Mirrors the format documented in the header of fleet-memory.md. */
export const FLEET_MEMORY_ENTRY = /^- \[\d{4}-\d{2}-\d{2}\] \[[^\]]+\] (DECISION|DELIVERED|CONVENTION):/;

export type FleetMemoryPlan =
  | {
      ok: true;
      /** The live file's new text. Equals the input when nothing needed archiving. */
      kept: string;
      /** The removed DELIVERED lines, verbatim, in their original (oldest-first) order. */
      archived: string[];
      /** Entry count of the input / of `kept`. */
      entriesBefore: number;
      entriesAfter: number;
    }
  | {
      ok: false;
      /** Every DELIVERED entry would have to go and the file would still be over the cap. */
      reason: 'delivered-exhausted';
      entries: number;
      cap: number;
      /** DECISION + CONVENTION entries: what a human must retire, since this never does. */
      protectedEntries: number;
      deliveredEntries: number;
      message: string;
    };

const isEntry = (line: string) => FLEET_MEMORY_ENTRY.test(line);
const isDelivered = (line: string) => isEntry(line) && line.includes('] DELIVERED:');

export const countFleetMemoryEntries = (text: string): number => text.split('\n').filter(isEntry).length;

/** Decide what a prune would do. Never mutates; the caller performs the write. */
export function planFleetMemoryPrune(text: string, cap: number): FleetMemoryPlan {
  const lines = text.split('\n');
  const entries = lines.filter(isEntry).length;
  const delivered = lines.filter(isDelivered).length;
  const protectedEntries = entries - delivered;

  if (entries <= cap) {
    return { ok: true, kept: text, archived: [], entriesBefore: entries, entriesAfter: entries };
  }
  if (protectedEntries > cap) {
    return {
      ok: false,
      reason: 'delivered-exhausted',
      entries,
      cap,
      protectedEntries,
      deliveredEntries: delivered,
      message:
        `${entries} entries against a cap of ${cap}, and archiving all ${delivered} DELIVERED line(s) would still leave ` +
        `${protectedEntries} DECISION/CONVENTION line(s) (+${protectedEntries - cap} over). ` +
        `A human must retire superseded DECISION/CONVENTION lines; this script never removes them.`,
    };
  }

  let over = entries - cap;
  const kept: string[] = [];
  const archived: string[] = [];
  for (const line of lines) {
    if (over > 0 && isDelivered(line)) {
      archived.push(line);
      over--;
    } else {
      kept.push(line);
    }
  }
  return { ok: true, kept: kept.join('\n'), archived, entriesBefore: entries, entriesAfter: entries - archived.length };
}
