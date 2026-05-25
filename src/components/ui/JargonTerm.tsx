'use client';

import { Tooltip } from './Tooltip';
import { lookupJargon } from '@/lib/blueprint-jargon';

interface JargonTermProps {
  /** The raw jargon term (e.g. "UPROPERTY", "EditAnywhere", "K2Node_Event"). */
  term: string;
  /** Optional override text to display (defaults to the term itself). */
  children?: string;
  /** Underline style. "dotted" matches the "click for definition" idiom. */
  underline?: 'dotted' | 'none';
}

/**
 * Inline accessible jargon explainer. Wraps a term with a tooltip pulled from
 * the blueprint-jargon dictionary. If the term isn't known, renders the text
 * unchanged (fail-soft — never blocks the user from seeing the code).
 *
 * The tooltip is keyboard-accessible (focus + Escape) via the underlying
 * Tooltip primitive.
 */
export function JargonTerm({ term, children, underline = 'dotted' }: JargonTermProps) {
  const entry = lookupJargon(term);
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
            ? 'underline decoration-dotted decoration-text-muted underline-offset-2 hover:decoration-text focus:outline-none focus-visible:ring-1 focus-visible:ring-border-bright rounded-sm'
            : 'focus:outline-none focus-visible:ring-1 focus-visible:ring-border-bright rounded-sm'
        }
        aria-label={`${term}: ${entry.plain}`}
      >
        {label}
      </button>
    </Tooltip>
  );
}
