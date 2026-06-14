'use client';

import { BT_TREE } from '../_shared/data';
import { ACCENT_EMERALD, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const nodeCount = BT_TREE.length;

function computeDepth(): number {
  const children = new Map(BT_TREE.map(n => [n.id, n.children]));
  let maxDepth = 0;

  function walk(id: string, depth: number) {
    if (depth > maxDepth) maxDepth = depth;
    for (const child of children.get(id) ?? []) {
      walk(child, depth + 1);
    }
  }

  walk('root', 1);
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
