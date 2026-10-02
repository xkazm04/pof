/**
 * Tier-1 motion gate — cheap, exact, numeric checks on generated motion data.
 *
 * Runs BEFORE the Tier-2 VLM aesthetic pass in `@/lib/anim-critique`: a clip that fails
 * a numeric invariant (does not loop, feet skate, root discontinuous) should never cost a
 * filmstrip render plus a vision-model call to find that out. That composition is real —
 * `@/lib/anim-critique/tier1` resolves this gate and `critiqueAnimation` consults it before
 * the vision call — and the two verdicts are reported side by side (integrity vs craft),
 * never averaged into one number.
 *
 * Loop closure is the first check. Foot-contact and root-continuity checks — named in
 * `docs/research/ardy-text-to-motion-spec.md` as the rest of the Tier-1 gate — slot in here
 * beside it.
 *
 * The gate measures the clip ITSELF: `readNpz` reads the `.npz` in-process (numpy's
 * force_zip64 shape, resolved through the central directory, pickle refused) and
 * `measureClip` ports the extractor's root-relative math, returning the sha256 of the bytes
 * it measured. The pasted-marker seam (`parseLoopMetrics`) remains as a labelled legacy input.
 */
export {
  scoreLoopClosure,
  parseLoopMetrics,
  critiqueLoop,
  DEFAULT_LOOP_THRESHOLDS,
  type LoopMetrics,
  type LoopThresholds,
  type LoopIntent,
  type LoopVerdict,
  type LoopScorecard,
  type ParsedLoopMetrics,
} from './loopClosure';
export { readNpz, npyNumbers, type NpzArchive, type NpyArray, type NpyDtype } from './npz';
export {
  measureClip,
  sha256Hex,
  type ClipSource,
  type MeasuredClip,
  type MeasureClipOptions,
} from './measureClip';
