'use client';

import { ListChecks } from 'lucide-react';
import { OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import type { PrioritySuggestion } from '@/lib/game-director/matrix-routing';
import { ACCENT } from './constants';

/**
 * Priority systems, seeded from the feature matrix instead of typed from
 * memory. Every chip states WHY it is here ("3 missing, avg quality 41"), so a
 * pre-filled list is a claim the operator can check rather than one they have
 * to trust — and every chip is togglable, so the seed is a starting point and
 * not a decision made for them.
 *
 * When nothing could be read the panel SAYS so (no project, a failed read, or a
 * matrix with nothing weak in it) rather than rendering an empty list that
 * looks like a considered "no priorities".
 */
export function PrioritySystems({
  suggestions,
  selected,
  onToggle,
  note,
  labelId,
}: {
  suggestions: PrioritySuggestion[];
  selected: ReadonlySet<string>;
  onToggle: (moduleId: string) => void;
  /** Why the list is empty or incomplete. Rendered verbatim. */
  note: string | null;
  labelId: string;
}) {
  return (
    <div>
      <span id={labelId} className="text-xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1 font-semibold">
        <ListChecks className="w-3 h-3" aria-hidden="true" />
        Priority Systems
        <span className="text-text-muted ml-1 normal-case tracking-normal">
          (from the feature matrix — {selected.size} of {suggestions.length} selected)
        </span>
      </span>

      {note && <p className="text-2xs text-text-muted mb-2 leading-relaxed">{note}</p>}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={labelId}>
          {suggestions.map((suggestion) => {
            const isSelected = selected.has(suggestion.moduleId);
            return (
              <button
                key={suggestion.moduleId}
                type="button"
                onClick={() => onToggle(suggestion.moduleId)}
                aria-pressed={isSelected}
                className={`
                  focus-ring flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-left transition-all
                  ${isSelected ? '' : 'border-border bg-surface-deep hover:border-border-bright hover:bg-surface'}
                `}
                style={isSelected ? { borderColor: `${ACCENT}${OPACITY_20}`, backgroundColor: `${ACCENT}${OPACITY_8}` } : undefined}
              >
                <span className={`text-sm font-medium ${isSelected ? 'text-text' : 'text-text-muted'}`}>
                  {suggestion.moduleId}
                </span>
                <span className="text-2xs text-text-muted leading-tight">{suggestion.reason}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
