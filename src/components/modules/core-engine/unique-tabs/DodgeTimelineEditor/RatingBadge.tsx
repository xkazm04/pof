'use client';

import { OPACITY_10, OPACITY_20 } from '@/lib/chart-colors';
import { type Rating, RATING_STYLES } from './types';

export function RatingBadge({ rating }: { rating: Rating }) {
  const { color, label } = RATING_STYLES[rating];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-[0.15em]"
      style={{
        color,
        backgroundColor: `${color}${OPACITY_10}`,
        border: `1px solid ${color}${OPACITY_20}`,
        textShadow: `0 0 8px ${color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
      />
      {label}
    </span>
  );
}
