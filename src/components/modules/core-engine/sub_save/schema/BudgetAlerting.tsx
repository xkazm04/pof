'use client';

import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_WARNING, STATUS_ERROR, ACCENT_CYAN_LIGHT,
  withOpacity, OPACITY_56, OPACITY_5, OPACITY_20, OPACITY_8, OPACITY_37, OPACITY_50,
} from '@/lib/chart-colors';
import { budgetStatusToken } from '@/lib/status-token';
import { StatusTag } from '@/components/ui/StatusTag';
import { BlueprintPanel, SectionHeader, SAVE_TYPE } from '../_shared/design';
import {
  ACCENT, SECTION_BUDGETS, FILE_SIZE_SECTIONS, GROWTH_HISTORY, TOTAL_BYTES,
  formatBytes, getBudgetStatus, projectGrowth,
} from '../_shared/data';

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
          {overBudget > 0 && <StatusTag level="bad" word={`${overBudget} OVER`} />}
          {nearBudget > 0 && <StatusTag level="warn" word={`${nearBudget} WARN`} />}
          {overBudget === 0 && nearBudget === 0 && <StatusTag level="ok" word="ALL OK" />}
        </div>
      </div>

      <div className="p-4 space-y-4 relative z-10">
        <div className="space-y-3">
          {SECTION_BUDGETS.map((budget, i) => {
            const sec = FILE_SIZE_SECTIONS.find(s => s.label === budget.sectionLabel);
            const currentBytes = sec?.bytes ?? 0;
            const pct = Math.min((currentBytes / budget.budgetBytes) * 100, 100);
            const status = getBudgetStatus(currentBytes, budget.budgetBytes);
            const statusToken = budgetStatusToken(status);
            const statusColor = statusToken.color;
            const history = GROWTH_HISTORY.map(g => g.sectionBytes[budget.sectionLabel] ?? 0);
            const projected = projectGrowth(history);
            const projectedStatus = getBudgetStatus(projected, budget.budgetBytes);
            const projectedColor = budgetStatusToken(projectedStatus).color;
            const maxVal = Math.max(...history, budget.budgetBytes);

            return (
              <motion.div
                key={budget.sectionLabel}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="border border-border/10 rounded-lg p-3 font-mono text-xs"
                style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: budget.color }} />
                    <span className="font-bold text-xs uppercase tracking-[0.15em]" style={{ color: ACCENT_CYAN_LIGHT }}>{budget.sectionLabel}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted">{formatBytes(currentBytes)} / {formatBytes(budget.budgetBytes)}</span>
                    <StatusTag level={statusToken.level} />
                  </div>
                </div>

                <div className="relative h-3 rounded-full overflow-hidden border border-border/10" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}` }}>
                  <motion.div className="absolute top-0 bottom-0 left-0 rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} style={{ backgroundColor: `${withOpacity(statusColor, OPACITY_37)}`, backgroundImage: statusToken.pattern }} />
                  <div className="absolute top-0 bottom-0" style={{ left: '80%', width: '1px', backgroundColor: `${withOpacity(STATUS_WARNING, OPACITY_37)}` }} />
                  {currentBytes < budget.budgetBytes && <div className="absolute top-0 bottom-0 right-0" style={{ width: '1px', backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_37)}` }} />}
                </div>
                <div className="flex justify-between mt-1 text-xs text-text-muted font-mono">
                  <span>0</span>
                  <span style={{ marginLeft: '76%', position: 'relative', left: '-8px', color: withOpacity(STATUS_WARNING, OPACITY_56) }}>80%</span>
                  <span>100%</span>
                </div>

                {/* Sparkline + projected */}
                <div className="flex items-end gap-4 mt-2 pt-2 border-t border-border/10">
                  <div className="flex-1">
                    <div className={`${SAVE_TYPE.body} text-text-muted mb-1`}>Growth trend</div>
                    <div className="flex items-end gap-0.5 h-8">
                      {history.map((val, hi) => {
                        const barH = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        const barStatus = getBudgetStatus(val, budget.budgetBytes);
                        const barToken = budgetStatusToken(barStatus);
                        // Keep the section's own hue while under budget; warn/over
                        // adopt the ramp color + its hatch so the spike reads
                        // without relying on color (WCAG 1.4.1).
                        const barColor = barStatus === 'ok' ? budget.color : barToken.color;
                        return (
                          <div key={hi} className="flex-1 flex flex-col items-center gap-0.5">
                            <motion.div className="w-full rounded-t-sm min-h-[2px]" style={{ backgroundColor: `${withOpacity(barColor, OPACITY_50)}`, backgroundImage: barToken.pattern }} initial={{ height: 0 }} animate={{ height: `${barH}%` }} transition={{ duration: 0.5, delay: 0.1 * hi }} title={`${GROWTH_HISTORY[hi].version}: ${formatBytes(val)}`} />
                            <span className={`${SAVE_TYPE.axis} text-text-muted`}>{GROWTH_HISTORY[hi].version}</span>
                          </div>
                        );
                      })}
                      <div className="flex-1 flex flex-col items-center gap-0.5">
                        <motion.div className="w-full rounded-t-sm min-h-[2px] border border-dashed" style={{ backgroundColor: `${withOpacity(projectedColor, OPACITY_20)}`, borderColor: `${withOpacity(projectedColor, OPACITY_37)}` }} initial={{ height: 0 }} animate={{ height: `${maxVal > 0 ? (projected / maxVal) * 100 : 0}%` }} transition={{ duration: 0.5, delay: 0.5 }} title={`Projected V3.0: ${formatBytes(projected)}`} />
                        <span className={`${SAVE_TYPE.axis} text-text-muted italic`}>V3?</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`${SAVE_TYPE.body} text-text-muted mb-0.5`}>Projected</div>
                    <div className={SAVE_TYPE.hero} style={{ color: projectedColor }}>{formatBytes(projected)}</div>
                    <div className="text-xs" style={{ color: projectedColor }}>
                      {projected > currentBytes ? `+${formatBytes(projected - currentBytes)}` : projected < currentBytes ? `-${formatBytes(currentBytes - projected)}` : 'stable'}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-3 py-2 border border-border/10 rounded-lg font-mono text-xs" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
          <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
          <span className={`${SAVE_TYPE.body} text-text-muted`}>Total budget:</span>
          <span style={{ color: ACCENT_CYAN_LIGHT }}>{formatBytes(TOTAL_BYTES)}</span>
          <span className="text-text-muted">/</span>
          <span style={{ color: ACCENT_CYAN_LIGHT }}>{formatBytes(SECTION_BUDGETS.reduce((s, b) => s + b.budgetBytes, 0))}</span>
          <span className="text-text-muted ml-1">({((TOTAL_BYTES / SECTION_BUDGETS.reduce((s, b) => s + b.budgetBytes, 0)) * 100).toFixed(0)}% used)</span>
          <span className="ml-auto text-text-muted">Next version est:</span>
          <span style={{ color: ACCENT_CYAN_LIGHT }}>{formatBytes(SECTION_BUDGETS.reduce((s, b) => s + projectGrowth(GROWTH_HISTORY.map(g => g.sectionBytes[b.sectionLabel] ?? 0)), 0))}</span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
