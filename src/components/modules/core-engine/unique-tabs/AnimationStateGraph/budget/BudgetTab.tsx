'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { AlertCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN_LIGHT, ACCENT_VIOLET, ACCENT_PINK, ACCENT_EMERALD,
  withOpacity, OPACITY_8, OPACITY_5, OPACITY_20, OPACITY_12, OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import { FeatureCard, LiveMetricGauge } from '../../_shared';
import {
  ACCENT, ASSET_FEATURES, BUDGET_GAUGES,
  NOTIFY_ISSUES, MONTAGE_COVERAGES,
  ALL_MONTAGES, MONTAGE_CATEGORIES, MONTAGE_CATEGORY_COUNTS, MONTAGE_CATEGORY_MEMORY, TOTAL_MONTAGE_MEMORY,
  type MontageCategory,
} from '../data';
import type { FeatureRow } from '@/types/feature-matrix';

interface BudgetTabProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

export function BudgetTab({ featureMap, defs }: BudgetTabProps) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  return (
    <>
      {/* Asset list */}
      <div className="space-y-3 pt-2">
        <div className="px-1">
          <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
            Anim Architecture Modules
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ASSET_FEATURES.map((name, i) => (
            <motion.div key={name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <FeatureCard name={name} featureMap={featureMap} defs={defs} expanded={expandedAsset} onToggle={toggleAsset} accent={ACCENT} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Montage Asset Browser */}
      <MontageAssetBrowser />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BudgetTracker />
        <NotifyCoverage />
      </div>
    </>
  );
}

/* ── Montage Asset Browser ────────────────────────────────────────────────── */

const ROW_HEIGHT = 28;
const OVERSCAN = 5;

function MontageAssetBrowser() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const toggleGroup = useCallback((cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  type BrowseRow = { type: 'header'; category: MontageCategory } | { type: 'item'; montage: typeof ALL_MONTAGES[0] };

  // Build flat row list: group headers + items
  const rows = useMemo(() => {
    const result: BrowseRow[] = [];
    for (const cat of MONTAGE_CATEGORIES) {
      result.push({ type: 'header', category: cat });
      if (!collapsed[cat]) {
        for (const m of ALL_MONTAGES) {
          if (m.category === cat) result.push({ type: 'item', montage: m });
        }
      }
    }
    return result;
  }, [collapsed]);

  const containerHeight = 350;
  const totalHeight = rows.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(startIdx, endIdx);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Montage Asset Browser" color={ACCENT} />
      <p className="text-xs font-mono text-text-muted mt-1 mb-1">
        {ALL_MONTAGES.length} montages &middot; {TOTAL_MONTAGE_MEMORY.toFixed(1)} MB total
      </p>

      {/* Category memory summary bar */}
      <div className="flex gap-0.5 mb-3 h-6 rounded overflow-hidden">
        {MONTAGE_CATEGORIES.map(cat => {
          const pct = (MONTAGE_CATEGORY_MEMORY[cat] / TOTAL_MONTAGE_MEMORY) * 100;
          if (pct < 1) return null;
          const color = categoryColor(cat);
          return (
            <div
              key={cat}
              className="h-full rounded-sm relative flex items-center justify-center overflow-hidden"
              style={{ width: `${pct}%`, backgroundColor: withOpacity(color, OPACITY_30) }}
              title={`${cat}: ${MONTAGE_CATEGORY_MEMORY[cat].toFixed(1)} MB (${MONTAGE_CATEGORY_COUNTS[cat]} montages)`}
            >
              {pct > 8 && (
                <span className="text-[9px] font-mono font-bold truncate px-0.5" style={{ color }}>
                  {cat}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Virtual scrolling list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto custom-scrollbar border border-border/40 rounded-lg"
        style={{ height: containerHeight }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRows.map((row, vi) => {
            const idx = startIdx + vi;
            if (row.type === 'header') {
              const cat = row.category;
              const isCollapsed = collapsed[cat];
              return (
                <button
                  key={`h-${cat}`}
                  onClick={() => toggleGroup(cat)}
                  className="absolute left-0 right-0 flex items-center gap-2 px-3 text-xs font-mono bg-surface-deep hover:bg-surface-hover transition-colors cursor-pointer"
                  style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT, borderBottom: `1px solid ${withOpacity(ACCENT, OPACITY_12)}` }}
                >
                  <ChevronDown className="w-3 h-3 text-text-muted transition-transform flex-shrink-0"
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined }} />
                  <span className="uppercase tracking-wider text-text-muted font-bold">{cat}</span>
                  <span className="text-text-muted/50">{MONTAGE_CATEGORY_COUNTS[cat]}</span>
                  <span className="ml-auto font-bold" style={{ color: categoryColor(cat) }}>
                    {MONTAGE_CATEGORY_MEMORY[cat].toFixed(1)} MB
                  </span>
                </button>
              );
            }
            const mon = row.montage;
            return (
              <div
                key={mon.id}
                className="absolute left-0 right-0 flex items-center gap-2 px-3 pl-8 text-xs font-mono hover:bg-surface-hover/30 transition-colors"
                style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(mon.category) }} />
                <span className="font-medium text-text flex-1 min-w-0 truncate">{mon.name}</span>
                <span className="text-text-muted">{mon.totalFrames}f</span>
                <span className="text-text-muted w-12 text-right">{mon.fps}fps</span>
                <span className="text-text-muted w-14 text-right">{mon.memorySizeMB.toFixed(1)} MB</span>
                {mon.hasRootMotion && (
                  <span className="px-1 rounded text-[10px]" style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8), color: ACCENT }}>RM</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}

function categoryColor(cat: MontageCategory): string {
  switch (cat) {
    case 'Attack': return STATUS_ERROR;
    case 'Dodge': return ACCENT_CYAN_LIGHT;
    case 'HitReact': return STATUS_WARNING;
    case 'Death': return ACCENT_VIOLET;
    case 'Idle': return STATUS_SUCCESS;
    case 'Locomotion': return STATUS_INFO;
    case 'Ability': return ACCENT_PINK;
    case 'Emote': return ACCENT_EMERALD;
  }
}

/* ── Budget Tracker ────────────────────────────────────────────────────────── */

function BudgetTracker() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Animation Budget Tracker" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Current animation system resource usage vs budget limits.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {BUDGET_GAUGES.map((metric) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <LiveMetricGauge metric={metric} accent={ACCENT} size={110} />
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}

/* ── Notify Coverage ───────────────────────────────────────────────────────── */

function NotifyCoverage() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Notify Coverage Analyzer" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Gaps in animation notify coverage. Errors must be resolved; warnings are advisory.
      </p>
      <div className="space-y-4">
        {/* Issue list */}
        <div className="space-y-1.5">
          {NOTIFY_ISSUES.map((issue, i) => (
            <motion.div
              key={`${issue.montage}-${i}`}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                backgroundColor: issue.severity === 'error' ? `${withOpacity(STATUS_ERROR, OPACITY_8)}` : `${withOpacity(STATUS_WARNING, OPACITY_5)}`,
                border: `1px solid ${issue.severity === 'error' ? withOpacity(STATUS_ERROR, OPACITY_20) : withOpacity(STATUS_WARNING, OPACITY_12)}`,
              }}
            >
              {issue.severity === 'error'
                ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />
              }
              <span className="font-mono font-bold text-text">{issue.montage}:</span>
              <span className="text-text-muted">{issue.message}</span>
              <span
                className="ml-auto text-xs font-bold uppercase px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: issue.severity === 'error' ? `${withOpacity(STATUS_ERROR, OPACITY_12)}` : `${withOpacity(STATUS_WARNING, OPACITY_10)}`,
                  color: issue.severity === 'error' ? STATUS_ERROR : STATUS_WARNING,
                }}
              >
                {issue.severity}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Coverage bars */}
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">
            Coverage per Montage
          </div>
          {MONTAGE_COVERAGES.map((mc) => {
            const barColor = mc.coverage >= 0.8 ? STATUS_SUCCESS : mc.coverage >= 0.5 ? STATUS_WARNING : STATUS_ERROR;
            return (
              <div key={mc.montage} className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-text-muted w-28 truncate">{mc.montage}</span>
                <div className="flex-1">
                  <NeonBar pct={mc.coverage * 100} color={barColor} height={12} glow />
                </div>
                <span className="text-xs font-mono text-text-muted w-8 text-right">{Math.round(mc.coverage * 100)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}
