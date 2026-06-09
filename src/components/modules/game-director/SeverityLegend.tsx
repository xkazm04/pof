'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { SEVERITY_TOKENS, SEVERITY_ORDER, SEVERITY_DESCRIPTIONS } from '@/lib/game-director-styles';

/**
 * Compact, dismissible severity legend. Pairs each level's distinct icon + color
 * with a plain-language description so finding severity is understandable without
 * relying on color (WCAG 1.4.1) or insider vocabulary. Shared by SessionDetail
 * and FindingsExplorer. Dismissing collapses it to a small "Severity legend"
 * affordance so it can be reopened.
 */
export function SeverityLegend({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`focus-ring inline-flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors rounded-sm ${className}`}
      >
        <HelpCircle className="w-3 h-3" aria-hidden="true" />
        Severity legend
      </button>
    );
  }

  return (
    <div
      role="note"
      aria-label="Severity legend"
      className={`rounded-lg border border-border bg-surface px-3 py-2.5 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Severity legend
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide severity legend"
          className="focus-ring p-0.5 rounded text-text-muted hover:text-text transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {SEVERITY_ORDER.map((sev) => {
          const token = SEVERITY_TOKENS[sev];
          const Icon = token.icon;
          return (
            <li key={sev} className="flex items-center gap-1.5 min-w-0">
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: token.color }} aria-hidden="true" />
              <span className="text-2xs font-semibold text-text">{token.label}</span>
              <span className="text-2xs text-text-muted">{SEVERITY_DESCRIPTIONS[sev]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
