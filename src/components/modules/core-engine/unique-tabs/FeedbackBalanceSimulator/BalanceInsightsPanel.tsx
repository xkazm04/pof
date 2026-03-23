'use client';

import { useState, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { INSIGHT_COLORS, INSIGHT_ICONS, SEVERITY_ORDER, SEVERITY_FILTERS } from './types';

/* ── BalanceInsightsPanel ─ Filterable insight cards ──────────────────── */

export function BalanceInsightsPanel({ insights }: {
  insights: { severity: string; category: string; message: string }[];
}) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(['critical', 'warning', 'positive']),
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, warning: 0, positive: 0 };
    for (const ins of insights) c[ins.severity] = (c[ins.severity] ?? 0) + 1;
    return c;
  }, [insights]);

  const toggleFilter = useCallback((key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); } else next.add(key);
      return next;
    });
  }, []);

  const filtered = useMemo(() =>
    [...insights]
      .filter(i => activeFilters.has(i.severity))
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)),
    [insights, activeFilters],
  );

  return (
    <BlueprintPanel className="p-3">
      <SectionHeader icon={AlertTriangle} label="Balance Insights" />

      {/* Severity filter pills */}
      <div className="flex items-center gap-1.5 mt-2 mb-2">
        {SEVERITY_FILTERS.map(s => {
          const active = activeFilters.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleFilter(s.key)}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded-full border transition-colors"
              style={{
                borderColor: active ? s.color : 'var(--color-border)',
                backgroundColor: active ? `${s.color}15` : 'transparent',
                color: active ? s.color : 'var(--color-text-muted)',
                opacity: active ? 1 : 0.5,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="font-mono ml-0.5">{counts[s.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Insight cards */}
      <div className="space-y-3">
        {filtered.map((insight, i) => {
          const color = INSIGHT_COLORS[insight.severity as keyof typeof INSIGHT_COLORS] ?? SEVERITY_FILTERS[1].color;
          const Icon = INSIGHT_ICONS[insight.severity as keyof typeof INSIGHT_ICONS] ?? AlertTriangle;
          const isCritical = insight.severity === 'critical';
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="flex items-start gap-2.5 px-3 py-2 rounded-md border overflow-hidden"
              style={{
                borderColor: `${color}30`,
                backgroundColor: `${color}08`,
                borderLeftWidth: isCritical ? 3 : undefined,
                borderLeftColor: isCritical ? STATUS_ERROR : undefined,
              }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {insight.severity}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
                    {insight.category}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-text leading-relaxed">{insight.message}</p>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-[10px] font-mono text-text-muted text-center py-2">
            No insights match the selected filters
          </p>
        )}
      </div>
    </BlueprintPanel>
  );
}
