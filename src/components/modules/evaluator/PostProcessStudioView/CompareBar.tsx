'use client';

import { SplitSquareHorizontal } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { PPStackSnapshot, ABSlot } from '@/types/post-process-studio';

// ── A/B Compare Bar ─────────────────────────────────────────────────────────

export function CompareBar({
  snapshotA,
  snapshotB,
  activeSlot,
  onCapture,
  onSetSlot,
  onLoad,
}: {
  snapshotA: PPStackSnapshot | null;
  snapshotB: PPStackSnapshot | null;
  activeSlot: ABSlot;
  onCapture: (slot: ABSlot) => void;
  onSetSlot: (slot: ABSlot) => void;
  onLoad: (slot: ABSlot) => void;
}) {
  return (
    <SurfaceCard className="p-3">
      <div className="flex items-center gap-3">
        <SplitSquareHorizontal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="text-xs font-medium text-text">A/B Compare</span>
        <div className="flex-1" />

        {/* Slot A */}
        <SlotChip
          label="A"
          snapshot={snapshotA}
          isActive={activeSlot === 'A'}
          onSelect={() => onSetSlot('A')}
          onCapture={() => onCapture('A')}
          onLoad={() => onLoad('A')}
        />

        <span className="text-2xs text-text-muted">vs</span>

        {/* Slot B */}
        <SlotChip
          label="B"
          snapshot={snapshotB}
          isActive={activeSlot === 'B'}
          onSelect={() => onSetSlot('B')}
          onCapture={() => onCapture('B')}
          onLoad={() => onLoad('B')}
        />
      </div>
    </SurfaceCard>
  );
}

function SlotChip({
  label,
  snapshot,
  isActive,
  onSelect,
  onCapture,
  onLoad,
}: {
  label: string;
  snapshot: PPStackSnapshot | null;
  isActive: boolean;
  onSelect: () => void;
  onCapture: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onSelect}
        className={`px-2 py-1 rounded text-2xs font-semibold border transition-colors ${
          isActive
            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
            : 'bg-surface border-border text-text-muted hover:text-text'
        }`}
      >
        {label}
      </button>
      {snapshot ? (
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted truncate max-w-20">{snapshot.label}</span>
          <span className="text-2xs font-mono text-text-muted/60">{snapshot.totalGpuMs.toFixed(1)}ms</span>
          <button onClick={onLoad} className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors">
            Load
          </button>
          <button onClick={onCapture} className="text-2xs text-text-muted hover:text-text transition-colors">
            Update
          </button>
        </div>
      ) : (
        <button onClick={onCapture} className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors">
          Capture
        </button>
      )}
    </div>
  );
}
