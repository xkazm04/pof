'use client';

import { SlidersHorizontal, GitCompareArrows, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_INFO } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, calculateXpForLevel } from './data';

/* -- Curve Parameters Control Panel --------------------------------------- */

interface CurveParametersPanelProps {
  baseXp: number;
  curveExp: number;
  compareMode: boolean;
  snapshotBaseXp: number;
  snapshotCurveExp: number;
  onBaseXpChange: (v: number) => void;
  onCurveExpChange: (v: number) => void;
  onToggleCompare: () => void;
}

export function CurveParametersPanel({
  baseXp, curveExp, compareMode,
  snapshotBaseXp, snapshotCurveExp,
  onBaseXpChange, onCurveExpChange, onToggleCompare,
}: CurveParametersPanelProps) {
  return (
    <BlueprintPanel color={ACCENT} className="p-5 flex flex-col">
      <div className="flex justify-between items-center mb-2.5">
        <SectionHeader label="Curve Parameters" icon={SlidersHorizontal} color={ACCENT} />
        <button
          onClick={onToggleCompare}
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-full border transition-all duration-200"
          style={{
            color: compareMode ? STATUS_INFO : 'var(--text-muted)',
            borderColor: compareMode ? `${STATUS_INFO}40` : 'var(--border)',
            backgroundColor: compareMode ? `${STATUS_INFO}15` : 'transparent',
          }}
        >
          {compareMode ? <X className="w-3 h-3" /> : <GitCompareArrows className="w-3 h-3" />}
          {compareMode ? 'Exit' : 'Compare'}
        </button>
      </div>

      <div className="space-y-6 flex-1 bg-surface/30 p-4 rounded-xl border border-border/40">
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-mono uppercase tracking-[0.15em] text-text flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT }} /> Base XP Scale
            </label>
            <span className="text-xs font-mono font-bold px-2 rounded-sm border" style={{ color: ACCENT, backgroundColor: `${ACCENT}10`, borderColor: `${ACCENT}20` }}>{baseXp}</span>
          </div>
          <input
            title="Base XP"
            type="range" min="50" max="500" step="10"
            value={baseXp}
            onChange={(e) => onBaseXpChange(Number(e.target.value))}
            className="w-full accent-amber-500 h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1.5">
            <span>50</span><span>Fast</span><span>500</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-mono uppercase tracking-[0.15em] text-text flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT }} /> Exponential Factor
            </label>
            <span className="text-xs font-mono font-bold px-2 rounded-sm border" style={{ color: ACCENT, backgroundColor: `${ACCENT}10`, borderColor: `${ACCENT}20` }}>{curveExp.toFixed(2)}</span>
          </div>
          <input
            title="Curve Exponential"
            type="range" min="1.1" max="2.5" step="0.05"
            value={curveExp}
            onChange={(e) => onCurveExpChange(Number(e.target.value))}
            className="w-full accent-amber-500 h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1.5">
            <span>Linear (1.1)</span><span>Steep (2.5)</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border/40">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Simulation Impact</div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-text">Lv 10 {'->'}  Lv 11</span>
            <span className="font-mono" style={{ color: ACCENT }}>
              {Math.floor(calculateXpForLevel(11, baseXp, curveExp) - calculateXpForLevel(10, baseXp, curveExp)).toLocaleString()} XP
            </span>
          </div>
        </div>

        <AnimatePresence>
          {compareMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-4 border-t border-border/40 overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-3 h-3" style={{ color: STATUS_INFO }} />
                <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: STATUS_INFO }}>Snapshot</span>
              </div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-text-muted">Base XP</span>
                <span className="font-mono" style={{ color: STATUS_INFO }}>{snapshotBaseXp}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">Exponent</span>
                <span className="font-mono" style={{ color: STATUS_INFO }}>{snapshotCurveExp.toFixed(2)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BlueprintPanel>
  );
}
