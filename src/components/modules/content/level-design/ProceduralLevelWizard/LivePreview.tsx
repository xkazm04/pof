'use client';

import type { ComponentProps } from 'react';
import { Eye, Pin, Undo2, Redo2 } from 'lucide-react';
import { ProcgenPreviewCanvas } from '../ProcgenPreviewCanvas';
import { ALGORITHMS } from './constants';
import { LayoutRemedies, type LayoutRemedyActions } from './LayoutRemedies';
import { SeedContactSheet } from './SeedContactSheet';
import { LayoutCompare } from './LayoutCompare';
import type { ProcgenSpec } from '@/lib/level-design/procgen-spec';

/** Exploration controls: pin a layout to compare against, undo/redo spec edits. */
export interface LayoutExploreProps {
  pinned: ProcgenSpec | null;
  canUndo: boolean;
  canRedo: boolean;
  pin: () => void;
  unpin: () => void;
  swapPinned: () => void;
  undo: () => void;
  redo: () => void;
}

const TOOL = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-violet-500/40 bg-violet-900/30 text-xs font-bold uppercase tracking-wider text-violet-200 hover:bg-violet-800/40 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-accent)] transition-colors';

interface LivePreviewProps {
  preview: ComponentProps<typeof ProcgenPreviewCanvas>['result'];
  seed: string;
  algDef: (typeof ALGORITHMS)[number];
  /**
   * The spec on screen and the wizard's dispatchers. Given, a fragmented
   * preview offers "Find a fix" (verified reseeds and one-lever changes);
   * a connected one renders exactly as without them.
   */
  spec?: ProcgenSpec;
  setSeed?: LayoutRemedyActions['setSeed'];
  updateSize?: LayoutRemedyActions['updateSize'];
  toggleConstraint?: LayoutRemedyActions['toggleConstraint'];
  /** Given (with `spec` and `setSeed`), the preview offers seed scan, pin/compare and undo/redo. */
  explore?: LayoutExploreProps;
}

export function LivePreview({ preview, seed, algDef, spec, setSeed, updateSize, toggleConstraint, explore }: LivePreviewProps) {
  const canRemedy = !!spec && !!setSeed && !!updateSize && !!toggleConstraint && preview.stats.regions > 1;
  return (
    <div className="space-y-3 relative z-10">
      <h4 className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest border-b border-violet-900/30 pb-2">
        <Eye className="w-3 h-3" /> Live Preview
        <span className="ml-1 text-violet-500/50">[{algDef.label}]</span>
      </h4>
      {/*
        The old copy claimed "the same seed UE targets", which read as a promise
        of layout parity. The UE path regenerates the C++ freehand from a prompt,
        so nothing enforces that — say what is actually true.
      */}
      <p className="text-xs text-violet-300/60 leading-relaxed" data-testid="procgen-preview-parity">
        Runs the same algorithm family and seed the UE task is asked to use, so you can judge room
        count and connectivity before dispatching the C++ generation. The generated C++ is authored
        by the CLI, so an identical layout is <strong className="text-violet-200/80">not guaranteed</strong>.
      </p>
      {explore && (
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Layout history">
          <button type="button" className={TOOL} onClick={explore.undo} disabled={!explore.canUndo} data-testid="procgen-undo">
            <Undo2 className="w-3 h-3" aria-hidden="true" /> Undo
          </button>
          <button type="button" className={TOOL} onClick={explore.redo} disabled={!explore.canRedo} data-testid="procgen-redo">
            <Redo2 className="w-3 h-3" aria-hidden="true" /> Redo
          </button>
          <button type="button" className={TOOL} onClick={explore.pin} data-testid="procgen-pin">
            <Pin className="w-3 h-3" aria-hidden="true" /> {explore.pinned ? 'Re-pin current' : 'Pin current'}
          </button>
        </div>
      )}
      <ProcgenPreviewCanvas result={preview} seedLabel={seed} />
      {explore?.pinned && (
        <LayoutCompare pinned={explore.pinned} live={preview} onSwap={explore.swapPinned} onUnpin={explore.unpin} />
      )}
      {explore && spec && setSeed && <SeedContactSheet spec={spec} setSeed={setSeed} />}
      {canRemedy && (
        <LayoutRemedies spec={spec} setSeed={setSeed} updateSize={updateSize} toggleConstraint={toggleConstraint} />
      )}
    </div>
  );
}
