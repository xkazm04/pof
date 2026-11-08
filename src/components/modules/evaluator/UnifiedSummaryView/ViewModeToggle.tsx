'use client';

import { Activity, FileText, LayoutDashboard } from 'lucide-react';
import type { ViewMode } from './types';

// ─── View-mode toggle ────────────────────────────────────────────────────────

export const SUMMARY_PANEL_ID = 'summary-view-panel';
export const summaryTabId = (mode: ViewMode) => `summary-tab-${mode}`;

/** ARIA tabs keyboard model: Left/Right wrap, Home/End jump; focus follows selection. */
export function onTablistKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const tabs = Array.from(
    e.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('button[role="tab"]') ?? [],
  );
  if (tabs.length === 0) return;
  e.preventDefault();
  const idx = tabs.indexOf(e.currentTarget);
  const next = e.key === 'Home' ? 0
    : e.key === 'End' ? tabs.length - 1
    : e.key === 'ArrowRight' ? (idx + 1) % tabs.length
    : (idx - 1 + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}

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
        id={summaryTabId('detailed')}
        active={mode === 'detailed'}
        onClick={() => onChange('detailed')}
        icon={LayoutDashboard}
        label="Detailed"
        title="Engineer view — scores, dimensions, source pills"
      />
      <ModeButton
        id={summaryTabId('brief')}
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
  id,
  active,
  onClick,
  icon: Icon,
  label,
  title,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: typeof Activity;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={SUMMARY_PANEL_ID}
      tabIndex={active ? 0 : -1}
      onKeyDown={onTablistKeyDown}
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
