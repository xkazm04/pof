import type { BtTreeNode } from '../_shared/data';
import { BT_TREE } from '../_shared/data';

export const SHAPE_LABELS: Record<BtTreeNode['shape'], string> = {
  diamond: 'Selector',
  rect: 'Sequence',
  rounded: 'Task',
  hexagon: 'Decorator',
};

export const INDENT = 20;

/** Build a lookup map from BT_TREE for O(1) access. */
export const NODE_MAP = new Map(BT_TREE.map(n => [n.id, n]));

/** Collect all descendant IDs for a given node. */
export function getDescendants(id: string): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const node = NODE_MAP.get(current);
    if (node) {
      for (const child of node.children) {
        if (!result.has(child)) {
          result.add(child);
          stack.push(child);
        }
      }
    }
  }
  return result;
}

export interface FlatRow {
  node: BtTreeNode;
  depth: number;
  hasChildren: boolean;
}
