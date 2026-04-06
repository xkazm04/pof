'use client';

/**
 * TestHarnessPanel — Remote-controlled UE5 test harness.
 *
 * Orchestrates test scenarios (spawn actor, set properties, advance frames,
 * capture screenshots, assert values) via the PoF Bridge, displaying
 * structured pass/fail results with visual diff summaries.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  FlaskConical, Play, Plus, Trash2, Copy, CheckCircle2, XCircle,
  Loader2, Camera, ChevronDown, ChevronRight, FileJson, RotateCcw,
  AlertTriangle, Clock, Crosshair, Eye, Layers,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ErrorBanner } from './ErrorBanner';
import { useTestRunner } from '@/hooks/useTestRunner';
import { useSnapshots } from '@/hooks/useSnapshots';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL, STATUS_INFO,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_PINK,
  OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import type {
  PofTestSpec, PofTestResult, PofTestAction, PofAssertion, PofSpawnEntry,
  PofAssertionResult, PofSnapshotDiffReport, PofSnapshotDiffResult,
  PofSnapshotCaptureRequest, PofCameraPreset,
} from '@/types/pof-bridge';

// ── Suite types ──────────────────────────────────────────────────────────────

interface TestSuite {
  id: string;
  name: string;
  description: string;
  scenarios: PofTestSpec[];
  snapshotPresets: string[];
  createdAt: number;
}

interface SuiteRunResult {
  suiteId: string;
  suiteName: string;
  startedAt: number;
  finishedAt: number;
  testResults: PofTestResult[];
  snapshotReport: PofSnapshotDiffReport | null;
  status: 'passed' | 'failed' | 'partial' | 'error';
}

// ── Default templates ────────────────────────────────────────────────────────

const DEFAULT_SPAWN: PofSpawnEntry = {
  spawn: '/Game/Blueprints/BP_TestActor.BP_TestActor_C',
  tag: 'TestActor',
  location: [0, 0, 100],
  rotation: [0, 0, 0],
};

const DEFAULT_ASSERTION: PofAssertion = {
  id: 'assert-1',
  target: 'TestActor',
  property: 'Health',
  operator: 'greaterThan',
  expected: 0,
  description: 'Actor should have positive health',
};

const DEFAULT_ACTION: PofTestAction = {
  type: 'wait',
  duration: 1.0,
  reason: 'Wait for initialization',
};

const TEMPLATE_SCENARIO: PofTestSpec = {
  testId: 'test-basic-spawn',
  description: 'Spawn actor and verify initial state',
  timeout: 30,
  setup: [DEFAULT_SPAWN],
  actions: [DEFAULT_ACTION],
  assertions: [DEFAULT_ASSERTION],
  cleanup: 'destroyAll',
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Status helpers ───────────────────────────────────────────────────────────

function testStatusColor(status: string): string {
  switch (status) {
    case 'passed': return STATUS_SUCCESS;
    case 'failed': return STATUS_ERROR;
    case 'error': return STATUS_ERROR;
    case 'timeout': return STATUS_WARNING;
    case 'running': return ACCENT_CYAN;
    default: return STATUS_NEUTRAL;
  }
}

function testStatusIcon(status: string) {
  switch (status) {
    case 'passed': return CheckCircle2;
    case 'failed': return XCircle;
    case 'error': return AlertTriangle;
    case 'timeout': return Clock;
    case 'running': return Loader2;
    default: return FlaskConical;
  }
}

function snapshotStatusColor(status: string): string {
  switch (status) {
    case 'passed': return STATUS_SUCCESS;
    case 'failed': return STATUS_ERROR;
    case 'no-baseline': return STATUS_WARNING;
    case 'resolution-mismatch': return ACCENT_ORANGE;
    default: return STATUS_NEUTRAL;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function TestHarnessPanel() {
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

  const tabs: { id: typeof activeTab; label: string; count?: number }[] = [
    { id: 'suites', label: 'Test Suites', count: suites.length },
    { id: 'results', label: 'Results', count: suiteRunHistory.length },
    { id: 'snapshots', label: 'Snapshots' },
  ];

  return (
    <SurfaceCard className="mt-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <button
        className="flex items-center gap-2 w-full text-left px-4 py-3"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
        <FlaskConical className="w-4 h-4" style={{ color: ACCENT_VIOLET }} />
        <span className="text-sm font-medium text-text">Test Harness</span>
        <span className="text-xs text-text-muted ml-auto">
          {suites.length} suite{suites.length !== 1 ? 's' : ''} · {suiteRunHistory.length} run{suiteRunHistory.length !== 1 ? 's' : ''}
        </span>
      </button>

      {!expanded && <div className="h-px bg-border" />}

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* ── Tab bar ──────────────────────────────────────────────────── */}
          <div className="flex gap-1 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  color: activeTab === tab.id ? ACCENT_VIOLET : undefined,
                  borderBottom: activeTab === tab.id ? `2px solid ${ACCENT_VIOLET}` : '2px solid transparent',
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 opacity-60">({tab.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Error banner ──────────────────────────────────────────── */}
          {error && <ErrorBanner message={error} />}

          {/* ── Suites Tab ───────────────────────────────────────────── */}
          {activeTab === 'suites' && (
            <SuitesTab
              suites={suites}
              activeSuiteId={activeSuiteId}
              activeSuite={activeSuite}
              isRunning={isRunning}
              editingScenarioIdx={editingScenarioIdx}
              jsonEditorOpen={jsonEditorOpen}
              jsonDraft={jsonDraft}
              onSelectSuite={setActiveSuiteId}
              onCreateSuite={createSuite}
              onDeleteSuite={deleteSuite}
              onDuplicateSuite={duplicateSuite}
              onUpdateField={updateSuiteField}
              onAddScenario={addScenario}
              onRemoveScenario={removeScenario}
              onUpdateScenario={updateScenario}
              onSetEditingIdx={setEditingScenarioIdx}
              onOpenJsonEditor={openJsonEditor}
              onSetJsonDraft={setJsonDraft}
              onApplyJsonDraft={applyJsonDraft}
              onCloseJsonEditor={() => setJsonEditorOpen(false)}
              onRunSuite={runSuite}
              onAbort={abortRun}
            />
          )}

          {/* ── Results Tab ──────────────────────────────────────────── */}
          {activeTab === 'results' && (
            <ResultsTab
              history={suiteRunHistory}
              isRunning={isSuiteRunning}
              onClear={() => { setSuiteRunHistory([]); clearResults(); }}
            />
          )}

          {/* ── Snapshots Tab ────────────────────────────────────────── */}
          {activeTab === 'snapshots' && (
            <SnapshotsTab
              diffReport={diffReport}
              isCapturing={isCapturing}
              onRefresh={refreshDiff}
            />
          )}
        </div>
      )}
    </SurfaceCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suites Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface SuitesTabProps {
  suites: TestSuite[];
  activeSuiteId: string | null;
  activeSuite: TestSuite | null;
  isRunning: boolean;
  editingScenarioIdx: number | null;
  jsonEditorOpen: boolean;
  jsonDraft: string;
  onSelectSuite: (id: string) => void;
  onCreateSuite: () => void;
  onDeleteSuite: (id: string) => void;
  onDuplicateSuite: (id: string) => void;
  onUpdateField: (id: string, field: keyof TestSuite, value: unknown) => void;
  onAddScenario: () => void;
  onRemoveScenario: (idx: number) => void;
  onUpdateScenario: (idx: number, spec: PofTestSpec) => void;
  onSetEditingIdx: (idx: number | null) => void;
  onOpenJsonEditor: () => void;
  onSetJsonDraft: (v: string) => void;
  onApplyJsonDraft: () => void;
  onCloseJsonEditor: () => void;
  onRunSuite: () => void;
  onAbort: () => void;
}

