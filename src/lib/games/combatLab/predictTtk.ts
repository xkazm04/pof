/**
 * Pure: the weapon table's own arithmetic for time to kill, the DESIGN side of the Combat lab's chart (the measured
 * side is arena telemetry). It models a perfect shooter: every shot lands, so a miss, spread and cover are not in
 * it, and neither are splash, damage-over-time or chain damage. It exists to be compared with the measured bars, not
 * to replace them. Shots to kill = ceil(hp / (damage x pellets)); time = the gaps between those shots at the rate of
 * fire + a reload per emptied magazine + the projectile's flight over the range.
 */
import type { CombatTable } from './combatTypes';

export interface KillTarget { id: string; hp: number }
export interface TtkPrediction { weapon: string; shots: number; seconds: number }
export interface TtkModel { rangeM: number; target: KillTarget; ready: TtkPrediction[]; outOfRange: string[]; disabled: string[]; unmodelled: string[] }

export const PREDICT_RANGES = [5, 10, 20, 35] as const;
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** The `targets` list of a weapons document (`{ id, hp }` records), or nothing. */
export function targetsOf(doc: unknown): KillTarget[] {
  const list = (doc as { targets?: unknown } | null)?.targets;
  if (!Array.isArray(list)) return [];
  return list.flatMap((t) => {
    const r = t as { id?: unknown; hp?: unknown };
    return typeof r?.id === 'string' && n(r.hp) !== undefined && (n(r.hp) as number) > 0 ? [{ id: r.id, hp: r.hp as number }] : [];
  });
}

export function predictTtk(table: CombatTable, target: KillTarget, rangeM: number): TtkModel {
  const model: TtkModel = { rangeM, target, ready: [], outOfRange: [], disabled: [], unmodelled: [] };
  for (const row of table.rows) {
    const v = row.values;
    const id = String(v.id ?? row.label ?? '?');
    const damage = n(v.damage), rof = n(v.rof_hz), range = n(v.range_m);
    if (v.enabled === false) { model.disabled.push(id); continue; }
    if (!damage || damage <= 0 || !rof || rof <= 0 || range === undefined) { model.unmodelled.push(id); continue; }
    if (rangeM > range) { model.outOfRange.push(id); continue; }
    const shots = Math.ceil(target.hp / (damage * Math.max(1, n(v.pellets) ?? 1)));
    const mag = n(v.magazine), reload = n(v.reload_s) ?? 0, speed = n(v.speed_mps);
    const reloads = mag && mag > 0 ? Math.floor((shots - 1) / mag) : 0;
    model.ready.push({ weapon: id, shots, seconds: (shots - 1) / rof + reloads * reload + (speed && speed > 0 ? rangeM / speed : 0) });
  }
  model.ready.sort((a, b) => a.seconds - b.seconds);
  return model;
}
