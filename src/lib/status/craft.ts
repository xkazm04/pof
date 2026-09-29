/**
 * Craft ladder — the A-axis: how a step's output measures against real AAA practice.
 *
 * PARALLEL to the readiness ladder (readiness.ts), never a replacement: R0–R5 measures
 * automation honesty (something real exists and a gate/judge confirmed it), A0–A4
 * measures craft distance from what a AAA studio ships for the same deliverable class.
 * The two are orthogonal — a step can be R5 (proven running in UE) and A1 (hobby-tier
 * writing), or A3 content that no gate has ever proven.
 *
 * Like readiness, this is a pure PROJECTION for display and routing. Acceptance,
 * `gradeArtifact`, the checkers and `statusModel`'s judge-elevation logic never read it
 * (a test pins that). Craft verdicts live in their own table (`craft_verdicts`) for the
 * same reason — an A-level must never leak into an R-grade.
 *
 * The scale carries the campaign's honesty rules in its own shape:
 *  - `at-ceiling` renders as ACHIEVEMENT, not shame — a 3D mesh at `A2^` has reached
 *    everything its medium permits under the recorded market assumption
 *    (`src/lib/craft/craft-ceilings.json`), and the remaining gap is a capability
 *    ceiling, not missing effort.
 *  - `stale` means the artifact changed after it was gauged: the score grades content
 *    the step no longer holds and must not be trusted or reported as current. "Changed" is
 *    decided by CONTENT (`stepContentHash`, the same fingerprint judge verdicts bind to)
 *    whenever both sides carry a comparable hash; only a hash-less side falls back to the
 *    row's write time — which errs toward stale, never toward current.
 *  - A verdict scored under an older lens version is A0 UNGAUGED, not its old level —
 *    lenses only change via a version bump, and the bump visibly invalidates dependent
 *    verdicts instead of silently re-meaning them. A NEWER version than this build holds is
 *    A0 too, and so is a level above the medium's roof (not awardable). The write door
 *    (`src/lib/craft/admission.ts`) refuses both; this is the defence for rows already stored.
 */
import type { JudgedContent } from '@/lib/catalog/acceptance/judgeBridge';
import { isComparableHash } from '@/lib/judge/contentHash';

/** The ladder, ascending. `A_LADDER` below is the single source of order. */
export type CraftLevel = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';

/** A gauged level — what a verdict may actually record (absence is A0, never stored). */
export type GaugedCraftLevel = Exclude<CraftLevel, 'A0'>;

/**
 * How the cell sits at its level:
 *  - `gauged`     — scored under the current lens version against the current content.
 *  - `at-ceiling` — at the maximum its medium permits; rendered as achievement.
 *  - `stale`      — content changed since it was gauged; the level shown is the OLD
 *                   content's and must not be reported as current.
 */
export type CraftState = 'gauged' | 'at-ceiling' | 'stale';

export interface Craft {
  level: CraftLevel;
  state: CraftState;
  /** The one input that decided this — shown in the cell tooltip and the legend. */
  because: string;
}

/** Ascending order. The ONLY place rung order is written down. */
export const A_LADDER: readonly CraftLevel[] = ['A0', 'A1', 'A2', 'A3', 'A4'] as const;

export const CRAFT_NAME: Record<CraftLevel, string> = {
  A0: 'UNGAUGED',
  A1: 'HOBBY',
  A2: 'INDIE',
  A3: 'AA',
  A4: 'AAA-PARITY',
};

export const CRAFT_MEANING: Record<CraftLevel, string> = {
  A0: 'No craft verdict yet, or the verdict predates the current lens version.',
  A1: 'Would not survive any professional review.',
  A2: 'Competent and shippable in an indie title; systematic gaps vs professional practice.',
  A3: 'Professional craft; misses named AAA-differentiating practices (findings cite which).',
  A4: 'Indistinguishable from the lens’s named benchmark anchors for this deliverable class.',
};

export function craftRank(level: CraftLevel): number {
  return A_LADDER.indexOf(level);
}

/**
 * Rungs remaining to this step's roof — the campaign headline is the sum of these.
 * A0 counts its full distance (nothing gauged yet means the whole climb remains);
 * a level above its ceiling (a ceiling later lowered) clamps to zero, never negative.
 */
export function distanceToRoof(level: CraftLevel, ceiling: CraftLevel): number {
  return Math.max(0, craftRank(ceiling) - craftRank(level));
}

/** The minimal verdict shape this projection needs — client-safe, no DB import.
 *  (`craft-verdicts-db.ts`'s CraftVerdict is a superset.) */
export interface CraftVerdictLite {
  aLevel: GaugedCraftLevel;
  lensVersion: number;
  /** The artifact `updatedAt` stamped when the verdict was written (staleness anchor).
   *  Absent on rows written with no artifact on record (e.g. process scorecards). */
  artifactUpdatedAt?: string;
  /** `stepContentHash` of the content gauged (the content binding). Absent on legacy rows. */
  contentHash?: string;
}

