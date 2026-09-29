import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadLoreGraph, withLoreFacts, type LoreGraph } from '@/lib/catalog/reference/loreFacts';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export function loreGraphPath(): string {
  return process.env.POF_DIABLO_LORE_GRAPH ?? join(
    homedir(),
    'Documents',
    'Obsidian',
    'pof',
    'Diablo',
    'Research',
    'cx-b62-lore-graph-normalized.json',
  );
}

export function promotionLoreGraph(): LoreGraph {
  return loadLoreGraph(loreGraphPath());
}

/** Preserve the original wrappers and entities exactly when the external graph is absent. */
export function withPromotionLoreFacts(wrappers: readonly ReferenceWrapper[]): ReferenceWrapper[] {
  const graph = promotionLoreGraph();
  if (graph.entities.length === 0) return wrappers as ReferenceWrapper[];
  return wrappers.map((wrapper) => ({
    ...wrapper,
    entity: withLoreFacts(wrapper.entity, graph),
  }));
}
