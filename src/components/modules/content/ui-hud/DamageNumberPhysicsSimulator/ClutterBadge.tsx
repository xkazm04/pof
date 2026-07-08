'use client';

import { AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';

export function ClutterBadge({ score }: { score: number }) {
  const color = score < 30 ? STATUS_SUCCESS : score < 60 ? STATUS_WARNING : STATUS_ERROR;
  const label = score < 30 ? 'Clear' : score < 60 ? 'Busy' : 'Cluttered';
  return (
    <span className="flex items-center gap-1 text-2xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>
      {score >= 60 && <AlertTriangle className="w-2.5 h-2.5" />}
      {label} ({score})
    </span>
  );
}
