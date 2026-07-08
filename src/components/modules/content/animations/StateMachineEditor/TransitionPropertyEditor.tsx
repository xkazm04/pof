'use client';

import { Trash2, ArrowRight } from 'lucide-react';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import type { EditorState, EditorTransition } from './types';
import { EDITOR_ACCENT, KNOWN_RULE_TEMPLATES } from './constants';

export function TransitionPropertyEditor({
  transition,
  stateMap,
  onUpdate,
  onDelete,
}: {
  transition: EditorTransition;
  stateMap: Map<string, EditorState>;
  onUpdate: (updates: Partial<EditorTransition>) => void;
  onDelete: () => void;
}) {
  const fromName = stateMap.get(transition.from)?.name ?? '?';
  const toName = stateMap.get(transition.to)?.name ?? '?';

  return (
    <div className="rounded-lg border border-border bg-surface-deep p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text flex items-center gap-2">
          <ArrowRight className="w-3 h-3" style={{ color: ACCENT_CYAN }} />
          Edit Transition
        </span>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* From / To display */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="px-2 py-1 rounded" style={{ backgroundColor: `${EDITOR_ACCENT}15`, color: EDITOR_ACCENT }}>{fromName}</span>
        <ArrowRight className="w-3 h-3 text-text-muted" />
        <span className="px-2 py-1 rounded bg-surface-hover text-text">{toName}</span>
      </div>

      {/* Rule */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Transition Rule</label>
        <input
          type="text"
          value={transition.rule}
          onChange={(e) => onUpdate({ rule: e.target.value })}
          placeholder="e.g., bIsAttacking == true"
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text placeholder-text-muted focus-ring-inset transition-colors"
        />
        {/* Quick templates */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {KNOWN_RULE_TEMPLATES.slice(0, 5).map((tmpl) => (
            <button
              key={tmpl}
              onClick={() => onUpdate({ rule: tmpl })}
              className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-border/40 text-text-muted hover:text-text hover:bg-surface-hover transition-colors truncate max-w-[140px]"
              title={tmpl}
            >
              {tmpl.length > 20 ? tmpl.slice(0, 18) + '...' : tmpl}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Description (optional)</label>
        <input
          type="text"
          value={transition.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value || undefined })}
          placeholder="e.g., Dodge cancels attack recovery"
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text placeholder-text-muted focus-ring-inset transition-colors"
        />
      </div>
    </div>
  );
}