function SuitesTab({
  suites, activeSuiteId, activeSuite, isRunning,
  editingScenarioIdx, jsonEditorOpen, jsonDraft,
  onSelectSuite, onCreateSuite, onDeleteSuite, onDuplicateSuite,
  onUpdateField, onAddScenario, onRemoveScenario, onUpdateScenario,
  onSetEditingIdx, onOpenJsonEditor, onSetJsonDraft, onApplyJsonDraft,
  onCloseJsonEditor, onRunSuite, onAbort,
}: SuitesTabProps) {
  return (
    <div className="space-y-3">
      {/* Suite list + create */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {suites.map((s) => (
            <button
              key={s.id}
              className="shrink-0 px-2.5 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: s.id === activeSuiteId ? `${ACCENT_VIOLET}${OPACITY_20}` : `${STATUS_NEUTRAL}${OPACITY_8}`,
                color: s.id === activeSuiteId ? ACCENT_VIOLET : undefined,
                border: s.id === activeSuiteId ? `1px solid ${ACCENT_VIOLET}40` : '1px solid transparent',
              }}
              onClick={() => onSelectSuite(s.id)}
            >
              {s.name}
              <span className="opacity-50 ml-1">({s.scenarios.length})</span>
            </button>
          ))}
        </div>
        <button
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
          style={{ background: `${ACCENT_EMERALD}${OPACITY_10}`, color: ACCENT_EMERALD }}
          onClick={onCreateSuite}
        >
          <Plus className="w-3 h-3" /> New Suite
        </button>
      </div>

      {/* Active suite editor */}
      {activeSuite && (
        <div className="space-y-3">
          {/* Suite header row */}
          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-transparent text-sm font-medium text-text border-b border-border focus:border-text-muted outline-none px-1 py-0.5"
              value={activeSuite.name}
              onChange={(e) => onUpdateField(activeSuite.id, 'name', e.target.value)}
            />
            <button
              className="p-1 rounded hover:bg-surface-2 text-text-muted"
              title="Duplicate suite"
              onClick={() => onDuplicateSuite(activeSuite.id)}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-surface-2 text-text-muted"
              title="Edit as JSON"
              onClick={onOpenJsonEditor}
            >
              <FileJson className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-surface-2"
              style={{ color: STATUS_ERROR }}
              title="Delete suite"
              onClick={() => onDeleteSuite(activeSuite.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Suite description */}
          <input
            className="w-full bg-transparent text-xs text-text-muted border-b border-border/50 focus:border-text-muted outline-none px-1 py-0.5"
            placeholder="Suite description..."
            value={activeSuite.description}
            onChange={(e) => onUpdateField(activeSuite.id, 'description', e.target.value)}
          />

          {/* JSON editor overlay */}
          {jsonEditorOpen && (
            <div className="rounded border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border">
                <span className="text-xs font-medium text-text-muted">Edit Scenarios (JSON)</span>
                <div className="flex gap-1">
                  <button
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: `${ACCENT_EMERALD}${OPACITY_15}`, color: ACCENT_EMERALD }}
                    onClick={onApplyJsonDraft}
                  >
                    Apply
                  </button>
                  <button
                    className="px-2 py-0.5 rounded text-xs text-text-muted hover:text-text"
                    onClick={onCloseJsonEditor}
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <textarea
                className="w-full h-48 bg-surface-1 text-xs text-text font-mono p-3 resize-y outline-none"
                value={jsonDraft}
                onChange={(e) => onSetJsonDraft(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          {/* Scenario list */}
          {!jsonEditorOpen && (
            <div className="space-y-2">
              {activeSuite.scenarios.map((scenario, idx) => (
                <ScenarioCard
                  key={scenario.testId}
                  scenario={scenario}
                  index={idx}
                  isExpanded={editingScenarioIdx === idx}
                  onToggle={() => onSetEditingIdx(editingScenarioIdx === idx ? null : idx)}
                  onUpdate={(updated) => onUpdateScenario(idx, updated)}
                  onRemove={() => onRemoveScenario(idx)}
                />
              ))}

              <button
                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors w-full justify-center"
                style={{ background: `${STATUS_NEUTRAL}${OPACITY_8}`, color: STATUS_NEUTRAL }}
                onClick={onAddScenario}
              >
                <Plus className="w-3 h-3" /> Add Scenario
              </button>
            </div>
          )}

          {/* Run button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40"
              style={{
                background: isRunning ? `${STATUS_WARNING}${OPACITY_15}` : `${ACCENT_EMERALD}${OPACITY_15}`,
                color: isRunning ? STATUS_WARNING : ACCENT_EMERALD,
              }}
              disabled={activeSuite.scenarios.length === 0}
              onClick={isRunning ? onAbort : onRunSuite}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running... (click to abort)
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Run Suite ({activeSuite.scenarios.length} test{activeSuite.scenarios.length !== 1 ? 's' : ''})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {suites.length === 0 && (
        <div className="text-center py-8 text-xs text-text-muted">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No test suites yet. Create one to define test scenarios.</p>
          <p className="mt-1 opacity-60">
            Test suites contain spawnable actors, actions, and assertions
            that run in the UE5 editor via the PoF Bridge.
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario Card
// ═══════════════════════════════════════════════════════════════════════════════

interface ScenarioCardProps {
  scenario: PofTestSpec;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (s: PofTestSpec) => void;
  onRemove: () => void;
}

function ScenarioCard({ scenario, index, isExpanded, onToggle, onUpdate, onRemove }: ScenarioCardProps) {
  const updateField = useCallback(
    <K extends keyof PofTestSpec>(field: K, value: PofTestSpec[K]) => {
      onUpdate({ ...scenario, [field]: value });
    },
    [scenario, onUpdate],
  );

  return (
    <div
      className="rounded border overflow-hidden"
      style={{ borderColor: `${STATUS_NEUTRAL}30` }}
    >
      {/* Scenario header */}
      <button
        className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-surface-2 transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <span className="text-xs font-mono text-text-muted">#{index + 1}</span>
        <span className="text-xs font-medium text-text flex-1 truncate">{scenario.description}</span>
        <span className="text-xs text-text-muted">
          {scenario.setup.length} spawn · {scenario.actions.length} action · {scenario.assertions.length} assert
        </span>
        <button
          className="p-0.5 rounded hover:bg-surface-3 shrink-0"
          style={{ color: STATUS_ERROR }}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </button>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t" style={{ borderColor: `${STATUS_NEUTRAL}20` }}>
          {/* Basic fields */}
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-0.5">
              <span className="text-xs text-text-muted uppercase tracking-wider">Test ID</span>
              <input
                className="w-full bg-surface-2 rounded px-2 py-1 text-xs font-mono text-text outline-none"
                value={scenario.testId}
                onChange={(e) => updateField('testId', e.target.value)}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-text-muted uppercase tracking-wider">Timeout (s)</span>
              <input
                className="w-full bg-surface-2 rounded px-2 py-1 text-xs font-mono text-text outline-none"
                type="number"
                value={scenario.timeout}
                onChange={(e) => updateField('timeout', Number(e.target.value))}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-text-muted uppercase tracking-wider">Cleanup</span>
              <select
                className="w-full bg-surface-2 rounded px-2 py-1 text-xs text-text outline-none"
                value={scenario.cleanup}
                onChange={(e) => updateField('cleanup', e.target.value as 'destroyAll' | 'none')}
              >
                <option value="destroyAll">Destroy All</option>
                <option value="none">None</option>
              </select>
            </label>
          </div>

          <label className="block space-y-0.5">
            <span className="text-xs text-text-muted uppercase tracking-wider">Description</span>
            <input
              className="w-full bg-surface-2 rounded px-2 py-1 text-xs text-text outline-none"
              value={scenario.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </label>

          {/* Setup (spawns) */}
          <ScenarioSection
            label="Spawn Setup"
            icon={Layers}
            color={ACCENT_CYAN}
            count={scenario.setup.length}
          >
            {scenario.setup.map((spawn, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <Crosshair className="w-3 h-3 shrink-0" style={{ color: ACCENT_CYAN }} />
                <span className="font-mono text-text-muted truncate flex-1" title={spawn.spawn}>
                  {spawn.tag}
                </span>
                <span className="text-xs text-text-muted">
                  [{spawn.location.join(', ')}]
                </span>
              </div>
            ))}
          </ScenarioSection>

          {/* Actions */}
          <ScenarioSection
            label="Actions"
            icon={Play}
            color={ACCENT_ORANGE}
            count={scenario.actions.length}
          >
            {scenario.actions.map((action, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                {action.type === 'wait' ? (
                  <Clock className="w-3 h-3 shrink-0" style={{ color: ACCENT_ORANGE }} />
                ) : (
                  <Play className="w-3 h-3 shrink-0" style={{ color: ACCENT_ORANGE }} />
                )}
                <span className="text-text-muted">
                  {action.type === 'wait'
                    ? `Wait ${action.duration}s — ${action.reason || 'no reason'}`
                    : `Call ${action.target}.${action.function}()`}
                </span>
              </div>
            ))}
          </ScenarioSection>

          {/* Assertions */}
          <ScenarioSection
            label="Assertions"
            icon={CheckCircle2}
            color={ACCENT_EMERALD}
            count={scenario.assertions.length}
          >
            {scenario.assertions.map((a) => (
              <div key={a.id} className="flex items-center gap-1 text-xs">
                <Eye className="w-3 h-3 shrink-0" style={{ color: ACCENT_EMERALD }} />
                <span className="text-text-muted truncate">
                  {a.target}.{a.property} {a.operator} {JSON.stringify(a.expected)}
                </span>
              </div>
            ))}
          </ScenarioSection>
        </div>
      )}
    </div>
  );
}

// ── Scenario Section (collapsible sub-group) ─────────────────────────────────

function ScenarioSection({
  label, icon: Icon, color, count, children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        className="flex items-center gap-1.5 w-full text-left text-xs uppercase tracking-wider font-medium mb-1"
        style={{ color }}
        onClick={() => setOpen((p) => !p)}
      >
        <Icon className="w-3 h-3" style={{ color }} />
        {label} ({count})
        {open ? <ChevronDown className="w-2.5 h-2.5 ml-auto opacity-50" /> : <ChevronRight className="w-2.5 h-2.5 ml-auto opacity-50" />}
      </button>
      {open && <div className="space-y-1 pl-4">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Results Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface ResultsTabProps {
  history: SuiteRunResult[];
  isRunning: boolean;
  onClear: () => void;
}

function ResultsTab({ history, isRunning, onClear }: ResultsTabProps) {
  const [expandedRunIdx, setExpandedRunIdx] = useState<number | null>(history.length > 0 ? 0 : null);

  if (history.length === 0 && !isRunning) {
    return (
      <div className="text-center py-8 text-xs text-text-muted">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No test results yet. Run a suite to see results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isRunning && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded text-xs"
          style={{ background: `${ACCENT_CYAN}${OPACITY_10}`, color: ACCENT_CYAN }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Suite is running...</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{history.length} run{history.length !== 1 ? 's' : ''}</span>
        <button
          className="text-xs text-text-muted hover:text-text"
          onClick={onClear}
        >
          Clear History
        </button>
      </div>

      {history.map((run, idx) => {
        const isOpen = expandedRunIdx === idx;
        const StatusIcon = run.status === 'passed' ? CheckCircle2 : run.status === 'failed' ? XCircle : AlertTriangle;
        const statusColor = run.status === 'passed' ? STATUS_SUCCESS : run.status === 'failed' ? STATUS_ERROR : STATUS_WARNING;
        const duration = run.finishedAt - run.startedAt;
        const passedCount = run.testResults.filter((r) => r.status === 'passed').length;
        const totalCount = run.testResults.length;

        return (
          <div key={idx} className="rounded border overflow-hidden" style={{ borderColor: `${statusColor}30` }}>
            <button
              className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-surface-2 transition-colors"
              onClick={() => setExpandedRunIdx(isOpen ? null : idx)}
            >
              {isOpen ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <StatusIcon className="w-3.5 h-3.5" style={{ color: statusColor }} />
              <span className="text-xs font-medium text-text flex-1">{run.suiteName}</span>
              <span className="text-xs font-mono" style={{ color: statusColor }}>
                {passedCount}/{totalCount} passed
              </span>
              <span className="text-xs text-text-muted">{(duration / 1000).toFixed(1)}s</span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t" style={{ borderColor: `${STATUS_NEUTRAL}20` }}>
                {run.testResults.map((result) => (
                  <TestResultCard key={result.testId} result={result} />
                ))}

                {run.snapshotReport && (
                  <SnapshotSummaryRow report={run.snapshotReport} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Single Test Result Card ──────────────────────────────────────────────────

function TestResultCard({ result }: { result: PofTestResult }) {
  const [expanded, setExpanded] = useState(result.status !== 'passed');
  const color = testStatusColor(result.status);
  const passedAsserts = result.assertions.filter((a) => a.status === 'passed').length;
  const iconType = testStatusIcon(result.status);

  return (
    <div className="rounded" style={{ background: `${color}${OPACITY_8}` }}>
      <button
        className="flex items-center gap-2 w-full text-left px-2.5 py-1.5"
        onClick={() => setExpanded((p) => !p)}
      >
        {React.createElement(iconType, {
          className: `w-3.5 h-3.5 shrink-0 ${result.status === 'running' ? 'animate-spin' : ''}`,
          style: { color },
        })}
        <span className="text-xs font-mono text-text flex-1 truncate">{result.testId}</span>
        <span className="text-xs" style={{ color }}>
          {passedAsserts}/{result.assertions.length} assertions
        </span>
        {result.durationMs !== undefined && (
          <span className="text-xs text-text-muted">{result.durationMs}ms</span>
        )}
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-1">
          {/* Assertion details */}
          {result.assertions.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5 text-xs pl-5"
            >
              {a.status === 'passed' ? (
                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" style={{ color: STATUS_SUCCESS }} />
              ) : (
                <XCircle className="w-2.5 h-2.5 shrink-0" style={{ color: STATUS_ERROR }} />
              )}
              <span className="text-text-muted truncate">{a.description}</span>
              {a.status === 'failed' && a.failureReason && (
                <span className="ml-auto shrink-0" style={{ color: STATUS_ERROR }}>
                  {a.actual} (expected {a.expected})
                </span>
              )}
            </div>
          ))}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {result.errors.map((err, i) => (
                <div key={i} className="text-xs pl-5" style={{ color: STATUS_ERROR }}>
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Logs */}
          {result.logs.length > 0 && (
            <div className="mt-1 max-h-20 overflow-y-auto">
              {result.logs.map((log, i) => (
                <div key={i} className="text-xs text-text-muted pl-5 font-mono">
                  <span className="opacity-50">[{log.time.toFixed(2)}s]</span> {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Snapshot Summary Row ─────────────────────────────────────────────────────

function SnapshotSummaryRow({ report }: { report: PofSnapshotDiffReport }) {
  const color = report.overallStatus === 'passed' ? STATUS_SUCCESS : STATUS_ERROR;
  return (
    <div className="rounded px-2.5 py-1.5" style={{ background: `${color}${OPACITY_8}` }}>
      <div className="flex items-center gap-2 text-xs">
        <Camera className="w-3.5 h-3.5" style={{ color }} />
        <span className="font-medium text-text">Snapshot Diff</span>
        <span className="ml-auto text-xs" style={{ color }}>
          {report.summary.passed}/{report.summary.totalPresets} passed
        </span>
      </div>
      {report.results.filter((r) => r.status === 'failed').length > 0 && (
        <div className="mt-1 space-y-0.5">
          {report.results
            .filter((r) => r.status === 'failed')
            .map((r) => (
              <div key={r.presetId} className="text-xs pl-5" style={{ color: STATUS_ERROR }}>
                {r.presetName}: {r.diffPercentage.toFixed(2)}% diff ({r.diffPixelCount} px)
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshots Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface SnapshotsTabProps {
  diffReport: PofSnapshotDiffReport | null;
  isCapturing: boolean;
  onRefresh: () => Promise<void>;
}

function SnapshotsTab({ diffReport, isCapturing, onRefresh }: SnapshotsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Visual Regression Diffs</span>
        <button
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text disabled:opacity-40"
          disabled={isCapturing}
          onClick={onRefresh}
        >
          <RotateCcw className={`w-3 h-3 ${isCapturing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!diffReport && !isCapturing && (
        <div className="text-center py-8 text-xs text-text-muted">
          <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No snapshot diff report available.</p>
          <p className="mt-1 opacity-60">
            Configure snapshot presets in your test suite, then run the suite to capture and compare screenshots.
          </p>
        </div>
      )}

      {isCapturing && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded text-xs"
          style={{ background: `${ACCENT_CYAN}${OPACITY_10}`, color: ACCENT_CYAN }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Capturing snapshots...</span>
        </div>
      )}

      {diffReport && (
        <div className="space-y-2">
          {/* Summary bar */}
          <div
            className="flex items-center gap-3 px-3 py-2 rounded"
            style={{
              background: `${diffReport.overallStatus === 'passed' ? STATUS_SUCCESS : STATUS_ERROR}${OPACITY_10}`,
            }}
          >
            {diffReport.overallStatus === 'passed' ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
            ) : (
              <XCircle className="w-4 h-4" style={{ color: STATUS_ERROR }} />
            )}
            <span className="text-xs font-medium text-text">
              {diffReport.overallStatus === 'passed' ? 'All snapshots match' : 'Visual regressions detected'}
            </span>
            <div className="ml-auto flex gap-3 text-xs">
              <span style={{ color: STATUS_SUCCESS }}>{diffReport.summary.passed} passed</span>
              <span style={{ color: STATUS_ERROR }}>{diffReport.summary.failed} failed</span>
              {diffReport.summary.noBaseline > 0 && (
                <span style={{ color: STATUS_WARNING }}>{diffReport.summary.noBaseline} no baseline</span>
              )}
            </div>
          </div>

          {/* Per-preset results */}
          {diffReport.results.map((result) => (
            <SnapshotResultRow key={result.presetId} result={result} />
          ))}

          <div className="text-xs text-text-muted text-right">
            Threshold: {diffReport.diffThreshold}% · Generated: {new Date(diffReport.generatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

function SnapshotResultRow({ result }: { result: PofSnapshotDiffResult }) {
  const color = snapshotStatusColor(result.status);
  const Icon = result.status === 'passed' ? CheckCircle2 : result.status === 'failed' ? XCircle : AlertTriangle;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs"
      style={{ background: `${color}${OPACITY_8}` }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <span className="text-text font-medium truncate flex-1">{result.presetName}</span>
      {result.status === 'failed' && (
        <span className="text-xs font-mono" style={{ color: STATUS_ERROR }}>
          {result.diffPercentage.toFixed(2)}% ({result.diffPixelCount} px)
        </span>
      )}
      {result.status === 'no-baseline' && (
        <span className="text-xs" style={{ color: STATUS_WARNING }}>No baseline</span>
      )}
      {result.status === 'resolution-mismatch' && (
        <span className="text-xs" style={{ color: ACCENT_ORANGE }}>Resolution mismatch</span>
      )}
      {result.status === 'passed' && (
        <span className="text-xs" style={{ color: STATUS_SUCCESS }}>
          {result.maxPixelDiff}px max diff
        </span>
      )}
    </div>
  );
}
