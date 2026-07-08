'use client';

import { Zap } from 'lucide-react';
import { OPACITY_15 } from '@/lib/chart-colors';

export function StatBadge({ icon: Icon, label, value, color }: { icon: typeof Zap; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5 rounded-md" style={{ backgroundColor: `${color}${OPACITY_15}` }}>
      <div className="flex items-center gap-1">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
      </div>
      <span className="text-2xs text-text-muted mt-0.5">{label}</span>
    </div>
  );
}
