'use client';

import { useState } from 'react';
import { Diff, Zap, Info, Workflow, Upload } from 'lucide-react';
import {
  ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  OPACITY_30,
} from '@/lib/chart-colors';
import { useStateMachineEditor } from './useStateMachineEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorCanvas } from './EditorCanvas';
import { PropertyPanel } from './PropertyPanel';
import { WarningsPanel } from './WarningsPanel';
import { CodeOutputPanel } from './CodeOutputPanel';
import type { EditorSeed } from './seed';
import type { ApplyPlan } from './applyPlan';

export type { EditorState, EditorTransition } from './types';
export type { EditorSeed } from './seed';

export interface StateMachineEditorProps {
  /** Real states/transitions to open on (AnimBP scan or live bridge). */
  seed?: EditorSeed | null;
  /** Session draft key — unsaved canvas edits survive an LRU eviction. */
  draftKey?: string;
  /**
   * Write a confirmed ready plan to the project (the host's CLI rail). Call
   * `markApplied` when that run succeeds — the next re-scan then rebases.
   */
  onApply?: (plan: ApplyPlan, markApplied: () => void) => void;
  /** An apply CLI run is in flight. */
  applyRunning?: boolean;
}
export { generateFullCppOutput } from './codegen';

// ── Component ──

export function StateMachineEditor({ seed = null, draftKey, onApply, applyRunning = false }: StateMachineEditorProps = {}) {
  const editor = useStateMachineEditor({ seed, draftKey });
  const [confirmingApply, setConfirmingApply] = useState(false);
  const {
    seedSource, seedOrigin, draftRestored,
    drawingTransition,
    stateMap,
    showDiff, diff, setShowDiff, diffTotal,
    warnings, errorCount, warnCount, infoCount,
    showWarnings, setShowWarnings, focusWarning,
    showCode, generatedCode, codeTab, setCodeTab,
    handleExport,
    applyPlan, markApplied, lastApplyOutcome,
  } = editor;

  // Snapshot-diff transitions already carry resolved "From -> To" labels
  // (computeDiff resolves names from both snapshots — see DiffResult).
  const transitionNames = (labels: string[]) => labels.join(', ');
  const confirmReady = confirmingApply && applyPlan.status === 'ready';
  const showChanges = seedSource !== 'template' && (applyPlan.changes.length > 0 || lastApplyOutcome !== null);
  const confirmApply = () => {
    setConfirmingApply(false);
    onApply?.(applyPlan, markApplied);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Provenance: whose state machine is on the canvas ── */}
      <div
        data-testid="pof-anim-sm-editor-provenance"
        data-source={seedSource}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{
          backgroundColor: `${seedSource === 'template' ? STATUS_WARNING : STATUS_SUCCESS}08`,
          border: `1px solid ${seedSource === 'template' ? STATUS_WARNING : STATUS_SUCCESS}${OPACITY_30}`,
          color: seedSource === 'template' ? STATUS_WARNING : STATUS_SUCCESS,
        }}
      >
        {seedSource === 'template' ? (
          <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
        ) : (
          <Workflow className="w-3.5 h-3.5 shrink-0" aria-hidden />
        )}
        <span>
          {seedSource === 'template'
            ? 'These states are a starting template, not your project’s — scan an AnimBP (or connect the UE bridge) to edit the real machine.'
            : `Seeded from ${seedSource === 'scan' ? 'the AnimBP scan of' : ''} ${seedOrigin ?? 'your project'} — edits below are yours, not the project’s until you apply them.`}
          {draftRestored && ' Unsaved edits from this session were restored.'}
        </span>
      </div>

      {/* ── Header bar ── */}
      <EditorToolbar
        editor={editor}
        onRequestApply={onApply ? () => setConfirmingApply(true) : undefined}
        applyRunning={applyRunning}
      />

      {/* ── Changes vs the seed: the disclosure an apply is confirmed against ── */}
      {(showChanges || confirmReady) && (
        <div data-testid="pof-anim-sm-editor-changes" className="rounded-lg border border-border bg-surface-deep px-3 py-2.5 space-y-1.5">
          <div className="text-xs font-bold text-text flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} />
            Changes vs {applyPlan.origin ?? 'the project'}
            <span className="text-text-muted font-normal">({applyPlan.changes.length})</span>
          </div>
          {lastApplyOutcome === 'residual' && applyPlan.changes.length > 0 && (
            <div className="text-2xs" style={{ color: STATUS_WARNING }}>
              The re-scan after the apply still differs from the canvas, so your draft is kept and these changes remain. (The scan derives priorities from enum order and flags from state names, and cannot see the Default marker.)
            </div>
          )}
          {lastApplyOutcome === 'converged' && applyPlan.changes.length === 0 && (
            <div className="text-2xs" style={{ color: STATUS_SUCCESS }}>Applied — the re-scan matches the canvas.</div>
          )}
          {applyPlan.changes.map((c, i) => (
            <div key={`${c.kind}-${i}`} className="text-2xs text-text-muted" data-kind={c.kind}>{c.label}</div>
          ))}
          {applyPlan.status === 'blocked' && applyPlan.reasons.map((r) => (
            <div key={r} className="text-2xs" style={{ color: STATUS_ERROR }}>{r}</div>
          ))}
          {confirmReady && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={confirmApply}
                data-testid="pof-anim-sm-editor-apply-confirm"
                className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_30}`, color: STATUS_WARNING }}
              >
                Write {applyPlan.changes.length} change{applyPlan.changes.length === 1 ? '' : 's'} to {applyPlan.target?.className}
              </button>
              <button onClick={() => setConfirmingApply(false)} className="text-2xs text-text-muted hover:text-text">Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* ── Drawing mode indicator ── */}
      {drawingTransition && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: `${ACCENT_ORANGE}08`, border: `1px solid ${ACCENT_ORANGE}${OPACITY_30}`, color: ACCENT_ORANGE }}>
          <Zap className="w-3.5 h-3.5" />
          Drawing transition from <strong>{stateMap.get(drawingTransition)?.name ?? '?'}</strong> — click a target state to connect, or click &quot;Drawing...&quot; to cancel
        </div>
      )}

      {/* ── Diff display ── */}
      {showDiff && diff && (
        <div className="rounded-lg border border-border bg-surface-deep px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text flex items-center gap-2">
              <Diff className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} />
              Diff since snapshot
              {diffTotal === 0 && <span className="text-text-muted font-normal">(no changes)</span>}
            </span>
            <button onClick={() => setShowDiff(false)} className="text-2xs text-text-muted hover:text-text">&times;</button>
          </div>
          {diff.newStates.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_SUCCESS }}>+ States:</span> <span className="text-text-muted">{diff.newStates.join(', ')}</span></div>
          )}
          {diff.removedStates.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_ERROR }}>- States:</span> <span className="text-text-muted">{diff.removedStates.join(', ')}</span></div>
          )}
          {diff.modifiedStates.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_WARNING }}>~ States:</span> <span className="text-text-muted">{diff.modifiedStates.join(', ')}</span></div>
          )}
          {diff.newTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_SUCCESS }}>+ Transitions:</span> <span className="text-text-muted">{transitionNames(diff.newTransitions)}</span></div>
          )}
          {diff.removedTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_ERROR }}>- Transitions:</span> <span className="text-text-muted">{transitionNames(diff.removedTransitions)}</span></div>
          )}
          {diff.modifiedTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_WARNING }}>~ Transitions:</span> <span className="text-text-muted">{transitionNames(diff.modifiedTransitions)}</span></div>
          )}
        </div>
      )}

      {/* ── Linter warnings ── */}
      {warnings.length > 0 && (
        <WarningsPanel
          warnings={warnings}
          errorCount={errorCount}
          warnCount={warnCount}
          infoCount={infoCount}
          collapsed={!showWarnings}
          onToggle={() => setShowWarnings(!showWarnings)}
          onFocus={focusWarning}
        />
      )}

      {/* ── Main grid: Canvas + Property Panel ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        {/* ── Canvas ── */}
        <EditorCanvas editor={editor} />

        {/* ── Property Panel ── */}
        <PropertyPanel editor={editor} />
      </div>

      {/* ── Code Output ── */}
      {showCode && (
        <CodeOutputPanel
          code={generatedCode}
          codeTab={codeTab}
          onTabChange={setCodeTab}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
