'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Bug, Play, Search, RefreshCw, XCircle, Layers,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MultiInteractivePill } from '@/components/ui/InteractivePill';
import type { MultiPillItem } from '@/components/ui/InteractivePill';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import {
  useCrashAnalyzerStore,
  EMPTY_REPORTS,
  EMPTY_DIAGNOSES,
  EMPTY_PATTERNS,
} from '@/stores/crashAnalyzerStore';
import { CrashHealthMap } from '../CrashHealthMap';
import type { CrashSeverity } from '@/types/crash-analyzer';
import { ACCENT_ROSE, STATUS_ERROR, STATUS_WARNING, SEVERITY_TOKENS } from '@/lib/chart-colors';
import { DURATION, EASE_OUT, motionSafe } from '@/lib/motion';
import { SEVERITY_LABELS, CRASH_TYPE_LABELS, type ViewTab } from './constants';
import { MiniStat } from './MiniStat';
import { PlainModeToggle } from './PlainModeToggle';
import { CrashListItem } from './CrashListItem';
import { CrashDetailPanel } from './CrashDetailPanel';
import { PatternCard } from './PatternCard';
import { ImportPanel } from './ImportPanel';

// ── Main Component ──────────────────────────────────────────────────────────

export function CrashAnalyzerView() {
  const reports = useCrashAnalyzerStore((s) => s.reports) ?? EMPTY_REPORTS;
  const diagnoses = useCrashAnalyzerStore((s) => s.diagnoses) ?? EMPTY_DIAGNOSES;
  const patterns = useCrashAnalyzerStore((s) => s.patterns) ?? EMPTY_PATTERNS;
  const stats = useCrashAnalyzerStore((s) => s.stats);
  const selectedCrashId = useCrashAnalyzerStore((s) => s.selectedCrashId);
  const isLoading = useCrashAnalyzerStore((s) => s.isLoading);
  const error = useCrashAnalyzerStore((s) => s.error);
  const fetchAnalysis = useCrashAnalyzerStore((s) => s.fetchAnalysis);
  const selectCrash = useCrashAnalyzerStore((s) => s.selectCrash);

  const [viewTab, setViewTab] = useState<ViewTab>('crashes');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Set<CrashSeverity>>(new Set());
  // Plain English mode leads with a humanized "what happened / what to do" story
  // and tucks callstacks + raw logs behind a disclosure. Default ON so the screen
  // is legible to non-technical readers (PMs, newcomers); "Technical" restores the
  // dense developer view.
  const [plainMode, setPlainMode] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Filtered crashes
  const filteredReports = useMemo(() => {
    let result = reports;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.errorMessage.toLowerCase().includes(q) ||
          r.callstack.some((f) => f.functionName.toLowerCase().includes(q)) ||
          (r.mappedModule ?? '').toLowerCase().includes(q),
      );
    }
    if (severityFilter.size > 0) {
      result = result.filter((r) => severityFilter.has(r.severity));
    }
    return result;
  }, [reports, searchQuery, severityFilter]);

  // Severity counts for pill badges
  const severityCounts = useMemo(() => {
    const counts: Record<CrashSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of reports) counts[r.severity]++;
    return counts;
  }, [reports]);

  const SEVERITY_PILLS: MultiPillItem[] = useMemo(() => [
    { id: 'critical', label: SEVERITY_LABELS.critical, color: SEVERITY_TOKENS.critical.color, count: severityCounts.critical },
    { id: 'high', label: SEVERITY_LABELS.high, color: SEVERITY_TOKENS.high.color, count: severityCounts.high },
    { id: 'medium', label: SEVERITY_LABELS.medium, color: SEVERITY_TOKENS.medium.color, count: severityCounts.medium },
    { id: 'low', label: SEVERITY_LABELS.low, color: SEVERITY_TOKENS.low.color, count: severityCounts.low },
  ], [severityCounts]);

  const toggleSeverity = useCallback((id: string) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id as CrashSeverity)) next.delete(id as CrashSeverity);
      else next.add(id as CrashSeverity);
      return next;
    });
  }, []);

  // Selected crash detail
  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedCrashId) ?? null,
    [reports, selectedCrashId],
  );
  const selectedDiagnosis = useMemo(
    () => diagnoses.find((d) => d.crashId === selectedCrashId) ?? null,
    [diagnoses, selectedCrashId],
  );

  const hasData = reports.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={Bug}
        title="Crash Log Analyzer"
        subtitle="Parse UE5 crash dumps, identify root causes with AI, and generate one-click fix prompts"
        accent="rose"
        accentTo="orange"
        action={
          <button
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isLoading ? 'Analyzing...' : 'Analyze Crashes'}
          </button>
        }
      />

      {/* Error */}
      {error && (
        <SurfaceCard level={2}>
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        </SurfaceCard>
      )}

      {/* Stats bar */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <MiniStat label="Total Crashes" value={stats.totalCrashes} accent={STATUS_ERROR} />
          <MiniStat label="Critical" value={stats.crashesBySeverity.critical} accent={stats.crashesBySeverity.critical > 0 ? SEVERITY_TOKENS.critical.color : undefined} />
          <MiniStat label="Patterns" value={stats.patternsDetected} accent={STATUS_WARNING} />
          <MiniStat label="Systemic" value={stats.systemicIssues} accent={stats.systemicIssues > 0 ? SEVERITY_TOKENS.critical.color : undefined} />
          <MiniStat label="Recent (24h)" value={stats.recentCrashes} />
          <MiniStat label="Top Type" value={CRASH_TYPE_LABELS[stats.mostCommonType]} />
        </div>
      )}

      {/* Sub-tabs */}
      {hasData && (
        <UnderlineTabs
          ariaLabel="Crash analyzer views"
          accent={ACCENT_ROSE}
          active={viewTab}
          onChange={(id) => setViewTab(id)}
          tabs={[
            { id: 'crashes', label: 'Crash Reports', count: reports.length },
            { id: 'patterns', label: 'Patterns', count: patterns.length },
            { id: 'health', label: 'Health Map' },
            { id: 'import', label: 'Import Log' },
          ]}
          trailing={
            viewTab === 'crashes' || viewTab === 'patterns' ? (
              <PlainModeToggle plain={plainMode} onChange={setPlainMode} />
            ) : undefined
          }
        />
      )}

      {/* Empty state */}
      {!hasData && !isLoading && (
        <SurfaceCard>
          <div className="text-center py-12">
            <Bug className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-text-muted mb-1">No crash data loaded</p>
            <p className="text-2xs text-text-muted">
              Click &quot;Analyze Crashes&quot; to load sample crash data, or import a crash log.
            </p>
          </div>
        </SurfaceCard>
      )}

      {/* Loading */}
      {isLoading && !hasData && (
        <SurfaceCard>
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-red-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-text-muted">Analyzing crash dumps...</p>
          </div>
        </SurfaceCard>
      )}

      {/* ── Crashes Tab ──────────────────────────────────────────── */}
      {/*
        Master-detail split runs on a CSS grid whose track widths snap once
        (full → 50/50) rather than a per-frame Framer width tween. The old
        `animate={{ width: '50%' }}` re-flowed the crash list every frame on a
        long list; now the list shrinks in a single reflow and the detail panel
        slides in purely on the compositor (transform + opacity + will-change)
        for a solid-60fps reveal. `prefers-reduced-motion` drops the slide.
      */}
      {hasData && viewTab === 'crashes' && (
        <div
          data-testid="crashes-split"
          className="grid gap-4 items-start"
          style={{ gridTemplateColumns: selectedReport ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)' }}
        >
          {/* Crash list */}
          <div className="space-y-3 min-w-0">
            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search crashes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-status-red-strong"
                />
              </div>
              <MultiInteractivePill
                items={SEVERITY_PILLS}
                activeIds={severityFilter}
                onToggle={toggleSeverity}
              />
            </div>

            {/* Real listbox: each CrashListItem is a focusable role=option that
                reports aria-selected, so the triage list is keyboard/SR operable. */}
            <div
              role="listbox"
              aria-label="Crash reports"
              className="space-y-2 max-h-[65vh] overflow-y-auto"
            >
              {filteredReports.map((r) => (
                <CrashListItem
                  key={r.id}
                  report={r}
                  isSelected={r.id === selectedCrashId}
                  onClick={() => selectCrash(r.id === selectedCrashId ? null : r.id)}
                  diagnosis={diagnoses.find((d) => d.crashId === r.id)}
                />
              ))}
            </div>
          </div>

          {/* Detail panel — a fixed-width grid track (no width tween). The track
              snaps in alongside the list in a single reflow; its content then
              slides + fades in purely on the compositor, so the adjacent list
              never re-flows mid-animation. */}
          {selectedReport && (
            <div className="min-w-0 overflow-hidden">
              <motion.div
                data-testid="crash-detail-anim"
                initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={motionSafe({ duration: DURATION.base, ease: EASE_OUT }, prefersReducedMotion)}
                style={{ willChange: 'transform, opacity' }}
              >
                <CrashDetailPanel
                  report={selectedReport}
                  diagnosis={selectedDiagnosis}
                  onClose={() => selectCrash(null)}
                  plainMode={plainMode}
                />
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* ── Patterns Tab ─────────────────────────────────────────── */}
      {hasData && viewTab === 'patterns' && (
        <div className="space-y-3">
          {patterns.length === 0 ? (
            <SurfaceCard>
              <div className="text-center py-8">
                <Layers className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
                <p className="text-sm text-text-muted">No recurring patterns detected</p>
                <p className="text-2xs text-text-muted mt-1">Patterns emerge when multiple crashes share the same callstack signature.</p>
              </div>
            </SurfaceCard>
          ) : (
            patterns.map((p) => <PatternCard key={p.id} pattern={p} plainMode={plainMode} />)
          )}
        </div>
      )}

      {/* ── Health Map Tab ──────────────────────────────────────── */}
      {hasData && viewTab === 'health' && (
        <CrashHealthMap reports={reports} patterns={patterns} />
      )}

      {/* ── Import Tab ───────────────────────────────────────────── */}
      {hasData && viewTab === 'import' && (
        <ImportPanel />
      )}
    </div>
  );
}
