'use client';

import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { scanSeeds, GALLERY_COUNT, type GalleryCandidate } from '@/lib/level-design/layout-gallery';
import type { ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { GridCanvas } from '../ProcgenPreviewCanvas';

interface SeedContactSheetProps {
  spec: ProcgenSpec;
  /** Adopting a candidate is exactly this: the wizard's own seed setter. */
  setSeed: (seed: string) => void;
}

/**
 * A contact sheet of the next seeds. The scan runs on the click, never on a drag,
 * and belongs to the spec it was computed for: any edit retires it.
 */
export function SeedContactSheet({ spec, setSeed }: SeedContactSheetProps) {
  const [sheet, setSheet] = useState<{ spec: ProcgenSpec; candidates: GalleryCandidate[] } | null>(null);
  const candidates = sheet?.spec === spec ? sheet.candidates : null;

  if (!candidates) {
    return (
      <button
        type="button"
        onClick={() => setSheet({ spec, candidates: scanSeeds(spec, { count: GALLERY_COUNT }) })}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-900/30 text-xs font-bold uppercase tracking-wider text-violet-200 hover:bg-violet-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-accent)] transition-colors"
        data-testid="seed-sheet-scan"
      >
        <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" /> Scan {GALLERY_COUNT} seeds
      </button>
    );
  }
  return (
    <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Neighbouring seeds" data-testid="seed-sheet">
      {candidates.map((c) => (
        <li key={c.seedLabel}>
          <button
            type="button"
            onClick={() => setSeed(c.seedLabel)}
            className="w-full space-y-1 rounded-md border border-violet-900/40 bg-black/40 p-1.5 text-left hover:border-violet-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-accent)] transition-colors"
            data-testid={`seed-candidate-${c.offset}`}
          >
            <GridCanvas grid={c.thumb.grid} width={c.thumb.width} height={c.thumb.height} label={`Layout for seed ${c.seedLabel}`} />
            <span className="block text-[10px] font-mono text-violet-300/80">
              {c.stats.roomCount} rooms · {Math.round(c.stats.connectivity * 100)}%
            </span>
            <span className="block text-[9px] font-mono text-violet-400/50">seed {c.seedLabel}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
