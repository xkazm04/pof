'use client';

import { Activity, FileText, LayoutDashboard } from 'lucide-react';
import type { ViewMode } from './types';

// ─── View-mode toggle ────────────────────────────────────────────────────────

export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Summary view mode"
      className="inline-flex items-center gap-1 rounded-lg p-0.5 bg-surface border border-border"
    >
      <ModeButton
        active={mode === 'detailed'}
        onClick={() => onChange('detailed')}
        icon={LayoutDashboard}
        label="Detailed"
        title="Engineer view — scores, dimensions, source pills"
      />
      <ModeButton
        active={mode === 'brief'}
        onClick={() => onChange('brief')}
        icon={FileText}
        label="Brief"
        title="Stakeholder view — plain-English summary of project health"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Activity;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={title}
      className={
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ' +
        (active
          ? 'bg-border text-text'
          : 'text-text-muted hover:text-text hover:bg-border/60')
      }
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
