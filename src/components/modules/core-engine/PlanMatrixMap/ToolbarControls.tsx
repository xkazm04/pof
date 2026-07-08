'use client';

import { ZoomIn, Link2 } from 'lucide-react';
import { MODULE_COLORS, OPACITY_20, withOpacity } from '@/lib/chart-colors';

export function ToolbarBtn({ icon: Icon, onClick, title }: { icon: typeof ZoomIn; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 text-text-muted hover:text-text hover:bg-surface-hover rounded-full transition-colors">
      <Icon className="w-4 h-4" />
    </button>
  );
}

export function ToggleBtn({ icon: Icon, active, onClick, label }: { icon: typeof Link2; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        active
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
      }`}
      style={active ? { boxShadow: `0 0 10px ${withOpacity(MODULE_COLORS.core, OPACITY_20)}` } : undefined}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
