'use client';

import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { STATUS_ERROR, withOpacity, OPACITY_80 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import { Sparkline } from '../system/CircularGauge';
import { ACCENT } from '../_shared/data';
import type { DebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';

/** Draw calls per frame from the capture: the same figure as the gauge and the stat dashboard. */
export function DrawCallSection({ drawCalls }: { drawCalls: DebugSnapshot['drawCalls'] }) {
  const { perFrame, peak, budget, series } = drawCalls;
  const usage = (perFrame / budget) * 100;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="DRAW_CALL_ANALYZER" color={ACCENT} icon={Layers} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted shrink-0 ml-2">
          AVG: {perFrame} / {budget} BUDGET
        </span>
      </div>
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">PER FRAME</div>
            <Sparkline data={series} color={ACCENT} width={240} height={36} />
            <div className="grid grid-cols-2 gap-2 text-xs font-mono uppercase tracking-[0.15em]">
              <span className="text-text-muted">Average</span>
              <span className="text-right font-bold" style={{ color: withOpacity(ACCENT, OPACITY_80) }}>{perFrame}</span>
              <span className="text-text-muted">Peak</span>
              <span className="text-right font-bold" style={{ color: peak > budget ? STATUS_ERROR : withOpacity(ACCENT, OPACITY_80) }}>{peak}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">
                <span>BUDGET USAGE</span>
                <span>{usage.toFixed(0)}%</span>
              </div>
              <NeonBar pct={Math.min(usage, 100)} color={ACCENT} height={4} glow />
            </div>
          </div>
          <div className="text-xs font-mono text-text-muted leading-relaxed">
            <div className="uppercase tracking-[0.15em] mb-1.5">By category / material</div>
            Not in this capture: a profiler session records draw calls per frame, not which
            mesh class or material issued them. Use <span style={{ color: withOpacity(ACCENT, OPACITY_80) }}>stat scenerendering</span> or
            a GPU capture for the breakdown.
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
