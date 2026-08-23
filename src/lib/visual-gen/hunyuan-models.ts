/**
 * Which Hunyuan3D model a generation runs on — and the honest record of how little
 * PoF actually knows about it.
 *
 * This mirrors `tripo-models.ts`, which exists because the app's generate route called
 * `startTripoJob` with no `model_version` and every in-app generation silently ran on
 * the account default. The Hunyuan path has the SAME hole and it is still open:
 * `HunyuanSpec.model` is plumbed end-to-end (`hunyuan-runner.ts` builds `--model` when
 * the spec carries it; `pof_hunyuan.py` defaults the flag to `tencent/Hunyuan3D-2`),
 * but the route's `startHunyuanJob(...)` call never passes it. So the model was chosen
 * by a default buried in a python argparse line, and nothing in the app ever said which
 * model produced a mesh.
 *
 * The Hunyuan case is in one way WORSE than Tripo's was. Tripo at least had a smoke CLI
 * where a model could be pinned by hand; there is no Hunyuan smoke CLI, so before this
 * module `spec.model` was reachable from exactly one place in the whole repo — a unit
 * test. Every Hunyuan mesh PoF has ever generated went on the unstated default.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not raise the tier. Hunyuan3D-2 is stated here
 * because it is what has actually been running, NOT because it was chosen. Pinning a
 * newer tier would repeat the original sin in the opposite direction: `tripo-models.ts`
 * earned `audited: true` from a real arena run that graded meshes PASS/FAIL, and by its
 * own rule ("an unpinned model is an unaudited engine, and an unaudited engine is not a
 * trusted one") an UN-ARENA'd pin is no more trustworthy than a silent default. PoF has
 * graded zero Hunyuan meshes — see `HUNYUAN_AUDIT_STATE` — so `audited` is false here
 * and must stay false until an arena run says otherwise.
 *
 * Licence note, unchanged by any of this: Hunyuan3D is NON-COMMERCIAL. TripoSR (MIT)
 * remains the commercial-safe local fallback behind the same interface. A newer Hunyuan
 * tier would not change that, and nothing here should be read as implying it does.
 */

/**
 * The model every Hunyuan generation has actually run on — the `--model` default in
 * `scripts/visual-gen/pof_hunyuan.py`. Stated, not chosen.
 */
export const HUNYUAN_RUNNING_MODEL = 'tencent/Hunyuan3D-2';

/**
 * What PoF has actually observed about Hunyuan output. Kept next to the model id so a
 * future session sees the evidence gap at the decision point rather than assuming the
 * `official: true` flag on the provider entry implies a graded engine.
 *
 * Measured 2026-08-23: `generated/hunyuan3d/` contained 0 files while the cloud fallback
 * `generated/tripo3d/` held 24 `.glb` and `generated/triposr/` held 18. PoF's declared
 * OFFICIAL image-to-3D provider has produced nothing on disk, so no arena — and no
 * `gradeFaceBudget` / `classifyComponents` / Qwen pass — has ever judged one.
 */
export const HUNYUAN_AUDIT_STATE = {
  measured: '2026-08-23',
  verdict: 'unaudited' as const,
  /** PoF arena runs that have compared Hunyuan model tiers. */
  arenaRuns: 0,
  /** Hunyuan meshes PoF has graded through its Tier-1 critique. */
  gradedMeshes: 0,
  /** `.glb` files present under `generated/hunyuan3d/` at measurement time. */
  meshesOnDisk: 0,
  reason:
    'The generate route never passed a model, so every run used the pof_hunyuan.py argparse default, and no generated mesh was ever attributed to a model tier. Nothing has been benchmarked; this is an open evidence gap, not a completed negative audit like SMART_LOW_POLY_VERDICT.',
} as const;

export interface HunyuanModelPin {
  model: string;
  /**
   * True only when this exact model has been graded by a PoF arena run. Currently
   * always false — see `HUNYUAN_AUDIT_STATE`. Callers may surface an unaudited engine,
   * but must never present it as a verified one.
   */
  audited: boolean;
  rationale: string;
}

/**
 * Resolve the model for a Hunyuan generation. Every class resolves to the same running
 * model — including an unknown or absent class, because "unknown class" must not
 * degrade back into the unstated script default this module exists to eliminate.
 *
 * The improvement this delivers is narrow and worth naming precisely: the model becomes
 * STATED and self-declaring-unaudited at the call site, instead of being decided
 * silently one layer below the app. It does not become better, and it does not become
 * trusted.
 */
export function hunyuanModelFor(assetClass?: string): HunyuanModelPin {
  return {
    model: HUNYUAN_RUNNING_MODEL,
    audited: false,
    rationale: assetClass
      ? `${assetClass} runs on ${HUNYUAN_RUNNING_MODEL} — stated explicitly rather than left to the pof_hunyuan.py script default. This model has never been graded by a PoF arena (see HUNYUAN_AUDIT_STATE), so it is stated, not endorsed.`
      : `no asset class was supplied; stated as ${HUNYUAN_RUNNING_MODEL} rather than falling back to the unstated script default. This model has never been graded by a PoF arena (see HUNYUAN_AUDIT_STATE).`,
  };
}
