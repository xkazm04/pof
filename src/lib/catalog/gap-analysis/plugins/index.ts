import type { GapAnalysisPlugin } from './types';

const PLUGINS: Record<string, GapAnalysisPlugin> = {};

export function pluginFor(catalogId: string): GapAnalysisPlugin | undefined {
  return PLUGINS[catalogId];
}

export function register(catalogId: string, plugin: GapAnalysisPlugin): void {
  PLUGINS[catalogId] = plugin;
}
