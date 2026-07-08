'use client';

import {
  Plus, ArrowRight, Code2, Download, RotateCcw, Diff, Layers,
} from 'lucide-react';
import {
  ACCENT_ORANGE, ACCENT_CYAN,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO,
  OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { EDITOR_ACCENT } from './constants';
import { BlenderNLAExport } from './BlenderNLAExport';
import type { StateMachineEditorApi } from './useStateMachineEditor';

export function EditorToolbar({ editor }: { editor: StateMachineEditorApi }) {
  const {
    takeSnapshot,
    hasChanges,
    showDiffResult,
    addState,
    drawingTransition,
    setDrawingTransition,
    selectedStateId,
    showCode,
    setShowCode,
    handleExport,
    states,
    handleReset,
  } = editor;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${EDITOR_ACCENT}${OPACITY_15}` }}>
          <Layers className="w-4 h-4" style={{ color: EDITOR_ACCENT }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            Visual State Machine Editor
            <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              EDITOR
            </span>
          </h3>
          <p className="text-2xs text-text-muted">
            Drag states, draw transitions, generate C++ code
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Snapshot */}
        <button
          onClick={takeSnapshot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: hasChanges ? `${STATUS_INFO}${OPACITY_15}` : `${EDITOR_ACCENT}${OPACITY_10}`,
            color: hasChanges ? STATUS_INFO : EDITOR_ACCENT,
            border: `1px solid ${hasChanges ? `${STATUS_INFO}${OPACITY_30}` : `${EDITOR_ACCENT}${OPACITY_20}`}`,
          }}
          title="Take snapshot for diff comparison"
        >
          <Diff className="w-3 h-3" />
          {hasChanges ? 'Re-snapshot' : 'Snapshot'}
        </button>

        {/* Show diff */}
        {hasChanges && (
          <button
            onClick={showDiffResult}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: `${STATUS_WARNING}${OPACITY_15}`,
              color: STATUS_WARNING,
              border: `1px solid ${STATUS_WARNING}${OPACITY_30}`,
            }}
          >
            <Diff className="w-3 h-3" />
            Diff
          </button>
        )}

        {/* Add state */}
        <button
          onClick={addState}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}`,
            color: STATUS_SUCCESS,
            border: `1px solid ${STATUS_SUCCESS}${OPACITY_30}`,
          }}
        >
          <Plus className="w-3 h-3" />
          Add State
        </button>

        {/* Draw transition */}
        <button
          onClick={() => setDrawingTransition(drawingTransition ? null : (selectedStateId ?? null))}
          disabled={!selectedStateId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            backgroundColor: drawingTransition ? `${ACCENT_ORANGE}${OPACITY_15}` : `${ACCENT_CYAN}${OPACITY_15}`,
            color: drawingTransition ? ACCENT_ORANGE : ACCENT_CYAN,
            border: `1px solid ${drawingTransition ? `${ACCENT_ORANGE}${OPACITY_30}` : `${ACCENT_CYAN}${OPACITY_20}`}`,
          }}
          title={drawingTransition ? 'Cancel drawing (click target state to connect)' : 'Start drawing transition from selected state'}
        >
          <ArrowRight className="w-3 h-3" />
          {drawingTransition ? 'Drawing...' : 'Draw Arrow'}
        </button>

        {/* Code */}
        <button
          onClick={() => setShowCode(!showCode)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: showCode ? `${EDITOR_ACCENT}${OPACITY_20}` : `${EDITOR_ACCENT}${OPACITY_10}`,
            color: EDITOR_ACCENT,
            border: `1px solid ${EDITOR_ACCENT}${showCode ? OPACITY_30 : OPACITY_20}`,
          }}
        >
          <Code2 className="w-3 h-3" />
          {showCode ? 'Hide Code' : 'View Code'}
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`,
            color: STATUS_SUCCESS,
            border: `1px solid ${STATUS_SUCCESS}${OPACITY_20}`,
          }}
          title="Export full C++ code"
        >
          <Download className="w-3 h-3" />
          Export
        </button>

        {/* Export to Blender NLA */}
        <BlenderNLAExport states={states} />

        {/* Reset */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-text transition-colors border border-border/40"
          title="Reset to default 5-state machine"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
