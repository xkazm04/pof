'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { OPACITY_10, withOpacity } from '@/lib/chart-colors';

interface SelectorGroupHeaderProps {
  label: string;
  count: number;
  accent: string;
  expanded: boolean;
}

/** Stateless group header — collapse state is managed by the parent grid. */
export function SelectorGroupHeader({
  label,
  count,
  accent,
  expanded,
}: SelectorGroupHeaderProps) {
  const Icon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md hover:bg-surface-hover transition-colors cursor-pointer select-none">
      <Icon size={14} style={{ color: accent }} />
      <span className="text-xs font-semibold text-text-muted truncate">
        {label}
      </span>
      <span
        className="ml-auto text-2xs font-mono rounded-full px-1.5 py-0.5"
        style={{
          backgroundColor: withOpacity(accent, OPACITY_10),
          color: accent,
        }}
      >
        {count}
      </span>
    </div>
  );
}
