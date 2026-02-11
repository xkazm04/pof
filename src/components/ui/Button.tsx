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
      solid: `bg-[#1a1a3a] text-[#e0e4f0] border border-[#2e2e5a] hover:bg-[#2e2e5a]`,
      outline: `bg-transparent text-[#e0e4f0] border border-[#2e2e5a] hover:bg-[#1a1a3a]`,
      ghost: `bg-transparent text-[#6b7294] hover:text-[#e0e4f0] hover:bg-[#1a1a3a]`,
      glass: `bg-[#111128]/50 backdrop-blur-sm text-[#e0e4f0] border border-[#1e1e3a] hover:bg-[#1a1a3a]/50`,
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
