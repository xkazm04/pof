'use client';

/**
 * TestHarnessPanel — Remote-controlled UE5 test harness.
 *
 * Orchestrates test scenarios (spawn actor, set properties, advance frames,
 * capture screenshots, assert values) via the PoF Bridge, displaying
 * structured pass/fail results with visual diff summaries.
 */

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { FlaskConical, ChevronDown, ChevronRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ErrorBanner } from '../ErrorBanner';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { useTestHarnessPanel } from './useTestHarnessPanel';
import { SuitesTab } from './SuitesTab';
import { ResultsTab } from './ResultsTab';
import { SnapshotsTab } from './SnapshotsTab';
import { WaitingTestsTab } from './WaitingTestsTab';
import type { HarnessTab } from './types';

const tabId = (id: HarnessTab) => `harness-tab-${id}`;
const panelId = (id: HarnessTab) => `harness-panel-${id}`;

/** One tabpanel per tab; only the selected one carries content. */
function HarnessPanel({ id, active, children }: { id: HarnessTab; active: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(id)} aria-labelledby={tabId(id)} hidden={!active} className="space-y-3">
      {active ? children : null}
    </div>
  );
}

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
    snapshotPresets, setSnapshotPresets, captureSnapshots, acceptBaselines,
  } = useTestHarnessPanel();

  const tabs: { id: HarnessTab; label: string; count?: number }[] = [
    { id: 'waiting', label: 'Waiting tests' },
    { id: 'suites', label: 'Test Suites', count: suites.length },
    { id: 'results', label: 'Results', count: suiteRunHistory.length },
    { id: 'snapshots', label: 'Snapshots' },
  ];

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActiveTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <SurfaceCard className="mt-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <button
        className="flex items-center gap-2 w-full text-left px-4 py-3"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
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
          <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Test Harness sections">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                id={tabId(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={panelId(tab.id)}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onKeyDown={(e) => onTabKeyDown(e, i)}
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

          {/* ── Waiting tests Tab (default) ──────────────────────────── */}
          <HarnessPanel id="waiting" active={activeTab === 'waiting'}><WaitingTestsTab /></HarnessPanel>

          {/* ── Suites Tab ───────────────────────────────────────────── */}
          <HarnessPanel id="suites" active={activeTab === 'suites'}>
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
          </HarnessPanel>

          {/* ── Results Tab ──────────────────────────────────────────── */}
          <HarnessPanel id="results" active={activeTab === 'results'}>
            <ResultsTab
              history={suiteRunHistory}
              isRunning={isSuiteRunning}
              onClear={() => { setSuiteRunHistory([]); clearResults(); }}
            />
          </HarnessPanel>

          {/* ── Snapshots Tab ────────────────────────────────────────── */}
          <HarnessPanel id="snapshots" active={activeTab === 'snapshots'}>
            <SnapshotsTab
              key={activeSuiteId ?? 'no-suite'}
              diffReport={diffReport}
              isCapturing={isCapturing}
              presets={snapshotPresets}
              suiteName={activeSuite?.name ?? null}
              onPresetsChange={setSnapshotPresets}
              onCapture={captureSnapshots}
              onAccept={acceptBaselines}
              onRefresh={refreshDiff}
            />
          </HarnessPanel>
        </div>
      )}
    </SurfaceCard>
  );
}
