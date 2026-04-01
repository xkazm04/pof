'use client';

import type { LucideIcon } from 'lucide-react';
import { OPACITY_5, withOpacity } from '@/lib/chart-colors';
import { Button } from '@/components/ui/Button';

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
        style={{ backgroundColor: iconColor ? withOpacity(iconColor, OPACITY_5) : undefined }}
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
            <Button
              type="button"
              variant="outline"
              size="lg"
              accentColor={action.color}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
