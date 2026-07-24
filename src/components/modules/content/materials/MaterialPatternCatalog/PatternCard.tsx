'use client';

import { useId } from 'react';
import { Zap, Monitor, ChevronDown } from 'lucide-react';
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
  const uid = useId();
  const headerId = `pattern-header-${uid}`;
  const panelId = `pattern-panel-${uid}`;

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
        type="button"
        id={headerId}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="focus-ring-inset w-full flex items-center gap-4 px-4 py-3 text-left relative z-10 rounded-xl"
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
          <ChevronDown
            aria-hidden="true"
            className="w-4 h-4 transition-transform duration-300"
            style={{ color: catMeta.color, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="px-4 pb-4 pt-2 space-y-5 relative z-10 border-t border-violet-900/30 w-full overflow-hidden"
        >
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
              type="button"
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={isGenerating}
              className="focus-ring-outline relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50 mt-2 group"
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
                <span className="flex items-center gap-2 animate-pulse">
                  <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Generating shader…
                </span>
              ) : (
                <>
                  <Zap aria-hidden="true" className="w-4 h-4 group-hover:scale-110 transition-all" />
                  Generate {pattern.name} material
                </>
              )}
            </button>

            {/* Preview in Blender button */}
            {hasBlenderScript && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onBlenderPreview(); }}
                  disabled={!blenderConnected || isBlenderPreviewing}
                  className="focus-ring relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-40 group border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                >
                  {isBlenderPreviewing ? (
                    <span className="flex items-center gap-2 animate-pulse">
                      <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Sending to Blender…
                    </span>
                  ) : (
                    <>
                      <Monitor aria-hidden="true" className="w-4 h-4" />
                      Preview in Blender
                    </>
                  )}
                </button>
                {!blenderConnected && (
                  <p className="text-[11px] text-violet-300/80 text-center">
                    Connect to Blender (top of this panel) to preview this shader live.
                  </p>
                )}
              </div>
            )}

            {/* Blender result inline */}
            {blenderResult && (
              <div
                role={blenderResult.isError ? 'alert' : 'status'}
                className={`text-xs font-mono px-3 py-2 rounded-lg border ${blenderResult.isError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}
              >
                <span className="font-bold uppercase mr-1.5">{blenderResult.isError ? 'Preview failed:' : 'Preview ready:'}</span>
                {blenderResult.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
