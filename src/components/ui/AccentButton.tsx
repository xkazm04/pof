'use client';

import { forwardRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { OPACITY_15, OPACITY_22, withOpacity } from '@/lib/chart-colors';

type AccentButtonSize = 'sm' | 'md';

interface AccentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Hex/CSS color that drives bg + border + text. */
  accentColor: string;
  size?: AccentButtonSize;
  /** Render a spinner and disable the button. */
  loading?: boolean;
  /** Optional label to render while loading; falls back to children. */
  loadingLabel?: ReactNode;
  /** Icon shown before the label. */
  leftIcon?: ReactNode;
  /** Icon shown after the label. */
  rightIcon?: ReactNode;
}

const sizeClasses: Record<AccentButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-xs gap-2',
};

/**
 * Per-module accent-colored CTA. Subsumes the `style={{ backgroundColor:
 * `${accentColor}24`, color: accentColor, border: `1px solid ${accentColor}38` }}`
 * recipe duplicated across FeatureMatrix / RoadmapChecklist / QuickActionsPanel.
 *
 * Centralizes the OPACITY_15 (bg ~14%) + OPACITY_22 (border ~22%) tokens so
 * the magic 24/38 hex suffixes stay in one place. Includes loading state and
 * focus-visible ring.
 *
 * Refs: ui-perfectionist 01.1
 */
export const AccentButton = forwardRef<HTMLButtonElement, AccentButtonProps>(
  function AccentButton(
    {
      accentColor,
      size = 'md',
      loading = false,
      loadingLabel,
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
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center rounded-lg font-semibold transition-all disabled:opacity-50 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${sizeClasses[size]} ${className}`}
        style={{
          backgroundColor: withOpacity(accentColor, OPACITY_15),
          color: accentColor,
          border: `1px solid ${withOpacity(accentColor, OPACITY_22)}`,
        }}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className={size === 'sm' ? 'w-3 h-3 animate-spin' : 'w-3.5 h-3.5 animate-spin'} aria-hidden />
            {loadingLabel ?? children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  },
);
