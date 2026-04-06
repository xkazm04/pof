'use client';

import { BT_NODES, BT_EDGES } from '../data';
import { ACCENT_EMERALD, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const nodeCount = BT_NODES.length;

function computeDepth(): number {
  const children = new Map<string, string[]>();
  for (const e of BT_EDGES) {
    const list = children.get(e.from) ?? [];
    list.push(e.to);
    children.set(e.from, list);
  }
  const roots = BT_NODES.filter(n => !BT_EDGES.some(e => e.to === n.id));
  let maxDepth = 0;

  function walk(id: string, depth: number) {
    if (depth > maxDepth) maxDepth = depth;
    for (const child of children.get(id) ?? []) {
      walk(child, depth + 1);
    }
  }

  for (const root of roots) walk(root.id, 1);
  return maxDepth;
}

const depth = computeDepth();

export function BehaviorTreeMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT_EMERALD }}>{nodeCount}</span>
      <span style={{ color: withOpacity(ACCENT_EMERALD, OPACITY_50) }}> nodes / </span>
      <span className="font-bold" style={{ color: ACCENT_EMERALD }}>{depth}</span>
      <span style={{ color: withOpacity(ACCENT_EMERALD, OPACITY_50) }}> depth</span>
    </div>
  );
}
