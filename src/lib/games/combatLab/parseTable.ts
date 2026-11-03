/**
 * Pure: turns a game table's JSON into display rows without knowing its schema (the combat lanes own it).
 * Accepts an array of records, a map of id -> record, or an object holding one of those under a key (preferring the
 * table's own name). Nested records flatten one level (`a.b`); scalar lists join; other lists read `[n items]`.
 */
import type { CombatTable } from './combatTypes';
import { isGroupedMelee, meleeRecords } from './meleeRecords';

export const MAX_COLUMNS = 14;
export const MAX_ROWS = 200;
type Cell = string | number | boolean;
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function flatten(rec: Record<string, unknown>): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  const put = (k: string, v: unknown, depth: number) => {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v)) out[k] = v.every((x) => typeof x !== 'object' || x === null) ? v.join(', ') : `[${v.length} items]`;
    else if (isRec(v) && depth < 1) for (const [k2, v2] of Object.entries(v)) put(`${k}.${k2}`, v2, depth + 1);
    else if (isRec(v)) out[k] = '{…}';
  };
  for (const [k, v] of Object.entries(rec)) put(k, v, 0);
  return out;
}

/** The records of a table document: `{ label?, rec }[]`, or a string saying why there are none. */
export function recordsOf(doc: unknown, name: string): Array<{ label?: string; rec: Record<string, unknown> }> | string {
  if (Array.isArray(doc)) {
    const recs = doc.filter(isRec);
    return recs.length ? recs.map((rec) => ({ rec })) : 'the array holds no records';
  }
  if (!isRec(doc)) return 'not a JSON object or array';
  const entries = Object.entries(doc);
  const arrays = entries.filter(([, v]) => Array.isArray(v) && v.some(isRec));
  const pick = arrays.find(([k]) => k === name) ?? arrays[0];
  if (pick) return (pick[1] as unknown[]).filter(isRec).map((rec) => ({ rec }));
  const maps = entries.filter(([, v]) => isRec(v) && Object.values(v).length > 0 && Object.values(v).every(isRec));
  const m = maps.find(([k]) => k === name) ?? maps[0];
  if (m) return Object.entries(m[1] as Record<string, Record<string, unknown>>).map(([label, rec]) => ({ label, rec }));
  if (entries.length > 0 && entries.every(([, v]) => isRec(v))) return entries.map(([label, rec]) => ({ label, rec: rec as Record<string, unknown> }));
  return 'no rows found (expected an array of records, or a map of id to record)';
}

/** Columns a designer reads first, per table (absent ones are skipped); `doc` prose always goes last. */
const LEAD: Record<CombatTable['key'], readonly string[]> = {
  weapons: ['id', 'tier', 'kind', 'fire_mode', 'enabled', 'damage', 'pellets', 'rof_hz', 'magazine', 'reload_s', 'range_m', 'spread_deg'],
  melee: ['id', 'group', 'name', 'damage', 'reach_m', 'windup_s', 'cycle_s', 'knockback_m'],
  enemies: ['id', 'body', 'hp', 'weapon', 'speed_mps', 'attack_m', 'preferred_m', 'reaction_s', 'aggression'],
  powers: ['id', 'action', 'duration_s', 'cooldown_s', 'madness_cost'],
};

export function parseTable(key: CombatTable['key'], file: string, doc: unknown): Pick<CombatTable, 'state' | 'reason' | 'columns' | 'hiddenColumns' | 'rows'> {
  const recs = key === 'melee' && isGroupedMelee(doc) ? meleeRecords(doc) : recordsOf(doc, key);
  if (typeof recs === 'string') return { state: 'invalid', reason: recs, columns: [], hiddenColumns: 0, rows: [] };
  const rows = recs.slice(0, MAX_ROWS).map(({ label, rec }) => ({ ...(label ? { label } : {}), values: flatten(rec) }));
  const seen: string[] = [];
  for (const r of rows) for (const k of Object.keys(r.values)) if (!seen.includes(k)) seen.push(k);
  const lead = [...LEAD[key], 'id', 'name', 'label'].filter((k, i, a) => seen.includes(k) && a.indexOf(k) === i);
  const tail = seen.filter((k) => !lead.includes(k));
  const all = [...lead, ...tail.filter((k) => k !== 'doc'), ...tail.filter((k) => k === 'doc')];
  return { state: 'ok', columns: all.slice(0, MAX_COLUMNS), hiddenColumns: Math.max(0, all.length - MAX_COLUMNS), rows };
}
