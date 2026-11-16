'use client';

import { AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';

/** The one clutter band, shared by this badge and the Clutter metric tile. */
export function clutterBand(score: number): { color: string; label: string } {
  if (score < 30) return { color: STATUS_SUCCESS, label: 'Clear' };
  if (score < 60) return { color: STATUS_WARNING, label: 'Busy' };
  return { color: STATUS_ERROR, label: 'Cluttered' };
}

export function ClutterBadge({ score }: { score: number }) {
  const { color, label } = clutterBand(score);
  return (
    <span className="flex items-center gap-1 text-2xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>
      {score >= 60 && <AlertTriangle className="w-2.5 h-2.5" />}
      {label} ({score})
    </span>
  );
}
