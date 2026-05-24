import type { ClassNode } from '../_shared/data';

export function countNodes(node: ClassNode): number {
  let count = 1;
  if (node.children) for (const c of node.children) count += countNodes(c);
  return count;
}

export function countLeafTypes(node: ClassNode): Set<string> {
  const types = new Set<string>();
  if (node.subtitle) types.add(node.subtitle);
  if (node.children) for (const c of node.children) {
    for (const t of countLeafTypes(c)) types.add(t);
  }
  return types;
}
