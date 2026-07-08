'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';

// ── Layout primitives ────────────────────────────────────────────────────────

export function Section({
  title,
  icon,
  rightContent,
  open: openProp,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(true);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const toggle = controlled ? onToggle : () => setInternalOpen((v) => !v);

  return (
    <section className="rounded border border-border bg-surface/60">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={12} className="text-text-muted" />
        ) : (
          <ChevronRight size={12} className="text-text-muted" />
        )}
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text flex-1">
          {title}
        </span>
        {rightContent}
      </button>
      {open && <div className="px-2 pb-2 pt-1 space-y-1">{children}</div>}
    </section>
  );
}

export function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-text-muted">{label}</span>
      <span
        className="font-mono"
        style={highlight ? { color: STATUS_ERROR } : { color: STATUS_INFO }}
      >
        {value}
      </span>
    </div>
  );
}
