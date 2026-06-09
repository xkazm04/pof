'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Bug, Play, ChevronDown, ChevronRight,
  Copy, Check, Search, RefreshCw, XCircle, FileText,
  ShieldAlert, Layers, ArrowRight, Clock, Cpu,
  TrendingUp, Eye, Upload, Terminal, Lightbulb, Wrench, Code2,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { MultiInteractivePill } from '@/components/ui/InteractivePill';
import type { MultiPillItem } from '@/components/ui/InteractivePill';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { UnderlineTabs } from '@/components/ui/UnderlineTabs';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { formatTimeAgo } from '@/lib/format-time';
import {
  useCrashAnalyzerStore,
  EMPTY_REPORTS,
  EMPTY_DIAGNOSES,
  EMPTY_PATTERNS,
} from '@/stores/crashAnalyzerStore';
import { CrashHealthMap } from './CrashHealthMap';
import { CrashTimeMachine } from './CrashTimeMachine';
import type {
  CrashReport,
  CrashDiagnosis,
  CrashPattern,
  CrashType,
  CrashSeverity,
  CallstackFrame,
} from '@/types/crash-analyzer';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD, ACCENT_ROSE, STATUS_ERROR, STATUS_WARNING, SEVERITY_TOKENS } from '@/lib/chart-colors';
import { DURATION, EASE_OUT, motionSafe } from '@/lib/motion';
import { plainCrashType, plainSeverity } from '@/lib/crash-glossary';

// ── Constants ───────────────────────────────────────────────────────────────

// Crash severities draw from the shared SEVERITY_TOKENS map (chart-colors), the
// same source Deep Eval / GDD Compliance / Archeologist use — so a `critical`
// crash renders with the identical hue everywhere instead of mixing status-red
// design tokens with raw orange/amber/blue palette classes. `CrashSeverity`
// (critical|high|medium|low) is a subset of the token keys, so direct indexing
// is type-safe.
const SEVERITY_LABELS: Record<CrashSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CRASH_TYPE_LABELS: Record<CrashType, string> = {
  nullptr_deref: 'Null Pointer',
  access_violation: 'Access Violation',
  assertion_failed: 'Assertion',
  ensure_failed: 'Ensure',
  gc_reference: 'GC Reference',
  stack_overflow: 'Stack Overflow',
  out_of_memory: 'OOM',
  unhandled_exception: 'Unhandled',
  fatal_error: 'Fatal Error',
  gpu_crash: 'GPU Crash',
  unknown: 'Unknown',
};

type ViewTab = 'crashes' | 'patterns' | 'import' | 'health';

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

            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
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

// ── Sub-components ──────────────────────────────────────────────────────────

/** Plain English ⇄ Technical toggle. Plain mode leads with a humanized story and
 *  hides callstacks/raw logs behind a disclosure; Technical restores the dense
 *  developer view. */
function PlainModeToggle({ plain, onChange }: { plain: boolean; onChange: (v: boolean) => void }) {
  const options: { id: 'plain' | 'technical'; label: string; icon: typeof Lightbulb; hint: string }[] = [
    { id: 'plain', label: 'Plain English', icon: Lightbulb, hint: 'Humanized summaries — what happened & what to do' },
    { id: 'technical', label: 'Technical', icon: Code2, hint: 'Full callstacks, diagnoses, and raw logs' },
  ];
  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
      role="group"
      aria-label="Crash detail level"
    >
      {options.map((opt) => {
        const active = (opt.id === 'plain') === plain;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id === 'plain')}
            aria-pressed={active}
            title={opt.hint}
            className={`focus-ring flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              active ? 'bg-status-red-medium text-red-400' : 'text-text-muted hover:text-text'
            }`}
          >
            <opt.icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <SurfaceCard level={2}>
      <p className="text-2xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold ${accent ? '' : 'text-text'}`} style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </SurfaceCard>
  );
}

/** Severity pill chip driven by the shared SEVERITY_TOKENS, so its color always
 *  matches the corresponding filter pill (fixing the old green-badge-on-blue-row
 *  mismatch on `low`). */
