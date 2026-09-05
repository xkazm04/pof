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
 * beside it against the same extracted-marker seam.
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
