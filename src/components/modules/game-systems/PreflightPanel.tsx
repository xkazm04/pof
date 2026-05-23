'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Hammer, ChevronDown, ShieldCheck } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, MODULE_COLORS } from '@/lib/chart-colors';
import type { PreflightCheckResult, PreflightStatus } from '@/lib/packaging/preflight';

type CheckKind = 'fast' | 'build-verify-editor' | 'build-verify-shipping';

interface PreflightResponse {
  results: PreflightCheckResult[];
  overall: PreflightStatus;
}

export interface PreflightStatusSummary {
  /** True when no completed check is in a `fail` state — the cook may proceed. */
  canCook: boolean;
  /** Worst status across all completed checks, or 'idle' if none have run. */
  overall: PreflightStatus | 'idle';
}

interface PreflightPanelProps {
  projectPath: string;
  projectName: string;
  ueVersion: string;
  /** The level the operator intends to cook (drives the map-exists check). */
  mapName?: string;
  onStatusChange?: (summary: PreflightStatusSummary) => void;
}

const STATUS_STYLES: Record<PreflightStatus, { icon: typeof CheckCircle2; color: string }> = {
  pass: { icon: CheckCircle2, color: STATUS_SUCCESS },
  warn: { icon: AlertTriangle, color: STATUS_WARNING },
  fail: { icon: XCircle, color: STATUS_ERROR },
};

/** Which result ids a given check kind owns, so re-running replaces only those tiles. */
const CHECK_RESULT_IDS: Record<CheckKind, string[]> = {
  fast: ['config-sanity', 'with-editor-audit'],
  'build-verify-editor': ['build-verify-editor'],
  'build-verify-shipping': ['build-verify-shipping'],
};

function worstStatus(results: PreflightCheckResult[]): PreflightStatus | 'idle' {
  if (results.length === 0) return 'idle';
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  return 'pass';
}

export function PreflightPanel({ projectPath, projectName, ueVersion, mapName, onStatusChange }: PreflightPanelProps) {
  const [results, setResults] = useState<PreflightCheckResult[]>([]);
  const [running, setRunning] = useState<Set<CheckKind>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  // Notify the parent gate whenever the result set changes.
  useEffect(() => {
    const overall = worstStatus(results);
    onStatusChangeRef.current?.({ canCook: !results.some((r) => r.status === 'fail'), overall });
  }, [results]);

  const runCheck = useCallback(async (kind: CheckKind) => {
    setRunning((prev) => new Set(prev).add(kind));
    setError(null);
    const res = await tryApiFetch<PreflightResponse>('/api/packaging/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, projectName, ueVersion, mapName, check: kind }),
    });
    setRunning((prev) => {
      const next = new Set(prev);
      next.delete(kind);
      return next;
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const ownedIds = new Set(CHECK_RESULT_IDS[kind]);
    setResults((prev) => {
      const kept = prev.filter((r) => !ownedIds.has(r.id));
      return [...kept, ...res.data.results].sort((a, b) => a.id.localeCompare(b.id));
    });
  }, [projectPath, projectName, ueVersion, mapName]);

  // Auto-run the cheap config + audit checks on mount / when the project changes.
  useEffect(() => {
    if (projectPath && projectName) void runCheck('fast');
  }, [projectPath, projectName, runCheck]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const overall = worstStatus(results);
  const fastRunning = running.has('fast');

  return (
    <div
      data-testid="pof-preflight-panel"
      data-overall={overall}
      className="rounded border border-border bg-surface p-3 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: MODULE_COLORS.systems }} />
          <span className="text-sm font-semibold text-text">Pre-flight checks</span>
          {overall !== 'idle' && (
            <span
              data-testid="pof-preflight-overall"
              data-status={overall}
              className="text-2xs font-mono uppercase tracking-wider"
              style={{ color: STATUS_STYLES[overall].color }}
            >
              {overall === 'pass' ? 'ready' : overall === 'warn' ? 'ready (warnings)' : 'blocked'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => runCheck('fast')}
            disabled={fastRunning}
            data-testid="pof-preflight-rerun"
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${fastRunning ? 'animate-spin' : ''}`} />
            Re-run
          </button>
        </div>
      </div>

      {error && (
        <div data-testid="pof-preflight-error" className="text-2xs font-mono" style={{ color: STATUS_ERROR }}>
          {error}
        </div>
      )}

      {/* Check tiles */}
      <div className="space-y-1.5">
        {results.length === 0 && fastRunning && (
          <div className="text-2xs text-text-muted font-mono">Running config + plugin audit…</div>
        )}
        {results.map((r) => {
          const style = STATUS_STYLES[r.status];
          const Icon = style.icon;
          const isOpen = expanded.has(r.id);
          const hasIssues = r.issues.length > 0;
          return (
            <div
              key={r.id}
              data-testid={`pof-preflight-check-${r.id}`}
              data-status={r.status}
              className="rounded border border-border-bright bg-background"
            >
              <button
                onClick={() => hasIssues && toggleExpand(r.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left ${hasIssues ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: style.color }} />
                <span className="text-xs font-medium text-text">{r.label}</span>
                <span className="text-2xs text-text-muted flex-1 truncate">{r.detail}</span>
                {hasIssues && (
                  <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {isOpen && hasIssues && (
                <ul className="px-3 pb-2 space-y-1 border-t border-border pt-1.5">
                  {r.issues.map((issue, i) => (
                    <li key={i} className="text-2xs text-text-muted font-mono leading-relaxed">
                      • {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Build-verify (slow, opt-in) */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="text-2xs text-text-muted uppercase tracking-wider">Build verify:</span>
        <button
          onClick={() => runCheck('build-verify-editor')}
          disabled={running.has('build-verify-editor')}
          data-testid="pof-preflight-run-editor-build"
          className="flex items-center gap-1 px-2 py-1 rounded border border-border-bright text-2xs text-text-muted hover:text-text hover:border-violet-500/40 transition-colors disabled:opacity-50"
        >
          <Hammer className={`w-3 h-3 ${running.has('build-verify-editor') ? 'animate-pulse' : ''}`} />
          Editor
        </button>
        <button
          onClick={() => runCheck('build-verify-shipping')}
          disabled={running.has('build-verify-shipping')}
          data-testid="pof-preflight-run-shipping-build"
          className="flex items-center gap-1 px-2 py-1 rounded border border-border-bright text-2xs text-text-muted hover:text-text hover:border-violet-500/40 transition-colors disabled:opacity-50"
        >
          <Hammer className={`w-3 h-3 ${running.has('build-verify-shipping') ? 'animate-pulse' : ''}`} />
          Shipping
        </button>
        {(running.has('build-verify-editor') || running.has('build-verify-shipping')) && (
          <span className="text-2xs text-text-muted font-mono">compiling… (may take minutes)</span>
        )}
      </div>
    </div>
  );
}
