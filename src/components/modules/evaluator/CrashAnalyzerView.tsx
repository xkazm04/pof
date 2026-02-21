'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Bug, Play, AlertTriangle, ChevronDown, ChevronRight,
  Copy, Check, Search, RefreshCw, XCircle, FileText,
  ShieldAlert, Layers, ArrowRight, Clock, Cpu,
  TrendingUp, Eye, Upload, Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import type {
  CrashReport,
  CrashDiagnosis,
  CrashPattern,
  CrashType,
  CrashSeverity,
  CallstackFrame,
} from '@/types/crash-analyzer';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

const EMPTY_REPORTS: CrashReport[] = [];
const EMPTY_DIAGNOSES: CrashDiagnosis[] = [];
const EMPTY_PATTERNS: CrashPattern[] = [];

const SEVERITY_STYLE: Record<CrashSeverity, { bg: string; border: string; text: string; badge: 'error' | 'warning' | 'success' | 'default' }> = {
  critical: { bg: 'bg-status-red-subtle', border: 'border-status-red-medium', text: 'text-red-400', badge: 'error' },
  high:     { bg: 'bg-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-400', badge: 'warning' },
  medium:   { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'default' },
  low:      { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'success' },
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

type ViewTab = 'crashes' | 'patterns' | 'import';

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
  const [severityFilter, setSeverityFilter] = useState<CrashSeverity | 'all'>('all');

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
    if (severityFilter !== 'all') {
      result = result.filter((r) => r.severity === severityFilter);
    }
    return result;
  }, [reports, searchQuery, severityFilter]);

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
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-status-red-subtle flex items-center justify-center">
            <Bug className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">Crash Log Analyzer</h2>
            <p className="text-2xs text-text-muted mt-0.5">
              Parse UE5 crash dumps, identify root causes with AI, and generate one-click fix prompts
            </p>
          </div>
        </div>
        <button
          onClick={fetchAnalysis}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-status-red-subtle text-red-400 hover:bg-status-red-medium transition-colors disabled:opacity-40"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {isLoading ? 'Analyzing...' : 'Analyze Crashes'}
        </button>
      </div>

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
          <MiniStat label="Total Crashes" value={stats.totalCrashes} accent="text-red-400" />
          <MiniStat label="Critical" value={stats.crashesBySeverity.critical} accent={stats.crashesBySeverity.critical > 0 ? 'text-red-400' : undefined} />
          <MiniStat label="Patterns" value={stats.patternsDetected} accent="text-amber-400" />
          <MiniStat label="Systemic" value={stats.systemicIssues} accent={stats.systemicIssues > 0 ? 'text-red-400' : undefined} />
          <MiniStat label="Recent (24h)" value={stats.recentCrashes} />
          <MiniStat label="Top Type" value={CRASH_TYPE_LABELS[stats.mostCommonType]} />
        </div>
      )}

      {/* Sub-tabs */}
      {hasData && (
        <div className="flex items-center gap-1 border-b border-border">
          <SubTab label="Crash Reports" active={viewTab === 'crashes'} onClick={() => setViewTab('crashes')} count={reports.length} />
          <SubTab label="Patterns" active={viewTab === 'patterns'} onClick={() => setViewTab('patterns')} count={patterns.length} />
          <SubTab label="Import Log" active={viewTab === 'import'} onClick={() => setViewTab('import')} />
        </div>
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
      {hasData && viewTab === 'crashes' && (
        <div className="flex gap-4">
          {/* Crash list */}
          <div className={`space-y-3 ${selectedCrashId ? 'w-1/2' : 'w-full'}`}>
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
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as CrashSeverity | 'all')}
                className="px-2 py-1.5 rounded-md border border-border bg-surface text-xs text-text focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
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

          {/* Detail panel */}
          <AnimatePresence>
            {selectedReport && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '50%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <CrashDetailPanel
                  report={selectedReport}
                  diagnosis={selectedDiagnosis}
                  onClose={() => selectCrash(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
            patterns.map((p) => <PatternCard key={p.id} pattern={p} />)
          )}
        </div>
      )}

      {/* ── Import Tab ───────────────────────────────────────────── */}
      {hasData && viewTab === 'import' && (
        <ImportPanel />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SubTab({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {count !== undefined && <span className="text-2xs text-text-muted">({count})</span>}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-red-400" />}
    </button>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <SurfaceCard level={2}>
      <p className="text-2xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold ${accent ?? 'text-text'}`}>{value}</p>
    </SurfaceCard>
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
  const style = SEVERITY_STYLE[report.severity];
  const timeAgo = getTimeAgo(report.timestamp);

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 cursor-pointer transition-all ${
        isSelected
          ? `${style.border} ${style.bg} ring-1 ring-${report.severity === 'critical' ? 'red' : 'amber'}-500/30`
          : 'border-border hover:border-border/80 hover:bg-surface-2/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant={style.badge}>{report.severity}</Badge>
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
}: {
  report: CrashReport;
  diagnosis: CrashDiagnosis | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showRawLog, setShowRawLog] = useState(false);

  const handleCopyPrompt = useCallback(() => {
    if (!diagnosis) return;
    navigator.clipboard.writeText(diagnosis.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [diagnosis]);

  return (
    <div className="space-y-3 pl-4">
      {/* Header */}
      <SurfaceCard>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bug className={`w-4 h-4 ${SEVERITY_STYLE[report.severity].text}`} />
            <span className="text-xs font-semibold text-text">{report.id}</span>
            <Badge variant={SEVERITY_STYLE[report.severity].badge}>{report.severity}</Badge>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-text mb-2">{report.errorMessage}</p>
        <div className="flex flex-wrap gap-2 text-2xs text-text-muted">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(report.timestamp).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{report.machineState.engineVersion} {report.machineState.buildConfig}</span>
          {report.mappedModule && <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{report.mappedModule}</span>}
        </div>
      </SurfaceCard>

      {/* Callstack */}
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-red-400" />
          Callstack ({report.callstack.length} frames)
        </h3>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {report.callstack.map((frame) => (
            <FrameRow key={frame.index} frame={frame} />
          ))}
        </div>
      </SurfaceCard>

      {/* AI Diagnosis */}
      {diagnosis && (
        <SurfaceCard>
          <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            AI Root Cause Analysis
            <ProgressRing value={Math.round(diagnosis.confidence * 100)} size={20} strokeWidth={2} color={ACCENT_EMERALD} />
          </h3>

          <div className="space-y-3">
            <div>
              <p className="text-2xs font-medium text-text mb-0.5">Summary</p>
              <p className="text-2xs text-text-muted">{diagnosis.summary}</p>
            </div>

            <div>
              <p className="text-2xs font-medium text-text mb-0.5">Root Cause</p>
              <p className="text-2xs text-text-muted">{diagnosis.rootCause}</p>
            </div>

            <div>
              <p className="text-2xs font-medium text-text mb-0.5">UE5 Pattern</p>
              <Badge variant="warning">{diagnosis.uePattern}</Badge>
            </div>

            <div>
              <p className="text-2xs font-medium text-text mb-0.5">Fix Description</p>
              <p className="text-2xs text-text-muted">{diagnosis.fixDescription}</p>
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
              <pre className="text-[10px] leading-relaxed text-emerald-300/80 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
                {diagnosis.fixPrompt}
              </pre>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {diagnosis.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-2 text-text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Raw log toggle */}
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
            <pre className="text-[10px] leading-relaxed p-3 rounded-md border border-border bg-surface text-text-muted overflow-x-auto max-h-48 overflow-y-auto">
              {report.rawLog}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FrameRow({ frame }: { frame: CallstackFrame }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] leading-relaxed ${
      frame.isCrashOrigin
        ? 'bg-status-red-subtle border border-status-red-medium'
        : frame.isGameCode
          ? 'bg-surface-2/50'
          : ''
    }`}>
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

function PatternCard({ pattern }: { pattern: CrashPattern }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <SurfaceCard>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {pattern.isSystemic ? (
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        ) : (
          <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text">{pattern.name}</span>
            {pattern.isSystemic && <Badge variant="error">systemic</Badge>}
            <Badge variant="warning">{pattern.occurrences}x</Badge>
          </div>
          <p className="text-2xs text-text-muted mt-0.5">{pattern.description}</p>
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
                <p className="text-2xs text-text-muted">{pattern.rootCause}</p>
              </div>
              <div>
                <p className="text-2xs font-medium text-text">Signature Functions</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {pattern.signatureFunctions.map((fn) => (
                    <span key={fn} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-2 text-text-muted font-mono">
                      {fn}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-2xs text-text-muted">
                <span>Crash IDs: {pattern.crashIds.join(', ')}</span>
                <span>First: {getTimeAgo(pattern.firstSeen)}</span>
                <span>Last: {getTimeAgo(pattern.lastSeen)}</span>
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
