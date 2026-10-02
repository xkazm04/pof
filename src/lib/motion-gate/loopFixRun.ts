/**
 * Loop fix run — the bounded, same-seed, seam-pinned re-take of THIS clip.
 *
 * preflight -> constraints -> `runArdy` -> Tier-1 measure, at most {@link LOOP_FIX_MAX_ATTEMPTS}
 * times, stopping on the first pass (spec:72 "Bounded retries (propose 2), then surface the
 * best-scoring attempt with its score — never silently ship attempt N"). Every attempt
 * writes a NEW `<stem>_loopfix_aN` clip beside the original, which is never modified.
 *
 * Three outcomes, never two: `resolved` (an attempt passed), `unresolved` (the best graded
 * attempt is reported at its TRUE verdict — the measured recipe reaches warn), `ungraded`
 * (no attempt could be measured). An unmeasured attempt is never chosen as best
 * (ai-registry `regeneration-vs-repair-economics#bounded-refine-iteration`).
 *
 * Every dep is injectable; the defaults spawn ARDY (local GPU — nothing bills) and measure
 * in-process with `measureClip`. Server-only (node:fs).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ok, type Result } from '@/types/result';
import {
  buildArdyArgs, preflightArdy, runArdy,
  type ArdyPreflight, type ArdyResult, type ArdySpec,
} from '@/lib/visual-gen/ardy-runner';
import { scoreLoopClosure, type LoopScorecard, type LoopVerdict, DEFAULT_LOOP_THRESHOLDS } from './loopClosure';
import { measureClip } from './measureClip';
import { routeLoopRemedy, type LoopRemedyPlan, type SeamPins } from './loopRemedy';
import { buildSeamConstraintArgs, buildSeamConstraints } from './seamConstraints';

export const LOOP_FIX_MAX_ATTEMPTS = 2;
/** The operator command that writes a constraint file (its argv is shown on a dry run). */
export const LOOP_FIX_SCRIPT = 'scripts/visual-gen/ardy/pof_loop_fix.ts';

/** A Tier-1 measurement of one attempt; `error` means nothing was measured. */
export interface LoopFixMeasure {
  status: LoopVerdict | 'error';
  card?: LoopScorecard;
  error?: string;
}

export interface LoopFixSpec {
  npzPath: string;
  prompt: string;
  seed?: number;
  frames: number;
  card: LoopScorecard;
  /** Seconds to regenerate; must reproduce `frames` at the model's fps (ARDY default 4 s). */
  durationSec?: number;
  maxAttempts?: number;
  dryRun?: boolean;
  /** Install overrides passed through to ARDY (root, venv, script, model, timeout). */
  ardy?: Pick<ArdySpec, 'ardyRoot' | 'venvPython' | 'scriptPath' | 'textEncodersDir' | 'model' | 'timeoutMs'>;
}

export interface LoopFixDeps {
  preflight?: () => Promise<ArdyPreflight>;
  buildConstraints?: (npzPath: string, pins: SeamPins, outPath: string) => Promise<Result<string>>;
  runArdy?: (spec: ArdySpec) => Promise<ArdyResult>;
  measure?: (npzPath: string) => Promise<LoopFixMeasure>;
  env?: Record<string, string | undefined>;
}

export interface LoopFixAttempt {
  n: number;
  outputPath: string;
  constraintsPath: string;
  /** graded = Tier-1 measured it; ungraded = generated but unmeasurable; failed = not generated. */
  state: 'graded' | 'ungraded' | 'failed';
  npzPath?: string;
  verdict?: LoopVerdict;
  card?: LoopScorecard;
  error?: string;
}

export type LoopFixResult =
  | {
      ok: true;
      plan: Extract<LoopRemedyPlan, { remedy: 'seam-pin' }>;
      dryRun?: boolean;
      argv?: { constraints: string[]; ardy: string[] }[];
      attempts: LoopFixAttempt[];
      best?: LoopFixAttempt;
      outcome?: 'resolved' | 'unresolved' | 'ungraded';
      verdict?: LoopVerdict;
    }
  | { ok: false; error: string; plan?: LoopRemedyPlan };

const RANK: Record<LoopVerdict, number> = { pass: 0, warn: 1, fail: 2, 'n/a': 3 };
const PASS_BAND = {
  poseGap: DEFAULT_LOOP_THRESHOLDS.poseGapPassMm,
  worstJoint: DEFAULT_LOOP_THRESHOLDS.worstJointPassMm,
  velJump: DEFAULT_LOOP_THRESHOLDS.velJumpPassMm,
} as const;
const METRIC = { poseGap: 'poseGapMm', worstJoint: 'worstJointMm', velJump: 'velJumpMm' } as const;

/** Worse verdict loses; within a verdict, the deciding axis further past its pass band loses. */
function severity(c: LoopScorecard): number {
  const axis = c.worstAxis;
  return RANK[c.verdict] * 1e6 + (axis ? c.metrics[METRIC[axis]] / PASS_BAND[axis] : 0);
}

