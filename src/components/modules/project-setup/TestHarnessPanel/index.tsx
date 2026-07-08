'use client';

/**
 * TestHarnessPanel — Remote-controlled UE5 test harness.
 *
 * Orchestrates test scenarios (spawn actor, set properties, advance frames,
 * capture screenshots, assert values) via the PoF Bridge, displaying
 * structured pass/fail results with visual diff summaries.
 */

import { FlaskConical, ChevronDown, ChevronRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ErrorBanner } from '../ErrorBanner';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { useTestHarnessPanel } from './useTestHarnessPanel';
import { SuitesTab } from './SuitesTab';
import { ResultsTab } from './ResultsTab';
import { SnapshotsTab } from './SnapshotsTab';

// ── Component ────────────────────────────────────────────────────────────────

export function TestHarnessPanel() {
  const {
    clearResults, diffReport, isCapturing, refreshDiff,
    suites, activeSuiteId, setActiveSuiteId, suiteRunHistory, setSuiteRunHistory, activeSuite,
    expanded, setExpanded, activeTab, setActiveTab,
    editingScenarioIdx, setEditingScenarioIdx,
    jsonEditorOpen, setJsonEditorOpen, jsonDraft, setJsonDraft, isSuiteRunning,
    error, isRunning,
    createSuite, deleteSuite, duplicateSuite, updateSuiteField,
    addScenario, removeScenario, updateScenario,
    openJsonEditor, applyJsonDraft,
    runSuite, abortRun,
  } = useTestHarnessPanel();

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
