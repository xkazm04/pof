import type { GapAnalysisPlugin } from './types';

// A Map, not an object literal: `pluginFor('constructor')` must not resolve Object.prototype
// members as plugins (catalogId arrives from request bodies).
const PLUGINS = new Map<string, GapAnalysisPlugin>();

export function pluginFor(catalogId: string): GapAnalysisPlugin | undefined {
  return PLUGINS.get(catalogId);
}

export function register(catalogId: string, plugin: GapAnalysisPlugin): void {
  PLUGINS.set(catalogId, plugin);
}
