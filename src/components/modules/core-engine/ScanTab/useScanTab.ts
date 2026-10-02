'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { usePaneHold } from '@/hooks/usePaneHold';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useModuleStore } from '@/stores/moduleStore';
import { MODULE_LABELS } from '@/lib/module-registry';
import { TaskFactory } from '@/lib/cli-task';
import { EVAL_PASSES, getPassesForModule, type EvalPass } from '@/lib/evaluator/module-eval-prompts';
import type { SubModuleId } from '@/types/modules';
import type { ScanDelta, ScanDeltaState, ScanFinding, ScanSeverity } from '@/types/scan';
import { getAppOrigin, UI_TIMEOUTS } from '@/lib/constants';
import { tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import {
  buildScanFixPrompt, formatPreviousFinding, planFixVerification, settleFixVerification,
  FIX_VERIFICATION_IDLE, idsIn, beginFixes, recordFixOutcome, dropFixTarget, finishFixes,
  beginVerification, applySettlement, markUnverified, type FixVerification,
} from '@/lib/evaluator/scan-fix-verify';
import { ACCENT, EMPTY_FINDINGS } from './constants';

/** The store caps a module at 100 findings; the GET is newest-first, so keep the newest. */
const STORE_FINDINGS_CAP = 100;
const UNRECORDED_REASON = 'the scan finished but its report was not recorded';
const FAILED_UNRECORDED_REASON = 'the scan failed before its report was recorded';

interface ScanImportView { findings: ScanFinding[]; delta?: ScanDelta | null }
interface ResolveResponse { updated: number; missing: string[] }

export function useScanTab(moduleId: SubModuleId) {
  const moduleLabel = MODULE_LABELS[moduleId] ?? moduleId;
  const findings = useModuleStore((s) => s.scanResults[moduleId] ?? EMPTY_FINDINGS);
  const addScanFindings = useModuleStore((s) => s.addScanFindings);
  const clearScanFindings = useModuleStore((s) => s.clearScanFindings);
  const resolveScanFinding = useModuleStore((s) => s.resolveScanFinding);

  // --- Re-Scan delta + durable resolutions ---
  const [deltaState, setDeltaState] = useState<ScanDeltaState>({ status: 'none' });
  // When a scan this view dispatched is still waiting for its record: a delta
  // older than this is an EARLIER scan's result and must not be shown as this one's.
  const scanDispatchedAtRef = useRef<number | null>(null);
  const loadErrorRef = useRef<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [lastResolved, setLastResolved] = useState<string[] | null>(null);

  // The selector offers every pass this module has (arpg-combat adds combat-trace);
  // the default selection stays the 4 passes every module runs.
  const passOptions = useMemo(() => getPassesForModule(moduleId), [moduleId]);
  const [selectedPasses, setSelectedPasses] = useState<Set<EvalPass>>(new Set(EVAL_PASSES));
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [scanCount, setScanCount] = useState(0);

  // --- Batch fix state ---
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [fixQueue, setFixQueue] = useState<string[]>([]);
  const fixQueueRef = useRef<string[]>([]);
  fixQueueRef.current = fixQueue;
  const [activeFixId, setActiveFixId] = useState<string | null>(null);
  const fixTotalRef = useRef(0);

  // --- Fix & verify: a fix exiting 0 resolves nothing; a Verify click runs ONE
  // scan over the fixed targets' passes and only what it no longer finds resolves.
  const [fixVerification, setFixVerification] = useState<FixVerification>(FIX_VERIFICATION_IDLE);
  /** Targets of the verification scan in flight (null = none). */
  const verifyTargetsRef = useRef<string[] | null>(null);
  const settleVerifyRef = useRef<(delta: ScanDelta) => void>(() => {});

  // Load findings + the latest scan's delta from the DB. The DB is the source of
  // truth for resolutions, so the store is REPLACED, never merged: a merge kept a
  // stale in-memory copy active over a server-side resolution.
  const fetchAndMergeFindings = useCallback(async (): Promise<boolean> => {
    const res = await tryApiFetch<ScanImportView>(
      `/api/module-scan/import?moduleId=${encodeURIComponent(moduleId)}&view=delta`,
    );
    if (!res.ok) {
      loadErrorRef.current = res.error;
      logger.warn(`[ScanTab] ${moduleId} could not load scan findings: ${res.error}`);
      return false;
    }
    loadErrorRef.current = null;
    clearScanFindings(moduleId);
    if (res.data.findings.length > 0) {
      addScanFindings(moduleId, res.data.findings.slice(0, STORE_FINDINGS_CAP));
    }
    const delta = res.data.delta ?? null;
    const since = scanDispatchedAtRef.current;
    if (since === null) {
      setDeltaState(delta ? { status: 'recorded', delta } : { status: 'none' });
    } else if (delta && Date.parse(delta.scan.createdAt) >= since) {
      scanDispatchedAtRef.current = null;
      setDeltaState({ status: 'recorded', delta });
      settleVerifyRef.current(delta);
    } else {
      setDeltaState({ status: 'pending' });
    }
    return true;
  }, [moduleId, addScanFindings, clearScanFindings]);

  const handleScanComplete = useCallback(async (success: boolean) => {
    // Final fetch to pick up the scan's record, whatever the outcome.
    const loaded = await fetchAndMergeFindings();
    if (success) setScanCount((n) => n + 1);
    if (scanDispatchedAtRef.current === null) return; // recorded — the delta is shown
    scanDispatchedAtRef.current = null;
    const reason = !loaded
      ? `the scan finished but its record could not be loaded: ${loadErrorRef.current ?? 'unknown error'}`
      : success ? UNRECORDED_REASON : FAILED_UNRECORDED_REASON;
    logger.warn(`[ScanTab] ${moduleId} scan unrecorded: ${reason}`);
    setDeltaState({ status: 'unrecorded', reason });
    if (verifyTargetsRef.current) {
      // A verification scan with no record verifies nothing — and resolves nothing.
      verifyTargetsRef.current = null;
      setFixVerification((prev) => markUnverified(prev, reason));
    }
  }, [fetchAndMergeFindings, moduleId]);

  /** Resolve findings server-side (ONE request), then reload the DB's truth.
   *  A failed save is reported, and the reload reverts the optimistic mark. */
  const setResolved = useCallback(async (ids: string[], resolved: boolean): Promise<string[]> => {
    if (ids.length === 0) return [];
    if (resolved) for (const id of ids) resolveScanFinding(moduleId, id);
    setResolveError(null);
    const res = await tryApiFetch<ResolveResponse>('/api/module-scan/import', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, ids, resolved }),
    });
    let saved: string[] = [];
    if (!res.ok) {
      setResolveError(`${resolved ? 'Resolution' : 'Undo'} not saved: ${res.error}`);
    } else {
      const missing = new Set(res.data.missing ?? []);
      saved = ids.filter((id) => !missing.has(id));
      if (missing.size > 0) setResolveError(`${missing.size} finding${missing.size !== 1 ? 's' : ''} not found on the server — not saved`);
    }
    await fetchAndMergeFindings();
    return saved;
  }, [moduleId, resolveScanFinding, fetchAndMergeFindings]);

  const resolveFindings = useCallback(async (ids: string[]) => {
    const saved = await setResolved(ids, true);
    setLastResolved(saved.length > 0 ? saved : null);
  }, [setResolved]);

  // The verification scan's record arrived: settle its targets, PATCH only the verified.
  const settleVerification = useCallback((delta: ScanDelta) => {
    const targets = verifyTargetsRef.current;
    if (!targets) return;
    verifyTargetsRef.current = null;
    const settlement = settleFixVerification(targets, delta);
    logger.info(`[ScanTab] ${moduleId} fix verification: ${settlement.verified.length} verified, ${settlement.stillPresent.length} still present, ${settlement.unverified.length} unverified`);
    setFixVerification((prev) => applySettlement(prev, settlement));
    if (settlement.verified.length > 0) void resolveFindings(settlement.verified);
  }, [moduleId, resolveFindings]);
  settleVerifyRef.current = settleVerification;

  const undoResolve = useCallback(async () => {
    const ids = lastResolved ?? [];
    setLastResolved(null);
    await setResolved(ids, false);
  }, [lastResolved, setResolved]);

  const scanCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-scan`,
    label: `${moduleLabel} Scan`,
    accentColor: ACCENT,
    onComplete: handleScanComplete,
  });

  // --- Batch fix CLI ---
  // Self-rescheduling timer, NOT a one-shot delay: every fix completion arms the
  // next tick, so the chain re-enters itself until something ends it. It is
  // bounded by a queue that strictly shrinks one id per tick, and every exit
  // REPORTS its reason rather than stopping silently:
  //   • queue drained            — the batch finished normally
  //   • finding no longer listed — that id is skipped and the drain continues
  //     (it would otherwise stall with `isBatchFixing` stuck true forever, since
  //     no CLI run is dispatched and nothing would ever call onComplete again)
  //   • hook unmounted           — LRU eviction destroys the queue and progress
  //     UI, so a further tick would dispatch a paid CLI run nobody can see. The
  //     batch holds its pane (`usePaneHold`, below) so the LRU only does this
  //     when every other candidate is held too — and then says so in the feed.
  // It deliberately does NOT pause under SuspendContext: a batch fix is a
  // user-initiated, paid, multi-minute CLI run, and hiding the module in the LRU
  // must not stall it — the same reasoning that keeps the forge poll alive
  // (see visual-gen/asset-forge/useForgeStore.ts).
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceFixRef = useRef<() => void>(() => {});

  const scheduleAdvance = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      advanceFixRef.current();
    }, UI_TIMEOUTS.batchItemDelay);
  }, []);

  const advanceFix = useCallback(() => {
    const queue = fixQueueRef.current;
    if (queue.length === 0) {
      setActiveFixId(null);
      fixTotalRef.current = 0;
      setFixVerification(finishFixes);
      logger.info(`[ScanTab] ${moduleId} batch fix ended: queue drained`);
      return;
    }

    const [nextId, ...rest] = queue;
    setFixQueue(rest);
    setActiveFixId(nextId);

    const finding = useModuleStore.getState().scanResults[moduleId]?.find((f) => f.id === nextId);
    if (!finding) {
      logger.warn(`[ScanTab] ${moduleId} batch fix skipped "${nextId}": finding no longer in scan results — advancing to the next item`);
      setFixVerification((prev) => dropFixTarget(prev, nextId));
      scheduleAdvance();
      return;
    }

    fixCliRef.current?.sendPrompt(buildScanFixPrompt(finding, moduleLabel));
  }, [moduleId, moduleLabel, scheduleAdvance]);

  advanceFixRef.current = advanceFix;

  // Cancel a pending advance when the view goes away for good, and say so —
  // an LRU eviction mid-batch must not leave a tick that dispatches into a
  // torn-down hook.
  useEffect(() => () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
      logger.info(`[ScanTab] ${moduleId} batch fix chain stopped: view unmounted with items still queued`);
    }
  }, [moduleId]);

  // A fix run's exit code is its outcome, never a resolution: the finding stays
  // open until a Verify scan no longer finds it.
  const handleFixComplete = useCallback((success: boolean) => {
    const completedId = activeFixId;
    if (completedId) setFixVerification((prev) => recordFixOutcome(prev, completedId, success));
    if (fixQueueRef.current.length === 0) setFixVerification(finishFixes);
    // Advance to next in queue
    scheduleAdvance();
  }, [activeFixId, scheduleAdvance]);

  const fixCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-fix`,
    label: `${moduleLabel} Fix`,
    accentColor: ACCENT,
    onComplete: handleFixComplete,
  });

  const fixCliRef = useRef(fixCli);
  fixCliRef.current = fixCli;

  /** Fix `ids` through the FIX session — a batch, or a single row as a queue of one. */
  const startFixes = useCallback((ids: string[]) => {
    if (ids.length === 0 || activeFixId !== null) return;

    fixTotalRef.current = ids.length;
    const [firstId, ...rest] = ids;
    setFixQueue(rest);
    setActiveFixId(firstId);
    setFixVerification((prev) => beginFixes(prev, ids));

    const finding = findings.find((f) => f.id === firstId);
    if (finding) fixCli.sendPrompt(buildScanFixPrompt(finding, moduleLabel));
  }, [activeFixId, findings, moduleLabel, fixCli]);

  const startBatchFix = useCallback(() => {
    startFixes(Array.from(selectedFindings));
    setSelectedFindings(new Set());
  }, [selectedFindings, startFixes]);

  const fixFinding = useCallback((id: string) => { startFixes([id]); }, [startFixes]);

  const markSelectedResolved = useCallback(() => {
    void resolveFindings(Array.from(selectedFindings));
    setSelectedFindings(new Set());
  }, [selectedFindings, resolveFindings]);

  // Poll for new findings while the scan is running (every 3s)
  // Pauses when module is suspended (hidden in LRU).
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useSuspendableEffect(() => {
    if (scanCli.isRunning) {
      // Start polling
      pollRef.current = setInterval(() => { void fetchAndMergeFindings(); }, 3000);
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
    void fetchAndMergeFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const startScan = useCallback(() => {
    const passes = Array.from(selectedPasses) as EvalPass[];
    if (passes.length === 0) return;
    const appOrigin = getAppOrigin();

    // Build previous findings summary for iterative scanning
    const activeFindings = findings.filter((f) => !f.resolvedAt);
    const previousFindings = activeFindings.length > 0
      ? activeFindings.map(formatPreviousFinding).join('\n')
      : undefined;

    const task = TaskFactory.moduleScan(moduleId, passes, appOrigin, `${moduleLabel} Scan`, previousFindings);
    scanDispatchedAtRef.current = Date.now();
    setDeltaState({ status: 'pending' });
    setLastResolved(null);
    scanCli.execute(task);
  }, [selectedPasses, findings, moduleId, moduleLabel, scanCli]);

  /** Verify the fixed findings: ONE module scan over their passes — only ever on a click. */
  const verifyFixes = useCallback(() => {
    if (fixVerification.status !== 'ready-to-verify') return;
    const fixed = new Set(idsIn(fixVerification, 'fixed'));
    const plan = planFixVerification(findings.filter((f) => fixed.has(f.id) && !f.resolvedAt));
    if (!plan) {
      setFixVerification((prev) => markUnverified(prev, 'the fixed findings are no longer listed'));
      return;
    }
    const task = TaskFactory.moduleScan(moduleId, plan.passes, getAppOrigin(), `${moduleLabel} Fix verification`, plan.previousFindings);
    verifyTargetsRef.current = plan.targetIds;
    scanDispatchedAtRef.current = Date.now();
    setDeltaState({ status: 'pending' });
    setLastResolved(null);
    setFixVerification((prev) => beginVerification(prev, plan.targetIds));
    void scanCli.execute(task);
  }, [fixVerification, findings, moduleId, moduleLabel, scanCli]);

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

  const toggleSelectFinding = useCallback((id: string) => {
    setSelectedFindings((prev) => {
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
    const counts: Partial<Record<EvalPass, number>> = {};
    for (const pass of passOptions) counts[pass] = 0;
    for (const f of activeFindings) {
      if (f.pass in counts) counts[f.pass] = (counts[f.pass] ?? 0) + 1;
    }
    return counts;
  }, [activeFindings, passOptions]);

  // Batch fix progress
  const isBatchFixing = activeFixId !== null;
  // Held for the whole batch, including the inter-item gap when no CLI session
  // is running and the shell would otherwise see nothing live in this pane.
  usePaneHold(isBatchFixing, 'Batch fix running');
  const fixProgress = fixTotalRef.current > 0
    ? fixTotalRef.current - fixQueue.length - (activeFixId ? 1 : 0)
    : 0;

  const allSelected = activeFindings.length > 0 && selectedFindings.size === activeFindings.length;
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedFindings(new Set());
    } else {
      setSelectedFindings(new Set(activeFindings.map((f) => f.id)));
    }
  }, [allSelected, activeFindings]);

  return {
    moduleLabel,
    findings,
    deltaState,
    resolveFindings,
    undoResolve,
    lastResolved,
    resolveError,
    passOptions,
    selectedPasses,
    togglePass,
    scanCount,
    scanCli,
    fixCli,
    startScan,
    activeFindings,
    resolvedFindings,
    bySeverity,
    severityCounts,
    passCounts,
    expandedFindings,
    toggleFinding,
    selectedFindings,
    toggleSelectFinding,
    toggleSelectAll,
    allSelected,
    startBatchFix,
    fixFinding,
    fixVerification,
    verifyFixes,
    markSelectedResolved,
    isBatchFixing,
    fixProgress,
    fixTotalRef,
    activeFixId,
  };
}
