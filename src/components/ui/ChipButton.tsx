'use client';

import { forwardRef, type ReactNode } from 'react';
import { OPACITY_15, withOpacity } from '@/lib/chart-colors';

type ChipButtonSize = 'xs' | 'sm';
type ChipButtonTone = 'soft' | 'outline';
type ChipButtonShape = 'pill' | 'rounded';

interface ChipButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  /** Hex/CSS color for fill + text. */
  color: string;
  size?: ChipButtonSize;
  /** soft: bg-15 + colored text. outline: bg-15 + colored border + colored text. */
  tone?: ChipButtonTone;
  shape?: ChipButtonShape;
  /** Render as a non-interactive `<span>`. Default: button. */
  as?: 'button' | 'span';
  /** Use monospaced font (for codes/identifiers). */
  mono?: boolean;
  /** Make text bold (default: medium). */
  bold?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const sizeClasses: Record<ChipButtonSize, string> = {
  xs: 'text-2xs px-1.5 py-0.5 gap-1',
  sm: 'text-xs px-2 py-0.5 gap-1.5',
};

const shapeClasses: Record<ChipButtonShape, string> = {
  pill: 'rounded-full',
  rounded: 'rounded-md',
};

/**
 * Toned colored chip / category pill primitive. Subsumes the duplicated
 * `text-2xs px-1.5 py-0.5 rounded` chip recipe from EQS pipeline diagrams,
 * audio preset/mode pills, and ability-tab pills (ui-perfectionist 18.3 / 15.3 / 05.3).
 *
 * Standardizes on `OPACITY_15` for the soft background — eliminates the
 * 10/15/25/30 opacity drift across the audited contexts. Outline tone adds
 * a colored border at 30% opacity. Renders as `<button>` by default; pass
 * `as="span"` for non-interactive labels.
 */
export const ChipButton = forwardRef<HTMLButtonElement | HTMLSpanElement, ChipButtonProps>(
  function ChipButton(
    {
      color,
      size = 'xs',
      tone = 'soft',
      shape = 'rounded',
      as = 'button',
      mono = false,
      bold = false,
      leftIcon,
      rightIcon,
      className = '',
      type,
      children,
      ...props
    },
    ref,
  ) {
    const fontClass = mono ? 'font-mono' : bold ? 'font-bold' : 'font-medium';
    const baseClass = `inline-flex items-center justify-center transition-colors disabled:opacity-50 ${shapeClasses[shape]} ${fontClass} ${sizeClasses[size]} ${className}`;
    const style: React.CSSProperties = {
      color,
      backgroundColor: withOpacity(color, OPACITY_15),
      ...(tone === 'outline' ? { border: `1px solid ${withOpacity(color, '30')}` } : {}),
    };

    if (as === 'span') {
      return (
        <span
          ref={ref as React.ForwardedRef<HTMLSpanElement>}
          className={baseClass}
          style={style}
          {...(props as React.HTMLAttributes<HTMLSpanElement>)}
        >
          {leftIcon}
          {children}
          {rightIcon}
        </span>
      );
    }

    return (
      <button
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        type={type ?? 'button'}
        className={baseClass}
        style={style}
        {...props}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);
