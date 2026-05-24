'use client';

import { useMemo } from 'react';
import { STATUS_ERROR, ACCENT_CYAN, withOpacity, OPACITY_8, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { ACCENT, COMBO_CHAIN_NODES, COMBO_CHAIN_EDGES } from '../_shared/data';

interface ComboChainGraphSvgProps {
  pagedNodes: typeof COMBO_CHAIN_NODES;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
}

const NODE_W = 98;
const NODE_GAP = 36;
const NODE_Y = 47;

/**
 * SVG combo-chain visualization. Extracted from ComboChainPanel.tsx
 * to keep that file under 200 LOC.
 */
export function ComboChainGraphSvg({ pagedNodes, selectedNodeId, onSelectNode }: ComboChainGraphSvgProps) {
  // Compute SVG layout: reposition nodes sequentially with consistent spacing
  const layoutNodes = useMemo(() => pagedNodes.map((node, i) => ({
    ...node,
    lx: i * (NODE_W + NODE_GAP),
    ly: NODE_Y,
  })), [pagedNodes]);

  const svgWidth = Math.max(400, layoutNodes.length * (NODE_W + NODE_GAP) - NODE_GAP + 10);

  // Only show edges whose both endpoints are on the current page
  const pageNodeIds = useMemo(() => new Set(pagedNodes.map(n => n.id)), [pagedNodes]);
  const pagedEdges = useMemo(
    () => COMBO_CHAIN_EDGES.filter(e => pageNodeIds.has(e.from) && pageNodeIds.has(e.to)),
    [pageNodeIds],
  );
  const layoutNodeMap = useMemo(() => {
    const map = new Map<string, typeof layoutNodes[0]>();
    for (const n of layoutNodes) map.set(n.id, n);
    return map;
  }, [layoutNodes]);

  return (
    <svg width={svgWidth} height={110} viewBox={`0 0 ${svgWidth} 110`}>
      <defs>
        <marker id="combo-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill={ACCENT} />
        </marker>
      </defs>
      {/* Edges (arrows) */}
      {pagedEdges.map((edge) => {
        const from = layoutNodeMap.get(edge.from);
        const to = layoutNodeMap.get(edge.to);
        if (!from || !to) return null;
        const x1 = from.lx + NODE_W - 5;
        const x2 = to.lx;
        const y = from.ly;
        return (
          <g key={`${edge.from}-${edge.to}`}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={ACCENT} strokeWidth="2" markerEnd="url(#combo-arrow)" />
            <text x={(x1 + x2) / 2} y={y - 10} textAnchor="middle" className="text-xs font-mono" fill={ACCENT_CYAN}>{edge.window}</text>
          </g>
        );
      })}
      {/* Nodes */}
      {layoutNodes.map((node) => {
        const isSelected = selectedNodeId === node.id;
        const cx = node.lx + NODE_W / 2;
        return (
          <g key={node.id} onClick={() => onSelectNode?.(isSelected ? null : node.id)} className="cursor-pointer">
            <rect x={node.lx} y={node.ly - 24} width={NODE_W} height={47} rx={6}
              fill={isSelected ? withOpacity(ACCENT, OPACITY_20) : withOpacity(ACCENT, OPACITY_8)}
              stroke={isSelected ? ACCENT : withOpacity(ACCENT, OPACITY_30)}
              strokeWidth={isSelected ? 2.5 : 1.5} />
            <text x={cx} y={node.ly - 9} textAnchor="middle" className="text-xs font-bold fill-[var(--text)]" style={{ fontSize: 12 }}>{node.name}</text>
            <text x={cx} y={node.ly + 2} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]">{node.montage}</text>
            <text x={cx} y={node.ly + 13} textAnchor="middle" className="text-xs font-mono font-bold" fill={STATUS_ERROR}>
              {node.damage} dmg
            </text>
          </g>
        );
      })}
    </svg>
  );
}
