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

/**
 * The ONE Mixamo manual-download contract literal.
 *
 * It was stated twice in different words — once in the `mixamo-import` task
 * handler (`cli-task-handlers.ts`) and once, paraphrased, in the Animation
 * checklist builder's best-practices block — so the two could (and did) drift.
 * Both now render THIS text; only the surrounding heading differs, which is why
 * the heading is a separate constant.
 */
export const MIXAMO_DOWNLOAD_CONTRACT_HEADING =
  '**Manual-download contract (verify the FBX, do not re-download):**';

/** The contract bullets themselves (no heading — see the heading constant). */
export const MIXAMO_DOWNLOAD_CONTRACT = `- Files come from mixamo.com as **FBX Binary**, 30 FPS, one animation per file.
- The first/character download is "**With Skin**" (creates the mesh+skeleton);
  every animation is "**Without Skin**" to reuse one skeleton.
- Locomotion (idle/walk/run) is "**In Place**"; attacks/dodges keep root motion.
- Mixamo bones use the \`mixamorig:\` prefix — the pipeline strips/handles it on import.`;
