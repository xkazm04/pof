'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TermChip } from '@/components/ui/TermChip';
import type { SemanticChange } from '@/types/blueprint';
import { CHANGE_TYPE_META } from '@/lib/blueprint-jargon';
import { ACCENT, CONFLICT_STYLES } from './constants';

// ─── Change Card ────────────────────────────────────────────────────────────

export function ChangeCard({ change }: { change: SemanticChange }) {
  const [expanded, setExpanded] = useState(false);
  const conflictStyle = CONFLICT_STYLES[change.conflictLevel];

  const t = CHANGE_TYPE_META[change.type] ?? CHANGE_TYPE_META.modify;

  return (
    <div
      className="rounded-lg border border-border bg-surface px-3 py-2 cursor-pointer hover:border-border-bright transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {expanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <TermChip
          term={t.code}
          underline={false}
          className="font-bold px-1.5 py-0.5 rounded"
          style={{ color: t.color, backgroundColor: `${t.color}15` }}
        />
        <TermChip term={change.scope} className="uppercase text-text-muted" />
        <span className="text-xs font-medium text-text">{change.name}</span>
        <span
          className="ml-auto w-2 h-2 rounded-full"
          style={{ backgroundColor: conflictStyle.color }}
        />
      </div>

      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
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
