'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Zap } from 'lucide-react';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { DodgeChainEntry } from '../dodge-types';
import { BlueprintPanel, SectionHeader } from '../_design';
import { DodgeChainTimeline } from './DodgeChainTimeline';

export function ChainControls({
  chainMode,
  chain,
  chainPlayhead,
  onSetChainMode,
  onBuildChain,
  onAddDodge,
  onRemoveLast,
  onScrub,
}: {
  chainMode: boolean;
  chain: DodgeChainEntry[];
  chainPlayhead: number;
  onSetChainMode: (v: boolean) => void;
  onBuildChain: (count: number) => void;
  onAddDodge: () => void;
  onRemoveLast: () => void;
  onScrub: (t: number) => void;
}) {
  return (
    <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <SectionHeader icon={Zap} label="Dodge Chain Simulator" color={ACCENT_EMERALD} />
        <div className="ml-auto flex items-center gap-1.5">
          {/* Quick chain buttons */}
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => { onSetChainMode(true); onBuildChain(n); }}
              className="px-2 py-1 rounded text-xs font-mono font-bold border transition-colors"
              style={{
                borderColor: chain.length === n && chainMode ? `${ACCENT_EMERALD}40` : 'rgba(255,255,255,0.08)',
                backgroundColor: chain.length === n && chainMode ? `${ACCENT_EMERALD}10` : 'transparent',
                color: chain.length === n && chainMode ? ACCENT_EMERALD : 'var(--text-muted)',
              }}
            >
              {n}\u00d7
            </button>
          ))}
          <button
            onClick={() => { if (chainMode) onAddDodge(); else { onSetChainMode(true); onBuildChain(1); } }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors"
            style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}10`, color: ACCENT_EMERALD }}
          >
            <Plus className="w-3 h-3" />
          </button>
          {chain.length > 0 && (
            <button
              onClick={onRemoveLast}
              className="p-1 rounded-lg text-text-muted hover:text-text transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {chainMode && chain.length > 0 ? (
        <DodgeChainTimeline chain={chain} playhead={chainPlayhead} onScrub={onScrub} />
      ) : (
        <div className="flex items-center justify-center py-6 text-text-muted">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em]">
            Select a chain count (2\u00d7, 3\u00d7, 4\u00d7) or add dodges to simulate a sequence
          </p>
        </div>
      )}
    </BlueprintPanel>
  );
}
