/**
 * Which Tripo model a generation runs on — and the honesty rule about which ones
 * PoF is allowed to pin.
 *
 * The app's generate route used to call `startTripoJob` with no `model_version`, so
 * every in-app generation ran on whatever the account default happened to be. PoF has
 * already recorded what that costs: the character pipeline's own arena
 * (`catalog/pipelines/character-pipeline.ts`) graded `v2.5-20250123 (default)` as
 * "FAIL — smeared face; the silent default, never leave model_version unset". An
 * unpinned model is an unaudited engine, and an unaudited engine is not a trusted one.
 *
 * Two verdicts from that same arena are encoded here:
 *  - `v3.1-20260211` PASSED (45MB, woven braids, full facial structure) — it is the only
 *    model PoF has watched clear its own bar, so it is the only one pinned.
 *  - `P1-20260311` FAILED as a hero model *despite carrying the newest date*. That is the
 *    trap worth naming: the P-series ("Smart Mesh", P1 → P2) is a separate TOPOLOGY tier
 *    — quad output, a controllable poly budget, seconds-fast, topology-only with
 *    texturing as a second pass — not a newer general-purpose model. Picking it by date
 *    is how PoF got a shard-haired 3MB character out of a hero-tier request.
 *
 * So the P-series is NOT pinned here. It is a real candidate for the budgeted classes
 * (weapon / prop / modular-part), and this file is where that pin belongs — once someone
 * has actually benchmarked it, the way v3.1 was benchmarked. Recording an unbenchmarked
 * id would be inventing an audit, which is the failure this module exists to prevent.
 */

/** The one model PoF has observed clear its own hero-tier gate. */
export const TRIPO_AUDITED_MODEL = 'v3.1-20260211';

/** Texture fidelity both recorded pass recipes call for. */
export const TRIPO_AUDITED_TEXTURE_QUALITY = 'detailed' as const;

export interface TripoModelPin {
  modelVersion: string;
  textureQuality: 'standard' | 'detailed';
  /** True only when this exact pairing has been graded by a PoF arena run. */
  audited: boolean;
  rationale: string;
}

/**
 * The candidate PoF deliberately has not pinned, kept next to the pin so the gap is
 * visible at the decision point instead of living in a commit message.
 */
export const UNAUDITED_TOPOLOGY_TIER = {
  family: 'Tripo P-series (Smart Mesh: P1, P2)',
  offers: 'quad topology, a controllable face budget, ~seconds per mesh, topology-only (texturing is a separate pass)',
  whyNotPinned:
    'P1-20260311 was graded FAIL as a hero model despite the newest date — the P-series is a low-poly topology tier, not a newer general model. It is a genuine candidate for the budgeted classes (weapon / prop / modular-part), but pinning an id nobody has benchmarked would fabricate an audit.',
  blockedOn: 'a PoF arena run over the budgeted classes, graded the way v3.1-20260211 was',
} as const;

/**
 * Resolve the model pin for a generation. Every class resolves to the audited pairing —
 * including an unknown or absent class, because "unknown class" must not degrade back
 * into the silent account default that this module exists to eliminate.
 */
export function tripoModelFor(assetClass?: string): TripoModelPin {
  return {
    modelVersion: TRIPO_AUDITED_MODEL,
    textureQuality: TRIPO_AUDITED_TEXTURE_QUALITY,
    audited: true,
    rationale: assetClass
      ? `${assetClass} runs on ${TRIPO_AUDITED_MODEL} — the only model graded PASS by the character-pipeline arena. The P-series topology tier is a candidate for the budgeted classes but is not benchmarked (see UNAUDITED_TOPOLOGY_TIER).`
      : `no asset class was supplied; pinned to ${TRIPO_AUDITED_MODEL} rather than falling back to the account default, which the character-pipeline arena graded FAIL.`,
  };
}
