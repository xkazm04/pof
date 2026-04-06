'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { ACCENT_CYAN, STATUS_ERROR, withOpacity, OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, COMBO_CHAIN_NODES, COMBO_CHAIN_EDGES, ALL_MONTAGES } from '../data';
import { ScalableSelector, type SelectorItem } from '@/components/shared/ScalableSelector';

interface ComboChainPanelProps {
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
}

/** Montage item for ScalableSelector - uses index signature for compatibility. */
type MontageItem = SelectorItem & {
  name: string;
  category: string;
  totalFrames: number;
  fps: number;
  memorySizeMB: number;
  hasRootMotion: boolean;
  blendInTime: number;
};

const PAGE_SIZE = 10;

export function ComboChainPanel({ selectedNodeId, onSelectNode }: ComboChainPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedMontages, setPickedMontages] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const montageItems: MontageItem[] = useMemo(
    () => ALL_MONTAGES.map(m => ({
      id: m.id,
      name: m.name,
      category: m.category,
      totalFrames: m.totalFrames,
      fps: m.fps,
      memorySizeMB: m.memorySizeMB,
      hasRootMotion: m.hasRootMotion,
      blendInTime: m.blendInTime,
    } as MontageItem)),
    [],
  );

  const handleSelect = useCallback((items: MontageItem[]) => {
    setPickedMontages(items.map(i => i.id));
  }, []);

  const renderMontageItem = useCallback((item: MontageItem, selected: boolean) => (
    <div
      className="px-3 py-2 rounded-lg border text-xs font-mono cursor-pointer transition-all"
      style={{
        backgroundColor: selected ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
        borderColor: selected ? withOpacity(ACCENT, OPACITY_30) : 'var(--border)',
      }}
    >
      <div className="font-bold text-text">{item.name}</div>
      <div className="text-text-muted">{item.category} &middot; {item.totalFrames}f &middot; {item.memorySizeMB.toFixed(1)} MB</div>
    </div>
  ), []);

  const totalPages = Math.ceil(COMBO_CHAIN_NODES.length / PAGE_SIZE);
  const pagedNodes = COMBO_CHAIN_NODES.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Compute SVG layout: reposition nodes sequentially with consistent spacing
  const NODE_W = 98;
  const NODE_GAP = 36;
  const NODE_Y = 47;
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
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="flex items-center justify-between mb-1">
        <SectionHeader label="Combo Chain Graph" color={ACCENT} />
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer hover:bg-surface-hover"
          style={{ borderColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}
        >
          <Plus className="w-3 h-3" />
          Pick Montage
        </button>
      </div>
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Attack combo sequence with damage values and combo window timing between nodes.
      </p>

      {/* Picked montages pills */}
      {pickedMontages.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {pickedMontages.map(id => {
            const m = ALL_MONTAGES.find(x => x.id === id);
            if (!m) return null;
            return (
              <span key={id} className="px-2 py-0.5 rounded text-xs font-mono border"
                style={{ borderColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT, backgroundColor: withOpacity(ACCENT, OPACITY_8) }}>
                {m.name}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex justify-center overflow-x-auto min-h-[200px]">
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className="w-6 h-6 rounded text-xs font-mono transition-colors cursor-pointer"
              style={page === i
                ? { backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}` }
                : { color: 'var(--text-muted)', border: '1px solid var(--border)' }
              }
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ScalableSelector modal */}
      <ScalableSelector
        items={montageItems}
        groupBy="category"
        renderItem={renderMontageItem}
        onSelect={handleSelect}
        selected={pickedMontages}
        searchKey="name"
        placeholder="Search montages..."
        mode="multi"
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Pick Montages for Combo Chain"
        accent={ACCENT}
      />
    </BlueprintPanel>
  );
}
