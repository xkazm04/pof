'use client';

import { useId, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useAnimationExplainStore } from '@/stores/animationExplainStore';
import { summarizeAnimationPrompt } from '@/lib/animation/explain';
import { TEXT_SCALE } from '@/lib/typography-scale';

interface PlainEnglishSummaryProps {
  /**
   * The dense source text to summarise — typically a CLI prompt or a
   * generated code block. Pulled from `step.prompt`, `step.description`, etc.
   */
  source: string;
  /** Optional short heading rendered above the bullets. */
  title?: string;
}

/**
 * A small panel rendered above a code block / dense step body.
 *
 * - Only renders when the Explain toggle is on.
 * - Builds the summary purely from the source string via
 *   `summarizeAnimationPrompt`, so it stays accurate as the prompt evolves.
 * - Returns null (no DOM) when the toggle is off or the source has no
 *   detectable animation concepts.
 */
export function PlainEnglishSummary({ source, title = 'In plain English' }: PlainEnglishSummaryProps) {
  const enabled = useAnimationExplainStore((s) => s.explainEnabled);
  const headingId = useId();

  const summary = useMemo(() => summarizeAnimationPrompt(source ?? ''), [source]);

  if (!enabled) return null;
  if (summary.detected.length === 0) return null;

  return (
    // A labelled region, not a bare div — this panel is an aside injected above
    // dense content, so assistive tech should be able to reach and name it.
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-3 shadow-[inset_0_0_20px_rgba(167,139,250,0.08)]"
      data-testid="pof-animation-plain-summary"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
        <h4 id={headingId} className={`${TEXT_SCALE.meta} font-bold uppercase tracking-widest text-violet-200`}>{title}</h4>
      </div>
      {/* Body copy sits at the 12px legibility floor (TEXT_SCALE.body): this is
          the plain-language explanation, so it must not be the smallest text on
          screen. It previously rendered at text-xs/text-[11px] with an opacity
          dim on top. */}
      <p className={`${TEXT_SCALE.body} text-violet-100 leading-relaxed mb-2`}>{summary.headline}</p>
      {summary.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {summary.bullets.map((b, i) => (
            <li
              key={i}
              className={`${TEXT_SCALE.body} text-violet-100/90 leading-relaxed flex gap-2`}
            >
              <span className="text-violet-400 flex-shrink-0" aria-hidden="true">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
