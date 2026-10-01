import type { BalanceAlertSeverity } from '@/types/combat-simulator';
import type { DramaticBeat, IssueBeatType, TensionCurve } from './tension-curve';

/**
 * Encounter findings — the ONE authority for what the choreographer reports
 * about an encounter (balance alerts + pacing defects).
 *
 * - Balance findings come from sim facts, read against `ENCOUNTER_ENVELOPE`.
 * - Pacing findings are a 1:1 promotion of the tension curve's `tone:'issue'`
 *   beats — the curve is the only pacing detector, so the alert list can never
 *   disagree with the arc (no beat dropped, none promoted twice).
 *
 * Every finding carries a stable `kind`: match findings across tuning passes by
 * kind (plus time), never by message text, which embeds numbers.
 */

/** Every threshold the findings read, in one table. `bucketSec` is also the tension curve's window. */
export const ENCOUNTER_ENVELOPE = {
  /** Analysis window for burst detection and the tension-curve flux (seconds) */
  bucketSec: 2,
  /** A death before this many seconds is critical (too punishing) */
  punishingDeathSec: 5,
  /** Fights longer than this feel spongy */
  spongySec: 45,
  /** Survived fights shorter than this are trivial */
  trivialSec: 3,
  /** Combined enemy HP above this multiple of effective player HP feels tedious */
  tediousHpRatio: 5,
  /** Enemy damage in one bucket above this fraction of effective player HP is a burst spike */
  burstHpFrac: 0.4,
} as const;

export const BALANCE_FINDING_KINDS = [
  'unknown-archetype', 'player-death', 'spongy', 'trivial', 'tedious-hp', 'burst-spike',
] as const;
export type BalanceFindingKind = (typeof BALANCE_FINDING_KINDS)[number];
export type PacingFindingKind = IssueBeatType;
export type EncounterFindingKind = BalanceFindingKind | PacingFindingKind;

export interface EncounterFinding {
  /** Stable identity of the finding — the key to diff findings across passes */
  kind: EncounterFindingKind;
  severity: BalanceAlertSeverity;
  message: string;
  timeSec: number;
  /** Set for ranged findings (dead zone, flat pacing): the finding spans timeSec..endTimeSec */
  endTimeSec?: number;
}

/** The sim facts the balance findings are read from. */
export interface EncounterFacts {
  damageEvents: ReadonlyArray<{ timeSec: number; source: string; target: string; damage: number }>;
  durationSec: number;
  playerDied: boolean;
  /** Player max HP after the health multiplier */
  effectivePlayerHp: number;
  totalEnemyHp: number;
  /** Placements in the encounter (including skipped ones) */
  enemyCount: number;
  /** Placements whose archetype no longer resolves */
  skippedEnemies: number;
}

/** Issue-beat type → finding. Keyed on IssueBeatType, so a new issue beat will not compile until it is mapped here. */
const PACING_FINDINGS: Record<PacingFindingKind, { severity: BalanceAlertSeverity; message: (b: DramaticBeat) => string }> = {
  'dead-zone': { severity: 'info', message: (b) => `Dead zone at ${b.timeSec}–${b.endTimeSec ?? b.timeSec}s: ${b.detail}` },
  anticlimax: { severity: 'info', message: (b) => `Anticlimactic finish: ${b.detail}` },
  'flat-pacing': { severity: 'info', message: (b) => `Flat pacing: ${b.detail}` },
};

export const PACING_FINDING_KINDS = Object.keys(PACING_FINDINGS) as readonly PacingFindingKind[];

export function isPacingFinding(kind: EncounterFindingKind): kind is PacingFindingKind {
  return (PACING_FINDING_KINDS as readonly string[]).includes(kind);
}

export function deriveEncounterFindings(facts: EncounterFacts, curve: TensionCurve): EncounterFinding[] {
  return [...deriveBalanceFindings(facts), ...derivePacingFindings(curve)];
}

function deriveBalanceFindings(f: EncounterFacts): EncounterFinding[] {
  const E = ENCOUNTER_ENVELOPE;
  const out: EncounterFinding[] = [];
  const dur = f.durationSec;
  if (f.skippedEnemies > 0) {
    const n = f.skippedEnemies;
    out.push({ kind: 'unknown-archetype', severity: 'warning', timeSec: 0,
      message: `${n} enemy placement${n > 1 ? 's' : ''} skipped — unknown archetype (renamed or removed). Re-pick the enemy in the encounter.` });
  }
  if (f.playerDied && dur < E.punishingDeathSec) {
    out.push({ kind: 'player-death', severity: 'critical', timeSec: dur, message: `Player dies in ${dur.toFixed(1)}s — encounter is too punishing` });
  } else if (f.playerDied) {
    out.push({ kind: 'player-death', severity: 'warning', timeSec: dur, message: `Player dies at ${dur.toFixed(1)}s — survival not guaranteed` });
  }
  if (dur > E.spongySec) {
    out.push({ kind: 'spongy', severity: 'warning', timeSec: E.spongySec, message: `Encounter lasts ${E.spongySec}s+ — combat feels spongy` });
  }
  if (!f.playerDied && dur < E.trivialSec && f.enemyCount > 0) {
    out.push({ kind: 'trivial', severity: 'info', timeSec: dur, message: `Encounter ends in <${E.trivialSec}s — trivially easy` });
  }
  if (f.totalEnemyHp > f.effectivePlayerHp * E.tediousHpRatio) {
    out.push({ kind: 'tedious-hp', severity: 'warning', timeSec: 0,
      message: `Combined enemy HP (${f.totalEnemyHp}) is ${E.tediousHpRatio}x+ player HP — may feel tedious` });
  }
  // Burst spikes: enemy damage landed on the player per analysis bucket.
  const buckets = new Map<number, number>();
  for (const e of f.damageEvents) {
    if (e.source === 'Player') continue;
    const t = Math.floor(e.timeSec / E.bucketSec) * E.bucketSec;
    buckets.set(t, (buckets.get(t) ?? 0) + e.damage);
  }
  for (const [t, dmg] of buckets) {
    if (dmg > f.effectivePlayerHp * E.burstHpFrac) {
      const pct = ((dmg / f.effectivePlayerHp) * 100).toFixed(0);
      out.push({ kind: 'burst-spike', severity: 'critical', timeSec: t,
        message: `Burst damage spike at ${t}s: ${dmg} dmg in ${E.bucketSec}s (${pct}% of HP)` });
    }
  }
  return out;
}

function derivePacingFindings(curve: TensionCurve): EncounterFinding[] {
  const out: EncounterFinding[] = [];
  for (const beat of curve.beats) {
    if (beat.tone !== 'issue') continue;
    const kind = beat.type as PacingFindingKind;
    const spec = PACING_FINDINGS[kind];
    out.push({ kind, severity: spec.severity, message: spec.message(beat), timeSec: beat.timeSec,
      ...(beat.endTimeSec !== undefined ? { endTimeSec: beat.endTimeSec } : {}) });
  }
  return out;
}
