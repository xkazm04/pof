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
  content: string;
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
export function Tooltip({ children, content }: TooltipProps) {
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
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-surface-hover border border-border-bright rounded text-2xs text-text whitespace-nowrap z-50 pointer-events-none"
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
