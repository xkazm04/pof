'use client';

import type { ReactNode } from 'react';
import { withOpacity, OPACITY_20, OPACITY_25 } from '@/lib/chart-colors';

/** A small labelled form group used across the rule editor. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/** A single toggleable chip (filled in `color` when active). */
export function ChipToggle({ label, active, color, onClick, title }: {
  label: string; active: boolean; color: string; onClick: () => void; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-0.5 rounded-md text-xs font-mono border transition-colors cursor-pointer capitalize ${
        active ? '' : 'text-text-muted border-border/50 hover:text-text hover:border-border/80'
      }`}
      style={active ? { backgroundColor: withOpacity(color, OPACITY_20), color, borderColor: withOpacity(color, OPACITY_25) } : undefined}
    >
      {label}
    </button>
  );
}

/** Multi-select chip group — OR-within one condition axis. */
export function ChipGroup<T extends string>({ options, selected, onToggle, color, colorFor }: {
  options: readonly T[]; selected: readonly string[]; onToggle: (v: T) => void;
  color: string; colorFor?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <ChipToggle key={o} label={o} active={selected.includes(o)} color={colorFor?.(o) ?? color} onClick={() => onToggle(o)} />
      ))}
    </div>
  );
}
