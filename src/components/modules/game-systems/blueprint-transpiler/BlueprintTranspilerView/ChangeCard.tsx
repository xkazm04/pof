'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TermChip } from '@/components/ui/TermChip';
import type { SemanticChange } from '@/types/blueprint';
import { CHANGE_TYPE_META } from '@/lib/blueprint-jargon';
import { withOpacity, OPACITY_8 } from '@/lib/chart-colors';
import { ACCENT, CONFLICT_STYLES } from './constants';

// ─── Change Card ────────────────────────────────────────────────────────────

export function ChangeCard({ change }: { change: SemanticChange }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const conflictStyle = CONFLICT_STYLES[change.conflictLevel];
  const ConflictIcon = conflictStyle.icon;

  const t = CHANGE_TYPE_META[change.type] ?? CHANGE_TYPE_META.modify;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 hover:border-border-bright transition-colors">
      {/* The toggle and the glossary chips are SIBLINGS: TermChip renders its
          own <button>, so wrapping the row in one click target nested
          controls and left the toggle mouse-only (same fix as QuestCard). */}
      <div className="flex items-center gap-2">
        <TermChip
          term={t.code}
          underline={false}
          className="font-bold px-1.5 py-0.5 rounded"
          style={{ color: t.color, backgroundColor: withOpacity(t.color, OPACITY_8) }}
        />
        <TermChip term={change.scope} className="uppercase text-text-muted" />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left rounded focus-ring"
        >
          {expanded
            ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" aria-hidden />
            : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" aria-hidden />}
          <span className="text-xs font-medium text-text truncate">{change.name}</span>
        </button>
        {/* Glyph + accessible name, not a hue-only dot (WCAG 1.4.1). */}
        <ConflictIcon
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: conflictStyle.color }}
          role="img"
          aria-label={conflictStyle.label}
        >
          <title>{conflictStyle.label}</title>
        </ConflictIcon>
      </div>

      {expanded && (
        <div id={panelId} className="mt-2 ml-5 space-y-1.5">
          <p className="text-2xs text-text-muted">{change.description}</p>
          {change.blueprintSide && (
            <div className="flex items-start gap-2">
              <span className="text-2xs font-medium text-text-muted w-8">BP:</span>
              <code className="text-2xs font-mono text-text bg-surface-hover px-1.5 py-0.5 rounded">{change.blueprintSide}</code>
            </div>
          )}
          {change.cppSide && (
            <div className="flex items-start gap-2">
              <span className="text-2xs font-medium text-text-muted w-8">C++:</span>
              <code className="text-2xs font-mono text-text bg-surface-hover px-1.5 py-0.5 rounded">{change.cppSide}</code>
            </div>
          )}
          {change.resolution && (
            <div className="flex items-start gap-2 mt-1 pt-1 border-t border-border">
              <span className="text-2xs font-medium" style={{ color: ACCENT }}>Fix:</span>
              <span className="text-2xs text-text-muted">{change.resolution}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
