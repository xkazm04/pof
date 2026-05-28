'use client';

import { BookOpen } from 'lucide-react';
import { useAnimationExplainStore } from '@/stores/animationExplainStore';

interface ExplainToggleProps {
  /** Optional small label rendered before the switch. */
  label?: string;
  /** Compact mode = icon + state, no descriptive label. */
  compact?: boolean;
}

/**
 * Pill-style toggle that turns the animation Explain layer on/off.
 *
 * When ON: plain-English summaries appear above code blocks, and known
 * jargon terms throughout the animation tooling get hoverable tooltips.
 *
 * State is persisted in `useAnimationExplainStore` (localStorage), so a
 * single click sticks across reloads.
 */
export function ExplainToggle({ label = 'Explain', compact = false }: ExplainToggleProps) {
  const enabled = useAnimationExplainStore((s) => s.explainEnabled);
  const toggle = useAnimationExplainStore((s) => s.toggleExplain);

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={enabled}
      aria-label={`${label} ${enabled ? 'on' : 'off'} — translates UE animation jargon into plain language`}
      data-testid="pof-animation-explain-toggle"
      title={enabled ? 'Explain: ON — click to hide tooltips and summaries' : 'Explain: OFF — click to translate jargon into plain language'}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-widest transition-colors border',
        enabled
          ? 'bg-violet-500/15 text-violet-200 border-violet-400/50 hover:bg-violet-500/25'
          : 'bg-surface/60 text-text-muted border-border hover:text-text hover:border-border-bright',
      ].join(' ')}
    >
      <BookOpen className="w-3 h-3" aria-hidden="true" />
      {!compact && <span>{label}</span>}
      <span className={[
        'inline-flex items-center justify-center min-w-[28px] px-1 py-[1px] rounded-full text-[10px] font-mono',
        enabled ? 'bg-violet-300/20 text-violet-100' : 'bg-surface text-text-muted',
      ].join(' ')}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
