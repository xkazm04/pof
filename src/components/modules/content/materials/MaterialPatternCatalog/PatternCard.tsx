'use client';

import { Zap, Monitor } from 'lucide-react';
import { CATEGORY_META } from './constants';
import type { MaterialPattern } from './types';

// ── Pattern Card ──

interface PatternCardProps {
  pattern: MaterialPattern;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  blenderConnected: boolean;
  hasBlenderScript: boolean;
  isBlenderPreviewing: boolean;
  onBlenderPreview: () => void;
  blenderResult: { patternId: string; message: string; isError: boolean } | null;
}

export function PatternCard({ pattern, isExpanded, onToggle, onGenerate, isGenerating, blenderConnected, hasBlenderScript, isBlenderPreviewing, onBlenderPreview, blenderResult }: PatternCardProps) {
  const Icon = pattern.icon;
  const catMeta = CATEGORY_META[pattern.category];

  return (
    <div
      className="rounded-xl border transition-all duration-500 overflow-hidden relative group"
      style={{
        borderColor: isExpanded ? `${catMeta.color}50` : 'rgba(139,92,246,0.2)',
        backgroundColor: isExpanded ? 'rgba(3,3,10,0.9)' : 'rgba(10,10,25,0.6)',
        boxShadow: isExpanded ? `0 0 30px ${catMeta.color}15, inset 0 0 20px ${catMeta.color}10` : 'none',
      }}
    >
      {isExpanded && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none mix-blend-overlay" />}

      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 text-left relative z-10"
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${catMeta.color}20, ${catMeta.color}05)`,
            border: `1px solid ${catMeta.color}40`,
            boxShadow: `0 0 15px ${catMeta.color}20`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: catMeta.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-bold uppercase text-violet-100 truncate">{pattern.name}</span>
            <span
              className="text-[11px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border"
              style={{ backgroundColor: `${catMeta.color}15`, borderColor: `${catMeta.color}40`, color: catMeta.color }}
            >
              {catMeta.label}
            </span>
          </div>
          <p className="text-xs text-violet-300/60 line-clamp-1 font-mono">{pattern.description}</p>
        </div>

        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-violet-900/40 bg-black/60 group-hover:border-violet-500/50 transition-colors">
          <span
            className="text-xs font-mono transition-transform duration-300"
            style={{ color: catMeta.color, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-5 relative z-10 border-t border-violet-900/30 w-full overflow-hidden">
          <div className="absolute left-4 top-4 bottom-4 w-px bg-violet-900/40" />

          <div className="pl-6 space-y-4">
            {/* Description */}
            <p className="text-[11px] text-violet-200/80 leading-relaxed font-mono">
              <span className="text-xs text-violet-500 uppercase block mb-1 font-bold">Synopsis</span>
              {pattern.description}
            </p>

            {/* Approach */}
            <div>
              <span className="text-xs text-amber-500 uppercase block mb-1 font-bold">Methodology</span>
              <p className="text-[11px] text-amber-100/70 leading-relaxed font-mono bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg">
                {pattern.approach}
              </p>
            </div>

            {/* HLSL Snippet */}
            <div className="w-full">
              <span className="text-xs text-emerald-500 uppercase block mb-1 font-bold">HLSL Source</span>
              <div className="relative w-full rounded-xl bg-black/80 border border-emerald-500/30 overflow-hidden shadow-inner">
                <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[11px] border-b border-emerald-500/30 font-bold">Core Logic</div>
                <pre className="text-xs leading-relaxed p-3 overflow-x-auto text-emerald-200/90 font-mono whitespace-pre">
                  {pattern.hlslSnippet}
                </pre>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {pattern.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] px-2 py-1 rounded bg-black/60 text-violet-300 border border-violet-900/50 uppercase font-mono"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Generate button */}
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={isGenerating}
              className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50 mt-2 group outline-none focus-visible:ring-1 focus-visible:ring-text/40"
              style={{
                backgroundColor: `${catMeta.color}15`,
                color: catMeta.color,
                border: `1px solid ${catMeta.color}50`,
                boxShadow: `0 0 20px ${catMeta.color}20, inset 0 0 10px ${catMeta.color}10`,
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
              <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

              {isGenerating ? (
                <div className="flex items-center gap-2 animate-pulse">
                  <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  COMPILING_SHADER...
                </div>
              ) : (
                <>
                  <Zap className="w-4 h-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(currentColor,0.8)] transition-all" />
                  EXECUTE {pattern.name} SYNTHESIS
                </>
              )}
            </button>

            {/* Preview in Blender button */}
            {hasBlenderScript && (
              <button
                onClick={(e) => { e.stopPropagation(); onBlenderPreview(); }}
                disabled={!blenderConnected || isBlenderPreviewing}
                className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-40 group outline-none border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 focus-visible:ring-1 focus-visible:ring-text/40"
                title={!blenderConnected ? 'Connect to Blender first' : `Preview ${pattern.name} shader in Blender`}
              >
                {isBlenderPreviewing ? (
                  <div className="flex items-center gap-2 animate-pulse">
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    SENDING_TO_BLENDER...
                  </div>
                ) : (
                  <>
                    <Monitor className="w-4 h-4" />
                    PREVIEW IN BLENDER
                  </>
                )}
              </button>
            )}

            {/* Blender result inline */}
            {blenderResult && (
              <div className={`text-xs font-mono px-3 py-2 rounded-lg border ${blenderResult.isError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                {blenderResult.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
