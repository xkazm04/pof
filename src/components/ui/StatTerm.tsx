'use client';

import { Tooltip } from './Tooltip';
import { lookupStatTerm } from '@/lib/prompt-evolution/stats-glossary';

interface StatTermProps {
  /** The statistics jargon term (e.g. "z-test", "confidence", "Jaccard"). */
  term: string;
  /** Optional override text to display (defaults to the term itself). */
  children?: string;
  /** Underline style. "dotted" matches the "hover for definition" idiom. */
  underline?: 'dotted' | 'none';
}

/**
 * Inline, accessible decoder for a single statistics term used by the Prompt
 * Evolution engine. Wraps the term with a hover/focus tooltip pulled from the
 * stats glossary. Unknown terms render unchanged (fail-soft — never blocks the
 * user from reading the screen).
 *
 * Mirrors {@link import('./JargonTerm').JargonTerm} but is backed by the
 * statistics dictionary instead of the UE5/Blueprint one. Keyboard-accessible
 * (focus + Escape) via the underlying Tooltip primitive.
 */
export function StatTerm({ term, children, underline = 'dotted' }: StatTermProps) {
  const entry = lookupStatTerm(term);
  const label = children ?? term;

  if (!entry) {
    return <span>{label}</span>;
  }

  const tooltipContent = entry.whyItMatters
    ? `${entry.plain} — ${entry.whyItMatters}`
    : entry.plain;

  return (
    <Tooltip content={tooltipContent}>
      <button
        type="button"
        className={
          underline === 'dotted'
            ? 'underline decoration-dotted decoration-text-muted underline-offset-2 hover:decoration-text cursor-help focus-ring rounded-sm'
            : 'cursor-help focus-ring rounded-sm'
        }
        aria-label={`${entry.term}: ${entry.plain}`}
      >
        {label}
      </button>
    </Tooltip>
  );
}
