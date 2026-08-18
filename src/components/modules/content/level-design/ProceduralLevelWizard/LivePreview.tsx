'use client';

import type { ComponentProps } from 'react';
import { Eye } from 'lucide-react';
import { ProcgenPreviewCanvas } from '../ProcgenPreviewCanvas';
import { ALGORITHMS } from './constants';

interface LivePreviewProps {
  preview: ComponentProps<typeof ProcgenPreviewCanvas>['result'];
  seed: string;
  algDef: (typeof ALGORITHMS)[number];
}

export function LivePreview({ preview, seed, algDef }: LivePreviewProps) {
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
      <ProcgenPreviewCanvas result={preview} seedLabel={seed} />
    </div>
  );
}
