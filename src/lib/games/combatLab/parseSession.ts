/**
 * Pure: reads one arena telemetry JSON without knowing its exact schema (the arena lane owns it). Metrics are found
 * by key name at any depth; a metric the file does not carry is absent, never 0. Time to kill is accepted as
 * `{ weapon: { range: seconds } }`, `{ weapon: seconds }` or a list of `{ weapon, range, seconds }` records.
 */
import type { SessionMetric, TtkPoint } from './combatTypes';

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

const METRIC_KEYS: Array<[SessionMetric['key'], RegExp]> = [
  ['hitRate', /hit_?rate|accuracy/i], ['damageTaken', /damage_?taken/i], ['latency', /latency/i],
  ['dodges', /dodge/i], ['knockdowns', /knock_?down/i], ['turnRate', /turn_?rate/i],
];
const TTK_KEY = /^(ttk|time_?to_?kill)/i;

/** Depth-first search for the first value under a key matching `re` that satisfies `pick`. */
function find<T>(v: unknown, re: RegExp, pick: (x: unknown) => T | undefined, depth = 0): T | undefined {
  if (depth > 5) return undefined;
  if (Array.isArray(v)) { for (const x of v.slice(0, 50)) { const r = find(x, re, pick, depth + 1); if (r !== undefined) return r; } return undefined; }
  if (!isRec(v)) return undefined;
  for (const [k, x] of Object.entries(v)) if (re.test(k)) { const r = pick(x); if (r !== undefined) return r; }
  for (const x of Object.values(v)) { const r = find(x, re, pick, depth + 1); if (r !== undefined) return r; }
  return undefined;
}

export function metricsOf(doc: unknown): SessionMetric[] {
  const out: SessionMetric[] = [];
  for (const [key, re] of METRIC_KEYS) {
    const value = find(doc, re, num);
    if (value !== undefined) out.push({ key, value });
  }
  return out;
}

const rangeOf = (k: string): number | undefined => { const m = /-?\d+(\.\d+)?/.exec(k); return m ? Number(m[0]) : undefined; };

function ttkFrom(v: unknown): TtkPoint[] {
  const out: TtkPoint[] = [];
  if (Array.isArray(v)) {
    for (const r of v) {
      if (!isRec(r)) continue;
      const weapon = [r.weapon, r.weapon_id, r.id].find((x) => typeof x === 'string') as string | undefined;
      const rangeM = [r.range_m, r.range, r.distance_m, r.distance].map(num).find((x) => x !== undefined);
      const seconds = [r.ttk_s, r.ttk, r.seconds, r.time_to_kill_s, r.value].map(num).find((x) => x !== undefined);
      if (weapon && rangeM !== undefined && seconds !== undefined) out.push({ weapon, rangeM, seconds });
    }
  } else if (isRec(v)) {
    for (const [weapon, byRange] of Object.entries(v)) {
      if (!isRec(byRange)) continue;
      for (const [k, s] of Object.entries(byRange)) {
        const rangeM = rangeOf(k);
        const seconds = num(s) ?? (isRec(s) ? [s.mean, s.avg, s.seconds, s.ttk_s].map(num).find((x) => x !== undefined) : undefined);
        if (rangeM !== undefined && seconds !== undefined) out.push({ weapon, rangeM, seconds });
      }
    }
  }
  return out;
}

export function ttkOf(doc: unknown): TtkPoint[] {
  return find(doc, TTK_KEY, (x) => { const p = ttkFrom(x); return p.length ? p : undefined; }) ?? [];
}

export function scalarsOf(doc: unknown, max = 12): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!isRec(doc)) return out;
  for (const [k, v] of Object.entries(doc)) {
    if (Object.keys(out).length >= max) break;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}
