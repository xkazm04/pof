/**
 * Weapon matchup — a weapon against a named target: time-to-kill and its band.
 *
 * DPS is the one weapon-DPS law (`weaponDps` / `weaponRoster` with the target's
 * `armour`, canon soft-cap), so this file owns no damage formula. TTK = target HP
 * / DPS, graded by the one fight-length law (`fightLengthBand` /
 * `fightLengthSeverity` in `@/lib/balance/encounter-bands`): no cut is restated
 * here. Targets are a no-armour dummy plus every `ENEMY_ARCHETYPES` entry, HP and
 * armour read from `baseAttributes`.
 *
 * Elemental weapons resolve in the law's one Physical bucket, so target armour
 * reduces them too (no resist model yet) — the panel discloses this.
 *
 * Pure (no React).
 */
import { ENEMY_ARCHETYPES } from '@/lib/combat/definitions';
import { weaponRoster, weaponDps, type WeaponRow } from '@/lib/combat/weapon-throughput';
import {
  fightLengthBand, fightLengthSeverity, isFlaggedSeverity, TTK_TARGET_SEC,
  type BandSeverity, type FightLengthBand,
} from '@/lib/balance/encounter-bands';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';

export interface MatchupTarget {
  id: string;
  name: string;
  /** Max health; null for the dummy (no kill, so no TTK). */
  hp: number | null;
  armour: number;
}

export const DUMMY_TARGET: MatchupTarget = { id: 'dummy', name: 'Training Dummy', hp: null, armour: 0 };

/** The dummy (today's no-target view) followed by every enemy archetype. */
export const MATCHUP_TARGETS: readonly MatchupTarget[] = [
  DUMMY_TARGET,
  ...ENEMY_ARCHETYPES.map(a => ({
    id: a.id, name: a.name, hp: a.baseAttributes.maxHealth, armour: a.baseAttributes.armor,
  })),
];

export interface WeaponMatchup {
  dps: number;
  ttkSec: number | null;
  band: FightLengthBand | null;
  severity: BandSeverity | null;
}

function grade(dps: number, target: MatchupTarget): WeaponMatchup {
  if (target.hp === null || !(dps > 0)) return { dps, ttkSec: null, band: null, severity: null };
  const ttkSec = target.hp / dps;
  const band = fightLengthBand(ttkSec);
  return { dps, ttkSec, band, severity: fightLengthSeverity(band) };
}

/** One weapon against one target. */
export function weaponMatchup(w: WeaponRow, target: MatchupTarget): WeaponMatchup {
  return grade(weaponDps(w, { armour: target.armour }), target);
}

export interface MatchupRow<T extends WeaponRow> extends WeaponMatchup {
  weapon: T;
  id: string;
  name: string;
  /** 0-based rank against this target. */
  rank: number;
  /** Places moved against the no-armour ranking (+ = climbed). */
  rankDelta: number;
}

export interface TargetRanking<T extends WeaponRow> {
  target: MatchupTarget;
  /** Fastest kill first (= highest DPS first; the dummy keeps the roster order). */
  rows: MatchupRow<T>[];
  /** Weapons per fight-length band; absent bands are omitted. */
  bandCounts: Partial<Record<FightLengthBand, number>>;
}

/** Rank a weapon table against a target, with rank moves against the dummy. */
export function rankForTarget<T extends WeaponRow>(weapons: readonly T[], target: MatchupTarget): TargetRanking<T> {
  const baseline = new Map(weaponRoster(weapons).rows.map((r, i) => [r.id, i]));
  const roster = weaponRoster(weapons, { armour: target.armour });
  const bandCounts: Partial<Record<FightLengthBand, number>> = {};
  const rows = roster.rows.map((r, rank) => {
    const m = grade(r.dps, target);
    if (m.band) bandCounts[m.band] = (bandCounts[m.band] ?? 0) + 1;
    return { ...m, weapon: r.weapon, id: r.id, name: r.name, rank, rankDelta: (baseline.get(r.id) ?? rank) - rank };
  });
  return { target, rows, bandCounts };
}

const SEVERITY_ORDER: Record<BandSeverity, number> = { critical: 0, warning: 1, good: 2 };

/** Distance from the tuning target on a log scale (a 2x-long and a 2x-short fight are equally off). */
function offTarget(ttkSec: number): number {
  return Math.abs(Math.log(ttkSec / TTK_TARGET_SEC));
}

/** Up to `n` weapon ids whose band is flagged, worst first (severity, then distance from target TTK). */
export function outOfBand(rows: readonly (WeaponMatchup & { id: string })[], n: number): string[] {
  return rows
    .filter(r => r.severity !== null && isFlaggedSeverity(r.severity) && r.ttkSec !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity!] - SEVERITY_ORDER[b.severity!] || offTarget(b.ttkSec!) - offTarget(a.ttkSec!))
    .slice(0, Math.max(n, 0))
    .map(r => r.id);
}

/**
 * Colour of a band severity. encounter-bands keeps its severity→tone map private
 * (only `survivalTone(rate)` is exported), so the same three status colours are
 * named here for the fight-length severity.
 */
export function severityTone(severity: BandSeverity | null): string {
  if (severity === 'critical') return STATUS_ERROR;
  if (severity === 'warning') return STATUS_WARNING;
  return STATUS_SUCCESS;
}
