'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useModuleStore } from '@/stores/moduleStore';
import { MODULE_LABELS } from '@/lib/module-registry';
import { TaskFactory } from '@/lib/cli-task';
import { EVAL_PASSES, type EvalPass } from '@/lib/evaluator/module-eval-prompts';
import type { SubModuleId } from '@/types/modules';
import type { ScanFinding, ScanSeverity } from '@/types/scan';
import { getAppOrigin, UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT, EMPTY_FINDINGS } from './constants';

export function useScanTab(moduleId: SubModuleId) {
  const moduleLabel = MODULE_LABELS[moduleId] ?? moduleId;
  const findings = useModuleStore((s) => s.scanResults[moduleId] ?? EMPTY_FINDINGS);
  const addScanFindings = useModuleStore((s) => s.addScanFindings);
  const clearScanFindings = useModuleStore((s) => s.clearScanFindings);
  const resolveScanFinding = useModuleStore((s) => s.resolveScanFinding);

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

  // --- Batch fix CLI ---
  const advanceFix = useCallback(() => {
    const queue = fixQueueRef.current;
    if (queue.length === 0) {
      setActiveFixId(null);
      fixTotalRef.current = 0;
      return;
    }

    const [nextId, ...rest] = queue;
    setFixQueue(rest);
    setActiveFixId(nextId);

    const finding = useModuleStore.getState().scanResults[moduleId]?.find((f) => f.id === nextId);
    if (finding) {
      const prompt = `Fix the following issue in the ${moduleLabel} module:\n\n**${finding.category}** (${finding.severity})\n${finding.description}\n\nFile: ${finding.file ?? 'N/A'}\n\nSuggested fix: ${finding.suggestedFix}`;
      fixCliRef.current?.sendPrompt(prompt);
    }
  }, [moduleId, moduleLabel]);

  const handleFixComplete = useCallback((success: boolean) => {
    const completedId = activeFixId;
    if (success && completedId) {
      resolveScanFinding(moduleId, completedId);
    }
    // Advance to next in queue
    setTimeout(advanceFix, UI_TIMEOUTS.batchItemDelay);
  }, [activeFixId, moduleId, resolveScanFinding, advanceFix]);

  const fixCli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-fix`,
    label: `${moduleLabel} Fix`,
    accentColor: ACCENT,
    onComplete: handleFixComplete,
  });

  const fixCliRef = useRef(fixCli);
  fixCliRef.current = fixCli;

  const startBatchFix = useCallback(() => {
    const ids = Array.from(selectedFindings);
    if (ids.length === 0) return;

    fixTotalRef.current = ids.length;
    const [firstId, ...rest] = ids;
    setFixQueue(rest);
    setActiveFixId(firstId);
    setSelectedFindings(new Set());

    const finding = findings.find((f) => f.id === firstId);
    if (finding) {
      const prompt = `Fix the following issue in the ${moduleLabel} module:\n\n**${finding.category}** (${finding.severity})\n${finding.description}\n\nFile: ${finding.file ?? 'N/A'}\n\nSuggested fix: ${finding.suggestedFix}`;
      fixCli.sendPrompt(prompt);
    }
  }, [selectedFindings, findings, moduleLabel, fixCli]);

  const markSelectedResolved = useCallback(() => {
    for (const id of selectedFindings) {
      resolveScanFinding(moduleId, id);
    }
    setSelectedFindings(new Set());
  }, [selectedFindings, moduleId, resolveScanFinding]);

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
    const counts: Record<EvalPass, number> = { 'ground-truth': 0, structure: 0, quality: 0, performance: 0, 'combat-trace': 0 };
    for (const f of activeFindings) {
      counts[f.pass]++;
    }
    return counts;
  }, [activeFindings]);

  // Batch fix progress
  const isBatchFixing = activeFixId !== null;
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
    clearScanFindings,
    resolveScanFinding,
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
    markSelectedResolved,
    isBatchFixing,
    fixProgress,
    fixTotalRef,
    activeFixId,
  };
}
