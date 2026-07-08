'use client';

import { Circle, Zap, Tag, Cable } from 'lucide-react';
import { STATUS_WARNING, STATUS_ERROR, ACCENT_VIOLET, ACCENT_EMERALD } from '@/lib/chart-colors';
import type { GASGraphNode, GraphWire } from '../types';

export function StatsBar({
  nodes, wires, nodeOverrides, setNodeOverrides,
}: {
  nodes: GASGraphNode[];
  wires: GraphWire[];
  nodeOverrides: Map<string, { x: number; y: number }>;
  setNodeOverrides: (v: Map<string, { x: number; y: number }>) => void;
}) {
  return (
    <div className="flex items-center gap-4 text-2xs font-mono text-text-muted px-1">
      <span className="flex items-center gap-1">
        <Circle className="w-2.5 h-2.5" style={{ color: ACCENT_VIOLET }} />
        {nodes.filter(n => n.type === 'attribute').length} attributes
      </span>
      <span className="flex items-center gap-1">
        <Zap className="w-2.5 h-2.5" style={{ color: STATUS_WARNING }} />
        {nodes.filter(n => n.type === 'effect').length} effects
      </span>
      <span className="flex items-center gap-1">
        <Tag className="w-2.5 h-2.5" style={{ color: STATUS_ERROR }} />
        {nodes.filter(n => n.type === 'tag-rule').length} rules
      </span>
      <span className="flex items-center gap-1">
        <Cable className="w-2.5 h-2.5" style={{ color: ACCENT_EMERALD }} />
        {wires.length} wires
      </span>
      {nodeOverrides.size > 0 && (
        <button
          onClick={() => setNodeOverrides(new Map())}
          className="ml-auto text-2xs font-mono px-1.5 py-0.5 rounded border border-border/40 text-text-muted hover:text-text hover:border-border/60 transition-colors"
        >
          Reset Layout
        </button>
      )}
    </div>
  );
}
