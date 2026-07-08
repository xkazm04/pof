'use client';

import { Activity } from 'lucide-react';

export function QuickNavCard({
  label,
  icon: Icon,
  color,
  sub,
  onClick,
}: {
  label: string;
  icon: typeof Activity;
  color: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-border bg-surface p-3 transition-all hover:border-border-bright hover:bg-[#15152e] group"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 transition-colors group-hover:brightness-125" style={{ color }} />
        <span className="text-xs font-semibold text-text">{label}</span>
      </div>
      <span className="text-xs text-text-muted">{sub}</span>
    </button>
  );
}
