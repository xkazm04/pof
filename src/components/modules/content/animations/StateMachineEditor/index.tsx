'use client';

import { Diff, Zap } from 'lucide-react';
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

export type { EditorState, EditorTransition } from './types';
export { generateFullCppOutput } from './codegen';

// ── Component ──

export function StateMachineEditor() {
  const editor = useStateMachineEditor();
  const {
    drawingTransition,
    stateMap,
    showDiff, diff, setShowDiff, diffTotal,
    warnings, errorCount, warnCount, infoCount,
    showWarnings, setShowWarnings, focusWarning,
    showCode, generatedCode, codeTab, setCodeTab,
    handleExport,
  } = editor;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header bar ── */}
      <EditorToolbar editor={editor} />

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
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_SUCCESS }}>+ Transitions:</span> <span className="text-text-muted">{diff.newTransitions.length} added</span></div>
          )}
          {diff.removedTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_ERROR }}>- Transitions:</span> <span className="text-text-muted">{diff.removedTransitions.length} removed</span></div>
          )}
          {diff.modifiedTransitions.length > 0 && (
            <div className="text-2xs"><span className="font-bold" style={{ color: STATUS_WARNING }}>~ Transitions:</span> <span className="text-text-muted">{diff.modifiedTransitions.length} changed</span></div>
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
