'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { FilePlus2, Hourglass, Loader2, Play, RotateCcw } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { TestPresence } from '@/lib/ue-test-scaffold/sourceRegistry';
import type { SubModuleId } from '@/types/modules';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import {
  WAITING_TESTS_URL, PLANNED_TESTS_URL, plannedTestsUrl, fetchApi, groupWaitingTests, runWaitingTest,
  describeRunOutcome, mergeWaitingPresence, notInSourceLabel, authorReducer, AUTHOR_IDLE,
  type WaitingTests, type WaitingRunOutcome, type AuthoringTaskEntry,
} from './waitingTests';
import { AuthorTestPanel } from './AuthorTestPanel';

/** Same module the scaffold task targets (plannedTests.SCAFFOLD_TASK_MODULE; that file is server-only). */
const AUTHOR_MODULE: SubModuleId = 'packaging';
const AUTHOR_SESSION_KEY = 'test-harness-author';
type Planned = ReadonlyArray<{ testName: string; presence?: TestPresence }>;

function outcomeColor(o: WaitingRunOutcome): string {
  if (o.kind === 'busy' || o.kind === 'lease-error') return STATUS_WARNING;
  if (o.kind !== 'settled') return STATUS_ERROR;
  if (o.outcome.failed > 0) return STATUS_ERROR;
  return o.outcome.settled > 0 ? STATUS_SUCCESS : STATUS_WARNING;
}

const BTN = 'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border hover:bg-surface-hover disabled:opacity-40';

/**
 * The UE automation tests deferred L3 gates are waiting on, ranked by how many gates one
 * run would settle, each marked with whether the project's C++ Source registers it (a
 * read-only scan, re-derived on every load). Nothing touches the UE bridge until a Run is
 * clicked, and nothing reaches Claude until Send to Claude is clicked in the Author panel.
 */
