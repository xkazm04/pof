'use client';

import { AlertTriangle, AlertCircle, Info, Layers, Plus } from 'lucide-react';
import {
  ACCENT_ORANGE, ACCENT_CYAN,
  STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING,
  MODULE_COLORS,
  OPACITY_15, OPACITY_30,
} from '@/lib/chart-colors';
import { computeEdgeGeometry } from '@/components/ui/svg/graph-edges';
import { SchematicPanel } from '@/components/ui/SchematicPanel';
import { highestSeverity } from '@/lib/state-machine-validator';
import { STATE_TYPE_COLORS } from '../shared/state-machine-shared';
import { EDITOR_ACCENT, NODE_W, NODE_H } from './constants';
import { severityColor } from './helpers';
import type { StateMachineEditorApi } from './useStateMachineEditor';

export function EditorCanvas({ editor }: { editor: StateMachineEditorApi }) {
  const {
    canvasRef,
    draggingStateId, setDraggingStateId,
    drawingTransition, setDrawingTransition,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    setSelectedStateId,
    setSelectedTransitionId,
    setEditingPanel,
    transitions,
    stateMap,
    selectedTransitionId,
    edgeKeySet,
    states,
    selectedStateId,
    warningsByState,
    handleStateClick,
    addState,
  } = editor;

  return (
    <SchematicPanel
      ref={canvasRef}
      tone="well"
      accent={EDITOR_ACCENT}
      className="select-none"
      style={{ height: 400, cursor: draggingStateId ? 'grabbing' : drawingTransition ? 'crosshair' : 'default' }}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onClick={(e) => {
        // Clicking empty space deselects
        if (e.target === canvasRef.current) {
          setSelectedStateId(null);
          setSelectedTransitionId(null);
          setEditingPanel(null);
          if (drawingTransition) setDrawingTransition(null);
        }
      }}
    >
      {/* SVG for transitions */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <marker id="sme-arrow" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 8 3 L 0 6 z" fill={`${EDITOR_ACCENT}60`} />
          </marker>
          <marker id="sme-arrow-sel" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 8 3 L 0 6 z" fill={ACCENT_CYAN} />
          </marker>
        </defs>

        {transitions.map((t) => {
          const from = stateMap.get(t.from);
          const to = stateMap.get(t.to);
          if (!from || !to) return null;

          const isSelected = selectedTransitionId === t.id;

          // Offset for bidirectional edges
          const reverseExists = edgeKeySet.has(`${t.to}->${t.from}`);
          const isForward = t.from < t.to;

          const geom = computeEdgeGeometry(from, to, { reverseExists, isForward });
          if (!geom) return null;
          const { x1, y1, x2, y2, midX, midY } = geom;

          const strokeColor = isSelected ? ACCENT_CYAN : `${EDITOR_ACCENT}40`;
          const strokeWidth = isSelected ? 2.5 : 1.5;

          return (
            <g key={t.id}>
              {/* Hit area */}
              <line
                x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                stroke="transparent" strokeWidth={15}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTransitionId(t.id);
                  setSelectedStateId(null);
                  setEditingPanel('transition');
                }}
              />
              {/* Glow */}
              {isSelected && (
                <line
                  x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                  stroke={ACCENT_CYAN} strokeWidth={strokeWidth * 3} opacity="0.2" style={{ filter: 'blur(3px)' }}
                />
              )}
              <line
                x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                stroke={strokeColor} strokeWidth={strokeWidth}
                markerEnd={isSelected ? 'url(#sme-arrow-sel)' : 'url(#sme-arrow)'}
              />
              {/* Rule label on line */}
              {t.rule && (
                <text
                  x={`${midX}%`} y={`${midY - 1.5}%`}
                  fill={isSelected ? ACCENT_CYAN : `${EDITOR_ACCENT}80`}
                  fontSize="8" fontFamily="monospace" textAnchor="middle" dominantBaseline="auto"
                  style={{ pointerEvents: 'none' }}
                >
                  {t.rule.length > 30 ? t.rule.slice(0, 28) + '...' : t.rule}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* State nodes */}
      {states.map((state) => {
        const isSelected = selectedStateId === state.id;
        const isDrawSource = drawingTransition === state.id;
        const color = STATE_TYPE_COLORS[state.stateType];
        const nodeWarnings = warningsByState.get(state.id) ?? [];
        const nodeSeverity = highestSeverity(nodeWarnings);

        let borderColor = `${color}40`;
        let bgColor = `${color}0A`;
        let shadow = 'none';

        if (isSelected) {
          borderColor = `${ACCENT_CYAN}80`;
          bgColor = `${ACCENT_CYAN}20`;
          shadow = `0 0 20px ${ACCENT_CYAN}40, inset 0 0 15px ${ACCENT_CYAN}20`;
        } else if (isDrawSource) {
          borderColor = `${ACCENT_ORANGE}80`;
          bgColor = `${ACCENT_ORANGE}20`;
          shadow = `0 0 15px ${ACCENT_ORANGE}40`;
        } else if (nodeSeverity === 'error') {
          borderColor = `${STATUS_ERROR}80`;
          shadow = `0 0 12px ${STATUS_ERROR}40`;
        } else if (nodeSeverity === 'warning') {
          borderColor = `${STATUS_WARNING}70`;
        }

        return (
          <div
            key={state.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`State ${state.name}, priority ${state.priority}${nodeSeverity ? `, ${nodeSeverity}` : ''}${isSelected ? ', selected' : ''}`}
            className="absolute rounded-xl border transition-all duration-150 group focus-ring"
            style={{
              left: `${state.x}%`,
              top: `${state.y}%`,
              transform: 'translate(-50%, -50%)',
              width: NODE_W,
              height: NODE_H,
              zIndex: isSelected ? 10 : 1,
              borderColor,
              backgroundColor: bgColor,
              boxShadow: shadow,
              cursor: draggingStateId === state.id ? 'grabbing' : drawingTransition ? 'crosshair' : 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleStateClick(state.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleStateClick(state.id);
              }
            }}
            onMouseDown={(e) => {
              // Only start drag on left button and not drawing
              if (e.button === 0 && !drawingTransition) {
                e.preventDefault();
                setDraggingStateId(state.id);
              }
            }}
          >
            {/* Type color strip */}
            <div className="absolute left-0 top-1 bottom-1 w-[4px] rounded-full" style={{ backgroundColor: color }} />

            {/* Priority badge */}
            <div
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border"
              style={{
                backgroundColor: `${color}20`,
                borderColor: `${color}50`,
                color,
              }}
              title={`Priority ${state.priority} (lower = higher priority)`}
            >
              {state.priority}
            </div>

            {/* Lint warning badge */}
            {nodeSeverity && (
              <div
                className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center border"
                style={{
                  backgroundColor: `${severityColor(nodeSeverity)}25`,
                  borderColor: `${severityColor(nodeSeverity)}80`,
                  color: severityColor(nodeSeverity),
                }}
                title={nodeWarnings.map((w) => `[${w.severity}] ${w.message}`).join('\n')}
              >
                {nodeSeverity === 'error' ? (
                  <AlertCircle className="w-3 h-3" />
                ) : nodeSeverity === 'warning' ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <Info className="w-3 h-3" />
                )}
              </div>
            )}

            <div className="flex flex-col items-start justify-center h-full px-3 pl-4 overflow-hidden">
              <span className="text-[11px] font-bold font-mono text-text truncate w-full">{state.name}</span>
              <span className="text-[11px] font-mono text-text-muted truncate w-full">{state.flag}</span>
              {state.montageRef && (
                <span className="text-[11px] font-mono truncate w-full" style={{ color: MODULE_COLORS.content }}>{state.montageRef}</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty state — all states deleted */}
      {states.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ zIndex: 2 }}>
          <div
            className="p-3 rounded-xl border"
            style={{
              backgroundColor: `${EDITOR_ACCENT}${OPACITY_15}`,
              borderColor: `${EDITOR_ACCENT}${OPACITY_30}`,
            }}
          >
            <Layers className="w-5 h-5" style={{ color: EDITOR_ACCENT }} />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs font-bold text-text">No states defined</span>
            <span className="text-2xs text-text-muted max-w-[260px]">
              Add a state to begin building the machine. Code generation and export are paused until at least one state exists.
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); addState(); }}
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
        </div>
      )}

      {/* Entry indicator */}
      {states.length > 0 && (() => {
        const defaultState = states.find((s) => s.isDefault) ?? states[0];
        return (
          <div
            className="absolute flex items-center gap-0.5"
            style={{ left: `${defaultState.x - 9}%`, top: `${defaultState.y}%`, transform: 'translate(-100%, -50%)', zIndex: 2 }}
          >
            <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">Entry</span>
            <svg width="16" height="8" viewBox="0 0 16 8">
              <line x1="0" y1="4" x2="12" y2="4" stroke={`${EDITOR_ACCENT}50`} strokeWidth="1" />
              <path d="M 10 1 L 14 4 L 10 7" stroke={`${EDITOR_ACCENT}50`} strokeWidth="1" fill="none" />
            </svg>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex items-center gap-2.5 text-2xs text-text-muted" style={{ zIndex: 2 }}>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: MODULE_COLORS.core }} />locomotion</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: MODULE_COLORS.evaluator }} />combat</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: ACCENT_ORANGE }} />reaction</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: EDITOR_ACCENT }} />other</span>
      </div>

      {/* Instruction hint (only meaningful when there are states to interact with) */}
      {states.length > 0 && (
        <div className="absolute top-2 left-2 text-[11px] text-text-muted/50 font-mono" style={{ zIndex: 2 }}>
          Drag to move · Click to select · Use toolbar for transitions
        </div>
      )}
    </SchematicPanel>
  );
}
