'use client';

import { useRef, useEffect } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_PINK } from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import { STATUS_COLORS } from '../_shared';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { ScreenNode, InputMode } from './data';
import { INPUT_MODE_COLORS } from './data';

const ACCENT = ACCENT_PINK;

/* ── Input mode badge ──────────────────────────────────────────────────────── */

export function InputModeBadge({ mode }: { mode: InputMode }) {
  const color = INPUT_MODE_COLORS[mode];
  return (
    <span
      className="text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded font-bold border"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}40` }}
    >
      {mode}
    </span>
  );
}

/* ── Screen node row ───────────────────────────────────────────────────────── */

interface ScreenNodeRowProps {
  node: ScreenNode;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expandedNode: string | null;
  onToggle: (id: string) => void;
  arrowLabel?: string;
  fromLabel?: string;
  highlightColor?: string | null;
}

export function ScreenNodeRow({
  node, featureMap, defs, expandedNode, onToggle,
  arrowLabel, fromLabel, highlightColor,
}: ScreenNodeRowProps) {
  const row = featureMap.get(node.featureName);
  const def = defs.find((d) => d.featureName === node.featureName);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];
  const isExpanded = expandedNode === node.id;
  const isHighlighted = !!highlightColor;
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isHighlighted]);

  return (
    <div ref={rowRef}>
      <BlueprintPanel
        color={isHighlighted ? highlightColor! : ACCENT}
        className={`transition-all duration-300 ${isHighlighted ? '' : 'hover:border-text-muted/40'}`}
      >
        <AnimatePresence>
          {isHighlighted && (
            <motion.div
              key={highlightColor}
              className="absolute inset-0 pointer-events-none z-[1] rounded-lg"
              initial={{ opacity: 0.35 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ backgroundColor: highlightColor! }}
            />
          )}
        </AnimatePresence>

        <button onClick={() => onToggle(node.id)} className="w-full text-left px-3.5 py-2.5 focus:outline-none">
          <div className="flex items-center gap-4">
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
              <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text transition-colors" />
            </motion.div>
            {fromLabel && (
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border/30">
                {fromLabel} &rarr;
              </span>
            )}
            <span className="text-xs font-bold text-text truncate max-w-[200px]">{node.featureName}</span>
            <div className="hidden sm:flex ml-2"><InputModeBadge mode={node.inputMode} /></div>
            <span className="ml-auto flex items-center gap-1.5 bg-surface px-2 py-0.5 rounded border border-border/40 shadow-sm flex-shrink-0">
              <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold" style={{ color: sc.dot }}>{sc.label}</span>
            </span>
          </div>
          <div className="flex sm:hidden mt-2 ml-6 items-center gap-2">
            <InputModeBadge mode={node.inputMode} />
            {arrowLabel && (
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded font-medium border"
                style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, borderColor: `${ACCENT}30` }}>
                Trigger: {arrowLabel}
              </span>
            )}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pb-3 pt-1 border-t border-border/40 space-y-3 bg-surface/30">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-text-muted leading-relaxed flex-1">
                    {def?.description ?? row?.description ?? 'No description'}
                  </p>
                  {arrowLabel && (
                    <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded font-medium border whitespace-nowrap"
                      style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, borderColor: `${ACCENT}30` }}>
                      Trigger: {arrowLabel}
                    </span>
                  )}
                </div>
                <div className="bg-surface-deep p-2 rounded-lg border border-border/40">
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold text-text-muted mb-1.5 ml-1">Sub-Widgets</div>
                  <div className="flex flex-wrap gap-1.5">
                    {node.subWidgets.map((w) => (
                      <span key={w} className="text-xs font-mono font-medium px-2 py-0.5 rounded-md border shadow-sm"
                        style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, borderColor: `${ACCENT}30` }}>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
                {row?.filePaths && row.filePaths.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {row.filePaths.slice(0, 3).map((fp) => (
                      <span key={fp} className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border bg-surface" style={{ color: ACCENT, borderColor: `${ACCENT}30` }}>
                        <ExternalLink className="w-2.5 h-2.5" />
                        {fp.split('/').pop()}
                      </span>
                    ))}
                  </div>
                )}
                {row?.nextSteps && (
                  <div className="text-xs p-2 bg-amber-500/10 border-l-2 border-amber-500 rounded text-amber-500 font-medium">
                    Next: {row.nextSteps}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BlueprintPanel>
    </div>
  );
}
