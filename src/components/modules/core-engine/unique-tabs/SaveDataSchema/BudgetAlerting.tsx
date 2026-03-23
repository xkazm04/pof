'use client';

import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';
import {
  ACCENT, SECTION_BUDGETS, FILE_SIZE_SECTIONS, GROWTH_HISTORY, TOTAL_BYTES,
  formatBytes, getBudgetStatus, projectGrowth,
} from './data';

export function BudgetAlerting() {
  const overBudget = SECTION_BUDGETS.filter(b => {
    const sec = FILE_SIZE_SECTIONS.find(s => s.label === b.sectionLabel);
    return sec && sec.bytes >= b.budgetBytes;
  }).length;
  const nearBudget = SECTION_BUDGETS.filter(b => {
    const sec = FILE_SIZE_SECTIONS.find(s => s.label === b.sectionLabel);
    return sec && getBudgetStatus(sec.bytes, b.budgetBytes) === 'amber';
  }).length;

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
        <SectionHeader label="BUDGET_ALERTING" icon={TrendingUp} color={ACCENT} />
        <div className="flex items-center gap-2 text-xs font-mono">
          {overBudget > 0 && <span className="px-1.5 py-0.5 rounded-sm border text-[10px] font-bold" style={{ color: STATUS_ERROR, borderColor: `${STATUS_ERROR}40`, backgroundColor: `${STATUS_ERROR}15` }}>{overBudget} OVER</span>}
          {nearBudget > 0 && <span className="px-1.5 py-0.5 rounded-sm border text-[10px] font-bold" style={{ color: STATUS_WARNING, borderColor: `${STATUS_WARNING}40`, backgroundColor: `${STATUS_WARNING}15` }}>{nearBudget} WARN</span>}
          {overBudget === 0 && nearBudget === 0 && <span className="px-1.5 py-0.5 rounded-sm border text-[10px] font-bold" style={{ color: STATUS_SUCCESS, borderColor: `${STATUS_SUCCESS}40`, backgroundColor: `${STATUS_SUCCESS}15` }}>ALL OK</span>}
        </div>
      </div>

      <div className="p-4 space-y-4 relative z-10">
        <div className="space-y-3">
          {SECTION_BUDGETS.map((budget, i) => {
            const sec = FILE_SIZE_SECTIONS.find(s => s.label === budget.sectionLabel);
            const currentBytes = sec?.bytes ?? 0;
            const pct = Math.min((currentBytes / budget.budgetBytes) * 100, 100);
            const status = getBudgetStatus(currentBytes, budget.budgetBytes);
            const statusColor = status === 'red' ? STATUS_ERROR : status === 'amber' ? STATUS_WARNING : STATUS_SUCCESS;
            const history = GROWTH_HISTORY.map(g => g.sectionBytes[budget.sectionLabel] ?? 0);
            const projected = projectGrowth(history);
            const projectedStatus = getBudgetStatus(projected, budget.budgetBytes);
            const projectedColor = projectedStatus === 'red' ? STATUS_ERROR : projectedStatus === 'amber' ? STATUS_WARNING : STATUS_SUCCESS;
            const maxVal = Math.max(...history, budget.budgetBytes);

            return (
              <motion.div
                key={budget.sectionLabel}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="border border-border/10 rounded-lg p-3 font-mono text-xs"
                style={{ backgroundColor: `${ACCENT}06` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: budget.color }} />
                    <span className="text-cyan-200 font-bold text-[10px] uppercase tracking-[0.15em]">{budget.sectionLabel}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted">{formatBytes(currentBytes)} / {formatBytes(budget.budgetBytes)}</span>
                    <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: statusColor, backgroundColor: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
                      {status === 'red' ? 'OVER' : status === 'amber' ? 'WARN' : 'OK'}
                    </span>
                  </div>
                </div>

                <div className="relative h-3 rounded-full overflow-hidden border border-border/10" style={{ backgroundColor: `${ACCENT}12` }}>
                  <motion.div className="absolute top-0 bottom-0 left-0 rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} style={{ backgroundColor: `${statusColor}60` }} />
                  <div className="absolute top-0 bottom-0" style={{ left: '80%', width: '1px', backgroundColor: `${STATUS_WARNING}60` }} />
                  {currentBytes < budget.budgetBytes && <div className="absolute top-0 bottom-0 right-0" style={{ width: '1px', backgroundColor: `${STATUS_ERROR}60` }} />}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-text-muted font-mono">
                  <span>0</span>
                  <span style={{ marginLeft: '76%', position: 'relative', left: '-8px', color: `${STATUS_WARNING}90` }}>80%</span>
                  <span>100%</span>
                </div>

                {/* Sparkline + projected */}
                <div className="flex items-end gap-4 mt-2 pt-2 border-t border-border/10">
                  <div className="flex-1">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Growth Trend</div>
                    <div className="flex items-end gap-0.5 h-8">
                      {history.map((val, hi) => {
                        const barH = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        const barStatus = getBudgetStatus(val, budget.budgetBytes);
                        const barColor = barStatus === 'red' ? STATUS_ERROR : barStatus === 'amber' ? STATUS_WARNING : budget.color;
                        return (
                          <div key={hi} className="flex-1 flex flex-col items-center gap-0.5">
                            <motion.div className="w-full rounded-t-sm min-h-[2px]" style={{ backgroundColor: `${barColor}80` }} initial={{ height: 0 }} animate={{ height: `${barH}%` }} transition={{ duration: 0.5, delay: 0.1 * hi }} title={`${GROWTH_HISTORY[hi].version}: ${formatBytes(val)}`} />
                            <span className="text-[9px] text-text-muted leading-none">{GROWTH_HISTORY[hi].version}</span>
                          </div>
                        );
                      })}
                      <div className="flex-1 flex flex-col items-center gap-0.5">
                        <motion.div className="w-full rounded-t-sm min-h-[2px] border border-dashed" style={{ backgroundColor: `${projectedColor}30`, borderColor: `${projectedColor}60` }} initial={{ height: 0 }} animate={{ height: `${maxVal > 0 ? (projected / maxVal) * 100 : 0}%` }} transition={{ duration: 0.5, delay: 0.5 }} title={`Projected V3.0: ${formatBytes(projected)}`} />
                        <span className="text-[9px] text-text-muted leading-none italic">V3?</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Projected</div>
                    <div className="text-sm font-bold" style={{ color: projectedColor }}>{formatBytes(projected)}</div>
                    <div className="text-[10px]" style={{ color: projectedColor }}>
                      {projected > currentBytes ? `+${formatBytes(projected - currentBytes)}` : projected < currentBytes ? `-${formatBytes(currentBytes - projected)}` : 'stable'}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-3 py-2 border border-border/10 rounded-lg font-mono text-xs" style={{ backgroundColor: `${ACCENT}06` }}>
          <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Total Budget:</span>
          <span className="text-cyan-300">{formatBytes(TOTAL_BYTES)}</span>
          <span className="text-text-muted">/</span>
          <span className="text-cyan-300">{formatBytes(SECTION_BUDGETS.reduce((s, b) => s + b.budgetBytes, 0))}</span>
          <span className="text-text-muted ml-1">({((TOTAL_BYTES / SECTION_BUDGETS.reduce((s, b) => s + b.budgetBytes, 0)) * 100).toFixed(0)}% used)</span>
          <span className="ml-auto text-text-muted">Next version est:</span>
          <span className="text-cyan-300">{formatBytes(SECTION_BUDGETS.reduce((s, b) => s + projectGrowth(GROWTH_HISTORY.map(g => g.sectionBytes[b.sectionLabel] ?? 0)), 0))}</span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
