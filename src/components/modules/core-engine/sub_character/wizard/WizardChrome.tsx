'use client';

import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import {
  MODULE_COLORS, OPACITY_12, OPACITY_20, OPACITY_30, withOpacity,
} from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.core;

export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold font-mono"
          style={{ backgroundColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}
        >
          {n}
        </span>
        <span className="text-xs font-semibold text-text">{title}</span>
      </div>
      <div className="flex flex-col gap-2 pl-7">{children}</div>
    </div>
  );
}

export function DispatchButton({
  onClick, isRunning, icon: Icon, label,
}: {
  onClick: () => void;
  isRunning: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRunning}
      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed w-fit"
      style={{ backgroundColor: withOpacity(ACCENT, OPACITY_12), border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}`, color: ACCENT }}
    >
      {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </button>
  );
}
