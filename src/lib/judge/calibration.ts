import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { err, ok, type Result } from '@/types/result';
import { BANDS } from './rubrics';

/**
 * Calibration set (Quality Program WS2) — the anti-drift anchor. A human labels each target
 * with the band it TRULY belongs in; the strict judge must agree with the human on
 * >= {@link CALIBRATION_THRESHOLD} of the CONFIRMED labels or the rubric wording is off.
 *
 * WHAT IS ACTUALLY GUARANTEED (read this before trusting the judge):
 *
 *  - The threshold is enforced by {@link evaluateCalibration} over the LATEST PERSISTED run of
 *    `npx tsx scripts/judge-run.ts --calibrate`, and the guard test
 *    (`src/__tests__/lib/judge/calibration.test.ts`) fails the build on `enforced-fail`.
 *  - Enforcement is scoped to NON-provisional targets, because a provisional label is seeded
 *    from prior evidence, not confirmed by a human — agreeing with an unconfirmed guess proves
 *    nothing. Today ALL {@link CALIBRATION} targets are provisional, so the honest standing of
 *    this project is `provisional`: the run reports a rate and the guard reports that ZERO
 *    confirmed labels back it. That is deliberately NOT a green.
 *  - With no persisted run the standing is `unrun` and NOTHING about the judge is proven; a run
 *    scored under an older `RUBRIC_VERSION` is `stale` and likewise proves nothing about the
 *    rubric in force.
 *
 * Workflow: user hand-labels (fail / placeholder / shippable) and clears `provisional` →
 * `judge-run.ts --calibrate` scores those exact targets at the policy judge model (metered like
 * any other draw, and recording NOTHING to `judge_verdicts` — calibration is measurement) → the
 * run is appended to {@link calibrationHistoryPath} → `computeAgreement` compares and
 * `evaluateCalibration` decides the standing. Re-run whenever `RUBRIC_VERSION` changes.
 */
export type Band = 'fail' | 'placeholder' | 'shippable';

/** Agreement the judge must reach with CONFIRMED human labels. Never lower this to pass. */
export const CALIBRATION_THRESHOLD = 0.85;

export interface CalibrationTarget {
  catalogId: string;
  entityId: string;
  step: string;
  /** The human's ground-truth band. */
  label: Band;
  /** Provisional = seeded from prior evidence, NOT yet user-confirmed. */
  provisional?: boolean;
  note?: string;
}

/** Score → band, the single mapping the whole program uses. */
export function bandOf(score: number): Band {
  if (score >= BANDS.shippable) return 'shippable';
  if (score >= BANDS.placeholder) return 'placeholder';
  return 'fail';
}

/**
 * Provisional seed — a handful of targets with strong prior evidence (documented honest
 * fails/passes from the gap-loop audit). The user must CONFIRM these (drop `provisional`) and
 * expand to ~20 spanning the map before the calibration is authoritative.
 */
export const CALIBRATION: CalibrationTarget[] = [
  { catalogId: 'characters', entityId: 'character-1', step: '3D Mesh', label: 'fail', provisional: true, note: 'Qwen already flagged the 3D face at 6/10 — a known hard fail.' },
  { catalogId: 'dialog-trees', entityId: 'dialog-1', step: 'Icon 2D Art', label: 'placeholder', provisional: true, note: 'Clean speech-bubble icon, competent but not distinctive AAA UI.' },
  { catalogId: 'items', entityId: 'item-1', step: '3D Mesh', label: 'placeholder', provisional: true, note: 'Iron longsword reads, but basic surface/topology — placeholder-plus.' },
];

/** The `${catalogId}::${entityId}::${step}` key a target's judge score is filed under. */
export function calibrationKey(t: Pick<CalibrationTarget, 'catalogId' | 'entityId' | 'step'>): string {
  return `${t.catalogId}::${t.entityId}::${t.step}`;
}

export interface AgreementResult {
  total: number;
  scored: number;
  agreed: number;
  rate: number; // agreed / scored, 0-1
  disagreements: { key: string; human: Band; judge: Band; score: number }[];
}

/**
 * Compare human labels to judge scores. `scores` maps `${catalogId}::${entityId}::${step}` →
 * the judge's 0-100 score (from the strict rubric run). Only labeled+scored targets count.
 */
export function computeAgreement(targets: CalibrationTarget[], scores: Record<string, number>): AgreementResult {
  const disagreements: AgreementResult['disagreements'] = [];
  let scored = 0, agreed = 0;
  for (const t of targets) {
    const key = calibrationKey(t);
    if (!(key in scores)) continue;
    scored++;
    const judge = bandOf(scores[key]);
    if (judge === t.label) agreed++;
    else disagreements.push({ key, human: t.label, judge, score: scores[key] });
  }
  return { total: targets.length, scored, agreed, rate: scored ? agreed / scored : 0, disagreements };
}

