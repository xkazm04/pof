import type { SubModuleId } from '@/types/modules';
import { SUB_GENRE_TEMPLATES } from '@/lib/genre-evolution-engine';
import { TOPOLOGY_ROOMY, getNodeCenter as getCenter } from '@/components/modules/evaluator/_shared/moduleTopology';
import { ITEM_PREFIX_TO_MODULE } from './constants';

export function getNodeCenter(moduleId: SubModuleId) {
  return getCenter(moduleId, TOPOLOGY_ROOMY);
}

export function itemIdToModule(itemId: string): string | undefined {
  // Try longest prefix first (acb before ac)
  for (const prefix of ['acb', 'apl', 'ac', 'aa', 'ag', 'ae', 'ai', 'al', 'au', 'ap', 'aw', 'as']) {
    if (itemId.startsWith(prefix + '-')) return ITEM_PREFIX_TO_MODULE[prefix];
  }
  return undefined;
}

// Count genre priority items per module across all templates
export function computeGenreCoverage(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const template of SUB_GENRE_TEMPLATES) {
    for (const itemId of template.priorityItems) {
      const mod = itemIdToModule(itemId);
      if (mod) counts[mod] = (counts[mod] ?? 0) + 1;
    }
  }
  return counts;
}
