'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface TruncateWithTooltipProps {
  children: React.ReactNode;
  /** Extra classes on the outer element (should include truncate or line-clamp-*) */
  className?: string;
  /** Tooltip placement */
  side?: 'top' | 'bottom';
  /** Max width for the tooltip popup (default 320px) */
  maxTooltipWidth?: number;
  /** Render as a different element (default span) */
  as?: 'span' | 'p' | 'div';
}

/**
 * Wraps children in a truncated container and shows a tooltip on hover
 * ONLY when the content is actually overflowing.
 * Uses ResizeObserver for efficient overflow detection.
 */
export function TruncateWithTooltip({
  children,
  className = '',
  side = 'top',
  maxTooltipWidth = 320,
  as = 'span',
}: TruncateWithTooltipProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    setIsTruncated(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
  }, []);

  // Re-check when children change
  useEffect(() => {
    checkOverflow();
  }, [checkOverflow, children]);

  // Observe resize
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkOverflow]);

  const setRef = useCallback((node: HTMLElement | null) => {
    elRef.current = node;
    if (node) checkOverflow();
  }, [checkOverflow]);

  const tipClass = `
    absolute left-0 z-50 px-2.5 py-1.5
    bg-surface-deep border border-border-bright rounded-md shadow-lg
    text-2xs text-text leading-relaxed whitespace-normal break-words
    pointer-events-none
    ${side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}
  `;

  const props = {
    ref: setRef,
    className: `${className} relative`,
    onMouseEnter: () => isTruncated && setShowTip(true),
    onMouseLeave: () => setShowTip(false),
  };

  const tooltip = showTip ? (
    <span role="tooltip" className={tipClass} style={{ maxWidth: maxTooltipWidth }}>
      {children}
    </span>
  ) : null;

  if (as === 'p') {
    return (
      <p {...props}>
        {children}
        {tooltip}
      </p>
    );
  }
  if (as === 'div') {
    return (
      <div {...props}>
        {children}
        {tooltip}
      </div>
    );
  }
  return (
    <span {...props}>
      {children}
      {tooltip}
    </span>
  );
}
