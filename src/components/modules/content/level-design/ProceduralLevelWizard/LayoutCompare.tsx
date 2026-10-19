'use client';

import { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { compareLayouts } from '@/lib/level-design/layout-gallery';
import { generatePreview, type PreviewResult } from '@/lib/level-design/procgen-preview';
import { previewConfigFromSpec, type ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { GridCanvas } from '../ProcgenPreviewCanvas';

interface LayoutCompareProps {
  pinned: ProcgenSpec;
  live: PreviewResult;
  onSwap: () => void;
  onUnpin: () => void;
}

const signed = (n: number, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

/** The pinned layout beside the live one, with what moved between them. */
export function LayoutCompare({ pinned, live, onSwap, onUnpin }: LayoutCompareProps) {
  const pinnedResult = useMemo(() => generatePreview(previewConfigFromSpec(pinned)), [pinned]);
  const { deltas, better } = compareLayouts(pinnedResult.stats, live.stats);
  return (
    <div className="space-y-2 rounded-lg border border-violet-900/40 bg-black/40 p-3" data-testid="layout-compare">
      <div className="grid grid-cols-2 gap-3">
        {([['Pinned', pinnedResult], ['Live', live]] as const).map(([name, r]) => (
          <figure key={name} className="space-y-1">
            <figcaption className="text-[10px] uppercase tracking-widest text-violet-400/70">
              {name}{(name === 'Pinned' && better === 'pinned') || (name === 'Live' && better === 'live') ? ' · better connected' : ''}
            </figcaption>
            <GridCanvas grid={r.grid} width={r.width} height={r.height} label={`${name} layout`} />
          </figure>
        ))}
      </div>
      <p className="text-xs font-mono text-violet-300/80" data-testid="layout-compare-deltas">
        live vs pinned: {signed(deltas.roomCount)} rooms · {signed(deltas.connectivity * 100)}% connectivity · {signed(deltas.floorRatio * 100)}% floor · {signed(deltas.regions)} regions
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onSwap} data-testid="layout-compare-swap"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-violet-500/40 bg-violet-900/30 text-xs font-bold uppercase tracking-wider text-violet-200 hover:bg-violet-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-accent)]">
          <ArrowLeftRight className="w-3 h-3" aria-hidden="true" /> Swap
        </button>
        <button type="button" onClick={onUnpin} data-testid="layout-compare-unpin"
          className="px-2.5 py-1 rounded-md border border-violet-900/40 text-xs uppercase tracking-wider text-violet-300/70 hover:bg-violet-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-accent)]">
          Unpin
        </button>
      </div>
    </div>
  );
}