const stemOf = (npzPath: string) => npzPath.replace(/\.npz$/i, '');

async function defaultBuildConstraints(npzPath: string, pins: SeamPins, outPath: string): Promise<Result<string>> {
  const built = buildSeamConstraints(await readFile(npzPath), pins);
  if (!built.ok) return built;
  await writeFile(outPath, JSON.stringify(built.data));
  return ok(outPath);
}

async function defaultMeasure(npzPath: string): Promise<LoopFixMeasure> {
  const m = measureClip(await readFile(npzPath), { path: npzPath });
  if (!m.ok) return { status: 'error', error: m.error };
  const card = scoreLoopClosure(m.data.metrics);
  return { status: card.verdict, card };
}

/** Plan, then (unless `dryRun`) run the bounded re-take. */
export async function runLoopFix(spec: LoopFixSpec, deps: LoopFixDeps = {}): Promise<LoopFixResult> {
  const plan = routeLoopRemedy(spec.card, { frames: spec.frames, seed: spec.seed, prompt: spec.prompt });
  if (plan.remedy === 'none') return { ok: false, error: `no remedy: ${plan.reason}`, plan };

  const cap = Math.min(LOOP_FIX_MAX_ATTEMPTS, Math.max(1, Math.floor(spec.maxAttempts ?? LOOP_FIX_MAX_ATTEMPTS)));
  const stem = stemOf(spec.npzPath);
  const ardySpec = (n: number): ArdySpec => ({
    ...spec.ardy,
    prompt: plan.prompt,
    seed: plan.seed,
    outputPath: `${stem}_loopfix_a${n}`,
    constraintsPath: `${stem}_loopfix_a${n}.constraints.json`,
    ...(spec.durationSec !== undefined ? { durationSec: spec.durationSec } : {}),
  });

  if (spec.dryRun) {
    const env = deps.env ?? process.env;
    const root = spec.ardy?.ardyRoot ?? env.POF_ARDY_ROOT ?? '$POF_ARDY_ROOT';
    const script = spec.ardy?.scriptPath ?? join(root, 'scripts', 'generate.py');
    const argv = Array.from({ length: cap }, (_, i) => {
      const s = ardySpec(i + 1);
      return { constraints: buildSeamConstraintArgs(LOOP_FIX_SCRIPT, spec.npzPath, s.constraintsPath!, plan), ardy: buildArdyArgs(script, s) };
    });
    return { ok: true, plan, dryRun: true, argv, attempts: [] };
  }

  const preflight = await (deps.preflight ?? (() => preflightArdy(spec.ardy ?? {})))();
  if (!preflight.ok) {
    const bad = preflight.checks.filter((c) => !c.ok).map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ''}`);
    return { ok: false, error: `ARDY preflight failed: ${bad.join('; ')}`, plan };
  }

  const build = deps.buildConstraints ?? defaultBuildConstraints;
  const generate = deps.runArdy ?? ((s: ArdySpec) => runArdy(s));
  const measure = deps.measure ?? defaultMeasure;
  const attempts: LoopFixAttempt[] = [];
  for (let n = 1; n <= cap; n++) {
    const s = ardySpec(n);
    const base = { n, outputPath: s.outputPath, constraintsPath: s.constraintsPath! };
    const written = await build(spec.npzPath, plan.pins, base.constraintsPath);
    if (!written.ok) return { ok: false, error: `constraints: ${written.error}`, plan };
    const gen = await generate(s);
    if (!gen.ok || !gen.npzPath) {
      attempts.push({ ...base, state: 'failed', error: gen.error ?? 'ARDY wrote no clip' });
      continue;
    }
    const m = await measure(gen.npzPath);
    const frames = m.card?.metrics.frames;
    if (m.status === 'error' || m.status === 'n/a' || !m.card) {
      attempts.push({ ...base, npzPath: gen.npzPath, state: 'ungraded', error: m.error ?? `Tier-1 returned ${m.status}` });
    } else if (frames !== plan.frames) {
      attempts.push({ ...base, npzPath: gen.npzPath, state: 'ungraded', error: `re-take has ${frames} frames, the pins were placed for ${plan.frames}` });
    } else {
      attempts.push({ ...base, npzPath: gen.npzPath, state: 'graded', verdict: m.card.verdict, card: m.card });
      if (m.card.verdict === 'pass') break;
    }
  }

  const graded = attempts.filter((a) => a.state === 'graded' && a.card);
  const best = graded.reduce<LoopFixAttempt | undefined>(
    (b, a) => (!b || severity(a.card!) < severity(b.card!) ? a : b),
    undefined,
  );
  const outcome = !best ? 'ungraded' : best.verdict === 'pass' ? 'resolved' : 'unresolved';
  return { ok: true, plan, attempts, best, outcome, verdict: best?.verdict };
}
