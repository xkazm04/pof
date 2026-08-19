/**
 * Tier-1 motion gate — cheap, exact, numeric checks on generated motion data.
 *
 * Runs BEFORE the Tier-2 VLM aesthetic pass in `@/lib/anim-critique`: a clip that fails
 * a numeric invariant (does not loop, feet skate, root discontinuous) should never cost a
 * filmstrip render plus a vision-model call to find that out.
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
