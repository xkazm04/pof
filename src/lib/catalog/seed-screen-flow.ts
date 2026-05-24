import { FLOW_NODES } from '@/components/modules/core-engine/unique-tabs/ScreenFlowMap/data';
import type { GraphNode } from '@/types/unique-tab-improvements';
import type { ScreenEntry } from './types';

/** Convert one FLOW_NODES graph node into a Screen entry. */
export function screenNodeToEntry(node: GraphNode): ScreenEntry {
  return {
    id: `screen-${node.id}`,
    catalogId: 'screen-flow',
    name: node.label,
    categoryPath: ['Screens', node.group ?? 'Misc'],
    tags: node.group ? [node.group] : [],
    lifecycle: 'planned',
    data: node,
  };
}

/** Seed the screen-flow catalog from FLOW_NODES. */
export function seedScreenEntries(): ScreenEntry[] {
  return FLOW_NODES.map(screenNodeToEntry);
}