// ── Persisted runs ───────────────────────────────────────────────────────────

/** What one `--calibrate` run measured. Appended to the history so drift is comparable. */
export interface CalibrationRun {
  ranAt: string;
  rubricVersion: number;
  model: string;
  effort: string;
  /** `calibrationKey` → the judge's 0-100 score. Targets the harness could not score are absent. */
  scores: Record<string, number>;
  /** Per-target detail, including the targets that could NOT be scored (and why). */
  targets: {
    key: string;
    label: Band;
    provisional: boolean;
    score: number | null;
    judge: Band | null;
    agreed: boolean | null;
    note?: string;
  }[];
  /** Agreement over every scored target, provisional included. Reported, never authoritative. */
  overall: AgreementResult;
  /** Agreement over the CONFIRMED (non-provisional) targets only. This is what is enforced. */
  confirmed: AgreementResult;
  /** What the run cost, through the same meter every other judge draw uses. */
  spend: { costUsd: number; spawns: number; unknownCost: number };
}

/** Assemble a run record from the scores a harness collected. Pure. */
export function buildCalibrationRun(input: {
  targets: CalibrationTarget[];
  scores: Record<string, number>;
  /** Why a target has no score (key → reason), so an unscored target is never silent. */
  unscored?: Record<string, string>;
  rubricVersion: number;
  model: string;
  effort: string;
  spend: { costUsd: number; spawns: number; unknownCost: number };
  ranAt?: string;
}): CalibrationRun {
  const confirmedTargets = input.targets.filter((t) => !t.provisional);
  return {
    ranAt: input.ranAt ?? new Date().toISOString(),
    rubricVersion: input.rubricVersion,
    model: input.model,
    effort: input.effort,
    scores: { ...input.scores },
    targets: input.targets.map((t) => {
      const key = calibrationKey(t);
      const scored = key in input.scores;
      const judge = scored ? bandOf(input.scores[key]) : null;
      return {
        key,
        label: t.label,
        provisional: !!t.provisional,
        score: scored ? input.scores[key] : null,
        judge,
        agreed: judge === null ? null : judge === t.label,
        note: scored ? t.note : (input.unscored?.[key] ?? t.note),
      };
    }),
    overall: computeAgreement(input.targets, input.scores),
    confirmed: computeAgreement(confirmedTargets, input.scores),
    spend: { ...input.spend },
  };
}

/**
 * How much the judge is actually proven to agree with humans.
 *
 * `enforced-*` require at least one CONFIRMED (non-provisional) label — those are the only
 * labels a human has vouched for. Every other standing is an honest "not proven", never a green.
 */
export type CalibrationStanding =
  | 'unrun'          // no run persisted — nothing is proven
  | 'stale'          // the run scored a different RUBRIC_VERSION — proves nothing about this rubric
  | 'unscored'       // a run happened but scored no target (no artifact / no judgeable payload)
  | 'provisional'    // scored only provisional targets — a rate exists, no human backs it
  | 'enforced-pass'
  | 'enforced-fail';

export interface CalibrationVerdict {
  standing: CalibrationStanding;
  /** Rate over every scored target (provisional included), null when nothing was scored. */
  rate: number | null;
  /** Rate over CONFIRMED targets only — the enforced number. Null when none are confirmed. */
  confirmedRate: number | null;
  /** How many non-provisional targets were scored, i.e. how much human labelling backs the rate. */
  confirmedScored: number;
  scored: number;
  threshold: number;
  /** True when the rate the run DID produce sits under the threshold, confirmed or not. */
  belowThreshold: boolean;
  /** One line an operator (or a failing test) can read without decoding the standing. */
  message: string;
}

