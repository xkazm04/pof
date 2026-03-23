'use client';

import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { STATUS_ERROR, STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { ACCENT } from './data';
import { DRAW_CALL_CATEGORIES, DRAW_CALL_TOTAL, DRAW_CALL_BUDGET, EXPENSIVE_MATERIALS } from './data-perf';

export function DrawCallSection() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="DRAW_CALL_ANALYZER" color={ACCENT} icon={Layers} />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted shrink-0 ml-2">
          TOTAL: {DRAW_CALL_TOTAL} / {DRAW_CALL_BUDGET} BUDGET
        </span>
      </div>
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">BY CATEGORY</div>
            {DRAW_CALL_CATEGORIES.map((cat) => {
              const maxCount = Math.max(...DRAW_CALL_CATEGORIES.map(c => c.count));
              return (
                <div key={cat.category} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] w-24 text-right text-text-muted">{cat.category}</span>
                  <div className="flex-1">
                    <NeonBar pct={(cat.count / maxCount) * 100} color={cat.color} height={5} />
                  </div>
                  <span className="text-xs font-mono font-bold w-10 text-right" style={{ color: cat.color }}>{cat.count}</span>
                </div>
              );
            })}
            {/* Budget bar */}
            <div className="mt-3 pt-2 border-t border-border">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">
                <span>BUDGET USAGE</span>
                <span>{((DRAW_CALL_TOTAL / DRAW_CALL_BUDGET) * 100).toFixed(0)}%</span>
              </div>
              <NeonBar pct={(DRAW_CALL_TOTAL / DRAW_CALL_BUDGET) * 100} color={ACCENT} height={4} glow />
            </div>
          </div>

          {/* Expensive materials table */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">TOP EXPENSIVE MATERIALS</div>
            <div className="grid grid-cols-4 gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted pb-1 border-b border-border">
              <span>Material</span><span className="text-center">Draws</span><span>Shader</span><span className="text-right">Cost</span>
            </div>
            <div className="space-y-0.5">
              {EXPENSIVE_MATERIALS.map((mat) => {
                const costColor = mat.cost === 'High' ? STATUS_ERROR : STATUS_WARNING;
                return (
                  <div key={mat.name} className="grid grid-cols-4 gap-2 text-xs font-mono py-1 hover:bg-surface-deep/50 transition-colors">
                    <span style={{ color: `${ACCENT}cc` }} className="truncate">{mat.name}</span>
                    <span className="text-center text-text-muted">{mat.drawCalls}</span>
                    <span className="text-text-muted truncate text-[10px]">{mat.shader}</span>
                    <span className="text-right">
                      <span className="text-[10px] px-1 py-[1px] rounded uppercase" style={{ color: costColor, backgroundColor: `${costColor}${OPACITY_10}` }}>{mat.cost}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
