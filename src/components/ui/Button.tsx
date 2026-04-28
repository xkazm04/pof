'use client';

import { forwardRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { OPACITY_22, withOpacity } from '@/lib/chart-colors';

type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'glass';
type ButtonIntent = 'primary' | 'danger' | 'warning' | 'info';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment (orthogonal to intent). */
  variant?: ButtonVariant;
  /** Semantic colour intent. When set, intent classes override the variant's neutral palette. */
  intent?: ButtonIntent;
  size?: ButtonSize;
  accentColor?: string;
  /** Render a spinner and disable the button. */
  loading?: boolean;
  /** Optional label to render while loading; falls back to children. */
  loadingLabel?: ReactNode;
  /** Icon shown before the label. */
  leftIcon?: ReactNode;
  /** Icon shown after the label. */
  rightIcon?: ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-sm',
};

const variantClasses: Record<ButtonVariant, string> = {
  solid: 'bg-surface-hover text-text border border-border-bright hover:bg-border-bright',
  outline: 'bg-transparent text-text border border-border-bright hover:bg-surface-hover',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-surface-hover',
  glass: 'bg-surface/50 backdrop-blur-sm text-text border border-border hover:bg-surface-hover/50',
};

/**
 * Semantic intent palettes layered on top of `variant`. When `intent` is supplied
 * the intent classes win because they appear later in the className string.
 * These mirror the previous `WizardButton` palette so it can be retired.
 */
const intentClasses: Record<ButtonIntent, string> = {
  primary:
    'bg-accent-medium text-accent-setup border border-accent-strong hover:bg-accent-strong',
  danger:
    'bg-status-red-subtle text-red-300 border border-status-red-medium hover:bg-status-red-medium',
  warning:
    'bg-status-amber-subtle text-accent-content border border-status-amber-medium hover:bg-status-amber-medium',
  info:
    'bg-status-blue-subtle text-accent-core border border-status-blue-medium hover:bg-status-blue-medium',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'solid',
      intent,
      size = 'md',
      accentColor,
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
  ) => {
    const palette = intent ? intentClasses[intent] : variantClasses[variant];
    const hasIconSlots = Boolean(leftIcon || rightIcon || loading);
    const layoutClass = hasIconSlots ? 'inline-flex items-center gap-2' : '';
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`rounded-lg font-medium transition-all duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:opacity-40 disabled:cursor-not-allowed ${layoutClass} ${sizeClasses[size]} ${palette} ${className}`}
        style={accentColor ? { borderColor: withOpacity(accentColor, OPACITY_22), color: accentColor } : undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
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
Button.displayName = 'Button';
