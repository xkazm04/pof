'use client';

import { Trash2, GripVertical, ArrowRight } from 'lucide-react';
import {
  ACCENT_CYAN, STATUS_SUCCESS, STATUS_INFO, OPACITY_10,
} from '@/lib/chart-colors';
import { STATE_TYPE_COLORS } from '../shared/state-machine-shared';
import type { EditorState, EditorTransition } from './types';
import { STATE_TYPE_OPTIONS, KNOWN_FLAGS } from './constants';

export function StatePropertyEditor({
  state,
  onUpdate,
  onDelete,
  onStartDrawing,
  transitions,
  stateMap,
}: {
  state: EditorState;
  onUpdate: (updates: Partial<EditorState>) => void;
  onDelete: () => void;
  onStartDrawing: () => void;
  transitions: EditorTransition[];
  stateMap: Map<string, EditorState>;
}) {
  const outgoing = transitions.filter((t) => t.from === state.id);
  const incoming = transitions.filter((t) => t.to === state.id);

  return (
    <div className="rounded-lg border border-border bg-surface-deep p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-text-muted" />
          Edit State
        </span>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors" title="Delete state">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Name</label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text focus-ring-inset transition-colors"
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Type</label>
        <div className="flex gap-1">
          {STATE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ stateType: opt.value })}
              className="flex-1 px-2 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: state.stateType === opt.value ? `${STATE_TYPE_COLORS[opt.value]}20` : 'transparent',
                color: state.stateType === opt.value ? STATE_TYPE_COLORS[opt.value] : 'var(--text-muted)',
                border: `1px solid ${state.stateType === opt.value ? `${STATE_TYPE_COLORS[opt.value]}50` : 'var(--border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Priority (0 = highest)</label>
        <input
          type="number"
          min={0}
          value={state.priority}
          onChange={(e) => onUpdate({ priority: parseInt(e.target.value, 10) || 0 })}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text focus-ring-inset transition-colors"
        />
      </div>

      {/* Flag */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Flag / Condition</label>
        <input
          type="text"
          value={state.flag}
          onChange={(e) => onUpdate({ flag: e.target.value })}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text focus-ring-inset transition-colors"
          list="known-flags"
        />
        <datalist id="known-flags">
          {KNOWN_FLAGS.map((f) => <option key={f} value={f} />)}
        </datalist>
        <div className="mt-1 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-2xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={state.isDefault ?? false}
              onChange={(e) => onUpdate({ isDefault: e.target.checked })}
              className="rounded border-border"
            />
            Default / fallback state
          </label>
        </div>
      </div>

      {/* Montage ref */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Montage Reference</label>
        <input
          type="text"
          value={state.montageRef ?? ''}
          onChange={(e) => onUpdate({ montageRef: e.target.value || undefined })}
          placeholder="e.g., AM_Dodge"
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text placeholder-text-muted focus-ring-inset transition-colors"
        />
      </div>

      {/* Connections summary */}
      <div className="pt-2 border-t border-border/40">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Connections</span>
          <button
            onClick={onStartDrawing}
            className="text-2xs font-medium px-2 py-0.5 rounded transition-colors"
            style={{ color: ACCENT_CYAN, backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}
          >
            + Draw arrow
          </button>
        </div>
        {outgoing.length > 0 && (
          <div className="text-2xs text-text-muted space-y-0.5">
            {outgoing.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <ArrowRight className="w-2.5 h-2.5" style={{ color: STATUS_SUCCESS }} />
                <span className="font-mono">{stateMap.get(t.to)?.name ?? '?'}</span>
              </div>
            ))}
          </div>
        )}
        {incoming.length > 0 && (
          <div className="text-2xs text-text-muted space-y-0.5 mt-1">
            {incoming.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <ArrowRight className="w-2.5 h-2.5 rotate-180" style={{ color: STATUS_INFO }} />
                <span className="font-mono">{stateMap.get(t.from)?.name ?? '?'}</span>
              </div>
            ))}
          </div>
        )}
        {outgoing.length === 0 && incoming.length === 0 && (
          <div className="text-2xs text-text-muted italic">No connections</div>
        )}
      </div>
    </div>
  );
}
