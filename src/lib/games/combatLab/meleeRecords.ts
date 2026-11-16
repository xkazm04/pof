/**
 * Pure: rivet-motion's `rivet_melee.json` (schema gtai.rivet-melee/1) is not a flat table: it is groups
 * (`claw: { hits: [...] }`, `shock: { ... }`) whose timing is in 60 Hz ticks. This turns it into one row per hit
 * (and one row per hit-less group), adding the derived seconds a designer reads: windup and the full cycle.
 */
const TICK_HZ = 60;
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const round = (n: number) => Math.round(n * 1000) / 1000;

function withSeconds(rec: Record<string, unknown>): Record<string, unknown> {
  const wind = num(rec.windup_ticks);
  const act = num(rec.active_ticks);
  const rec_ = num(rec.recovery_ticks);
  const out: Record<string, unknown> = { ...rec };
  if (wind !== undefined) out.windup_s = round(wind / TICK_HZ);
  if (wind !== undefined && act !== undefined && rec_ !== undefined) out.cycle_s = round((wind + act + rec_) / TICK_HZ);
  return out;
}

/** True when the document has the grouped shape (some top-level object holds a `hits` array of records). */
export function isGroupedMelee(doc: unknown): boolean {
  return isRec(doc) && Object.values(doc).some((g) => isRec(g) && Array.isArray(g.hits) && g.hits.some(isRec));
}

/** One `{ label, rec }` per hit and per hit-less group; scalar group fields (cancel/combo window) ride on each hit. */
export function meleeRecords(doc: unknown): Array<{ label?: string; rec: Record<string, unknown> }> {
  if (!isRec(doc)) return [];
  const out: Array<{ label?: string; rec: Record<string, unknown> }> = [];
  for (const [group, g] of Object.entries(doc)) {
    if (!isRec(g)) continue;
    const { hits, ...shared } = g;
    if (Array.isArray(hits) && hits.some(isRec)) {
      for (const hit of hits.filter(isRec)) {
        const groupScalars = Object.fromEntries(Object.entries(shared).filter(([k]) => k !== 'doc'));
        out.push({ rec: withSeconds({ group, ...hit, ...groupScalars }) });
      }
    } else {
      out.push({ rec: withSeconds({ id: group, group, ...shared }) });
    }
  }
  return out;
}
