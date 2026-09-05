'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Hammer, ChevronDown, ShieldCheck, FileSearch, CircleDashed } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL, MODULE_COLORS } from '@/lib/chart-colors';
import { StatusChip } from '@/components/ui/StatusChip';
import type { PreflightCheckResult, PreflightStatus } from '@/lib/packaging/preflight';

type CheckKind = 'fast' | 'build-verify-editor' | 'build-verify-shipping' | 'asset-validation';

interface PreflightResponse {
  results: PreflightCheckResult[];
  overall: PreflightStatus;
}

export interface PreflightStatusSummary {
  /**
   * True when no COMPLETED check is in a `fail` state — the cook may proceed.
   * Deliberately unchanged: an unrun check qualifies the verdict, it never
   * vetoes the build.
   */
  canCook: boolean;
  /** Worst status across all completed checks, or 'idle' if none have run. */
  overall: PreflightStatus | 'idle';
  /** True when every cook-relevant check has produced a result. */
  fullyCovered: boolean;
  /** Labels of the cook-relevant checks that have never run. */
  notRunLabels: string[];
  /** How much of the cook-relevant gate was actually measured. */
  coverage: { ran: number; total: number };
}

interface PreflightPanelProps {
  projectPath: string;
  projectName: string;
  ueVersion: string;
  /**
   * The maps the selected build profile will cook
   * (`cookSettings.mapsToInclude`) — these drive the map-exists check, because
   * these are the levels the cook ships. Empty = the profile cooks all maps and
   * the check falls back to `GameDefaultMap`.
   */
  cookMaps?: string[];
  /** Name of the profile `cookMaps` came from, for the panel's own disclosure. */
  cookProfileName?: string;
  onStatusChange?: (summary: PreflightStatusSummary) => void;
}

const STATUS_STYLES: Record<PreflightStatus, { icon: typeof CheckCircle2; color: string }> = {
  pass: { icon: CheckCircle2, color: STATUS_SUCCESS },
  warn: { icon: AlertTriangle, color: STATUS_WARNING },
  fail: { icon: XCircle, color: STATUS_ERROR },
};

/** The not-run state as a reusable chip token — absence is a status, not a blank. */
const NOT_RUN_TOKEN = { icon: CircleDashed, color: STATUS_NEUTRAL, label: 'NOT RUN' };

interface KnownCheck {
  id: string;
  label: string;
  kind: CheckKind;
  /**
   * Whether skipping this check leaves the COOK verdict uncovered. The Editor
   * target is never cooked, so its build-verify is diagnostic only; everything
   * else gates something the packaged build depends on.
   */
  cookRelevant: boolean;
  /** What running it costs, shown on the not-run tile. */
  howToRun: string;
}

/**
 * Every check this panel can produce — enumerated, not inferred from the
 * results that happen to have arrived. A check with no result is rendered in an
 * explicit `not run` state and counted against the header's coverage, so a
 * fast-only pass can never read as a whole-gate "ready"
 * (ai-registry game-production/ship-pipeline-gating).
 */
const KNOWN_CHECKS: KnownCheck[] = [
  { id: 'config-sanity', label: 'Config sanity', kind: 'fast', cookRelevant: true, howToRun: 'runs automatically — press Re-run' },
  { id: 'with-editor-audit', label: 'Plugin WITH_EDITOR audit', kind: 'fast', cookRelevant: true, howToRun: 'runs automatically — press Re-run' },
  { id: 'build-verify-shipping', label: 'Build verify (Shipping)', kind: 'build-verify-shipping', cookRelevant: true, howToRun: 'press Build verify → Shipping (minutes)' },
  { id: 'asset-validation', label: 'Asset validation', kind: 'asset-validation', cookRelevant: true, howToRun: 'press Validate assets (boots the editor)' },
  { id: 'build-verify-editor', label: 'Build verify (Editor)', kind: 'build-verify-editor', cookRelevant: false, howToRun: 'press Build verify → Editor (minutes)' },
];

/** Which result ids a given check kind owns, so re-running replaces only those tiles. */
const CHECK_RESULT_IDS: Record<CheckKind, string[]> = {
  fast: ['config-sanity', 'with-editor-audit'],
  'build-verify-editor': ['build-verify-editor'],
  'build-verify-shipping': ['build-verify-shipping'],
  'asset-validation': ['asset-validation'],
};

function worstStatus(results: PreflightCheckResult[]): PreflightStatus | 'idle' {
  if (results.length === 0) return 'idle';
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  return 'pass';
}

