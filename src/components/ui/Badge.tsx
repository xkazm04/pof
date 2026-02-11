'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

const variantClasses = {
  default: 'text-[#6b7294] bg-[#1a1a3a] border-[#2e2e5a]',
  success: 'text-green-400 bg-green-400/10 border-green-400/20',
  warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  error: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
