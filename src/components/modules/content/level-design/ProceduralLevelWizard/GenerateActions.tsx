'use client';

import { Zap, Loader2, Monitor } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { ALGORITHMS } from './constants';

interface GenerateActionsProps {
  isGenerating: boolean;
  handleGenerate: () => void;
  handleExportToBlender: () => void;
  blenderConnected: boolean;
  blenderExporting: boolean;
  blenderResult: { message: string; isError: boolean } | null;
  algDef: (typeof ALGORITHMS)[number];
}

export function GenerateActions({
  isGenerating, handleGenerate, handleExportToBlender,
  blenderConnected, blenderExporting, blenderResult, algDef,
}: GenerateActionsProps) {
  return (
    <div className="pt-4 relative z-10">
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="focus-ring-outline relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 group"
        style={{
          backgroundColor: `${MODULE_COLORS.content}20`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}60`,
          boxShadow: `0 0 30px ${MODULE_COLORS.content}30, inset 0 0 15px ${MODULE_COLORS.content}10`,
        }}
      >
        {/* Edge Glints */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent opacity-50" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-30" />

        {/* Shine effect */}
        <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 group-hover:left-[200%] transition-all duration-1000 ease-in-out pointer-events-none" />

        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Compiling Matrix...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all" />
            Execute {algDef.label} Routine
          </>
        )}
      </button>

      {/* Export to Blender */}
      <button
        onClick={handleExportToBlender}
        disabled={!blenderConnected || blenderExporting}
        className="focus-ring-outline relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 group"
        style={{
          backgroundColor: 'rgba(16,185,129,0.12)',
          color: 'rgb(52,211,153)',
          border: '1px solid rgba(16,185,129,0.4)',
          boxShadow: '0 0 20px rgba(16,185,129,0.2), inset 0 0 10px rgba(16,185,129,0.1)',
        }}
        title={!blenderConnected ? 'Connect to Blender first' : 'Export level geometry + metadata to Blender'}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent opacity-50" />
        {blenderExporting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Exporting to Blender...
          </>
        ) : (
          <>
            <Monitor className="w-5 h-5 group-hover:scale-110 transition-all" />
            Export to Blender
          </>
        )}
      </button>

      {/* Blender result */}
      {blenderResult && (
        <div className={`text-xs font-mono px-3 py-2 rounded-lg border ${blenderResult.isError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
          {blenderResult.message}
        </div>
      )}
    </div>
  );
}
