'use client';

import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import type { EditorState, EditorTransition } from './types';

export function TransitionList({
  transitions,
  stateMap,
  selectedId,
  onSelect,
}: {
  transitions: EditorTransition[];
  stateMap: Map<string, EditorState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface-deep p-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between text-xs font-bold text-text"
      >
        <span className="flex items-center gap-2">
          <ArrowRight className="w-3 h-3 text-text-muted" />
          Transitions ({transitions.length})
        </span>
        {collapsed ? <ChevronRight className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
      </button>
      {!collapsed && (
        <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
          {transitions.map((t) => {
            const from = stateMap.get(t.from);
            const to = stateMap.get(t.to);
            const isSelected = selectedId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-left text-2xs transition-colors hover:bg-surface-hover/30"
                style={isSelected ? { backgroundColor: `${ACCENT_CYAN}15`, border: `1px solid ${ACCENT_CYAN}30` } : { border: '1px solid transparent' }}
              >
                <span className="font-mono font-medium text-text truncate">{from?.name ?? '?'}</span>
                <ArrowRight className="w-2.5 h-2.5 text-text-muted flex-shrink-0" />
                <span className="font-mono font-medium text-text truncate">{to?.name ?? '?'}</span>
                {t.rule && (
                  <span className="ml-auto font-mono text-text-muted truncate max-w-[120px]">{t.rule}</span>
                )}
              </button>
            );
          })}
          {transitions.length === 0 && (
            <div className="text-2xs text-text-muted italic px-2 py-1">No transitions defined</div>
          )}
        </div>
      )}
    </div>
  );
}
