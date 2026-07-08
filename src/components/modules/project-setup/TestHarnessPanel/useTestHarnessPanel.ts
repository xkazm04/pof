import { useState, useCallback, useMemo, useRef } from 'react';
import { useTestRunner } from '@/hooks/useTestRunner';
import { useSnapshots } from '@/hooks/useSnapshots';
import type {
  PofTestSpec, PofTestResult, PofSnapshotDiffReport, PofSnapshotCaptureRequest,
} from '@/types/pof-bridge';
import type { TestSuite, SuiteRunResult } from './types';
import { TEMPLATE_SCENARIO } from './constants';
import { generateId } from './helpers';

export function useTestHarnessPanel() {
  const { runTest, results: testResults, isRunning: isTestRunning, error: testError, clearResults } = useTestRunner();
  const { capture, diffReport, isCapturing, error: snapError, refreshDiff } = useSnapshots();

  // ── Suites ──
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [activeSuiteId, setActiveSuiteId] = useState<string | null>(null);
  const [suiteRunHistory, setSuiteRunHistory] = useState<SuiteRunResult[]>([]);

  // ── UI state ──
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'suites' | 'results' | 'snapshots'>('suites');
  const [editingScenarioIdx, setEditingScenarioIdx] = useState<number | null>(null);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [isSuiteRunning, setIsSuiteRunning] = useState(false);

  const runAbortRef = useRef(false);

  const activeSuite = useMemo(
    () => suites.find((s) => s.id === activeSuiteId) ?? null,
    [suites, activeSuiteId],
  );

  // ── Suite CRUD ──

  const createSuite = useCallback(() => {
    const id = generateId();
    const newSuite: TestSuite = {
      id,
      name: `Test Suite ${suites.length + 1}`,
      description: 'New test suite',
      scenarios: [{ ...TEMPLATE_SCENARIO, testId: `test-${id}` }],
      snapshotPresets: [],
      createdAt: Date.now(),
    };
    setSuites((prev) => [...prev, newSuite]);
    setActiveSuiteId(id);
  }, [suites.length]);

  const deleteSuite = useCallback((id: string) => {
    setSuites((prev) => prev.filter((s) => s.id !== id));
    if (activeSuiteId === id) setActiveSuiteId(null);
  }, [activeSuiteId]);

  const duplicateSuite = useCallback((id: string) => {
    const source = suites.find((s) => s.id === id);
    if (!source) return;
    const newId = generateId();
    const dup: TestSuite = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      scenarios: source.scenarios.map((sc) => ({ ...sc, testId: `test-${generateId()}` })),
      createdAt: Date.now(),
    };
    setSuites((prev) => [...prev, dup]);
    setActiveSuiteId(newId);
  }, [suites]);

  const updateSuiteField = useCallback((id: string, field: keyof TestSuite, value: unknown) => {
    setSuites((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }, []);

  // ── Scenario CRUD ──

  const addScenario = useCallback(() => {
    if (!activeSuiteId) return;
    const newScenario: PofTestSpec = {
      ...TEMPLATE_SCENARIO,
      testId: `test-${generateId()}`,
      description: 'New test scenario',
    };
    setSuites((prev) =>
      prev.map((s) =>
        s.id === activeSuiteId ? { ...s, scenarios: [...s.scenarios, newScenario] } : s,
      ),
    );
  }, [activeSuiteId]);

  const removeScenario = useCallback((idx: number) => {
    if (!activeSuiteId) return;
    setSuites((prev) =>
      prev.map((s) =>
        s.id === activeSuiteId
          ? { ...s, scenarios: s.scenarios.filter((_, i) => i !== idx) }
          : s,
      ),
    );
    setEditingScenarioIdx(null);
  }, [activeSuiteId]);

  const updateScenario = useCallback((idx: number, updated: PofTestSpec) => {
    if (!activeSuiteId) return;
    setSuites((prev) =>
      prev.map((s) =>
        s.id === activeSuiteId
          ? { ...s, scenarios: s.scenarios.map((sc, i) => (i === idx ? updated : sc)) }
          : s,
      ),
    );
  }, [activeSuiteId]);

  // ── JSON editor ──

  const openJsonEditor = useCallback(() => {
    if (!activeSuite) return;
    setJsonDraft(JSON.stringify(activeSuite.scenarios, null, 2));
    setJsonEditorOpen(true);
  }, [activeSuite]);

  const applyJsonDraft = useCallback(() => {
    if (!activeSuiteId) return;
    try {
      const parsed = JSON.parse(jsonDraft) as PofTestSpec[];
      if (!Array.isArray(parsed)) return;
      updateSuiteField(activeSuiteId, 'scenarios', parsed);
      setJsonEditorOpen(false);
    } catch {
      // invalid JSON — don't apply
    }
  }, [activeSuiteId, jsonDraft, updateSuiteField]);

  // ── Run suite ──

  const runSuite = useCallback(async () => {
    if (!activeSuite || isSuiteRunning) return;
    setIsSuiteRunning(true);
    setActiveTab('results');
    runAbortRef.current = false;

    const startedAt = Date.now();
    const runResults: PofTestResult[] = [];

    // Run each scenario sequentially
    for (const scenario of activeSuite.scenarios) {
      if (runAbortRef.current) break;
      const result = await runTest(scenario);
      if (result) runResults.push(result);
    }

    // Run snapshot capture if presets configured
    let snapshotReport: PofSnapshotDiffReport | null = null;
    if (activeSuite.snapshotPresets.length > 0 && !runAbortRef.current) {
      const captureReq: PofSnapshotCaptureRequest = {
        presetIds: activeSuite.snapshotPresets,
        compareToBaseline: true,
        diffThreshold: 0.5,
      };
      snapshotReport = await capture(captureReq);
    }

    const finishedAt = Date.now();
    const allPassed = runResults.every((r) => r.status === 'passed');
    const anyFailed = runResults.some((r) => r.status === 'failed' || r.status === 'error');
    const snapshotPassed = !snapshotReport || snapshotReport.overallStatus === 'passed';

    const suiteResult: SuiteRunResult = {
      suiteId: activeSuite.id,
      suiteName: activeSuite.name,
      startedAt,
      finishedAt,
      testResults: runResults,
      snapshotReport,
      status: anyFailed || !snapshotPassed ? 'failed' : allPassed ? 'passed' : 'partial',
    };

    setSuiteRunHistory((prev) => [suiteResult, ...prev].slice(0, 20));
    setIsSuiteRunning(false);
  }, [activeSuite, isSuiteRunning, runTest, capture]);

  const abortRun = useCallback(() => {
    runAbortRef.current = true;
  }, []);

  // ── Render helpers ──

  const error = testError || snapError;
  const isRunning = isTestRunning || isCapturing || isSuiteRunning;

  return {
    // hook passthrough
    testResults, clearResults, diffReport, isCapturing, refreshDiff,
    // suites
    suites, activeSuiteId, setActiveSuiteId, suiteRunHistory, setSuiteRunHistory, activeSuite,
    // ui state
    expanded, setExpanded, activeTab, setActiveTab,
    editingScenarioIdx, setEditingScenarioIdx,
    jsonEditorOpen, setJsonEditorOpen, jsonDraft, setJsonDraft, isSuiteRunning,
    // derived
    error, isRunning,
    // suite crud
    createSuite, deleteSuite, duplicateSuite, updateSuiteField,
    // scenario crud
    addScenario, removeScenario, updateScenario,
    // json editor
    openJsonEditor, applyJsonDraft,
    // run
    runSuite, abortRun,
  };
}
