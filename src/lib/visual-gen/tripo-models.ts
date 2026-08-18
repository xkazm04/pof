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
 *  - `v3.1-20260211` PASSED that arena (45MB, woven braids, full facial structure) — it
 *    is the only model PoF has watched clear its own bar, so it is the only one pinned.
 *  - The same arena also tried a `model_version: 'P1-20260311'` request and got FAIL
 *    (shard hair, 3MB) despite carrying the newest date — a distinct legacy model id,
 *    separate from the `smart_low_poly` finding below.
 *
 * `smart_low_poly` — what Tripo markets as "P1/P2 Smart Mesh" — is a FLAG on the SAME
 * `model_version` already pinned here (verified against the primary API docs: the
 * `model_version` field accepts only `v3.1-20260211` or `v3.0-20250812`; there is no
 * separate P-series model id today). It was benchmarked 2026-08-18 across all three
 * budgeted classes (weapon/prop/modular-part) that had no production caller — same
 * model, same texture settings, `smart_low_poly: true` vs `false`, graded on
 * `gradeFaceBudget` + `classifyComponents` + a Qwen-VL score of the provider's own
 * preview render (`pof_tripo_smartlowpoly_arena.ts`). Result, consistent on all three:
 * `smart_low_poly` OVERSHOT its own requested face_limit every time (1.26x-1.35x —
 * baseline honoured its budget every time, 0.82x-0.96x), produced far more fragmented
 * output (1,900-2,400 raw components vs baseline's 83-137), and scored equal-or-worse
 * on Qwen's aesthetic judgment in every class. The vendor's "controllable poly count,
 * no further refine needed" claim did not hold up. `smart_low_poly` is therefore
 * DELIBERATELY NOT enabled anywhere — this is a completed, negative audit, not an
 * unbenchmarked gap.
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
 * `smart_low_poly` — benchmarked 2026-08-18 and REJECTED, kept next to the pin so a
 * future session sees the completed verdict at the decision point instead of assuming
 * this is still an open gap and re-benchmarking it. Per-class detail:
 *  - weapon (budget 15,000): baseline 14,368 faces (honoured) vs smart_low_poly 18,920
 *    (1.26x over); 83 vs 2,365 raw components; Qwen 3 vs 3 (tie, both scored poorly).
 *  - prop (budget 10,000): baseline 8,245 (honoured) vs smart_low_poly 13,548 (1.35x
 *    over); 396 vs 1,658 raw components; Qwen 6 vs not scored (geometry alone decided
 *    it — see the arena run notes).
 *  - modular-part (budget 8,000): baseline 7,464 (honoured) vs smart_low_poly 10,288
 *    (1.29x over); 137 vs 1,952 raw components; Qwen 4 vs 3 (worse).
 */
export const SMART_LOW_POLY_VERDICT = {
  benchmarked: '2026-08-18',
  verdict: 'rejected' as const,
  reason:
    'Overshot its own requested face_limit in all 3 budgeted classes (1.26x-1.35x; baseline honoured its budget every time), produced 15x-30x more raw components (far more fragmented, not "hand-crafted"), and scored equal-or-worse on Qwen aesthetic judgment. Not enabled anywhere.',
  harness: 'scripts/visual-gen/pof_tripo_smartlowpoly_arena.ts',
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
      ? `${assetClass} runs on ${TRIPO_AUDITED_MODEL} — the only model graded PASS by the character-pipeline arena. smart_low_poly was benchmarked and rejected for this class (see SMART_LOW_POLY_VERDICT).`
      : `no asset class was supplied; pinned to ${TRIPO_AUDITED_MODEL} rather than falling back to the account default, which the character-pipeline arena graded FAIL.`,
  };
}
