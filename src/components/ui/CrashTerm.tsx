'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import {
  crashTermTooltip,
  isRawCrashToken,
  lookupCrashTerm,
} from '@/lib/crash-glossary';

interface CrashTermProps {
  /** The raw jargon token (e.g. "GAS", "AbilitySystemComponent", "ensure"). */
  term: string;
  /** Optional display label (defaults to the term itself). */
  children?: ReactNode;
  /** Extra classes for the trigger. */
  className?: string;
  /** Inline styles for the trigger. */
  style?: CSSProperties;
  /** Show the dotted-underline affordance. Off for solid chips. Default true. */
  underline?: boolean;
}

/**
 * Inline, accessible decoder for a single UE5 crash / GAS / engine jargon token.
 * Renders the term with a subtle dotted underline and a hover/focus tooltip
 * carrying the plain-English explanation from the shared crash glossary.
 *
 * Fail-soft: an unknown term renders unchanged (never blocks the user from
 * reading the screen). The tooltip is keyboard-accessible via the underlying
 * Tooltip primitive (focus to open, Escape to dismiss).
 *
 * Mirrors {@link import('./TermChip').TermChip} but is backed by the crash
 * vocabulary (`crash-glossary`) shared across the Crash Analyzer, Pattern
 * Library, and Error Memory panel.
 */
export function CrashTerm({ term, children, className, style, underline = true }: CrashTermProps) {
  const entry = lookupCrashTerm(term);
  const label = children ?? term;

  if (!entry) {
    return <span className={className} style={style}>{label}</span>;
  }

  const underlineClasses = underline
    ? 'underline decoration-dotted decoration-text-muted underline-offset-2 hover:decoration-text'
    : '';

  return (
    <Tooltip content={crashTermTooltip(entry)}>
      <button
        type="button"
        className={`cursor-help rounded-sm focus-ring ${underlineClasses} ${className ?? ''}`.trim()}
        style={style}
        aria-label={`${term}: ${entry.plain}`}
      >
        {label}
      </button>
    </Tooltip>
  );
}

// Token-ish runs (identifiers, incl. underscores) vs. everything else, kept so
// the surrounding punctuation/spacing in a prose string is preserved exactly.
const TOKEN_SPLIT = /([A-Za-z_][A-Za-z0-9_]*)/g;

interface DecoratedCrashTextProps {
  /** Free-text string (e.g. a crash diagnosis summary or fix description). */
  text: string;
  /** Wrapping class applied to the container span. */
  className?: string;
}

/**
 * Wraps any *raw engine tokens* found inside a free-text string (e.g. a crash
 * diagnosis like "Null AbilitySystemComponent accessed during ability
 * activation") in {@link CrashTerm}s, leaving the surrounding prose untouched.
 *
 * Only raw engine identifiers are decorated (see `isRawCrashToken`), so everyday
 * words are never underlined mid-sentence while `GAS`, `AbilitySystemComponent`,
 * or `TWeakObjectPtr` are.
 */
export function DecoratedCrashText({ text, className }: DecoratedCrashTextProps) {
  const parts = text.split(TOKEN_SPLIT);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (isRawCrashToken(part) && lookupCrashTerm(part)) {
          return <CrashTerm key={i} term={part} />;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
