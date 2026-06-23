/**
 * Animation aesthetic critique — the aesthetic-truth ruler for the autonomous loop.
 * Captures' GAMEPLAY truth is measured by the test-gate-runner; this measures whether
 * a motion LOOKS believable. Multi-frame filmstrip → scored, dimensional, actionable card.
 *
 * Pure cores (prompt/parse/score/filmstrip) are unit-tested; the model call (gemini) is the
 * one injectable I/O seam, mirroring visual-gen/mesh-critique.
 */
export { buildCritiquePrompt, type AnimationContext } from './prompt';
export { parseCritique, type ParsedCritique } from './parse';
export { scoreCard, DEFAULT_THRESHOLDS, type CritiqueDimensions, type ScoreThresholds, type Scorecard } from './score';
export { resolveFilmstrip, type FilmstripOptions } from './filmstrip';
export {
  critiqueAnimation,
  type AnimationCritiqueCard,
  type CritiqueResult,
  type CritiqueDeps,
  type VisionImage,
} from './critique';
export { makeGeminiVision, type GeminiVisionOptions } from './gemini';
