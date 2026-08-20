/**
 * Stage awareness for the Tier-1 mesh gate — WHAT the scorecard was actually grading,
 * and what could actually change it.
 *
 * ── The claim this module was built to test, and what measuring it found ──────────
 *
 * On record since 2026-08-14 (`docs/research/impact-map.md`, and repeated verbatim in
 * `scripts/visual-gen/pof_tripo_smartlowpoly_arena.ts`'s header): *"the Tier-1 gate reads
 * raw, pre-retopo provider output against FINISHED game-tier thresholds and fails it near
 * 100% of the time regardless of quality"* — and the shipped caveat attached to every
 * failing verdict said the mesh *"may fail on face count alone"*.
 *
 * Both halves were re-measured on 2026-08-20 against the operator's real corpus — all
 * **52 `.glb` files under `generated/`** (TripoSR, Tripo3D cloud, pipeline meshes),
 * metrics re-derived in Node straight from the glTF buffers and graded by this repo's own
 * `scoreMesh` at per-class thresholds. The result:
 *
 *   - **Face count NEVER fails a mesh.** `scoreMesh` files `face-count` as a WARN and has
 *     no fail rule for it at any threshold. A 1,492,072-face mesh graded against the
 *     `modular-part` ceiling of 12,000 scores **warn / 85**. The shipped caveat named a
 *     mechanism that does not exist in the code it was printed beside.
 *   - **The fail rate is 10 of 52 (19.2%), not "near 100%"** — and because this
 *     re-derivation welds vertices on exact position (trimesh welds with a tolerance), it
 *     can only ever find MORE components than the real critic, so 19.2% is an upper bound.
 *   - **Every single one of those 10 fails was `floaters`.** Not one was `face-count`, and
 *     not one was `parts-over-budget`. The recorded live Tripo verdict behind the original
 *     claim (4 independent rolls of one prompt, 0/100 each) is consistent: it names
 *     16-50 floater fragments and 35-56 substantial parts — floaters and parts, never
 *     face count.
 *   - **Retopo does not cure the dominant fail — it can worsen it.** Measured on one
 *     before/after pair in the corpus: `tripo3d/jinx_v32_run.glb` (1,482,446 faces, 2
 *     components, 1 floater) grades **warn**; its decimated game mesh
 *     `tripo3d/jinx_v32_run_game.glb` (46,791 faces, 17 components, **16 floaters**)
 *     grades **fail**. Decimation collapsed the face count and multiplied the specks.
 *
 * So the premise is right in SUBSTANCE (a post-finish bar is being applied to pre-finish
 * geometry, and nothing on disk has ever scored a `pass`) and wrong in MECHANISM. That is
 * why this module states the tier rather than re-tuning a face-count threshold: re-tuning
 * the number the claim blamed would have changed exactly zero verdicts.
 */
import type { CritiqueResult, Finding, FindingCode } from './mesh-critique';

/** Which stage of the pipeline produced the mesh being graded. */
export type MeshStage =
  /** Straight from a generator — pre-retopo, pre-unwrap, pre-bake. */
  | 'raw'
  /** After a `mesh-finish` pass (join → decimate → unwrap → bake). */
  | 'finished'
  /** The caller did not say. Never guessed — an unstated stage is reported as unstated. */
  | 'unknown';

/**
 * Defect classes a `mesh-finish` pass structurally resolves.
 *
 * `pof_mesh_finish.py` joins every part into one object and decimates to a face budget,
 * so a face/budget overrun and a multi-part count are exactly what it fixes. **`floaters`
 * is deliberately absent** — joining does not delete specks and decimation demonstrably
 * multiplies them (1 → 16 on the measured `jinx_v32_run` pair above). Listing it here
 * would let a routed finish claim a cure it does not deliver.
 */
export const FINISH_RESOLVES: readonly FindingCode[] = [
  'face-count',
  'budget-over',
  'parts-over-budget',
  'components-over-budget',
];

/**
 * Defect classes where paying for ANOTHER provider roll is a rational act.
 *
 * A generator returning nothing, or a flat/degenerate result, is a bad draw — a fresh roll
 * genuinely can come back different. Everything else in the list is determined by the
 * generation STAGE, not by the draw: raw output is dense and speck-ridden every time.
 * Recorded live, 4 independent rolls of one prompt, `assetClass: 'prop'`: 0/100 on all
 * four, 16-50 floaters and 35-56 parts on all four. Re-rolling those buys nothing but the
 * bill (20 Tripo credits per generation).
 */
