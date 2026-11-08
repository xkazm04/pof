import type { GapAnalysisPlugin } from './types';

// A Map, not an object literal: `pluginFor('constructor')` must not resolve Object.prototype
// members as plugins (catalogId arrives from request bodies).
const PLUGINS = new Map<string, GapAnalysisPlugin>();

/** Longest description fallback a summary may carry (the prompt lists up to 5 samples). */
export const SUMMARY_FALLBACK_MAX = 80;

/**
 * A plugin's summary, or — when none of the fields it reads are present (generic starters carry
 * only `{ description }`) — the entity's description, bounded. Never an empty sample line.
 */
function withDescriptionFallback(summarize: GapAnalysisPlugin['summarize']): GapAnalysisPlugin['summarize'] {
  return (data: unknown): string => {
    const own = summarize(data);
    if (own) return own;
    const desc = data && typeof data === 'object' ? (data as Record<string, unknown>).description : undefined;
    if (typeof desc !== 'string' || !desc) return '';
    return desc.length > SUMMARY_FALLBACK_MAX ? `${desc.slice(0, SUMMARY_FALLBACK_MAX)}…` : desc;
  };
}

export function pluginFor(catalogId: string): GapAnalysisPlugin | undefined {
  return PLUGINS.get(catalogId);
}

export function register(catalogId: string, plugin: GapAnalysisPlugin): void {
  PLUGINS.set(catalogId, { ...plugin, summarize: withDescriptionFallback(plugin.summarize) });
}
