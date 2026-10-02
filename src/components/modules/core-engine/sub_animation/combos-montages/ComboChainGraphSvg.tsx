'use client';

import { useId, useMemo } from 'react';
import { STATUS_ERROR, ACCENT_CYAN, withOpacity, OPACITY_8, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { ACCENT } from '../_shared/data';
import { VERDICT_COLOR, type ComboGraph, type ComboGraphEdge } from './useComboChains';

interface ComboChainGraphSvgProps {
  graph: ComboGraph;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
  selectedEdgeId?: string | null;
  onSelectEdge?: (id: string | null) => void;
}

const NODE_W = 98;
const NODE_GAP = 96;
const NODE_Y = 47;

const edgeColor = (edge: ComboGraphEdge) => (edge.link ? VERDICT_COLOR[edge.link.verdict] : ACCENT);

/**
 * SVG combo-chain visualization of one chain. A derived edge is drawn in its
 * verdict color with its window in seconds and is clickable; a template edge
 * carries only its fixture label and no verdict.
 */
export function ComboChainGraphSvg({ graph, selectedNodeId, onSelectNode, selectedEdgeId, onSelectEdge }: ComboChainGraphSvgProps) {
  const markerBase = useId().replace(/:/g, '');
  const layoutNodes = useMemo(() => graph.nodes.map((node, i) => ({
    ...node,
    lx: i * (NODE_W + NODE_GAP),
    ly: NODE_Y,
  })), [graph.nodes]);
  const layoutNodeMap = useMemo(() => new Map(layoutNodes.map((n) => [n.id, n])), [layoutNodes]);
  const colors = useMemo(() => [...new Set(graph.edges.map(edgeColor))], [graph.edges]);
  const markerId = (color: string) => `${markerBase}-arrow-${colors.indexOf(color)}`;

  const svgWidth = Math.max(400, layoutNodes.length * (NODE_W + NODE_GAP) - NODE_GAP + 10);

  return (
    <svg width={svgWidth} height={110} viewBox={`0 0 ${svgWidth} 110`}>
      <defs>
        {colors.map((c) => (
          <marker key={c} id={markerId(c)} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill={c} />
          </marker>
        ))}
      </defs>
      {graph.edges.map((edge) => {
        const from = layoutNodeMap.get(edge.from);
        const to = layoutNodeMap.get(edge.to);
        if (!from || !to) return null;
        const x1 = from.lx + NODE_W;
        const x2 = to.lx;
        const y = from.ly;
        const mid = (x1 + x2) / 2;
        const color = edgeColor(edge);
        const link = edge.link;
        const selected = !!link && selectedEdgeId === edge.id;
        const body = (
          <>
            <rect x={x1} y={y - 24} width={x2 - x1} height={47} fill="transparent" />
            <line x1={x1} y1={y} x2={x2 - 2} y2={y} stroke={color} strokeWidth={selected ? 3.5 : 2} markerEnd={`url(#${markerId(color)})`} />
            <text x={mid} y={y - 8} textAnchor="middle" className="text-xs font-mono" fill={link ? color : ACCENT_CYAN}>{edge.label}</text>
            {link && (
              <text data-testid="combo-link-verdict" x={mid} y={y + 16} textAnchor="middle" className="text-xs font-mono font-bold" fill={color}>
                {link.verdict}
              </text>
            )}
          </>
        );
        if (!link) return <g key={edge.id}>{body}</g>;
        return (
          <g
            key={edge.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${link.from} → ${link.to}: ${link.verdict}, window ${edge.label}`}
            className="cursor-pointer"
            onClick={() => onSelectEdge?.(selected ? null : edge.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectEdge?.(selected ? null : edge.id); } }}
          >
            {body}
          </g>
        );
      })}
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
            <text x={cx} y={node.ly + 4} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]">{node.sub}</text>
            {node.badge && (
              <text x={cx} y={node.ly + 16} textAnchor="middle" className="text-xs font-mono font-bold" fill={STATUS_ERROR}>
                {node.badge}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
