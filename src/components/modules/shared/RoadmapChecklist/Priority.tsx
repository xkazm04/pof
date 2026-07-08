'use client';

import { useRef } from 'react';
import { Check, Flag } from 'lucide-react';
import { PRIORITY_CONFIG, PRIORITY_OPTIONS } from './constants';
import type { Priority } from './types';

// ── Priority badge ───────────────────────────────────────────────────────────

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  if (priority === 'none') return null;
  return (
    <span
      className="text-2xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.label}
    </span>
  );
}

// ── Priority dropdown ────────────────────────────────────────────────────────

export function PriorityDropdown({ itemId, priority, isOpen, onToggle, onSelect }: {
  itemId: string;
  priority: Priority;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (p: Priority) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const config = PRIORITY_CONFIG[priority];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className={`p-1.5 rounded-md transition-colors ${
          priority !== 'none'
            ? ''
            : 'text-text-muted hover:text-text hover:bg-surface-hover'
        }`}
        style={priority !== 'none' ? { color: config.color } : undefined}
        title="Set priority"
      >
        <Flag className="w-3 h-3" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {PRIORITY_OPTIONS.map((p) => {
            const pc = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => onSelect(p)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-surface-hover ${
                  priority === p ? 'bg-surface-hover' : ''
                }`}
              >
                {p !== 'none' && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pc.color }} />
                )}
                {p === 'none' && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-border" />}
                <span className="text-text">{pc.label}</span>
                {priority === p && <Check className="w-3 h-3 text-text-muted ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
