/**
 * Readiness ladder — the ONE production-readiness scale for a pipeline step.
 *
 * /status used to paint two competing colour languages on every cell: the background
 * encoded `CellGrade` (credibility) and a 3px left stripe encoded the acceptance tier
 * L0–L4 (which KIND of check the artifact reached). They collided —
 *   - `TIER_VAR.L4` and `GRADE_VAR.verified` were the same green, so green meant
 *     "declares a visual gate" on the stripe and "a gate actually passed" in the fill;
 *   - the stripe read `bestPassTier ?? tier`, and that fallback took the max tier of ANY
 *     artifact regardless of status — so a DECLARED-but-deferred L4 painted a green stripe
 *     on an amber cell, rewarding ambition instead of achievement;
 *   - `TIER_VAR.L1`/`TIER_VAR.L2` are literally the same hex on the Blueprint floor
 *     (`--lab-ink` === `--lab-accent`), so the 5-step ramp had 4 distinguishable steps.
 *
 * This module collapses both into one ordered ladder where up ALWAYS means closer to
 * shippable, plus two states that are deliberately NOT rungs (a gate that was declared
 * but never run is not progress; a failure is not a level).
 *
 * It is a pure PROJECTION over the already-derived `StepCell` — no grading logic lives
 * here and none moved. `deriveCell` still owns headless gating, rubric filtering and
 * unpowered detection, so consolidating the display cannot move a verdict.
 */
import type { StepCell, CellGrade } from './statusModel';

/** The ladder, ascending. `LADDER` below is the single source of order. */
export type ReadinessLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

/**
 * How the cell sits at its level:
 *  - `reached`  — it is genuinely at that rung.
 *  - `waiting`  — the gate that would put it there is DECLARED but has not run. Renders
 *                 hollow at the would-be rung so it can never read as progress.
 *  - `blocked`  — a checker or a judge condemned it. Renders terminal red regardless of
 *                 level; the level is kept only so blocked cells sort and filter sanely.
 */
export type ReadinessState = 'reached' | 'waiting' | 'blocked';

export interface Readiness {
  level: ReadinessLevel;
  state: ReadinessState;
  /** The one input that decided this — shown in the cell tooltip and the legend. */
  because: string;
}

/** Ascending order. The ONLY place rung order is written down; `RAMP` and `rank` derive
 *  from it, and a test pins them together so a future edit can't desync the ramp. */
