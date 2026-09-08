/**
 * The vision chokepoint's vocabulary.
 *
 * A caller names a CAPABILITY; the plan decides which provider answers. Nothing outside
 * `router.ts` may name a provider and get it — that is the whole point of this module, and
 * it is what makes the operator's local-first policy a one-line table edit rather than an
 * edit to every gate that happens to look at an image.
 */
import type { VisionImage } from '@/lib/anim-critique/critique';
import type { VisionAnswer } from '@/lib/anim-critique/vision';

/** The closed capability vocabulary. `recognize` = read/judge pixels that already exist. */
export type VisionCapability = 'recognize';

/** Every provider the router can reach. A caller may steer among these; it may not add one. */
export type VisionProviderId = 'ollama' | 'qwen-cloud' | 'gemini';

/**
 * How hard the provider should think before answering.
 *
 * These three are the vocabulary because they are what the live API actually accepts —
 * probed against `gemini-3.8-flash` on 2026-09-08, where `none` / `minimal` / `max` are all
 * rejected with `Invalid value at generation_config.thinking_config.thinking_level`. Thought
 * spend scales monotonically across them (48 / 115 / 176 thought tokens on a fixed task), so
 * this is a real cost axis, not a label.
 *
 * It is deliberately a SHARED vocabulary rather than a per-vendor passthrough: a caller says
 * how hard the question is, and each provider maps that onto whatever knob it has. A provider
 * that cannot serve the level asked for does not silently serve a cheaper one — the answer
 * reports what was actually served (see `RoutedVisionAnswer.effortDowngraded`).
 */
export type VisionEffort = 'low' | 'medium' | 'high';

/** Ascending — the single source of effort order. */
export const EFFORT_ORDER: readonly VisionEffort[] = ['low', 'medium', 'high'] as const;

export interface VisionRequest {
  images: VisionImage[];
  prompt: string;
  /** How hard to think. Omitted ⇒ the provider's own default. */
  effort?: VisionEffort;
  /**
   * A JSON Schema the answer must satisfy. Where the provider can ENFORCE it (ollama's
   * `format` constrains decoding natively) the answer cannot be malformed; elsewhere it is
   * still the honest declaration of the shape the caller needs.
   *
   * Worth threading rather than leaving to each caller's regex: PoF currently strips fences
   * and hand-parses in at least three places, and every one of them is a chance for a model
   * that answered in prose to reach a checker as a shape error instead of a refusal.
   */
  schema?: Record<string, unknown>;
}

/**
 * The four ways a candidate drops out of the chain. Every one of them lands in the trail —
 * that is this module's single invariant. An asset outlives the process that made it, so
 * "why did the fallback answer this?" must stay answerable from the answer's own record.
 */
export type EliminationKind =
  /** the provider does not serve this capability at all */
  | 'no-capability'
  /** it serves the capability but cannot honour a field of THIS request */
  | 'unsupported-request'
  /** no key / no host on this machine */
  | 'not-configured'
  /** it was called and failed (transport, quota, or an empty answer) */
  | 'call-failed';

export interface Elimination {
  provider: VisionProviderId;
  kind: EliminationKind;
  detail: string;
}

/** A vision answer plus WHO served it and everything that dropped out first. */
export interface RoutedVisionAnswer extends VisionAnswer {
  provider: VisionProviderId;
  trail: Elimination[];
  /** The effort level actually served; undefined when the caller asked for none. */
  effortServed?: VisionEffort;
  /** True when the served effort differs from the one requested. Never silent. */
  effortDowngraded: boolean;
}

export interface VisionProvider {
  id: VisionProviderId;
  capabilities: VisionCapability[];
  /** Configured on THIS machine (a key, or for a local provider an address). */
  isConfigured(): boolean;
  /**
   * Can it honour this specific request? `null` = yes; a string = the reason it cannot,
   * which becomes an `unsupported-request` elimination BEFORE anything is billed.
   * This is the subtlest elimination and the one worth the most: a provider that accepts
   * five frames and silently reads one produces on-time, on-budget output that answers a
   * different question, with nothing anywhere reporting a problem.
   */
  cannotHonour?(req: VisionRequest): string | null;
  /**
   * The effort levels this provider can actually serve, ascending. Omitted ⇒ it has no
   * effort knob at all, and an effort request against it is reported as a downgrade rather
   * than quietly ignored — an ignored field is a routing constraint, not a preference.
   */
  effortLevels?: readonly VisionEffort[];
  recognize(req: VisionRequest): Promise<VisionAnswer>;
}
