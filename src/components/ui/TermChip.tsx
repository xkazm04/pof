'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import {
  isRawEngineToken,
  lookupTerm,
  termTooltip,
} from '@/lib/blueprint-glossary';

interface TermChipProps {
  /** The raw jargon token (e.g. "CPF_Edit", "K2Node_CallFunction", "MOD"). */
  term: string;
  /** Optional display label (defaults to the term itself). */
  children?: ReactNode;
  /** Extra classes for the trigger (e.g. a colored diff badge). */
  className?: string;
  /** Inline styles for the trigger (e.g. dynamic diff-badge colors). */
  style?: CSSProperties;
  /** Show the dotted-underline affordance. Off for solid badges. Default true. */
  underline?: boolean;
}

/**
 * Inline, accessible decoder for a single UE5 / Blueprint jargon token. Renders
 * the term at `text-2xs` with a subtle dotted underline and a hover/focus tooltip
 * carrying the plain-English explanation from the shared blueprint glossary.
 *
 * Fail-soft: an unknown term renders unchanged (never blocks the user from
 * reading the code). The tooltip is keyboard-accessible via the underlying
 * Tooltip primitive (focus to open, Escape to dismiss).
 */
export function TermChip({ term, children, className, style, underline = true }: TermChipProps) {
  const entry = lookupTerm(term);
  const label = children ?? term;

  if (!entry) {
    return <span className={className} style={style}>{label}</span>;
  }

  const underlineClasses = underline
    ? 'underline decoration-dotted decoration-text-muted underline-offset-2 hover:decoration-text'
    : '';

  return (
    <Tooltip content={termTooltip(entry)}>
      <button
        type="button"
        className={`text-2xs cursor-help rounded-sm focus-ring ${underlineClasses} ${className ?? ''}`.trim()}
        style={style}
        aria-label={`${term}: ${entry.plain}`}
      >
        {label}
      </button>
    </Tooltip>
  );
}

// Token-ish runs (identifiers, incl. underscores) vs. everything else, kept so
// the surrounding punctuation/spacing in a warning string is preserved exactly.
const TOKEN_SPLIT = /([A-Za-z_][A-Za-z0-9_]*)/g;

interface DecoratedJargonProps {
  /** Free-text string (e.g. a transpiler warning message). */
  text: string;
  /** Wrapping class applied to the container span. */
  className?: string;
}

/**
 * Wraps any *raw engine tokens* found inside a free-text string (e.g. a
 * transpiler warning like `Node type "K2Node_Timeline" needs manual
 * translation`) in {@link TermChip}s, leaving the surrounding prose untouched.
 *
 * Only raw engine identifiers are decorated (see `isRawEngineToken`) so everyday
 * words that happen to be glossary keys ("function", "event") are not underlined
 * mid-sentence.
 */
export function DecoratedJargon({ text, className }: DecoratedJargonProps) {
  const parts = text.split(TOKEN_SPLIT);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (isRawEngineToken(part) && lookupTerm(part)) {
          return <TermChip key={i} term={part} />;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
