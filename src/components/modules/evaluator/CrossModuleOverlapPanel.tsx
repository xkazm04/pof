'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Crown,
  Copy,
  Check,
  Filter,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { MODULE_LABELS } from '@/lib/module-registry';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { OverlapReport, OverlapPair, ModuleOverlapSummary } from '@/lib/overlap-detection';
import { UI_TIMEOUTS } from '@/lib/constants';
import { STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS, OPACITY_30 } from '@/lib/chart-colors';

// ── Reason labels + colors ──

const REASON_CONFIG: Record<OverlapPair['reason'], { label: string; color: string }> = {
  name_match: { label: 'Name Match', color: STATUS_ERROR },
  description_similarity: { label: 'Description Overlap', color: STATUS_WARNING },
  shared_category_keywords: { label: 'Shared Category', color: '#818cf8' },
};

type FilterReason = OverlapPair['reason'] | 'all';

// ── Component ──

export function CrossModuleOverlapPanel() {
  const [report, setReport] = useState<OverlapReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [filterReason, setFilterReason] = useState<FilterReason>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ report: OverlapReport }>('/api/feature-matrix/overlap');
      setReport(data.report);
    } catch (err) {
      console.error('Overlap analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredOverlaps = useMemo(() => {
    if (!report) return [];
    if (filterReason === 'all') return report.overlaps;
    return report.overlaps.filter((o) => o.reason === filterReason);
  }, [report, filterReason]);

  const reasonCounts = useMemo(() => {
    if (!report) return { name_match: 0, description_similarity: 0, shared_category_keywords: 0 };
    const counts = { name_match: 0, description_similarity: 0, shared_category_keywords: 0 };
    for (const o of report.overlaps) {
      counts[o.reason]++;
    }
    return counts;
  }, [report]);

  const togglePair = useCallback((id: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCopy = useCallback(async (overlap: OverlapPair) => {
    const text = [
      `Overlap: ${overlap.featureA} (${moduleLabel(overlap.moduleA)}) ↔ ${overlap.featureB} (${moduleLabel(overlap.moduleB)})`,
      `Similarity: ${Math.round(overlap.similarity * 100)}%`,
      `Reason: ${REASON_CONFIG[overlap.reason].label}`,
      `Suggested owner: ${moduleLabel(overlap.suggestedOwner)} — ${overlap.ownershipReason}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    const id = `${overlap.moduleA}:${overlap.featureA}:${overlap.moduleB}:${overlap.featureB}`;
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), UI_TIMEOUTS.copyFeedback);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!report || report.totalOverlaps === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4">
          <Layers className="w-6 h-6 text-[#4ade80]" />
        </div>
        <h3 className="text-sm font-semibold text-text mb-1">No Overlaps Detected</h3>
        <p className="text-xs text-text-muted text-center max-w-xs leading-relaxed">
          Feature definitions across all modules have clean separation of responsibilities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Summary cards ─────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Total Overlaps"
          value={report.totalOverlaps}
          color={STATUS_ERROR}
          icon={AlertTriangle}
        />
        <StatCard
          label="Name Matches"
          value={reasonCounts.name_match}
          color={REASON_CONFIG.name_match.color}
          icon={Layers}
        />
        <StatCard
          label="Description"
          value={reasonCounts.description_similarity}
          color={REASON_CONFIG.description_similarity.color}
          icon={Layers}
        />
        <StatCard
          label="Category"
          value={reasonCounts.shared_category_keywords}
          color={REASON_CONFIG.shared_category_keywords.color}
          icon={Layers}
        />
      </div>

      {/* ── Module heatmap ─────────────────────── */}
      <SurfaceCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#f87171]" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Modules by Overlap Count
            </span>
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
            title="Re-analyze"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {report.moduleSummaries.slice(0, 12).map((ms) => (
            <ModuleBubble key={ms.moduleId} summary={ms} maxCount={report.moduleSummaries[0]?.overlapCount ?? 1} />
          ))}
        </div>
      </SurfaceCard>

      {/* ── Filter bar + Overlap list ────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Detected Overlaps
            </span>
            <span className="text-2xs text-text-muted">
              ({filteredOverlaps.length}{filterReason !== 'all' ? ` of ${report.totalOverlaps}` : ''})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <FilterChip
              label="All"
              active={filterReason === 'all'}
              onClick={() => setFilterReason('all')}
              color="var(--text-muted)"
            />
            {(Object.keys(REASON_CONFIG) as OverlapPair['reason'][]).map((reason) => (
              <FilterChip
                key={reason}
                label={REASON_CONFIG[reason].label}
                active={filterReason === reason}
                onClick={() => setFilterReason(reason)}
                color={REASON_CONFIG[reason].color}
                count={reasonCounts[reason]}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          {filteredOverlaps.map((overlap) => {
            const id = `${overlap.moduleA}:${overlap.featureA}:${overlap.moduleB}:${overlap.featureB}`;
            const isExpanded = expandedPairs.has(id);
            const isCopied = copiedId === id;
            return (
              <OverlapRow
                key={id}
                overlap={overlap}
                isExpanded={isExpanded}
                isCopied={isCopied}
                onToggle={() => togglePair(id)}
                onCopy={() => handleCopy(overlap)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function moduleLabel(id: string): string {
  return MODULE_LABELS[id] ?? id;
}

function similarityColor(sim: number): string {
  if (sim >= 0.6) return STATUS_ERROR;
  if (sim >= 0.4) return STATUS_WARNING;
  return '#818cf8';
}

// ── Sub-components ──

function StatCard({ label, value, color, icon: Icon }: {
  label: string;
  value: number;
  color: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="bg-surface border border-border rounded-lg p-3"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        {value}
      </div>
    </motion.div>
  );
}

function ModuleBubble({ summary, maxCount }: { summary: ModuleOverlapSummary; maxCount: number }) {
  const intensity = Math.max(0.2, summary.overlapCount / maxCount);
  return (
    <div
      className="px-3 py-1.5 rounded-full border text-xs font-medium transition-colors"
      style={{
        backgroundColor: `rgba(248, 113, 113, ${intensity * 0.15})`,
        borderColor: `rgba(248, 113, 113, ${intensity * 0.4})`,
        color: `rgba(248, 113, 113, ${0.5 + intensity * 0.5})`,
      }}
      title={`${moduleLabel(summary.moduleId)}: ${summary.overlapCount} overlaps with ${summary.overlappingModules.length} modules`}
    >
      {moduleLabel(summary.moduleId)}
      <span className="ml-1.5 text-2xs opacity-70">{summary.overlapCount}</span>
    </div>
  );
}

function FilterChip({ label, active, onClick, color, count }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all"
      style={{
        backgroundColor: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--text-muted)',
        border: `1px solid ${active ? `${color}40` : 'transparent'}`,
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="opacity-60">{count}</span>
      )}
    </button>
  );
}

function OverlapRow({ overlap, isExpanded, isCopied, onToggle, onCopy }: {
  overlap: OverlapPair;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const cfg = REASON_CONFIG[overlap.reason];
  const simPct = Math.round(overlap.similarity * 100);
  const simColor = similarityColor(overlap.similarity);

  return (
    <div className="group rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover ${
          isExpanded ? 'bg-[#111130]' : ''
        }`}
      >
        {/* Reason dot */}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />

        {/* Module A → Feature A */}
        <span className="text-xs text-text font-medium truncate min-w-0" style={{ maxWidth: '28%' }}>
          <span className="text-text-muted">{moduleLabel(overlap.moduleA)}</span>
          <span className="text-text-muted mx-1">/</span>
          {overlap.featureA}
        </span>

        {/* Arrow */}
        <span className="flex-shrink-0 text-text-muted">
          <ArrowRight className="w-3 h-3" />
        </span>

        {/* Module B → Feature B */}
        <span className="text-xs text-text font-medium truncate min-w-0" style={{ maxWidth: '28%' }}>
          <span className="text-text-muted">{moduleLabel(overlap.moduleB)}</span>
          <span className="text-text-muted mx-1">/</span>
          {overlap.featureB}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Hover copy button */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onCopy(); } }}
          className="p-1 rounded hover:bg-border transition-all text-text-muted hover:text-text opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 flex-shrink-0"
          title={isCopied ? 'Copied!' : 'Copy overlap details'}
        >
          {isCopied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
        </span>

        {/* Similarity badge */}
        <span
          className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
          style={{ backgroundColor: `${simColor}18`, color: simColor }}
        >
          {simPct}%
        </span>

        {/* Reason badge */}
        <span
          className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
          style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
        >
          {cfg.label}
        </span>

        {/* Expand */}
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        }
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="border-t border-border bg-surface-deep"
        >
          <div className="grid grid-cols-2 gap-4 p-4">
            {/* Feature A */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {moduleLabel(overlap.moduleA)}
                </span>
              </div>
              <p className="text-xs text-text font-medium mb-1">{overlap.featureA}</p>
              <p className="text-2xs text-text-muted leading-relaxed">{overlap.descriptionA}</p>
            </div>

            {/* Feature B */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {moduleLabel(overlap.moduleB)}
                </span>
              </div>
              <p className="text-xs text-text font-medium mb-1">{overlap.featureB}</p>
              <p className="text-2xs text-text-muted leading-relaxed">{overlap.descriptionB}</p>
            </div>
          </div>

          {/* Ownership suggestion */}
          <div className="mx-4 mb-4 px-3 py-2.5 rounded-lg border bg-surface" style={{ borderColor: `${STATUS_SUCCESS}${OPACITY_30}` }}>
            <div className="flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 text-[#4ade80] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-[#4ade80]">
                  Suggested owner: {moduleLabel(overlap.suggestedOwner)}
                </span>
                <p className="text-2xs text-text-muted mt-0.5">
                  {overlap.ownershipReason}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