/** Cook-relevant coverage: which known checks have a result and which do not. */
function coverageOf(results: PreflightCheckResult[]): PreflightStatusSummary['coverage'] & { notRun: KnownCheck[] } {
  const have = new Set(results.map((r) => r.id));
  const relevant = KNOWN_CHECKS.filter((c) => c.cookRelevant);
  const notRun = relevant.filter((c) => !have.has(c.id));
  return { ran: relevant.length - notRun.length, total: relevant.length, notRun };
}

/**
 * The header word, qualified by its own coverage. "ready" alone is only ever
 * printed when every cook-relevant check actually ran.
 */
function summaryWord(overall: PreflightStatus | 'idle', ran: number, total: number): string {
  if (overall === 'idle') return 'not checked';
  const base = overall === 'fail' ? 'blocked' : overall === 'warn' ? 'ready (warnings)' : 'ready';
  const notRun = total - ran;
  if (notRun === 0) return base;
  return `${base} — ${ran} of ${total} checks run, ${notRun} not run`;
}

export function PreflightPanel({ projectPath, projectName, ueVersion, cookMaps, cookProfileName, onStatusChange }: PreflightPanelProps) {
  const [results, setResults] = useState<PreflightCheckResult[]>([]);
  const [running, setRunning] = useState<Set<CheckKind>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  // Project-scoped generation token: the project identity ITSELF, so an in-flight
  // check dispatched for the previous project cannot apply its (now stale) result
  // to the new project's gate. This replaced a hand-bumped counter — the counter
  // had to be incremented during render to stay in step with the reset below,
  // which is a ref write during render. The key is derived from props, so it needs
  // no bumping and cannot drift out of step with the reset.
  const projectKey = `${projectPath ?? ''}|${projectName ?? ''}`;
  const projectKeyRef = useRef(projectKey);
  useEffect(() => {
    projectKeyRef.current = projectKey;
  }, [projectKey]);

  // Reset the gate to idle for the new project — results/spinners from the
  // previous project must not leak across the switch. Adjusted DURING render
  // (React's derive-from-props idiom): an effect would paint one frame of the
  // PREVIOUS project's verdicts under the new project's name, which is precisely
  // the cross-project leak this reset exists to prevent.
  const [prevProjectKey, setPrevProjectKey] = useState(projectKey);
  if (prevProjectKey !== projectKey) {
    setPrevProjectKey(projectKey);
    setResults([]);
    setRunning(new Set());
    setError(null);
  }

  // Stable dependency for the maps list — the parent may hand a fresh array
  // each render, which would otherwise re-fire the auto-run effect forever.
  const cookMapsKey = (cookMaps ?? []).join('|');

  // Notify the parent gate whenever the result set changes. The summary carries
  // its own coverage: `canCook` still means "nothing that ran failed", and
  // `notRunLabels` names what was never measured.
  useEffect(() => {
    const overall = worstStatus(results);
    const { ran, total, notRun } = coverageOf(results);
    onStatusChangeRef.current?.({
      canCook: !results.some((r) => r.status === 'fail'),
      overall,
      fullyCovered: notRun.length === 0,
      notRunLabels: notRun.map((c) => c.label),
      coverage: { ran, total },
    });
  }, [results]);

  const runCheck = useCallback(async (kind: CheckKind) => {
    // Capture the project identity at dispatch. Concurrent checks of
    // different kinds share the same key, so this scopes by project
    // (not per-call) — legitimately parallel checks are never cancelled.
    const gen = projectKey;
    setRunning((prev) => new Set(prev).add(kind));
    setError(null);
    const res = await tryApiFetch<PreflightResponse>('/api/packaging/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, projectName, ueVersion, mapsToInclude: cookMaps ?? [], check: kind }),
    });
    // Drop the response if the active project changed while it was in flight —
    // a stale project's result must not touch this project's ready-to-cook gate.
    if (gen !== projectKeyRef.current) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cookMaps is tracked by its serialized key
  }, [projectKey, projectPath, projectName, ueVersion, cookMapsKey]);

  // Auto-run the cheap config + audit checks on mount / when the project changes.
  // Deferred to a macrotask so the running-state update isn't a synchronous
  // setState inside the effect body (which would risk a cascading render).
  useEffect(() => {
    if (!projectPath || !projectName) return;
    const id = setTimeout(() => { void runCheck('fast'); }, 0);
    return () => clearTimeout(id);
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
  const { ran, total, notRun } = useMemo(() => coverageOf(results), [results]);
  const byId = useMemo(() => new Map(results.map((r) => [r.id, r])), [results]);
  const mapScope = (cookMaps ?? []).length > 0
    ? `map check: ${(cookMaps ?? []).length} map(s) from ${cookProfileName ? `profile “${cookProfileName}”` : 'the selected profile'}`
    : 'map check: GameDefaultMap (the selected profile cooks all maps)';

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
              data-coverage={`${ran}/${total}`}
              data-fully-covered={notRun.length === 0}
              className="text-2xs font-mono uppercase tracking-wider"
              style={{ color: overall === 'fail' || notRun.length === 0 ? STATUS_STYLES[overall].color : STATUS_NEUTRAL }}
            >
              {summaryWord(overall, ran, total)}
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

      {/* Coverage disclosure — what this verdict does and does not cover. */}
      <div data-testid="pof-preflight-coverage" className="text-2xs text-text-muted font-mono">
        {notRun.length === 0
          ? `All ${total} cook-relevant checks have run · ${mapScope}`
          : `Not yet run: ${notRun.map((c) => c.label).join(', ')} · ${mapScope}`}
      </div>

      {/* Check tiles — every KNOWN check, run or not. */}
      <div className="space-y-1.5">
        {results.length === 0 && fastRunning && (
          <div className="text-2xs text-text-muted font-mono">Running config + plugin audit…</div>
        )}
        {KNOWN_CHECKS.map((known) => {
          const r = byId.get(known.id);
          if (!r) {
            const isRunning = running.has(known.kind);
            return (
              <div
                key={known.id}
                data-testid={`pof-preflight-check-${known.id}`}
                data-status="not-run"
                className="rounded border border-border bg-background"
              >
                <div className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
                  <StatusChip token={NOT_RUN_TOKEN} showIcon label={isRunning ? 'RUNNING' : 'NOT RUN'} />
                  <span className="text-xs font-medium text-text-muted">{known.label}</span>
                  <span className="text-2xs text-text-muted flex-1 truncate">
                    {isRunning ? 'running…' : `Not run — no verdict. To measure it: ${known.howToRun}.`}
                  </span>
                </div>
              </div>
            );
          }
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
                <Icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: style.color }}
                  role="img"
                  aria-label={r.status === 'pass' ? 'Passed' : r.status === 'warn' ? 'Warning' : 'Failed'}
                />
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
          className="flex items-center gap-1 px-2 py-1 rounded border border-border-bright text-2xs text-text-muted hover:text-text hover:border-[var(--systems)]/40 transition-colors disabled:opacity-50"
        >
          <Hammer className={`w-3 h-3 ${running.has('build-verify-editor') ? 'animate-pulse' : ''}`} />
          Editor
        </button>
        <button
          onClick={() => runCheck('build-verify-shipping')}
          disabled={running.has('build-verify-shipping')}
          data-testid="pof-preflight-run-shipping-build"
          className="flex items-center gap-1 px-2 py-1 rounded border border-border-bright text-2xs text-text-muted hover:text-text hover:border-[var(--systems)]/40 transition-colors disabled:opacity-50"
        >
          <Hammer className={`w-3 h-3 ${running.has('build-verify-shipping') ? 'animate-pulse' : ''}`} />
          Shipping
        </button>
        {(running.has('build-verify-editor') || running.has('build-verify-shipping')) && (
          <span className="text-2xs text-text-muted font-mono">compiling… (may take minutes)</span>
        )}
      </div>

      {/* Content audit (slow, opt-in) — DataValidation commandlet */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="text-2xs text-text-muted uppercase tracking-wider">Content audit:</span>
        <button
          onClick={() => runCheck('asset-validation')}
          disabled={running.has('asset-validation')}
          data-testid="pof-preflight-run-asset-validation"
          className="flex items-center gap-1 px-2 py-1 rounded border border-border-bright text-2xs text-text-muted hover:text-text hover:border-[var(--systems)]/40 transition-colors disabled:opacity-50"
        >
          <FileSearch className={`w-3 h-3 ${running.has('asset-validation') ? 'animate-pulse' : ''}`} />
          Validate assets
        </button>
        {running.has('asset-validation') && (
          <span className="text-2xs text-text-muted font-mono">scanning content… (boots the editor)</span>
        )}
      </div>
    </div>
  );
}
