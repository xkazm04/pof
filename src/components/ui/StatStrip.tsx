'use client';

import { OPACITY_15, withOpacity } from '@/lib/chart-colors';

interface StatItem {
  label: string;
  value: string | number;
  color?: string;
  /** Optional inline sparkline data points (0-1 normalized) */
  spark?: number[];
}

interface StatStripProps {
  stats: StatItem[];
  className?: string;
}

/**
 * Compact inline metrics strip with optional mini sparklines.
 * Use at the top of sections for at-a-glance KPIs.
 */
export function StatStrip({ stats, className = '' }: StatStripProps) {
  return (
    <div className={`flex items-center gap-4 text-xs font-mono ${className}`}>
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex items-center gap-2">
          {i > 0 && <div className="w-[1px] h-3 bg-border/40" />}
          <span className="text-text-muted uppercase tracking-wider text-[9px]">{stat.label}</span>
          <span
            className="font-bold tabular-nums"
            style={stat.color ? { color: stat.color, textShadow: `0 0 12px ${withOpacity(stat.color, OPACITY_15)}` } : { color: 'var(--text)' }}
          >
            {stat.value}
          </span>
          {stat.spark && stat.spark.length >= 2 && (
            <MiniSparkline data={stat.spark} color={stat.color ?? 'var(--text-muted)'} />
          )}
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ data, color, width = 32, height = 10 }: { data: number[]; color: string; width?: number; height?: number }) {
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - v * (height - 1) - 0.5}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 2px ${color})` }}
      />
    </svg>
  );
}