function SeverityBadge({ severity }: { severity: CrashSeverity }) {
  const token = SEVERITY_TOKENS[severity];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-2xs font-medium rounded border capitalize"
      style={{ color: token.color, backgroundColor: token.bg, borderColor: token.border }}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function CrashListItem({
  report,
  isSelected,
  onClick,
  diagnosis,
}: {
  report: CrashReport;
  isSelected: boolean;
  onClick: () => void;
  diagnosis: CrashDiagnosis | undefined;
}) {
  const token = SEVERITY_TOKENS[report.severity];
  const timeAgo = formatTimeAgo(report.timestamp);

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 cursor-pointer transition-all ${
        isSelected ? '' : 'border-border hover:border-border/80 hover:bg-surface-2/50'
      }`}
      style={isSelected ? { borderColor: token.color, backgroundColor: token.bg } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <SeverityBadge severity={report.severity} />
            <Badge variant="default">{CRASH_TYPE_LABELS[report.crashType]}</Badge>
            {report.mappedModule && (
              <span className="text-2xs text-text-muted">{report.mappedModule}</span>
            )}
          </div>
          <p className="text-xs text-text truncate">{report.errorMessage}</p>
          {report.culpritFrame && (
            <p className="text-2xs text-text-muted mt-0.5 truncate">
              {report.culpritFrame.functionName}
              {report.culpritFrame.sourceFile && ` — ${report.culpritFrame.sourceFile}:${report.culpritFrame.lineNumber}`}
            </p>
          )}
          {diagnosis && (
            <p className="text-2xs text-emerald-400 mt-0.5 truncate">
              AI: {diagnosis.summary}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-2xs text-text-muted">{timeAgo}</span>
          {diagnosis && (
            <ProgressRing value={Math.round(diagnosis.confidence * 100)} size={24} strokeWidth={2.5} color={ACCENT_EMERALD} />
          )}
        </div>
      </div>
    </div>
  );
}

function CrashDetailPanel({
  report,
  diagnosis,
  onClose,
  plainMode,
}: {
  report: CrashReport;
  diagnosis: CrashDiagnosis | null;
  onClose: () => void;
  plainMode: boolean;
}) {
  // In Plain English mode the dense developer sections (callstack, AI root cause,
  // raw log) collapse behind one disclosure so the humanized story leads. Default
  // closed there; in Technical mode they're always shown.
  const [showTech, setShowTech] = useState(false);

  return (
    <div className="space-y-3 pl-4">
      {/* Header */}
      <SurfaceCard>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4" style={{ color: SEVERITY_TOKENS[report.severity].color }} />
            <span className="text-xs font-semibold text-text">{report.id}</span>
            <SeverityBadge severity={report.severity} />
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-text mb-2">
          <DecoratedCrashText text={report.errorMessage} />
        </p>
        <div className="flex flex-wrap gap-2 text-2xs text-text-muted">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(report.timestamp).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{report.machineState.engineVersion} {report.machineState.buildConfig}</span>
          {report.mappedModule && <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{report.mappedModule}</span>}
        </div>
      </SurfaceCard>

      {plainMode ? (
        <>
          {/* Humanized "what happened / what to do" */}
          <PlainCrashSummary report={report} diagnosis={diagnosis} />

          {/* All developer detail tucked behind one disclosure */}
          <button
            onClick={() => setShowTech((v) => !v)}
            data-testid="show-tech-toggle"
            aria-expanded={showTech}
            className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors"
          >
            <Terminal className="w-3 h-3" />
            {showTech ? 'Hide' : 'Show'} technical details
            {showTech ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <AnimatePresence>
            {showTech && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3">
                  <CallstackCard report={report} />
                  {diagnosis && <AiDiagnosisCard diagnosis={diagnosis} />}
                  <RawLogBlock rawLog={report.rawLog} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          {/* Technical mode — dense developer view */}
          <CallstackCard report={report} />
          {diagnosis && <AiDiagnosisCard diagnosis={diagnosis} />}
          <RawLogDisclosure rawLog={report.rawLog} />
        </>
      )}
    </div>
  );
}

/** The humanized lead: leads with the AI summary + fix when present, always
 *  backed by the plain-language crashType/severity translations. */
function PlainCrashSummary({ report, diagnosis }: { report: CrashReport; diagnosis: CrashDiagnosis | null }) {
  const plain = plainCrashType(report.crashType);
  const sev = plainSeverity(report.severity);
  const whatHappened = diagnosis?.summary ?? plain.what;
  const whatToDo = diagnosis?.fixDescription ?? plain.fix;

  return (
    <SurfaceCard data-testid="plain-crash-summary">
      <div className="space-y-3">
        <div>
          <p className="text-2xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Bug className="w-3 h-3" style={{ color: SEVERITY_TOKENS[report.severity].color }} />
            What happened
          </p>
          <p className="text-xs text-text leading-relaxed">
            <DecoratedCrashText text={whatHappened} />
          </p>
          <p className="text-2xs text-text-muted mt-1">{sev.meaning}</p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Wrench className="w-3 h-3 text-emerald-400" />
            What to do
          </p>
          <p className="text-xs text-text leading-relaxed">
            <DecoratedCrashText text={whatToDo} />
          </p>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-2xs text-text-muted">Crash type:</span>
          <Badge variant="default">{CRASH_TYPE_LABELS[report.crashType]}</Badge>
          <span className="text-2xs text-text-muted">·</span>
          <span className="text-2xs text-text-muted">{plain.label}</span>
        </div>
      </div>
    </SurfaceCard>
  );
}

function CallstackCard({ report }: { report: CrashReport }) {
  // The Time Machine reimagines the raw frame list as a scrubable replay that
  // walks execution from engine entry into game code and stops on the glowing
  // culprit; the static list below stays as the full, copy-friendly reference.
  return (
    <SurfaceCard>
      <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
        <Terminal className="w-3.5 h-3.5 text-red-400" />
        Callstack ({report.callstack.length} frames)
      </h3>
      <CrashTimeMachine key={report.id} report={report} />
      <div className="mt-3 pt-3 border-t border-border space-y-0.5 max-h-48 overflow-y-auto">
        {report.callstack.map((frame) => (
          <FrameRow key={frame.index} frame={frame} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function AiDiagnosisCard({ diagnosis }: { diagnosis: CrashDiagnosis }) {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(diagnosis.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [diagnosis]);

  return (
    <SurfaceCard>
      <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5 text-emerald-400" />
        AI Root Cause Analysis
        <ProgressRing value={Math.round(diagnosis.confidence * 100)} size={20} strokeWidth={2} color={ACCENT_EMERALD} />
      </h3>

      <div className="space-y-3">
        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Summary</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.summary} /></p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Root Cause</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.rootCause} /></p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">UE5 Pattern</p>
          <Badge variant="warning">{diagnosis.uePattern}</Badge>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Fix Description</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.fixDescription} /></p>
        </div>

        {/* Fix prompt */}
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-2xs font-medium text-emerald-400 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> One-Click Fix Prompt
            </p>
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs leading-relaxed text-emerald-300/80 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
            {diagnosis.fixPrompt}
          </pre>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {diagnosis.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-surface-2 text-text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

function RawLogBlock({ rawLog }: { rawLog: string }) {
  return (
    <div>
      <p className="text-2xs font-medium text-text mb-1 flex items-center gap-1.5">
        <FileText className="w-3 h-3" /> Raw Log
      </p>
      <pre className="text-xs leading-relaxed p-3 rounded-md border border-border bg-surface text-text-muted overflow-x-auto max-h-48 overflow-y-auto">
        {rawLog}
      </pre>
    </div>
  );
}

/** Standalone raw-log disclosure used in Technical mode (its own toggle). */
function RawLogDisclosure({ rawLog }: { rawLog: string }) {
  const [showRawLog, setShowRawLog] = useState(false);
  return (
    <>
      <button
        onClick={() => setShowRawLog(!showRawLog)}
        className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors"
      >
        <FileText className="w-3 h-3" />
        {showRawLog ? 'Hide' : 'Show'} Raw Log
        {showRawLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {showRawLog && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="text-xs leading-relaxed p-3 rounded-md border border-border bg-surface text-text-muted overflow-x-auto max-h-48 overflow-y-auto">
              {rawLog}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FrameRow({ frame }: { frame: CallstackFrame }) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded text-xs leading-relaxed ${
        frame.isCrashOrigin ? 'border' : frame.isGameCode ? 'bg-surface-2/50' : ''
      }`}
      style={frame.isCrashOrigin
        ? { backgroundColor: SEVERITY_TOKENS.critical.bg, borderColor: SEVERITY_TOKENS.critical.border }
        : undefined}
    >
      <span className="text-text-muted w-4 text-right shrink-0">#{frame.index}</span>
      <span className={`font-mono truncate ${frame.isGameCode ? 'text-text' : 'text-text-muted'}`}>
        {frame.functionName}
      </span>
      {frame.sourceFile && (
        <span className="text-text-muted shrink-0">
          {frame.sourceFile}:{frame.lineNumber}
        </span>
      )}
      {frame.isCrashOrigin && (
        <Badge variant="error">crash</Badge>
      )}
    </div>
  );
}

