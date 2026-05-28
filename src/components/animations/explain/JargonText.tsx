'use client';

import { Fragment, useMemo } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { scanAnimationJargon, type AnimationJargonEntry } from '@/lib/animation/jargon';
import { useAnimationExplainStore } from '@/stores/animationExplainStore';

interface JargonTextProps {
  /** The raw text to annotate. */
  children: string;
  /** Optional className applied to the wrapping span. */
  className?: string;
  /**
   * Force the explain layer on/off regardless of the global preference.
   * Useful for previews; production callers should omit this.
   */
  force?: boolean;
}

/**
 * Renders `children` as plain text, but when the global Explain toggle is on
 * (or `force` is true), any known animation jargon term is wrapped in a small
 * accessible tooltip pulled from the animation glossary.
 *
 * Fail-soft: an empty string renders nothing; unknown text renders as-is.
 */
export function JargonText({ children, className, force }: JargonTextProps) {
  const enabledFromStore = useAnimationExplainStore((s) => s.explainEnabled);
  const enabled = force ?? enabledFromStore;

  const segments = useMemo(() => {
    if (!enabled || !children) return null;
    return splitWithMatches(children);
  }, [enabled, children]);

  if (!enabled || !segments) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === 'text'
          ? <Fragment key={i}>{seg.text}</Fragment>
          : <JargonChip key={i} matched={seg.matched} entry={seg.entry} />
      )}
    </span>
  );
}

interface Segment {
  kind: 'text' | 'jargon';
  text: string;
  matched: string;
  entry: AnimationJargonEntry;
}

function splitWithMatches(text: string): Segment[] {
  const matches = scanAnimationJargon(text);
  if (matches.length === 0) {
    return [{ kind: 'text', text, matched: '', entry: {} as AnimationJargonEntry }];
  }

  const out: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      out.push({
        kind: 'text',
        text: text.slice(cursor, m.start),
        matched: '',
        entry: {} as AnimationJargonEntry,
      });
    }
    out.push({
      kind: 'jargon',
      text: m.matched,
      matched: m.matched,
      entry: m.entry,
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    out.push({
      kind: 'text',
      text: text.slice(cursor),
      matched: '',
      entry: {} as AnimationJargonEntry,
    });
  }
  return out;
}

function JargonChip({ matched, entry }: { matched: string; entry: AnimationJargonEntry }) {
  const tooltip = entry.whyItMatters
    ? `${entry.plain} — ${entry.whyItMatters}`
    : entry.plain;

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className="underline decoration-dotted decoration-violet-400/70 underline-offset-2 hover:decoration-violet-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/60 rounded-sm bg-transparent text-current"
        aria-label={`${entry.term}: ${entry.plain}`}
        data-testid="pof-animation-jargon-term"
        data-jargon-term={entry.term}
      >
        {matched}
      </button>
    </Tooltip>
  );
}
