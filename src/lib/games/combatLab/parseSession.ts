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
  ['dodges', /dodge/i], ['knockdowns', /knock_?down/i], ['turnRate', /turn_?rate/i], ['topSpeed', /top_?speed/i], ['courseTime', /course_?time/i],
  ['pitTime', /pit_?done/i], ['pitKills', /^pit_?kills$/i], ['pitWaves', /^pit_?waves_?cleared$/i], ['coverStops', /stopped_?by_?cover/i],
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
    if (value === undefined) continue;
    // The arena writes -1 for a latency it never measured and 0 for the hit rate of a session with no shots: not data.
    if (key === 'latency' && value < 0) continue;
    if (key === 'hitRate' && find(doc, /^shots$/i, num) === 0) continue;
    // Every session carries pit_kills 0 / pit_waves 0 when it ran no pit: only a session that spawned a wave has pit metrics.
    if ((key === 'pitKills' || key === 'pitWaves') && !(find(doc, /^pit_?waves$/i, num) ?? 0)) continue;
    out.push({ key, value });
  }
  return out;
}

/** Arena spawn ids encode motion and range: `static_05m`, `strafe_10m`, `approach_35m`. */
const SPAWN_ID = /^([a-z][a-z_]*?)_(\d+(?:\.\d+)?)m$/i;
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
      if (Array.isArray(byRange)) { // the arena's own shape: ttk_s { "<motion>_<range>m": [seconds, ...] }, one entry per kill
        const spawn = SPAWN_ID.exec(weapon);
        const kills = byRange.map(num).filter((x): x is number => x !== undefined);
        if (spawn && kills.length) out.push({ weapon: spawn[1], rangeM: Number(spawn[2]), seconds: kills.reduce((a, b) => a + b, 0) / kills.length, kills: kills.length });
        continue;
      }
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
  const points = find(doc, TTK_KEY, (x) => { const p = ttkFrom(x); return p.length ? p : undefined; }) ?? [];
  // A session that names the weapon it fired labels every spawn-id series with it ("pistol · strafe").
  const named = isRec(doc) ? [doc.weapon, doc.weapon_id].find((x): x is string => typeof x === 'string') : undefined;
  return named ? points.map((p) => (p.kills === undefined ? p : { ...p, weapon: `${named} · ${p.weapon}` })) : points;
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
