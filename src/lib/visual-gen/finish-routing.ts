/**
 * critique → mesh-finish routing — the missing edge between the Tier-1 gate and the
 * $0 local retopo/decimate/bake stage.
 *
 * `runMeshFinish` was live-proven on 2026-07-28 and gained a job store + an API route on
 * 2026-08-14, but NOTHING ever routed a verdict into it: the gate condemned a mesh, and
 * the condemnation went nowhere. This is the decision layer that closes it, kept pure so
 * the routing rules are testable without Blender, a job or a network.
 *
 * ── Three refusals this makes explicit ────────────────────────────────────────────
 *
 * 1. **It refuses to finish a mesh finishing cannot help.** Measured 2026-08-20 over all
 *    52 `.glb` in `generated/`: 10 of 52 fail the gate and ALL 10 fail on `floaters` —
 *    which decimation does not remove and demonstrably multiplies (`jinx_v32_run.glb`
 *    1 speck → its decimated `jinx_v32_run_game.glb` 16 specks, warn → fail). Routing
 *    those into Blender would burn minutes to deliver the same verdict. So a plan is only
 *    produced when at least one FAILING criterion is in `FINISH_RESOLVES`, and whatever
 *    will still be wrong afterwards is named in `unaddressed` up front.
 *
 * 2. **It refuses `cullInterior`, always.** `pof_mesh_finish.py`'s `loose_shell_count`
 *    (line 104) builds a Python dict of per-vertex polygon lists over the HIGH-poly,
 *    before decimation, and runs a per-polygon BFS — the same memory-bomb family as the
 *    `trimesh.split()` call that consumed 211 GB and crashed the operator's machine on
 *    2026-08-18. It is latent today only because `cullInterior` has no caller. This
 *    module is the first thing that would have become one, so it never sets the flag.
 *
 * 3. **It refuses an arbitrary write path.** The mesh-finish route accepts any
 *    `highPolyPath`/`outputPath` — an unreviewed write primitive. Every path this planner
 *    produces is a safe basename inside the `mesh-finish` dir of the `ASSET_DIRS`
 *    allow-list, and the input must itself resolve to an allow-listed generated file.
 */
import { join } from 'node:path';
import type { CritiqueResult, FindingCode } from './mesh-critique';
import { assessStage, type MeshStage } from './critique-stage';
import type { MeshFinishSpec } from './mesh-finish';
import { polycountFor } from './polycount-presets';
import { ASSET_DIRS, safeAssetDir, safeAssetName } from './generated-assets';

/** The one dir a routed finish may write into. Must be a member of `ASSET_DIRS`. */
export const FINISH_OUTPUT_DIR = 'mesh-finish';

export interface FinishPlan {
  ok: true;
  spec: MeshFinishSpec;
  /** Failing codes this run is expected to resolve. */
  addresses: FindingCode[];
  /** Failing codes that will STILL be wrong after it — never omitted, never softened. */
  unaddressed: FindingCode[];
  /** One line stating both, for the caller to report verbatim. */
  note: string;
}

export interface FinishRefusal {
  ok: false;
  reason: string;
}

/** Where a routed finish writes. Basename-only, inside the allow-listed dir. Pure. */
export function finishOutputPath(inputName: string, stamp: number, cwd: string): string | null {
  const safe = safeAssetName(inputName);
  if (!safe) return null;
  const base = safe.replace(/\.[^.]+$/, '');
  const out = `${base}_finish_${stamp}.glb`;
  // Re-check the CONSTRUCTED name through the same guard, so a crafted input basename
  // cannot smuggle anything into the file we are about to write.
  if (!safeAssetName(out)) return null;
  if (!safeAssetDir(FINISH_OUTPUT_DIR)) return null;
  return join(cwd, 'generated', FINISH_OUTPUT_DIR, out).replace(/\\/g, '/');
}

export interface PlanFinishArgs {
  /** Basename of the mesh inside `generated/<dir>/`. Never a path. */
  meshName: string;
  /** Which allow-listed `generated/` dir it lives in. */
  meshDir: string;
  critique: CritiqueResult | undefined;
  assetClass?: string;
  /** Stage the critique graded. Only a `raw` mesh can be routed INTO finish. */
  stage?: MeshStage;
  now?: number;
  cwd?: string;
}

/**
 * Decide whether a failing verdict should be routed into `mesh-finish`, and with what
 * spec. Pure. Never spends anything; never touches the filesystem.
 */
