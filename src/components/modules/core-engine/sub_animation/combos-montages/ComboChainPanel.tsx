'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { withOpacity, OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT, COMBO_CHAIN_NODES, ALL_MONTAGES } from '../_shared/data';
import { ScalableSelector, type SelectorItem } from '@/components/shared/ScalableSelector';
import { ComboChainGraphSvg } from './ComboChainGraphSvg';

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
  const pagedNodes = useMemo(
    () => COMBO_CHAIN_NODES.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [page],
  );

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
        <ComboChainGraphSvg
          pagedNodes={pagedNodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
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
