'use client';

import type { LucideIcon } from 'lucide-react';
import { OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_30, withOpacity } from '@/lib/chart-colors';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional accent color for icon (defaults to border-bright) */
  iconColor?: string;
  /**
   * Optional satellite icons rendered at the top-left and bottom-right
   * corners of the icon tile. When provided, the tile switches to the larger
   * `w-16 h-16 rounded-2xl` "illustration block" composition used across the
   * Game Director module. Order: [bottomRight, topLeft].
   */
  satelliteIcons?: [LucideIcon, LucideIcon];
  /** Primary CTA */
  action?: {
    label: string;
    onClick: () => void;
    color?: string;
    icon?: LucideIcon;
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
  satelliteIcons,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const ActionIcon = action?.icon;
  const [SatelliteBR, SatelliteTL] = satelliteIcons ?? [];
  const accent = iconColor ?? 'var(--border-bright)';

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {satelliteIcons ? (
        <div className="relative w-16 h-16 mb-5">
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              backgroundColor: iconColor ? withOpacity(iconColor, OPACITY_8) : undefined,
              border: iconColor ? `1px solid ${withOpacity(iconColor, OPACITY_15)}` : undefined,
            }}
          />
          <Icon
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7"
            style={{ color: accent }}
          />
          {SatelliteBR && (
            <SatelliteBR className="absolute -bottom-1 -right-1 w-5 h-5 opacity-50" style={{ color: accent }} />
          )}
          {SatelliteTL && (
            <SatelliteTL className="absolute -top-1 -left-1 w-4 h-4 opacity-30" style={{ color: accent }} />
          )}
        </div>
      ) : (
        <div
          className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4"
          style={{ backgroundColor: iconColor ? withOpacity(iconColor, OPACITY_5) : undefined }}
        >
          <Icon className="w-6 h-6" style={{ color: accent }} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-muted max-w-xs leading-relaxed">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-4">
          {action && (
            satelliteIcons && (action.color ?? iconColor) ? (
              <button
                type="button"
                onClick={action.onClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: withOpacity(action.color ?? iconColor!, OPACITY_15),
                  color: action.color ?? iconColor,
                  border: `1px solid ${withOpacity(action.color ?? iconColor!, OPACITY_30)}`,
                }}
              >
                {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
                {action.label}
              </button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                accentColor={action.color}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
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