export const REROLL_RESOLVES: readonly FindingCode[] = ['empty-mesh', 'degenerate-bbox'];

export interface StageAssessment {
  /** The stage the caller declared. `unknown` is reported, never inferred. */
  stage: MeshStage;
  /** Fail-severity codes a `mesh-finish` pass would resolve. */
  finishResolvable: FindingCode[];
  /** Fail-severity codes another paid generation could plausibly change. */
  rerollResolvable: FindingCode[];
  /** Fail-severity codes neither finishing nor re-rolling is known to fix. */
  unaddressed: FindingCode[];
  /**
   * True only when a mesh the caller declared `raw` is condemned SOLELY by criteria the
   * finish stage exists to satisfy — i.e. it is being held to a post-finish bar before
   * the post-finish step has run.
   */
  misTiered: boolean;
  /** Another paid roll could change this outcome. */
  rerollWorthwhile: boolean;
  /** A `mesh-finish` pass could change this outcome. */
  finishWorthwhile: boolean;
  /**
   * The honest sentence to print beside this verdict — DERIVED from the verdict's own
   * findings, never a blanket claim. `undefined` when there is no failing verdict to
   * caveat.
   */
  caveat?: string;
}

function failCodes(findings: Finding[] | undefined): FindingCode[] {
  const seen = new Set<FindingCode>();
  for (const f of findings ?? []) if (f.severity === 'fail') seen.add(f.code);
  return [...seen];
}

function list(codes: FindingCode[]): string {
  return codes.join(', ');
}

/**
 * Assess one critique against the stage the mesh is at. Pure.
 *
 * Display + routing only. It reads a verdict; it can never produce or soften one — there
 * is no path here that turns a `fail` into anything else, which is the property that keeps
 * "the gate is mis-tiered" from becoming "so ship it anyway".
 */
export function assessStage(critique: CritiqueResult | undefined, stage: MeshStage = 'unknown'): StageAssessment {
  const empty: StageAssessment = {
    stage,
    finishResolvable: [],
    rerollResolvable: [],
    unaddressed: [],
    misTiered: false,
    rerollWorthwhile: false,
    finishWorthwhile: false,
  };
  // No verdict was reached (critic absent, or it errored) — there is nothing to tier, and
  // a missing gate must not be dressed up as a calibration problem.
  if (!critique?.ok || critique.verdict === undefined) return empty;
  if (critique.verdict !== 'fail') return { ...empty, stage };

  const codes = failCodes(critique.findings);
  const finishResolvable = codes.filter((c) => FINISH_RESOLVES.includes(c));
  const rerollResolvable = codes.filter((c) => REROLL_RESOLVES.includes(c));
  const unaddressed = codes.filter((c) => !FINISH_RESOLVES.includes(c) && !REROLL_RESOLVES.includes(c));
  const misTiered = stage === 'raw' && codes.length > 0 && unaddressed.length === 0 && rerollResolvable.length === 0;

  return {
    stage,
    finishResolvable,
    rerollResolvable,
    unaddressed,
    misTiered,
    rerollWorthwhile: rerollResolvable.length > 0,
    finishWorthwhile: finishResolvable.length > 0,
    caveat: caveatFor(stage, codes, finishResolvable, unaddressed, misTiered),
  };
}

function caveatFor(
  stage: MeshStage,
  codes: FindingCode[],
  finishResolvable: FindingCode[],
  unaddressed: FindingCode[],
  misTiered: boolean,
): string | undefined {
  if (!codes.length) return undefined;
  if (misTiered) {
    return `graded PRE-FINISH geometry against post-finish thresholds — every failing criterion (${list(finishResolvable)}) is what the retopo/decimate stage exists to satisfy, so this verdict is about the stage, not the mesh`;
  }
  if (stage === 'raw' && finishResolvable.length) {
    return `stage: RAW (pre-retopo). ${list(finishResolvable)} is resolved by the retopo/decimate stage; ${list(unaddressed)} is not — finishing this mesh would not clear the gate`;
  }
  if (stage === 'unknown') {
    return `pipeline stage not declared, so this verdict cannot say whether ${list(codes)} is a defect or an un-finished input — declare the stage to get a tiered reading`;
  }
  return `stage: ${stage.toUpperCase()}. ${list(unaddressed)} is not resolved by the retopo/decimate stage`;
}