export interface CraftInput {
  /** The current verdict for this step, if any. */
  verdict?: CraftVerdictLite;
  /** The lens's CURRENT version (src/lib/craft/lens-versions.ts). */
  currentLensVersion: number;
  /** The medium's roof (src/lib/craft/craft-ceilings.json). */
  ceiling: CraftLevel;
  /** What the step holds NOW — its content hash (when the reader can prove one) and its
   *  `updatedAt`. The same shape judge verdicts are checked against (`judgeBridge`). */
  artifact?: JudgedContent;
}

/**
 * Did the content change since this verdict gauged it? Returns WHY it is stale, or null.
 *
 *  - BOTH sides carry a hash of the CURRENT scheme → compare fingerprints. A drain re-upserting
 *    identical data moves `updated_at` but not the hash (current); a re-produce inside the same
 *    second moves the hash but not the second-resolution timestamp (stale).
 *  - Otherwise (a legacy hash-less gauge, a hash from a superseded scheme, or a reader that could
 *    not prove the artifact's hash) → the timestamp rule, exactly as before: a write after the
 *    gauge reads stale. Unprovable never elevates a gauge to current.
 */
function staleBecause(verdict: CraftVerdictLite, artifact: JudgedContent | undefined): string | null {
  if (isComparableHash(verdict.contentHash) && isComparableHash(artifact?.hash)) {
    return verdict.contentHash === artifact?.hash
      ? null
      : 'content changed since it was gauged — this level grades content the step no longer holds';
  }
  const rewritten =
    verdict.artifactUpdatedAt != null &&
    artifact?.updatedAt != null &&
    artifact.updatedAt > verdict.artifactUpdatedAt;
  // Said as what it is: a later WRITE, with no content binding able to prove the content held.
  return rewritten
    ? 'artifact rewritten since it was gauged and no content binding proves it unchanged — this level may grade content the step no longer holds'
    : null;
}

/**
 * Project a craft verdict onto the A-axis. Pure.
 *
 * Precedence: ungauged (no verdict, or a lens version not in force either way, or a level
 * above the medium's roof) → stale → at-ceiling → gauged.
 * Stale beats at-ceiling deliberately: a stale `A2^` on a 3D step would read as "roof
 * reached" about content nobody has gauged.
 */
export function craftOf(input: CraftInput): Craft {
  const { verdict, currentLensVersion, ceiling, artifact } = input;
  if (!verdict) {
    return { level: 'A0', state: 'gauged', because: 'no craft verdict recorded for this step' };
  }
  if (verdict.lensVersion < currentLensVersion) {
    return {
      level: 'A0',
      state: 'gauged',
      because: `gauged under lens v${verdict.lensVersion}; current lens is v${currentLensVersion}`,
    };
  }
  // A version this build does not hold (a branch that bumped the lens, writing into the shared
  // DB) cannot be read as current — the rubric it scored against is not the one in force.
  if (verdict.lensVersion > currentLensVersion) {
    return {
      level: 'A0',
      state: 'gauged',
      because: `gauged under lens v${verdict.lensVersion}, but lens v${verdict.lensVersion} is not in force (v${currentLensVersion})`,
    };
  }
  // Above the roof is NOT awardable (craft-ceilings.json records the market assumption); it
  // never renders as at-ceiling achievement. Checked before staleness so it cannot show A3~.
  if (craftRank(verdict.aLevel) > craftRank(ceiling)) {
    return {
      level: 'A0',
      state: 'gauged',
      because: `${verdict.aLevel} is above this medium's recorded roof ${ceiling} — not awardable`,
    };
  }
  const stale = staleBecause(verdict, artifact);
  if (stale) return { level: verdict.aLevel, state: 'stale', because: stale };
  if (craftRank(verdict.aLevel) === craftRank(ceiling)) {
    return {
      level: verdict.aLevel,
      state: 'at-ceiling',
      because: `at the recorded maximum for this medium (ceiling ${ceiling})`,
    };
  }
  return { level: verdict.aLevel, state: 'gauged', because: CRAFT_MEANING[verdict.aLevel] };
}

/** Glyph per state. `gauged` adds none — an unmarked chip simply is what it says. */
export const CRAFT_STATE_GLYPH: Record<CraftState, string> = {
  gauged: '',
  'at-ceiling': '^',
  stale: '~',
};

export const CRAFT_STATE_WORD: Record<CraftState, string> = {
  gauged: 'gauged',
  'at-ceiling': 'at ceiling',
  stale: 'stale',
};

/** The compact code shown on the chip, e.g. `A2^` / `A3~`. */
export function craftCode(c: Craft): string {
  return `${c.level}${CRAFT_STATE_GLYPH[c.state]}`;
}

/** Spoken form for aria/tooltip: "A3 AA · at ceiling — <because>". */
export function craftLabel(c: Craft): string {
  return `${c.level} ${CRAFT_NAME[c.level]} · ${CRAFT_STATE_WORD[c.state]} — ${c.because}`;
}
