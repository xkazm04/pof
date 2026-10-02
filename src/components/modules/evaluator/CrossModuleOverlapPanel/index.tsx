'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Filter,
  GitCompareArrows,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { KPICard } from '@/components/ui/KPICard';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { OverlapReport, OverlapPair } from '@/lib/overlap-detection';
import type { SourceState } from '@/lib/evaluator/nexus-signals';
import { buildTwinRows, classifyTwin, splitTwinKey } from '@/lib/evaluator/overlap-twins';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { TaskFactory, type CallbackStatus } from '@/lib/cli-task';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';
import { UI_TIMEOUTS, getAppOrigin } from '@/lib/constants';
import { STATUS_ERROR, STATUS_SUCCESS, MODULE_COLORS } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { REASON_CONFIG, TWIN_KIND_CONFIG, type FilterReason } from './constants';
import { moduleLabel } from './helpers';
import { StatCard, ModuleBubble, FilterChip } from './SummaryParts';
import { OverlapRow } from './OverlapRow';

/** The feature definition a twin key names (null = not a defined feature, so no review). */
function twinDefinition(key: string) {
  const { moduleId, featureName } = splitTwinKey(key);
  return MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId]?.find((d) => d.featureName === featureName) ?? null;
}

/** One read of the overlap report as a source state: a failure keeps its reason. */
function loadOverlaps(): Promise<SourceState<OverlapReport>> {
  return apiFetch<{ report: OverlapReport }>('/api/feature-matrix/overlap').then(
    (data): SourceState<OverlapReport> => ({ state: 'ready', data: data.report }),
    (err: unknown): SourceState<OverlapReport> => ({ state: 'failed', error: err instanceof Error ? err.message : String(err) }),
  );
}

// ── Component ──

export function CrossModuleOverlapPanel() {
  const [source, setSource] = useState<SourceState<OverlapReport>>({ state: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [filterReason, setFilterReason] = useState<FilterReason>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<{ key: string; message: string } | null>(null);
  const reviewing = useRef<string | null>(null);
  const statuses = useFeatureStatuses();
  // A failed or unsettled status read is NOT an empty map: twins stay unclassified.
  const statusMap = statuses.loaded && !statuses.failed ? statuses.statusMap : null;

  useEffect(() => {
    let cancelled = false;
    void loadOverlaps().then((next) => { if (!cancelled) setSource(next); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reanalyze = useCallback(() => {
    setSource({ state: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  // One review session for the tab; a landed review refreshes every status reader.
  const onComplete = useCallback((success: boolean, callbackStatus?: CallbackStatus) => {
    const key = reviewing.current;
    reviewing.current = null;
    if (!key) return;
    if (success && callbackStatus === 'confirmed') {
      invalidateFeatureData();
      return;
    }
    const why = !success ? 'run failed' : `callback ${callbackStatus ?? 'unconfirmed'}`;
    setReviewError({ key, message: `Review of ${splitTwinKey(key).featureName} did not land (${why})` });
  }, []);
  const { execute, isRunning } = useModuleCLI({
    moduleId: 'core-engine' as SubModuleId,
    sessionKey: 'overlap-twin-review',
    label: 'Twin Review',
    accentColor: MODULE_COLORS.evaluator,
    onComplete,
  });

  // Explicit click only: a one-feature review of the named twin.
  const reviewTwin = useCallback((key: string) => {
    const def = twinDefinition(key);
    if (!def) return;
    const { moduleId, featureName } = splitTwinKey(key);
    reviewing.current = key;
    setReviewError(null);
    void execute(TaskFactory.featureReview(moduleId as SubModuleId, moduleLabel(moduleId), [def], getAppOrigin(), `Review twin: ${featureName}`));
  }, [execute]);

  const report = source.state === 'ready' ? source.data : null;

  const twinRows = useMemo(() => {
    if (!report) return [];
    const overlaps = filterReason === 'all' ? report.overlaps : report.overlaps.filter((o) => o.reason === filterReason);
    return buildTwinRows(overlaps, statusMap);
  }, [report, filterReason, statusMap]);

  const divergedCount = useMemo(() => {
    if (!report || !statusMap) return null;
    return report.overlaps.filter((o) => classifyTwin(o, statusMap).kind === 'diverged').length;
  }, [report, statusMap]);

  const reasonCounts = useMemo(() => {
    const counts = { name_match: 0, description_similarity: 0, shared_category_keywords: 0 };
    for (const o of report?.overlaps ?? []) counts[o.reason]++;
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

  if (source.state === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  // A failed read is an error with Retry - never the clean-separation empty state.
  if (source.state === 'failed') {
    return (
      <div className="py-8">
        <InlineErrorRetry message={`Overlap analysis failed: ${source.error}`} onRetry={reanalyze} />
      </div>
    );
  }

  const data = source.data;
  if (data.totalOverlaps === 0) {
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
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total Overlaps" value={data.totalOverlaps} color={STATUS_ERROR} icon={AlertTriangle} />
        <KPICard
          layout="vertical"
          animated
          accent={TWIN_KIND_CONFIG.diverged.color}
          icon={<GitCompareArrows className="w-3 h-3" style={{ color: TWIN_KIND_CONFIG.diverged.color }} />}
          label="Diverged"
          value={divergedCount ?? '—'}
        />
        <StatCard label="Name Matches" value={reasonCounts.name_match} color={REASON_CONFIG.name_match.color} icon={Layers} />
        <StatCard label="Description" value={reasonCounts.description_similarity} color={REASON_CONFIG.description_similarity.color} icon={Layers} />
        <StatCard label="Category" value={reasonCounts.shared_category_keywords} color={REASON_CONFIG.shared_category_keywords.color} icon={Layers} />
      </div>

      {statuses.failed && (
        <InlineErrorRetry message={`Twin statuses unavailable: ${statuses.error ?? 'status read failed'}`} onRetry={statuses.refresh} />
      )}
      {reviewError && (
        <InlineErrorRetry
          message={reviewError.message}
          onRetry={() => reviewTwin(reviewError.key)}
          onDismiss={() => setReviewError(null)}
        />
      )}

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
            onClick={reanalyze}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
            title="Re-analyze"
            aria-label="Re-analyze overlaps"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.moduleSummaries.slice(0, 12).map((ms) => (
            <ModuleBubble key={ms.moduleId} summary={ms} maxCount={data.moduleSummaries[0]?.overlapCount ?? 1} />
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
              ({twinRows.length}{filterReason !== 'all' ? ` of ${data.totalOverlaps}` : ''})
            </span>
            {!statuses.loaded && <span className="text-2xs text-text-muted">· loading twin statuses…</span>}
          </div>
          <div className="flex items-center gap-1">
            <FilterChip label="All" active={filterReason === 'all'} onClick={() => setFilterReason('all')} color="var(--text-muted)" />
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
          {twinRows.map(({ overlap, twin }) => {
            const id = `${overlap.moduleA}:${overlap.featureA}:${overlap.moduleB}:${overlap.featureB}`;
            return (
              <OverlapRow
                key={id}
                overlap={overlap}
                twin={twin}
                reviewKeys={(twin?.reviewKeys ?? []).filter((k) => twinDefinition(k) !== null)}
                reviewBusy={isRunning}
                onReview={reviewTwin}
                isExpanded={expandedPairs.has(id)}
                isCopied={copiedId === id}
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
