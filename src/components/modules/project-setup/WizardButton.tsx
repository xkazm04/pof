'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type WizardButtonVariant = 'primary' | 'warning' | 'info';

interface WizardButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WizardButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  loadingLabel?: string;
  icon?: React.ReactNode;
}

const variantClasses: Record<WizardButtonVariant, string> = {
  primary:
    'bg-accent-medium text-accent-setup border-accent-strong hover:bg-accent-strong',
  warning:
    'bg-status-amber-subtle text-accent-content border-status-amber-medium hover:bg-status-amber-medium',
  info:
    'bg-status-blue-subtle text-accent-core border-status-blue-medium hover:bg-status-blue-medium',
};

export const WizardButton = forwardRef<HTMLButtonElement, WizardButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingLabel,
      icon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const sizeClass = size === 'sm'
      ? 'px-3 py-1.5 text-xs'
      : 'px-4 py-2 text-sm';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`flex items-center gap-2 ${sizeClass} border rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingLabel ?? children}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
    );
  },
);
WizardButton.displayName = 'WizardButton';