function PatternCard({ pattern, plainMode }: { pattern: CrashPattern; plainMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const plain = plainCrashType(pattern.crashType);

  return (
    <SurfaceCard>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {pattern.isSystemic ? (
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        ) : (
          <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-text">{pattern.name}</span>
            {pattern.isSystemic && <Badge variant="error">systemic</Badge>}
            <Badge variant="warning">{pattern.occurrences}x</Badge>
            {plainMode && <span className="text-2xs text-text-muted">{plain.label}</span>}
          </div>
          <p className="text-2xs text-text-muted mt-0.5">
            <DecoratedCrashText text={pattern.description} />
          </p>
          {plainMode && (
            <p className="text-2xs text-text-muted/80 mt-0.5 italic">{plain.fix}</p>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-border space-y-2">
              <div>
                <p className="text-2xs font-medium text-text">Root Cause</p>
                <p className="text-2xs text-text-muted"><DecoratedCrashText text={pattern.rootCause} /></p>
              </div>
              <div>
                <p className="text-2xs font-medium text-text">Signature Functions</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {pattern.signatureFunctions.map((fn) => (
                    <span key={fn} className="px-1.5 py-0.5 rounded text-xs bg-surface-2 text-text-muted font-mono">
                      {fn}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-2xs text-text-muted">
                <span>Crash IDs: {pattern.crashIds.join(', ')}</span>
                <span>First: {formatTimeAgo(pattern.firstSeen)}</span>
                <span>Last: {formatTimeAgo(pattern.lastSeen)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

function ImportPanel() {
  const [rawLog, setRawLog] = useState('');
  const importCrashLog = useCrashAnalyzerStore((s) => s.importCrashLog);
  const isLoading = useCrashAnalyzerStore((s) => s.isLoading);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    if (!rawLog.trim()) return;
    const report = await importCrashLog(rawLog);
    if (report) {
      setImportResult(`Imported crash ${report.id} — ${CRASH_TYPE_LABELS[report.crashType]} (${report.severity})`);
      setRawLog('');
    }
  }, [rawLog, importCrashLog]);

  return (
    <div className="space-y-3">
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-red-400" />
          Import Crash Log
        </h3>
        <p className="text-2xs text-text-muted mb-3">
          Paste a UE5 crash log (from Saved/Logs/ or CrashReportClient output) to analyze it.
        </p>
        <textarea
          value={rawLog}
          onChange={(e) => setRawLog(e.target.value)}
          placeholder={`Paste crash log here...\n\nExample:\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: [Callstack]\n[2026.02.14-22.15.33:456][  0]LogWindows: Error: UnrealEditor-MyGame!MyFunction() [MyFile.cpp:123]`}
          className="w-full h-40 p-3 rounded-md border border-border bg-surface text-xs text-text font-mono placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-status-red-strong resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={handleImport}
            disabled={isLoading || !rawLog.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-status-red-subtle text-red-400 hover:bg-status-red-medium transition-colors disabled:opacity-40"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import & Analyze
          </button>
          {importResult && (
            <span className="text-2xs text-emerald-400">{importResult}</span>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}

