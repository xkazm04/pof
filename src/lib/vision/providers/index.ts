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
export function qwenCloudProvider(): VisionProvider {
  const call = makeQwenVisionAttributed();
  return {
    id: 'qwen-cloud',
    capabilities: ['recognize'],
    isConfigured: () => Boolean(process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY),
    recognize: (req) => call(req.images, req.prompt),
  };
}

/** Every provider the router can reach, in no particular order — the PLAN decides order. */
export function defaultProviders(): VisionProvider[] {
  return [ollamaProvider(), qwenCloudProvider(), geminiProvider()];
}

export { ollamaProvider, geminiProvider };