export function planFinishFromCritique(args: PlanFinishArgs): FinishPlan | FinishRefusal {
  const { critique, assetClass, meshName, meshDir } = args;
  const stage: MeshStage = args.stage ?? 'raw';

  const dir = safeAssetDir(meshDir);
  if (!dir) return { ok: false, reason: `"${meshDir}" is not a servable generated dir (${ASSET_DIRS.map((d) => d.dir).join(', ')})` };
  const safeName = safeAssetName(meshName);
  if (!safeName) return { ok: false, reason: `"${meshName}" is not a safe generated-asset basename` };

  if (!critique) return { ok: false, reason: 'no critique — nothing graded this mesh, so there is no verdict to route' };
  if (critique.unavailable) return { ok: false, reason: `the critic could not run (${critique.error ?? 'reason not reported'}) — an absent gate is not a finish request` };
  if (!critique.ok || critique.verdict === undefined) return { ok: false, reason: `critique did not complete: ${critique.error ?? 'no verdict'}` };
  if (critique.verdict !== 'fail') return { ok: false, reason: `verdict is "${critique.verdict}", not a failure — nothing to remediate` };
  if (stage === 'finished') return { ok: false, reason: 'this mesh has already been through the finish stage; running it again would not change the criteria it failed' };
  if (!critique.findings?.length) {
    return { ok: false, reason: 'the verdict carries no defect codes, so which stage could resolve it is unknown — routing on prose would be a guess' };
  }

  const assessment = assessStage(critique, stage);
  if (!assessment.finishWorthwhile) {
    return {
      ok: false,
      reason: `mesh-finish resolves none of the failing criteria (${assessment.unaddressed.join(', ') || 'none recorded'}) — decimation does not remove floater specks and has been measured to multiply them, so this run would spend minutes to reproduce the same verdict`,
    };
  }

  // The class budget is stated in TRIANGLES, the same unit the gate measures in, so the
  // finished mesh is held to the budget it was actually asked for.
  const targetFaces = assetClass ? polycountFor(assetClass)?.faceLimit : undefined;
  const outputPath = finishOutputPath(safeName, args.now ?? Date.now(), args.cwd ?? process.cwd());
  if (!outputPath) return { ok: false, reason: `could not build a safe output path for "${safeName}"` };

  const spec: MeshFinishSpec = {
    highPolyPath: join(args.cwd ?? process.cwd(), 'generated', dir.dir, safeName).replace(/\\/g, '/'),
    outputPath,
    ...(targetFaces !== undefined ? { targetFaces } : {}),
    unwrap: true,
    bake: ['normal', 'ao'],
    // cullInterior is NEVER set — see the header. Not a default, a refusal.
  };

  const addresses = assessment.finishResolvable;
  const unaddressed = assessment.unaddressed;
  return {
    ok: true,
    spec,
    addresses,
    unaddressed,
    note: unaddressed.length
      ? `finishing addresses ${addresses.join(', ')}; ${unaddressed.join(', ')} will still fail afterwards`
      : `finishing addresses every failing criterion (${addresses.join(', ')}); the re-grade decides, not this plan`,
  };
}

export interface RemediationOutcome {
  /** The verdict that triggered the route. */
  before: { verdict: string; score: number; failCodes: FindingCode[] };
  /** The verdict on the FINISHED mesh, graded at stage `finished`. */
  after?: { verdict: string; score: number; failCodes: FindingCode[] };
  /** True only when the after-verdict is strictly better than the before-verdict. */
  improved: boolean;
  /** One line, safe to print verbatim. Says "not re-graded" when there is no after. */
  summary: string;
}

const RANK: Record<string, number> = { fail: 0, warn: 1, pass: 2 };

function codesOf(c: CritiqueResult | undefined): FindingCode[] {
  return (c?.findings ?? []).filter((f) => f.severity === 'fail').map((f) => f.code);
}

/**
 * Compare the before/after verdicts of a routed finish. Pure.
 *
 * `improved` is deliberately strict and deliberately NOT "the finish ran": a finish that
 * completed and left the mesh failing is reported as a completed finish that did not fix
 * it. A missing after-verdict is never treated as an improvement.
 */
export function summarizeRemediation(before: CritiqueResult, after: CritiqueResult | undefined): RemediationOutcome {
  const b = { verdict: before.verdict ?? 'unknown', score: before.score ?? 0, failCodes: codesOf(before) };
  if (!after?.ok || after.verdict === undefined) {
    return {
      before: b,
      improved: false,
      summary: `finished mesh was NOT re-graded (${after?.error ?? 'no critique'}) — the before-verdict "${b.verdict}" still stands, and nothing here says the mesh improved`,
    };
  }
  const a = { verdict: after.verdict, score: after.score ?? 0, failCodes: codesOf(after) };
  const improved = RANK[a.verdict] > RANK[b.verdict];
  const resolved = b.failCodes.filter((c) => !a.failCodes.includes(c));
  const introduced = a.failCodes.filter((c) => !b.failCodes.includes(c));
  return {
    before: b,
    after: a,
    improved,
    summary: [
      `${b.verdict} (${b.score}) -> ${a.verdict} (${a.score})`,
      resolved.length ? `resolved: ${resolved.join(', ')}` : 'resolved: nothing',
      introduced.length ? `INTRODUCED: ${introduced.join(', ')}` : null,
    ].filter(Boolean).join(' · '),
  };
}
