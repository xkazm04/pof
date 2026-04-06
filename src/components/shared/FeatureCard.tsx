'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  STATUS_SUCCESS, STATUS_NEUTRAL, OVERLAY_WHITE,
  OPACITY_8, OPACITY_20, OPACITY_30, OPACITY_50, OPACITY_90,
  withOpacity,
} from '@/lib/chart-colors';

interface FeatureCardProps {
  /** Feature name displayed at the top */
  name: string;
  /** Whether the feature is currently active/enabled */
  active: boolean;
  /** Called when the card is clicked */
  onToggle: () => void;
  /** Accent color for active state */
  accent: string;
  /** Optional metric or content area */
  children?: ReactNode;
  /** Optional short summary shown below name */
  summary?: string;
}

export function FeatureCard({ name, active, onToggle, accent, children, summary }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="relative text-left rounded-lg border p-3 cursor-pointer transition-all duration-150 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-0"
      style={{
        backgroundColor: active ? withOpacity(accent, OPACITY_8) : 'transparent',
        borderColor: active ? withOpacity(accent, OPACITY_30) : withOpacity(STATUS_NEUTRAL, OPACITY_20),
        opacity: active ? 1 : 0.65,
        '--tw-ring-color': withOpacity(accent, OPACITY_50),
      } as CSSProperties}
    >
      {/* Feature name */}
      <span
        className="block text-xs font-mono font-bold truncate"
        style={{ color: active ? withOpacity(OVERLAY_WHITE, OPACITY_90) : STATUS_NEUTRAL }}
      >
        {name}
      </span>

      {/* Summary */}
      {summary && (
        <span
          className="block text-[10px] font-mono truncate leading-tight mt-0.5"
          style={{ color: active ? withOpacity(OVERLAY_WHITE, OPACITY_50) : STATUS_NEUTRAL }}
        >
          {summary}
        </span>
      )}

      {/* Metric content area (render prop children) */}
      {children && (
        <div className="mt-2" style={{ filter: active ? 'none' : 'saturate(0.3)' }}>
          {children}
        </div>
      )}

      {/* Status dot — bottom-right (decorative) */}
      <span
        aria-hidden="true"
        className="absolute bottom-2 right-2 w-2 h-2 rounded-full transition-colors duration-150"
        style={{ backgroundColor: active ? STATUS_SUCCESS : withOpacity(STATUS_NEUTRAL, OPACITY_50) }}
      />
    </button>
  );
}
