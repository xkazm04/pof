'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import {
  ScanSearch, Play, Loader2, AlertTriangle, AlertCircle, Info,
  ChevronDown, ChevronRight, Zap, Trash2, RotateCcw, Clock,
  Shield, Bug, Gauge, CheckCircle,
} from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useModuleStore } from '@/stores/moduleStore';
import { MODULE_LABELS } from '@/lib/module-registry';
import { TaskFactory } from '@/lib/cli-task';
import { EVAL_PASSES, PASS_LABELS, type EvalPass } from '@/lib/evaluator/module-eval-prompts';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { ScanFinding, ScanSeverity } from '@/types/scan';
import { getAppOrigin } from '@/lib/constants';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_IMPROVED,
  ACCENT_ORANGE, OPACITY_8,
} from '@/lib/chart-colors';

const SEVERITY_CONFIG: Record<ScanSeverity, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  critical: { color: MODULE_COLORS.evaluator, bg: `${MODULE_COLORS.evaluator}${OPACITY_8}`, icon: AlertTriangle },
  high: { color: ACCENT_ORANGE, bg: `${ACCENT_ORANGE}${OPACITY_8}`, icon: AlertCircle },
  medium: { color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_8}`, icon: Info },
  low: { color: '#94a3b8', bg: '#94a3b818', icon: Info },
};

const EFFORT_CONFIG: Record<string, { color: string; label: string }> = {
  trivial: { color: STATUS_SUCCESS, label: '~5m' },
  small: { color: STATUS_IMPROVED, label: '~30m' },
  medium: { color: STATUS_WARNING, label: '~2h' },
  large: { color: STATUS_ERROR, label: '>2h' },
};

const PASS_ICONS: Record<EvalPass, typeof Shield> = {
  structure: Shield,
  quality: Bug,
  performance: Gauge,
};

const ACCENT = MODULE_COLORS.core;
const EMPTY_FINDINGS: ScanFinding[] = [];

interface ScanTabProps {
  moduleId: SubModuleId;
}

export function ScanTab({ moduleId }: ScanTabProps) {
  const moduleLabel = MODULE_LABELS[moduleId] ?? moduleId;
  const findings = useModuleStore((s) => s.scanResults[moduleId] ?? EMPTY_FINDINGS);
  const addScanFindings = useModuleStore((s) => s.addScanFindings);
  const clearScanFindings = useModuleStore((s) => s.clearScanFindings);
  const resolveScanFinding = useModuleStore((s) => s.resolveScanFinding);

  const [selectedPasses, setSelectedPasses] = useState<Set<EvalPass>>(new Set(EVAL_PASSES));
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [scanCount, setScanCount] = useState(0);

  // Fetch findings from the DB and merge into the Zustand store
  const fetchAndMergeFindings = useCallback(async () => {
    try {
      const res = await fetch(`/api/module-scan/import?moduleId=${encodeURIComponent(moduleId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data?.findings?.length > 0) {
        addScanFindings(moduleId, json.data.findings);
      }
    } catch { /* silent */ }
  }, [moduleId, addScanFindings]);

  const handleScanComplete = useCallback(async (success: boolean) => {
    if (!success) return;
    // Final fetch to pick up any findings from the last poll interval
    await fetchAndMergeFindings();
    setScanCount((n) => n + 1);
  }, [fetchAndMergeFindings]);

  const scanCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-scan`,
    label: `${moduleLabel} Scan`,
    accentColor: ACCENT,
    onComplete: handleScanComplete,
  });

  // Poll for new findings while the scan is running (every 3s)
  // Pauses when module is suspended (hidden in LRU).
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useSuspendableEffect(() => {
    if (scanCli.isRunning) {
      // Start polling
      pollRef.current = setInterval(fetchAndMergeFindings, 3000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    } else {
      // Stop polling
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [scanCli.isRunning, fetchAndMergeFindings]);

  // Load persisted findings on mount (from previous scans)
  useEffect(() => {
    fetchAndMergeFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const startScan = useCallback(() => {
    const passes = Array.from(selectedPasses) as EvalPass[];
    if (passes.length === 0) return;
    const appOrigin = getAppOrigin();

    // Build previous findings summary for iterative scanning
    const activeFindings = findings.filter((f) => !f.resolvedAt);
    const previousFindings = activeFindings.length > 0
      ? activeFindings.map((f) => `- [${f.severity}] ${f.category}: ${f.description} (${f.file ?? 'general'})`).join('\n')
      : undefined;

    const task = TaskFactory.moduleScan(moduleId, passes, appOrigin, `${moduleLabel} Scan`, previousFindings);
    scanCli.execute(task);
  }, [selectedPasses, findings, moduleId, moduleLabel, scanCli]);

  const togglePass = useCallback((pass: EvalPass) => {
    setSelectedPasses((prev) => {
      const next = new Set(prev);
      if (next.has(pass)) {
        if (next.size > 1) next.delete(pass);
      } else {
        next.add(pass);
      }
      return next;
    });
  }, []);

  const toggleFinding = useCallback((id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Group findings by severity
  const activeFindings = useMemo(() => findings.filter((f) => !f.resolvedAt), [findings]);
  const resolvedFindings = useMemo(() => findings.filter((f) => f.resolvedAt), [findings]);

  const bySeverity = useMemo(() => {
    const grouped: Record<ScanSeverity, ScanFinding[]> = {
      critical: [], high: [], medium: [], low: [],
    };
    for (const f of activeFindings) {
      grouped[f.severity].push(f);
    }
    return grouped;
  }, [activeFindings]);

  const severityCounts = useMemo(() => ({
    critical: bySeverity.critical.length,
    high: bySeverity.high.length,
    medium: bySeverity.medium.length,
    low: bySeverity.low.length,
  }), [bySeverity]);

  // Stats by pass
  const passCounts = useMemo(() => {
    const counts: Record<EvalPass, number> = { structure: 0, quality: 0, performance: 0 };
    for (const f of activeFindings) {
      counts[f.pass]++;
    }
    return counts;
  }, [activeFindings]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanSearch className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-sm font-semibold text-text">Module Scan</span>
          <span className="text-xs text-text-muted">— {moduleLabel}</span>
          {scanCount > 0 && (
            <span className="text-2xs text-text-muted font-mono">
              {scanCount} scan{scanCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {findings.length > 0 && (
          <button
            onClick={() => clearScanFindings(moduleId)}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Clear all findings"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Pass selector + Scan button */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {EVAL_PASSES.map((pass) => {
            const isActive = selectedPasses.has(pass);
            const PassIcon = PASS_ICONS[pass];
            const count = passCounts[pass];
            return (
              <button
                key={pass}
                onClick={() => togglePass(pass)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
                style={isActive
                  ? { backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }
                  : { backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                }
              >
                <PassIcon className="w-3 h-3" />
                {PASS_LABELS[pass]}
                {count > 0 && (
                  <span className="text-2xs opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={startScan}
          disabled={scanCli.isRunning || selectedPasses.size === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${ACCENT}24`,
            color: ACCENT,
            border: `1px solid ${ACCENT}38`,
          }}
        >
          {scanCli.isRunning ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Scanning...
            </>
          ) : activeFindings.length > 0 ? (
            <>
              <RotateCcw className="w-3 h-3" />
              Re-Scan
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              Start Scan
            </>
          )}
        </button>
      </div>

      {/* Summary stats */}
      {activeFindings.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(['critical', 'high', 'medium', 'low'] as ScanSeverity[]).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            const count = severityCounts[sev];
            const SevIcon = cfg.icon;
            return (
              <SurfaceCard key={sev} level={2} className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <SevIcon className="w-3 h-3" style={{ color: cfg.color }} />
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">{sev}</span>
                </div>
                <div className="text-lg font-semibold mt-0.5" style={{ color: count > 0 ? cfg.color : 'var(--text-muted)' }}>
                  {count}
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {/* Findings list grouped by severity */}
      {activeFindings.length > 0 ? (
        <div className="space-y-3">
          {(['critical', 'high', 'medium', 'low'] as ScanSeverity[]).map((sev) => {
            const items = bySeverity[sev];
            if (items.length === 0) return null;
            const cfg = SEVERITY_CONFIG[sev];

            return (
              <div key={sev} className="space-y-1">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
                    {sev}
                  </span>
                  <span className="text-2xs text-text-muted">{items.length}</span>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  {items.map((finding) => (
                    <FindingRow
                      key={finding.id}
                      finding={finding}
                      isExpanded={expandedFindings.has(finding.id)}
                      onToggle={() => toggleFinding(finding.id)}
                      onResolve={() => resolveScanFinding(moduleId, finding.id)}
                      onFix={() => {
                        const prompt = `Fix the following issue in the ${moduleLabel} module:\n\n**${finding.category}** (${finding.severity})\n${finding.description}\n\nFile: ${finding.file ?? 'N/A'}\n\nSuggested fix: ${finding.suggestedFix}`;
                        scanCli.sendPrompt(prompt);
                      }}
                      isRunning={scanCli.isRunning}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <ScanSearch className="w-8 h-8 text-text-muted" style={{ opacity: 0.4 }} />
          <div>
            <p className="text-sm text-text-muted">No scan results yet</p>
            <p className="text-xs text-text-muted mt-1">
              Select evaluation passes and run a scan to analyze the {moduleLabel} module for issues.
            </p>
          </div>
        </div>
      )}

      {/* Resolved findings (collapsed by default) */}
      {resolvedFindings.length > 0 && (
        <ResolvedSection findings={resolvedFindings} />
      )}
    </div>
  );
}

// ── Finding row ──────────────────────────────────────────────────────────────

function FindingRow({
  finding,
  isExpanded,
  onToggle,
  onResolve,
  onFix,
  isRunning,
}: {
  finding: ScanFinding;
  isExpanded: boolean;
  onToggle: () => void;
  onResolve: () => void;
  onFix: () => void;
  isRunning: boolean;
}) {
  const cfg = SEVERITY_CONFIG[finding.severity];
  const effortCfg = EFFORT_CONFIG[finding.effort];
  const PassIcon = PASS_ICONS[finding.pass];

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-hover/30 transition-colors"
      >
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-text">{finding.category}</span>
            <span className="text-2xs font-mono px-1.5 py-px rounded" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
              {finding.severity}
            </span>
            <span className="text-2xs text-text-muted flex items-center gap-0.5">
              <PassIcon className="w-2.5 h-2.5" />
              {PASS_LABELS[finding.pass]}
            </span>
            {finding.file && (
              <span className="text-2xs font-mono text-text-muted truncate max-w-[200px]">
                {finding.file}{finding.line ? `:${finding.line}` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
            {finding.description}
          </p>
        </div>

        <span className="flex items-center gap-0.5 text-2xs px-1.5 py-px rounded flex-shrink-0" style={{ color: effortCfg.color, backgroundColor: `${effortCfg.color}18` }}>
          <Clock className="w-2.5 h-2.5" />
          {effortCfg.label}
        </span>
      </button>

      {isExpanded && (
        <div className="px-8 pb-2.5 space-y-2">
          {finding.suggestedFix && (
            <div className="text-xs text-text-muted leading-relaxed">
              <span className="font-semibold text-text-muted-hover">Suggested fix: </span>
              {finding.suggestedFix}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onFix(); }}
              disabled={isRunning}
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
            >
              <Zap className="w-3 h-3" />
              Fix This
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(); }}
              className="flex items-center gap-1 text-xs font-medium text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1 rounded transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Mark Resolved
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resolved section ─────────────────────────────────────────────────────────

function ResolvedSection({ findings }: { findings: ScanFinding[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <CheckCircle className="w-3 h-3 text-green-400" />
        {findings.length} resolved finding{findings.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg border border-border overflow-hidden opacity-60">
          {findings.map((f) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 last:border-b-0">
              <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
              <span className="text-xs text-text-muted line-through">{f.category}: {f.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
