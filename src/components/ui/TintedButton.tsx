'use client';

import { forwardRef, type ReactNode } from 'react';
import { OPACITY_15, withOpacity } from '@/lib/chart-colors';

type TintedButtonSize = 'sm' | 'md';

interface TintedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Hex/CSS color that drives bg + border + text. */
  color: string;
  size?: TintedButtonSize;
  /** Icon shown before the label. */
  leftIcon?: ReactNode;
  /** Icon shown after the label. */
  rightIcon?: ReactNode;
}

const sizeClasses: Record<TintedButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-3 py-1.5 text-xs gap-1.5',
};

/**
 * Bridge-panel "tinted action button" primitive. Subsumes the recipe used
 * across UE5 / LiveCoding / Bidirectional / LiveStateSync / BridgeEndpoint
 * panels: `border ${color}40 / bg ${color}15 / text ${color}` with
 * `text-xs font-bold rounded-lg`.
 *
 * Differs from AccentButton: this primitive is for the bridge / project-setup
 * surface, defaults to `font-bold` (matches existing bridge typography), and
 * uses the lighter `${color}15` bg + `${color}40` border combo (vs AccentButton's
 * 24/38 used elsewhere). The two could be unified later via a `tone` prop, but
 * are kept separate to preserve each surface's existing visual weight.
 *
 * Refs: ui-perfectionist 25.1
 */
export const TintedButton = forwardRef<HTMLButtonElement, TintedButtonProps>(
  function TintedButton(
    {
      color,
      size = 'md',
      leftIcon,
      rightIcon,
      type = 'button',
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-lg font-bold border transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${sizeClasses[size]} ${className}`}
        style={{
          borderColor: withOpacity(color, '40'),
          backgroundColor: withOpacity(color, OPACITY_15),
          color,
        }}
        {...props}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);
