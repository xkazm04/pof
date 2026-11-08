import { useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD, STATUS_ERROR } from '@/lib/chart-colors';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * The view's one labelled copy button. The receipt follows the VERIFIED write
 * (`copyToClipboard` resolves true), never the attempt: a rejected or missing
 * clipboard shows "Copy failed", not "Copied!". The label change is announced
 * (aria-live) and a re-press restarts the window instead of stacking timers.
 */
export function CopyTextButton({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(text);
    setState(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), UI_TIMEOUTS.copyFeedback);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`flex items-center gap-1 px-2 py-1 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors ${FOCUS_RING_CLASS} ${className}`}
    >
      {state === 'copied' ? (
        <Check aria-hidden="true" className="w-3 h-3" style={{ color: ACCENT_EMERALD }} />
      ) : state === 'failed' ? (
        <X aria-hidden="true" className="w-3 h-3" style={{ color: STATUS_ERROR }} />
      ) : (
        <Copy aria-hidden="true" className="w-3 h-3" />
      )}
      {state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
}
