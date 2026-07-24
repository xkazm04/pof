'use client';

import { useMemo, useState } from 'react';
import {
  FlaskConical, Play, Plus, Trash2, Copy, Loader2, FileJson,
} from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_EMERALD, ACCENT_VIOLET,
  OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { PofTestSpec } from '@/types/pof-bridge';
import type { TestSuite } from './types';
import { ScenarioCard } from './ScenarioCard';

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

export function SuitesTab({
  suites, activeSuiteId, activeSuite, isRunning,
  editingScenarioIdx, jsonEditorOpen, jsonDraft,
  onSelectSuite, onCreateSuite, onDeleteSuite, onDuplicateSuite,
  onUpdateField, onAddScenario, onRemoveScenario, onUpdateScenario,
  onSetEditingIdx, onOpenJsonEditor, onSetJsonDraft, onApplyJsonDraft,
  onCloseJsonEditor, onRunSuite, onAbort,
}: SuitesTabProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDelete = suites.find((s) => s.id === pendingDeleteId) ?? null;

  /**
   * The JSON draft is validated here so an unparseable edit reports *why* it
   * cannot be applied — `applyJsonDraft` otherwise swallows the parse error and
   * the Apply button appears to do nothing.
   */
  const jsonValidation = useMemo<
    { status: 'valid'; count: number } | { status: 'error'; message: string }
  >(() => {
    try {
      const parsed = JSON.parse(jsonDraft);
      if (!Array.isArray(parsed)) {
        return { status: 'error', message: 'Scenarios must be a JSON array, e.g. [ { … } ]' };
      }
      return { status: 'valid', count: parsed.length };
    } catch (e) {
      return { status: 'error', message: e instanceof SyntaxError ? e.message : 'Invalid JSON' };
    }
  }, [jsonDraft]);

  return (
    <div className="space-y-3">
      {/* Suite list + create */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {suites.map((s) => (
            <button
              key={s.id}
              aria-pressed={s.id === activeSuiteId}
              title={`${s.name} — ${s.scenarios.length} scenario${s.scenarios.length !== 1 ? 's' : ''}`}
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
              aria-label="Suite name"
              placeholder="Suite name"
              value={activeSuite.name}
              onChange={(e) => onUpdateField(activeSuite.id, 'name', e.target.value)}
            />
            <button
              className="p-1 rounded hover:bg-surface-2 text-text-muted"
              title="Duplicate suite"
              aria-label="Duplicate suite"
              onClick={() => onDuplicateSuite(activeSuite.id)}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-surface-2 text-text-muted"
              title="Edit scenarios as JSON"
              aria-label="Edit scenarios as JSON"
              onClick={onOpenJsonEditor}
            >
              <FileJson className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-surface-2"
              style={{ color: STATUS_ERROR }}
              title="Delete suite"
              aria-label="Delete suite"
              onClick={() => setPendingDeleteId(activeSuite.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Suite description */}
          <input
            className="w-full bg-transparent text-xs text-text-muted border-b border-border/50 focus:border-text-muted outline-none px-1 py-0.5"
            aria-label="Suite description"
            placeholder="Suite description..."
            value={activeSuite.description}
            onChange={(e) => onUpdateField(activeSuite.id, 'description', e.target.value)}
          />

          {/* JSON editor overlay */}
          {jsonEditorOpen && (
            <div className="rounded border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border">
                <label htmlFor="test-harness-json-draft" className="text-xs font-medium text-text-muted">
                  Edit Scenarios (JSON)
                </label>
                <div className="flex gap-1">
                  <button
                    className="px-2 py-0.5 rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: `${ACCENT_EMERALD}${OPACITY_15}`, color: ACCENT_EMERALD }}
                    disabled={jsonValidation.status === 'error'}
                    title={
                      jsonValidation.status === 'error'
                        ? 'Fix the JSON below before applying'
                        : 'Replace this suite’s scenarios with the JSON below'
                    }
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
                id="test-harness-json-draft"
                className="w-full h-48 bg-surface-1 text-xs text-text font-mono p-3 resize-y outline-none"
                value={jsonDraft}
                onChange={(e) => onSetJsonDraft(e.target.value)}
                aria-invalid={jsonValidation.status === 'error'}
                aria-describedby="test-harness-json-status"
                spellCheck={false}
              />
              <p
                id="test-harness-json-status"
                role="status"
                className="px-3 py-1.5 text-xs border-t border-border bg-surface-2 leading-snug"
                style={{ color: jsonValidation.status === 'error' ? STATUS_ERROR : ACCENT_EMERALD }}
              >
                {jsonValidation.status === 'error'
                  ? jsonValidation.message
                  : `Valid — ${jsonValidation.count} scenario${jsonValidation.count !== 1 ? 's' : ''} ready to apply`}
              </p>
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
              title={
                activeSuite.scenarios.length === 0
                  ? 'Add at least one scenario before running this suite'
                  : undefined
              }
              onClick={isRunning ? onAbort : onRunSuite}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Running… — click to abort
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" /> Run Suite ({activeSuite.scenarios.length} test{activeSuite.scenarios.length !== 1 ? 's' : ''})
                </>
              )}
            </button>
            {activeSuite.scenarios.length === 0 && (
              <span className="text-xs text-text-muted">
                Add at least one scenario to run this suite.
              </span>
            )}
          </div>
        </div>
      )}

      {/* No suite selected (e.g. right after deleting the active one) */}
      {suites.length > 0 && !activeSuite && (
        <p className="text-center py-6 text-xs text-text-muted">
          Select a suite above to edit and run it.
        </p>
      )}

      {/* Empty state */}
      {suites.length === 0 && (
        <div className="text-center py-8 text-xs text-text-muted">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
          <p>No test suites yet. Create one to define test scenarios.</p>
          <p className="mt-1 opacity-60">
            Test suites contain spawnable actors, actions, and assertions
            that run in the UE5 editor via the PoF Bridge.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => { if (pendingDeleteId) onDeleteSuite(pendingDeleteId); }}
        title="Delete this test suite?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” and its ${pendingDelete.scenarios.length} scenario${pendingDelete.scenarios.length !== 1 ? 's' : ''} will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete suite"
      />
    </div>
  );
}