export const LADDER: readonly ReadinessLevel[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'] as const;

/** Human name per rung — used by the legend, chips and aria labels. */
export const READINESS_NAME: Record<ReadinessLevel, string> = {
  R0: 'NOT WIRED',
  R1: 'HOLLOW',
  R2: 'DRAFTED',
  R3: 'REVIEWED',
  R4: 'PROVEN',
  R5: 'SHIPPED',
};

/** One-line meaning per rung, for the legend's title text. */
export const READINESS_MEANING: Record<ReadinessLevel, string> = {
  R0: 'No artifact at all — nothing has ever been produced for this step.',
  R1: 'Nothing real behind it: a pass on placeholder data, no engine that can produce it, or produced but not passing.',
  R2: 'Real output exists but only shape-level checks ran, and the engine class needs a gate to prove quality.',
  R3: 'Passes, from an engine class that scales to quality without a gate — or a judge passed it below the shippable band.',
  R4: 'A real L3/L4 gate passed (headless-reproducible), or a strict judge scored it at the shippable bar.',
  R5: 'Proven quality AND proven running in UE — the only rung that means production.',
};

export function rank(level: ReadinessLevel): number {
  return LADDER.indexOf(level);
}

/** True when `level` sits at or above `floor` on the ladder. */
export function atOrAbove(level: ReadinessLevel, floor: ReadinessLevel): boolean {
  return rank(level) >= rank(floor);
}

/**
 * The rung a grade occupies, ignoring gate-waiting and failure. `deferred` and
 * `attention` are handled by `readinessOf` because they are STATES, not rungs — this
 * map answers "where would it sit". A deferred artifact is always L3/L4 (only
 * `acceptance/deferred.ts` emits deferred, and it emits nothing else), so its
 * would-be rung is R4; a blocked cell's would-be rung comes from what did pass.
 */
const GRADE_LEVEL: Record<CellGrade, ReadinessLevel> = {
  unwired: 'R0',
  unpowered: 'R1',
  pending: 'R1',
  ungated: 'R2',
  trusted: 'R3',
  verified: 'R4',
  deferred: 'R4',
  attention: 'R1',
};

/** Why a grade lands where it does — the honest one-liner shown on the cell. */
const GRADE_BECAUSE: Record<CellGrade, string> = {
  unwired: 'no artifact has ever been recorded for this step',
  unpowered: 'the checker passed on placeholder data — nothing in the stack can actually produce this',
  pending: 'an artifact exists but does not satisfy its own checker yet',
  ungated: 'output exists and passes shape checks, but its engine class needs a gate to prove quality',
  trusted: 'passes, from an engine class that scales to quality without a gate',
  verified: 'a real gate passed, or a strict judge scored it at the shippable bar',
  deferred: 'the gate that would prove this is declared but has not been run',
  attention: 'a checker or a judge condemned this output',
};

/**
 * Where a BLOCKED cell would sit if its failure were lifted. A judge-fail on a cell
 * whose shape checker passed still produced something real, so it keeps the rung that
 * pass earned; a hard checker fail with nothing passing stays at R1.
 */
function blockedWouldBeLevel(cell: StepCell): ReadinessLevel {
  if (cell.counts.pass === 0) return 'R1';
  // Something passed — grade it as if the judge verdict were absent, which is exactly
  // the `trusted` / `ungated` split deriveCell applies to a plain pass.
  return cell.checkerMeaningful === false ? 'R2' : 'R3';
}

/**
 * Project a derived cell onto the readiness ladder. Pure.
 *
 * R5 is the one rung that reads outside `CellGrade`: it is R4 PLUS audited evidence that
 * the step's output actually runs in UE (`realization-facts.json`). That promotes the
 * realization audit from decoration to a readiness input — deliberately, and only for
 * this display projection. Acceptance, `gradeArtifact` and the checkers never see it.
 */
export function readinessOf(cell: StepCell): Readiness {
  if (cell.grade === 'deferred') {
    return { level: 'R4', state: 'waiting', because: GRADE_BECAUSE.deferred };
  }
  if (cell.grade === 'attention') {
    return { level: blockedWouldBeLevel(cell), state: 'blocked', because: GRADE_BECAUSE.attention };
  }
  if (cell.grade === 'verified' && cell.realization?.ue === 'proven') {
    return {
      level: 'R5',
      state: 'reached',
      because: 'gate-proven AND audited as actually running in UE',
    };
  }
  return { level: GRADE_LEVEL[cell.grade], state: 'reached', because: GRADE_BECAUSE[cell.grade] };
}

/**
 * The monotone colour ramp. Weight climbs with the rung, and GREEN IS RESERVED for the
 * gate-proven rungs (R4/R5) — the same discipline the old grade ladder held. Below that
 * it is one blue-ink weight ramp, so there is no hue argument in the middle of the scale.
 *
 * Colour never carries a rung alone: every cell also renders its `R…` code, `waiting`
 * adds a glyph and a hatch, `blocked` adds `✕` (WCAG 1.4.1, and this repo's
 * StatusToken convention of glyph + word over hue).
 */
export interface RampStep {
  /** Base lab token the rung is tinted from. */
  token: string;
  /** Fill alpha percentage against the Blueprint floor. */
  fill: number;
}

export const RAMP: Record<ReadinessLevel, RampStep> = {
  R0: { token: 'var(--lab-line)', fill: 0 },
  R1: { token: 'var(--lab-ink)', fill: 8 },
  R2: { token: 'var(--lab-ink)', fill: 18 },
  R3: { token: 'var(--lab-ink)', fill: 32 },
  R4: { token: 'var(--lab-ok)', fill: 28 },
  R5: { token: 'var(--lab-ok)', fill: 55 },
};

/** Terminal red for `blocked` — outside the ramp on purpose. */
export const BLOCKED_TOKEN = 'var(--lab-bad)';
export const BLOCKED_FILL = 30;

/** Glyph per state. `reached` adds none — an unmarked cell is one that simply is where
 *  it says it is. */
export const STATE_GLYPH: Record<ReadinessState, string> = {
  reached: '',
  waiting: '⋯',
  blocked: '✕',
};

export const STATE_WORD: Record<ReadinessState, string> = {
  reached: 'reached',
  waiting: 'waiting',
  blocked: 'blocked',
};

/** The compact code shown on the cell face and in chips, e.g. `R4⋯` / `R3✕`. */
export function readinessCode(r: Readiness): string {
  return `${r.level}${STATE_GLYPH[r.state]}`;
}

/** Spoken form for aria/tooltip: "R4 PROVEN · waiting — <because>". */
export function readinessLabel(r: Readiness): string {
  return `${r.level} ${READINESS_NAME[r.level]} · ${STATE_WORD[r.state]} — ${r.because}`;
}
