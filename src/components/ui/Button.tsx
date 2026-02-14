'use client';

import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'solid', size = 'md', accentColor, className = '', children, ...props }, ref) => {
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
        className={`rounded-lg font-medium transition-all duration-200 disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        style={accentColor ? { borderColor: `${accentColor}30`, color: accentColor } : undefined}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
