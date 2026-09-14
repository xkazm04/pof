/**
 * The provider roster. Adapters over the seams PoF already has, so the chokepoint adds a
 * routing layer without re-implementing a single vendor call.
 *
 * `cannotHonour` is deliberately UNSET on all three today. It is the hook where a measured
 * request-level constraint lands — "this eye accepts N frames and reads one" is the worst
 * failure this layer can produce and must be enforced by the router — but no such constraint
 * has been MEASURED for these providers yet. Declaring one on suspicion would be an opinion
 * dressed as evidence, which is exactly what the arena exists to replace.
 */
import { makeQwenVisionAttributed } from '@/lib/anim-critique/qwen';
import type { VisionProvider } from '../types';
import { ollamaProvider } from './ollama';
import { geminiProvider } from './gemini';

/**
 * Qwen via Alibaba DashScope — a metered CLOUD eye, not a local one. Named `qwen-cloud`
 * rather than `qwen` on purpose: the id is the one place a reader learns that this rung
 * bills and ships pixels off the box, and `qwen` alone reads as the local option.
 */
export interface RosterOptions {
  /**
   * A caller's model pin, applied to every provider that takes one.
   *
   * A model name is VENDOR-SPECIFIC by nature, so a pin is implicitly a vendor choice: hand
   * `gemini-3.8-flash` to the DashScope chain and every model in it fails, which lands in the
   * trail as `call-failed` rather than silently serving something else. That is the honest
   * shape — the alternative, letting each provider ignore a pin it does not recognise, is an
   * answer from a model the caller did not ask for and cannot tell apart.
   */
  model?: string;
}

export function qwenCloudProvider(opts: RosterOptions = {}): VisionProvider {
  const call = makeQwenVisionAttributed({ ...(opts.model ? { model: opts.model } : {}) });
  return {
    id: 'qwen-cloud',
    // MULTI-FRAME IS DECLARED because it is what already shipped: `critiqueAnimation` has been
    // sending N-frame filmstrips down this seam since before the chokepoint existed. This
    // records a fact, it does not claim a measurement.
    capabilities: ['recognize', 'recognize-multiframe'],
    isConfigured: () => Boolean(process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY),
    recognize: (req) => call(req.images, req.prompt),
  };
}

/** Every provider the router can reach, in no particular order — the PLAN decides order. */
export function defaultProviders(opts: RosterOptions = {}): VisionProvider[] {
  return [ollamaProvider(opts), qwenCloudProvider(opts), geminiProvider(opts)];
}

export { ollamaProvider, geminiProvider };
