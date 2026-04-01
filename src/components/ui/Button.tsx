'use client';

import { forwardRef } from 'react';
import { OPACITY_22, withOpacity } from '@/lib/chart-colors';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'solid', size = 'md', accentColor, type = 'button', className = '', children, ...props }, ref) => {
    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-sm',
    };

    const variantClasses = {
      solid: `bg-surface-hover text-text border border-border-bright hover:bg-border-bright`,
      outline: `bg-transparent text-text border border-border-bright hover:bg-surface-hover`,
      ghost: `bg-transparent text-text-muted hover:text-text hover:bg-surface-hover`,
      glass: `bg-surface/50 backdrop-blur-sm text-text border border-border hover:bg-surface-hover/50`,
    };

    return (
      <button
        ref={ref}
        type={type}
        className={`rounded-lg font-medium transition-all duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        style={accentColor ? { borderColor: withOpacity(accentColor, OPACITY_22), color: accentColor } : undefined}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
