'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { STATUS_ERROR, STATUS_SUCCESS } from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';

type CopyButtonSize = 'xs' | 'sm';

interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Text to copy to clipboard. */
  text: string;
  size?: CopyButtonSize;
  /** Stop click event from bubbling to ancestor handlers (default: true). */
  stopPropagation?: boolean;
  /** Tooltip when not copied (default: 'Copy'). */
  tooltip?: string;
  /** Tooltip when copied (default: 'Copied!'). */
  copiedTooltip?: string;
  /** Called after successful clipboard write. */
  onCopied?: () => void;
}

const ICON_SIZE: Record<CopyButtonSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
};

const PADDING: Record<CopyButtonSize, string> = {
  xs: 'p-1',
  sm: 'p-1.5',
};

/**
 * Click-to-copy button with built-in copied-flash state. Subsumes the 3+
 * `useState(copied) + setTimeout reset` reimplementations in
 * QuickActionsPanel/RoadmapChecklist/FeatureMatrix (ui-perfectionist 01.2).
 *
 * Uses `STATUS_SUCCESS` token (replaces hardcoded `text-[#4ade80]`),
 * `UI_TIMEOUTS.copyFeedback` for the reset timer, and `e.stopPropagation()`
 * by default (most call sites are nested inside row-toggle buttons).
 */
export function CopyButton({
  text,
  size = 'xs',
  stopPropagation = true,
  tooltip = 'Copy',
  copiedTooltip = 'Copied!',
  onCopied,
  className = '',
  title,
  ...props
}: CopyButtonProps) {
  const [outcome, setOutcome] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (stopPropagation) e.stopPropagation();
      let next: 'copied' | 'failed' = 'copied';
      try {
        await navigator.clipboard.writeText(text);
        onCopied?.();
      } catch {
        next = 'failed';
      }
      setOutcome(next);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setOutcome('idle'), UI_TIMEOUTS.copyFeedback);
    },
    [text, stopPropagation, onCopied],
  );

  const stateLabel = outcome === 'failed' ? 'Copy failed' : outcome === 'copied' ? copiedTooltip : tooltip;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title ?? stateLabel}
      aria-label={stateLabel}
      className={`${PADDING[size]} rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright ${className}`}
      {...props}
    >
      {outcome === 'copied' ? (
        <Check className={ICON_SIZE[size]} style={{ color: STATUS_SUCCESS }} aria-hidden />
      ) : outcome === 'failed' ? (
        <X className={ICON_SIZE[size]} style={{ color: STATUS_ERROR }} aria-hidden />
      ) : (
        <Copy className={ICON_SIZE[size]} aria-hidden />
      )}
    </button>
  );
}
