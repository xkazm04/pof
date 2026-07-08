'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Filter,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { OverlapReport, OverlapPair } from '@/lib/overlap-detection';
import { UI_TIMEOUTS } from '@/lib/constants';
import { STATUS_ERROR, STATUS_SUCCESS } from '@/lib/chart-colors';
import { REASON_CONFIG, type FilterReason } from './constants';
import { moduleLabel } from './helpers';
import { StatCard, ModuleBubble, FilterChip } from './SummaryParts';
import { OverlapRow } from './OverlapRow';

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
          <Layers className="w-6 h-6" style={{ color: STATUS_SUCCESS }} />
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
            <Layers className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
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
