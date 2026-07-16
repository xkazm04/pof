'use client';

import { Settings2 } from 'lucide-react';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import { STATE_TYPE_COLORS } from '../shared/state-machine-shared';
import { StatePropertyEditor } from './StatePropertyEditor';
import { TransitionPropertyEditor } from './TransitionPropertyEditor';
import { TransitionList } from './TransitionList';
import type { StateMachineEditorApi } from './useStateMachineEditor';

export function PropertyPanel({ editor }: { editor: StateMachineEditorApi }) {
  const {
    sortedByPriority,
    selectedStateId, setSelectedStateId,
    setEditingPanel,
    editingPanel,
    selectedState,
    updateState,
    removeState,
    setDrawingTransition,
    transitions,
    stateMap,
    selectedTransition,
    updateTransition,
    removeTransition,
    selectedTransitionId, setSelectedTransitionId,
  } = editor;

  return (
    <div className="space-y-3">
      {/* Priority cascade */}
      <div className="rounded-lg border border-border bg-surface-deep p-3">
        <div className="flex items-center gap-2 mb-2">
          <Settings2 className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs font-bold text-text">Priority Cascade</span>
        </div>
        <p className="text-2xs text-text-muted mb-2">
          ComputeAnimState() checks from top (highest) to bottom.
        </p>
        {sortedByPriority.length === 0 && (
          <div className="text-2xs text-text-muted italic">No states — the cascade is empty</div>
        )}
        <div className="space-y-1">
          {sortedByPriority.map((s) => {
            const color = STATE_TYPE_COLORS[s.stateType];
            const isSelected = selectedStateId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { setSelectedStateId(s.id); setEditingPanel('state'); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-surface-hover/30"
                style={isSelected ? { backgroundColor: `${ACCENT_CYAN}15`, border: `1px solid ${ACCENT_CYAN}30` } : { border: '1px solid transparent' }}
              >
                <span className="text-xs font-mono font-bold w-4 text-center" style={{ color }}>{s.priority}</span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-mono font-medium text-text flex-1 truncate">{s.name}</span>
                <span className="text-[11px] font-mono text-text-muted truncate max-w-[80px]">{s.flag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* State editor */}
      {editingPanel === 'state' && selectedState && (
        <StatePropertyEditor
          state={selectedState}
          onUpdate={(updates) => updateState(selectedState.id, updates)}
          onDelete={() => removeState(selectedState.id)}
          onStartDrawing={() => setDrawingTransition(selectedState.id)}
          transitions={transitions}
          stateMap={stateMap}
        />
      )}

      {/* Transition editor */}
      {editingPanel === 'transition' && selectedTransition && (
        <TransitionPropertyEditor
          transition={selectedTransition}
          stateMap={stateMap}
          onUpdate={(updates) => updateTransition(selectedTransition.id, updates)}
          onDelete={() => removeTransition(selectedTransition.id)}
        />
      )}

      {/* Transition list */}
      <TransitionList
        transitions={transitions}
        stateMap={stateMap}
        selectedId={selectedTransitionId}
        onSelect={(id) => { setSelectedTransitionId(id); setSelectedStateId(null); setEditingPanel('transition'); }}
      />
    </div>
  );
}
