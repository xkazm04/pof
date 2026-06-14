/**
 * Shared rule fragments for prompt builders.
 *
 * Single source of truth for boilerplate `extraRules` / best-practice strings
 * that were previously copy-pasted (byte-identically) across many builders.
 * Each constant below is the EXACT literal those builders already emitted — no
 * wording was changed, so importing these does not alter any generated prompt.
 *
 * NOTE: Builders whose rule text has *drifted* (e.g. the "the code files"
 * variant of GENERATE_ALL_DIRECTLY, or "Use MetaSounds …" phrasings, or the
 * "Expose all parameters as …" variant) intentionally keep their own inline
 * literals — folding them onto a shared constant would change their output.
 */

/** Emitted verbatim by ~11 builders as the first `extraRule`. */
export const GENERATE_ALL_DIRECTLY =
  'Generate all code files directly — do NOT ask for confirmation.';

/** The singular-scope variant used by audio-scene zone/soundscape + level-design room codegen. */
export const GENERATE_THE_DIRECTLY =
  'Generate the code files directly — do NOT ask for confirmation.';

/** Shared by material-configurator + style-transfer (exact match only). */
export const USE_MATERIAL_BEST_PRACTICES =
  'Use UE5 Material system best practices.';

/** Shared by material-configurator + style-transfer (exact match only). */
export const MATERIAL_UPROPERTY_TUNING =
  'All parameters must be UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.';
