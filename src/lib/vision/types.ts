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

export interface VisionRequest {
  images: VisionImage[];
  prompt: string;
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
  recognize(req: VisionRequest): Promise<VisionAnswer>;
}
