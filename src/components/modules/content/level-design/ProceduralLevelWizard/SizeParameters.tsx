'use client';

import { Grid3X3 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { LEVEL_TYPES } from './constants';
import { SizeSlider } from './SizeSlider';
import type { SizeParams } from './types';

interface SizeParametersProps {
  size: SizeParams;
  updateSize: (key: keyof SizeParams, value: number) => void;
  seed: string;
  setSeed: (v: string) => void;
  ltDef: (typeof LEVEL_TYPES)[number];
}

export function SizeParameters({ size, updateSize, seed, setSeed, ltDef }: SizeParametersProps) {
  return (
    <div className="space-y-3 relative z-10">
      <h4 className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest border-b border-violet-900/30 pb-2">
        <Grid3X3 className="w-3 h-3" /> Size Parameters
        <span className="ml-1 text-violet-500/50">[{ltDef.label}]</span>
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <SizeSlider label="Grid Width" value={size.gridWidth} min={16} max={512} step={16} onChange={(v) => updateSize('gridWidth', v)} color={MODULE_COLORS.content} />
        <SizeSlider label="Grid Height" value={size.gridHeight} min={16} max={512} step={16} onChange={(v) => updateSize('gridHeight', v)} color={MODULE_COLORS.content} />
        <SizeSlider label="Min Rooms" value={size.roomCountMin} min={1} max={50} step={1} onChange={(v) => updateSize('roomCountMin', v)} color={MODULE_COLORS.content} />
        <SizeSlider label="Max Rooms" value={size.roomCountMax} min={1} max={100} step={1} onChange={(v) => updateSize('roomCountMax', v)} color={MODULE_COLORS.content} />
        <SizeSlider label="Corridor Width" value={size.corridorWidth} min={1} max={10} step={1} onChange={(v) => updateSize('corridorWidth', v)} color={MODULE_COLORS.content} />
        {/* Seed Input */}
        <div className="px-4 py-3 rounded-xl bg-black/60 border border-violet-900/40 relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/5 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-violet-300 uppercase tracking-widest">WORLD SEED</span>
            <span className="text-[11px] text-violet-500 font-mono">OPTIONAL</span>
          </div>
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="0xRND..."
            className="w-full px-3 py-1.5 bg-black/40 border border-violet-900/50 rounded-md text-xs text-violet-200 placeholder-violet-500/40 outline-none focus:border-violet-500 transition-colors font-mono tracking-wider shadow-inner"
          />
        </div>
      </div>
    </div>
  );
}