/** Decide the standing of a persisted run against the rubric currently in force. Pure. */
export function evaluateCalibration(run: CalibrationRun | null | undefined, rubricVersion: number): CalibrationVerdict {
  const base = { threshold: CALIBRATION_THRESHOLD, rate: null, confirmedRate: null, confirmedScored: 0, scored: 0, belowThreshold: false };
  if (!run) {
    return {
      ...base,
      standing: 'unrun',
      message: 'UNCALIBRATED — no calibration run persisted; the judge agreement with human labels is unmeasured. Run: npx tsx scripts/judge-run.ts --calibrate',
    };
  }
  if (run.rubricVersion !== rubricVersion) {
    return {
      ...base,
      standing: 'stale',
      rate: run.overall.scored ? run.overall.rate : null,
      scored: run.overall.scored,
      message: `STALE — the last calibration scored rubric v${run.rubricVersion}, the rubric in force is v${rubricVersion}. Re-run --calibrate; an old rubric's agreement proves nothing about this one.`,
    };
  }
  if (!run.overall.scored) {
    return {
      ...base,
      standing: 'unscored',
      message: `UNCALIBRATED — the run of ${run.ranAt} scored 0 of ${run.overall.total} targets (no artifact or no judgeable payload); no agreement could be measured.`,
    };
  }
  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;
  const belowOverall = run.overall.rate < CALIBRATION_THRESHOLD;
  if (!run.confirmed.scored) {
    return {
      standing: 'provisional',
      rate: run.overall.rate,
      confirmedRate: null,
      confirmedScored: 0,
      scored: run.overall.scored,
      threshold: CALIBRATION_THRESHOLD,
      belowThreshold: belowOverall,
      message: `PROVISIONAL — ${pct(run.overall.rate)} agreement over ${run.overall.scored} target(s), but 0 of them carry a confirmed human label, so nothing enforces the ${pct(CALIBRATION_THRESHOLD)} threshold${belowOverall ? ' (and the provisional rate is already under it)' : ''}. Confirm the labels in CALIBRATION (drop provisional) to make this binding.`,
    };
  }
  const below = run.confirmed.rate < CALIBRATION_THRESHOLD;
  return {
    standing: below ? 'enforced-fail' : 'enforced-pass',
    rate: run.overall.rate,
    confirmedRate: run.confirmed.rate,
    confirmedScored: run.confirmed.scored,
    scored: run.overall.scored,
    threshold: CALIBRATION_THRESHOLD,
    belowThreshold: below,
    message: `${below ? 'DRIFTED' : 'CALIBRATED'} — ${pct(run.confirmed.rate)} agreement over ${run.confirmed.scored} confirmed target(s) (threshold ${pct(CALIBRATION_THRESHOLD)}); ${pct(run.overall.rate)} over all ${run.overall.scored} scored.`,
  };
}

/** A per-target band change between two runs — what "drift" concretely means. */
export interface CalibrationDrift {
  rateDelta: number | null;
  moved: { key: string; from: Band | null; to: Band | null; fromScore: number | null; toScore: number | null }[];
  /** Targets present in one run and not the other (the set itself changed). */
  setChanged: string[];
}

/** Compare two persisted runs so drift is visible, not just a new number. Pure. */
export function calibrationDrift(prev: CalibrationRun | null | undefined, next: CalibrationRun): CalibrationDrift {
  if (!prev) return { rateDelta: null, moved: [], setChanged: [] };
  const byKey = (r: CalibrationRun) => new Map(r.targets.map((t) => [t.key, t]));
  const a = byKey(prev), b = byKey(next);
  const moved: CalibrationDrift['moved'] = [];
  const setChanged: string[] = [];
  for (const [key, t] of b) {
    const p = a.get(key);
    if (!p) { setChanged.push(key); continue; }
    if (p.judge !== t.judge) moved.push({ key, from: p.judge, to: t.judge, fromScore: p.score, toScore: t.score });
  }
  for (const key of a.keys()) if (!b.has(key)) setChanged.push(key);
  return {
    rateDelta: prev.overall.scored && next.overall.scored ? next.overall.rate - prev.overall.rate : null,
    moved,
    setChanged,
  };
}

// ── History file (script/server-side only) ───────────────────────────────────

/**
 * Where runs are appended, one JSON object per line. Lives in the app's own data home
 * (`~/.pof/`, beside `pof.db`) rather than the repo: it is a MEASUREMENT log that grows every
 * run, not source. `POF_JUDGE_CALIBRATION_PATH` overrides it (tests point it at a temp file).
 */
export function calibrationHistoryPath(env: Record<string, string | undefined> = process.env): string {
  return env.POF_JUDGE_CALIBRATION_PATH || join(homedir(), '.pof', 'judge-calibration.jsonl');
}

/**
 * Read the persisted runs, oldest first. A missing file is an empty history (which
 * `evaluateCalibration` reports as the honest `unrun`, never as a pass); a corrupt LINE is
 * skipped rather than thrown, so one bad append cannot make the whole guard unreadable.
 */
export function readCalibrationHistory(path = calibrationHistoryPath()): CalibrationRun[] {
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  const runs: CalibrationRun[] = [];
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const parsed = JSON.parse(s) as CalibrationRun;
      if (parsed && typeof parsed === 'object' && parsed.overall) runs.push(parsed);
    } catch {
      // a truncated/corrupt line is skipped, never thrown
    }
  }
  return runs;
}

/** The most recent persisted run, or null when none exists. */
export function latestCalibrationRun(path = calibrationHistoryPath()): CalibrationRun | null {
  const runs = readCalibrationHistory(path);
  return runs.length ? runs[runs.length - 1] : null;
}

/**
 * Append one run to the history. Returns the path on success; a failure is returned, never
 * swallowed — a calibration whose result was not persisted must not be reported as persisted.
 */
export function appendCalibrationRun(run: CalibrationRun, path = calibrationHistoryPath()): Result<string, string> {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(run) + '\n', 'utf8');
    return ok(path);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
