'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useAnimationExplainStore } from '@/stores/animationExplainStore';
import { summarizeAnimationPrompt } from '@/lib/animation/explain';

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

  const summary = useMemo(() => summarizeAnimationPrompt(source ?? ''), [source]);

  if (!enabled) return null;
  if (summary.detected.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-3 shadow-[inset_0_0_20px_rgba(167,139,250,0.08)]"
      data-testid="pof-animation-plain-summary"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
        <h4 className="text-2xs font-bold uppercase tracking-widest text-violet-200">{title}</h4>
      </div>
      <p className="text-xs text-violet-100/90 leading-relaxed mb-2">{summary.headline}</p>
      {summary.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {summary.bullets.map((b, i) => (
            <li
              key={i}
              className="text-[11px] text-violet-100/80 leading-relaxed flex gap-2"
            >
              <span className="text-violet-400/80 flex-shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
