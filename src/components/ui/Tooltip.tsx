'use client';

import { cloneElement, isValidElement, useCallback, useEffect, useId, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

interface TooltipProps {
  /**
   * The trigger element. Must be a single React element that can accept
   * `aria-describedby`, `onFocus`, `onBlur`, `onMouseEnter`, `onMouseLeave`,
   * and `onKeyDown` props (e.g. a button or input).
   */
  children: ReactElement;
  /** Tooltip body. A plain string stays single-line; pass `multiline` for richer nodes. */
  content: ReactNode;
  /**
   * Allow the bubble to wrap onto multiple lines (capped width, left-aligned).
   * Use for definitions/examples; the default single-line `nowrap` suits short labels.
   */
  multiline?: boolean;
  /** Which side of the trigger the bubble opens on. Defaults to `top`. */
  placement?: 'top' | 'bottom';
}

/**
 * Accessible tooltip primitive.
 *
 * - Wraps a single trigger element and links it to the tooltip via
 *   `aria-describedby` so screen readers announce `content` when focus reaches
 *   the trigger.
 * - Tooltip element carries `role="tooltip"` and a stable id.
 * - Visible on hover AND keyboard focus.
 * - Escape dismisses while focused (returns focus to trigger by default).
 * - Skips portal/positioning — relative-positioned, mirrors prior visual API.
 */
export function Tooltip({ children, content, multiline = false, placement = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const tooltipId = useId();

  const open = useCallback(() => setShow(true), []);
  const close = useCallback(() => setShow(false), []);

  // Close on Escape (global handler while open) — no DOM measurement needed.
  useEffect(() => {
    if (!show) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show]);

  if (!isValidElement(children)) {
    // Fail-soft: render children as-is if not a single element.
    return <>{children}</>;
  }

  const child = children as ReactElement<{
    'aria-describedby'?: string;
    onFocus?: (e: unknown) => void;
    onBlur?: (e: unknown) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
  }>;

  const triggerProps = {
    'aria-describedby': show ? tooltipId : child.props['aria-describedby'],
    onFocus: (e: unknown) => {
      open();
      child.props.onFocus?.(e);
    },
    onBlur: (e: unknown) => {
      close();
      child.props.onBlur?.(e);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      child.props.onKeyDown?.(e);
    },
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={open}
      onMouseLeave={close}
    >
      {cloneElement(child, triggerProps)}
      {show && (
        <div
          id={tooltipId}
          role="tooltip"
          className={[
            'absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none',
            'bg-surface-hover border border-border-bright rounded text-2xs text-text',
            placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
            multiline
              ? 'px-2.5 py-1.5 w-max max-w-[16rem] whitespace-normal text-left leading-snug'
              : 'px-2 py-1 whitespace-nowrap',
          ].join(' ')}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// Keep ReactNode import alive for downstream consumers that may have relied
// on the previous (looser) typing during incremental migration.
export type TooltipContent = ReactNode;