export function WaitingTestsTab() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [data, setData] = useState<WaitingTests | null>(null);
  const [planned, setPlanned] = useState<Planned | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [running, setRunning] = useState<string | null>(null);
  // The last run's outcome lives above the list: a settle refreshes the queue and the row may leave it.
  const [lastRun, setLastRun] = useState<{ testName: string; outcome: WaitingRunOutcome } | null>(null);
  const [author, dispatchAuthor] = useReducer(authorReducer, AUTHOR_IDLE);
  const [authorLoading, setAuthorLoading] = useState<string | null>(null);
  const [authorError, setAuthorError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scan = projectPath ? tryApiFetch<Planned>(plannedTestsUrl(projectPath)) : null;
    void Promise.all([tryApiFetch<GateJob[]>(WAITING_TESTS_URL), scan]).then(([r, p]) => {
      if (cancelled) return;
      if (r.ok) { setData(groupWaitingTests(r.data)); setLoadError(null); } else setLoadError(r.error);
      setPlanned(p?.ok ? p.data : null);
      setScanError(p && !p.ok ? p.error : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey, projectPath]);

  // Loading is raised by whoever asks for the reload (never set synchronously inside the effect).
  const reload = useCallback(() => { setLoading(true); setReloadKey((k) => k + 1); }, []);

  const cli = useModuleCLI({
    moduleId: AUTHOR_MODULE,
    sessionKey: AUTHOR_SESSION_KEY,
    label: 'Author UE test',
    accentColor: ACCENT_VIOLET,
    // The CLI's own claim: moves the author flow to authored-unverified / author-failed only.
    // A success re-scans Source so the row's presence comes from disk, not from this callback.
    onComplete: (success) => { dispatchAuthor({ type: 'cli-complete', success }); if (success) reload(); },
  });
  const sessionId = useCLIPanelStore((s) => s.tabOrder.find((id) => s.sessions[id]?.sessionKey === AUTHOR_SESSION_KEY) ?? null);

  const run = useCallback(async (testName: string) => {
    setRunning(testName);
    const outcome = await runWaitingTest(testName);
    setLastRun({ testName, outcome });
    dispatchAuthor({ type: 'run-outcome', testName, outcome });
    setRunning(null);
    // A settle changes the queue — refresh so the number the operator decided on visibly drops.
    if (outcome.kind === 'settled' && outcome.outcome.settled > 0) reload();
  }, [reload]);

  /** Preview only: fetch the authoring task + scaffold. Nothing is dispatched here. */
  const openAuthor = useCallback(async (testName: string) => {
    setAuthorLoading(testName);
    setAuthorError(null);
    const r = await fetchApi.post<{ tasks: AuthoringTaskEntry[] }>(PLANNED_TESTS_URL, { action: 'authoring-tasks', testName });
    setAuthorLoading(null);
    const t = r.ok ? r.data.tasks[0] : undefined;
    if (!t) { setAuthorError(r.ok ? `no authoring task for ${testName}` : r.error); return; }
    dispatchAuthor({ type: 'preview', testName: t.testName, scaffold: t.scaffold, requestedBy: t.requestedBy ?? [], task: t.task });
  }, []);

  const send = useCallback(() => {
    if (author.phase !== 'preview' && author.phase !== 'author-failed') return;
    dispatchAuthor({ type: 'dispatch' });
    cli.execute(author.task).catch((e: unknown) => {
      dispatchAuthor({ type: 'cli-complete', success: false, reason: e instanceof Error ? e.message : 'dispatch failed' });
    });
  }, [author, cli]);

  const view = useMemo(() => (data ? mergeWaitingPresence(data, planned) : null), [data, planned]);
  const totalGates = view?.tests.reduce((n, t) => n + t.gates, 0) ?? 0;
  const sourceLabel = view ? notInSourceLabel(view) : null;
  const authorPanel = (testName: string) => author.phase !== 'idle' && author.testName === testName && (
    <AuthorTestPanel state={author} onSend={send} onVerify={() => void run(testName)}
      onClose={() => dispatchAuthor({ type: 'close' })} cliRunning={cli.isRunning}
      runBusy={running !== null} sessionId={sessionId} />
  );
  // A settle can take the authored row out of the queue — its panel (and verdict) stays visible.
  const orphanAuthor = author.phase !== 'idle' && !view?.tests.some((t) => t.testName === author.testName);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          {view
            ? `${view.tests.length} test${view.tests.length !== 1 ? 's' : ''} · ${totalGates} deferred L3 gate${totalGates !== 1 ? 's' : ''} waiting${view.unnamed ? ` · ${view.unnamed} name no test` : ''}${sourceLabel ? ` · ${sourceLabel}` : ''}`
            : 'UE tests your deferred gates wait on'}
        </span>
        <button
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text disabled:opacity-40"
          disabled={loading || running !== null}
          onClick={reload}
        >
          <RotateCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {scanError && <p className="text-2xs" style={{ color: STATUS_WARNING }}>UE source not scanned ({scanError}) — presence unknown, every row offers Run.</p>}
      {authorError && <p className="text-2xs" style={{ color: STATUS_ERROR }}>Could not build the authoring task: {authorError}</p>}

      {lastRun && (
        <p className="text-2xs" role="status" style={{ color: outcomeColor(lastRun.outcome) }}>
          <span className="font-mono">{lastRun.testName}</span>: {describeRunOutcome(lastRun.outcome)}
        </p>
      )}

      {loadError && (
        <p className="text-xs" style={{ color: STATUS_ERROR }}>Could not load the deferred queue: {loadError}</p>
      )}

      {view && view.tests.length === 0 && !loading && (
        <div className="text-center py-8 text-xs text-text-muted">
          <Hourglass className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No deferred L3 gate is waiting on a named UE test.</p>
        </div>
      )}

      {view && view.tests.length > 0 && (
        <ul className="divide-y divide-border rounded border border-border">
          {view.tests.map((t) => {
            const isThis = running === t.testName;
            return (
              <li key={t.testName} className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-text truncate" title={t.testName}>{t.testName}</div>
                    <div className="text-2xs text-text-muted truncate">
                      {t.gates} gate{t.gates !== 1 ? 's' : ''} · {t.catalogs.length} catalog{t.catalogs.length !== 1 ? 's' : ''} ({t.catalogs.join(', ')})
                      {t.presence === 'not-in-source' && <span style={{ color: STATUS_WARNING }}> · not in UE source</span>}
                      {t.presence === 'ambiguous' && <span style={{ color: STATUS_WARNING }}> · ambiguous: several registered tests match</span>}
                    </div>
                  </div>
                  {t.action === 'author' && (
                    <button aria-label={`Author ${t.testName}`} className={BTN} style={{ color: ACCENT_VIOLET }}
                      disabled={authorLoading !== null} onClick={() => void openAuthor(t.testName)}>
                      {authorLoading === t.testName ? <Loader2 className="w-3 h-3 animate-spin" /> : <FilePlus2 className="w-3 h-3" />}
                      Author
                    </button>
                  )}
                  <button aria-label={`Run ${t.testName}`} className={BTN}
                    style={{ color: t.action === 'run' ? ACCENT_VIOLET : undefined }}
                    disabled={running !== null} onClick={() => void run(t.testName)}>
                    {isThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    {isThis ? 'Running…' : 'Run + settle'}
                  </button>
                </div>
                {authorPanel(t.testName)}
              </li>
            );
          })}
        </ul>
      )}
      {orphanAuthor && authorPanel(author.testName)}
    </div>
  );
}
