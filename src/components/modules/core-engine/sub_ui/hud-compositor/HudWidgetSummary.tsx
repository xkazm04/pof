'use client';

import { Eye } from 'lucide-react';
import { OPACITY_30, OPACITY_8, withOpacity } from '@/lib/chart-colors';

interface HudWidgetSummaryProps {
  visible: string[];
  hidden: string[];
  contextColor: string;
}

export function HudWidgetSummary({ visible, hidden, contextColor }: HudWidgetSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-2.5">
      <div className="bg-surface/50 p-2 rounded-md border border-border/30">
        <div className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted mb-1 flex items-center gap-1">
          <Eye className="w-2.5 h-2.5" /> Visible
        </div>
        <div className="flex flex-wrap gap-1">
          {visible.map(w => (
            <span
              key={w}
              className="px-1.5 py-0.5 text-xs font-mono rounded border"
              style={{
                color: contextColor,
                backgroundColor: `${withOpacity(contextColor, OPACITY_8)}`,
                borderColor: `${contextColor}${OPACITY_30}`,
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
      <div className="bg-surface/50 p-2 rounded-md border border-border/30">
        <div className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted mb-1 flex items-center gap-1 opacity-60">
          <Eye className="w-2.5 h-2.5" /> Hidden
        </div>
        <div className="flex flex-wrap gap-1">
          {hidden.map(w => (
            <span key={w} className="px-1.5 py-0.5 text-xs font-mono text-text-muted opacity-50 rounded border border-border/30">
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
