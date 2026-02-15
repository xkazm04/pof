'use client';

import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional accent color for icon (defaults to border-bright) */
  iconColor?: string;
  /** Primary CTA */
  action?: {
    label: string;
    onClick: () => void;
    color?: string;
  };
  /** Optional secondary CTA */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  iconColor,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      <div
        className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4"
        style={{ backgroundColor: iconColor ? `${iconColor}10` : undefined }}
      >
        <Icon
          className="w-6 h-6"
          style={{ color: iconColor ?? 'var(--border-bright)' }}
        />
      </div>
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-muted text-center max-w-xs leading-relaxed">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-4">
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: action.color ? `${action.color}14` : 'var(--accent-medium)',
                color: action.color ?? '#00ff88',
                border: `1px solid ${action.color ? `${action.color}38` : 'var(--accent-strong)'}`,
              }}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-lg text-xs font-medium text-text-muted border border-border hover:text-text hover:border-border-bright transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
