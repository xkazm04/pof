'use client';

import { MODULE_COLORS } from '@/lib/chart-colors';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  label?: string;
  isLoading?: boolean;
}

export function ProgressRing({ value, size = 48, strokeWidth = 4, color = MODULE_COLORS.setup, className = '', label, isLoading }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = isLoading ? circumference * 0.75 : circumference - (value / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      role="progressbar"
      aria-valuenow={isLoading ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${value}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-slow ${isLoading ? 'animate-progress-spin' : ''}`}
        />
      </svg>
      {isLoading ? (
        <span className="absolute text-xs font-semibold animate-pulse" style={{ color }}>…</span>
      ) : (
        <span className="absolute text-xs font-semibold" style={{ color }}>{value}</span>
      )}
    </div>
  );
}
