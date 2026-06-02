'use client';

import type { LucideIcon } from 'lucide-react';
import { Loader2, Check, Lock, AlertTriangle } from 'lucide-react';
import {
  MODULE_COLORS, OPACITY_12, OPACITY_20, OPACITY_30, OPACITY_50, withOpacity,
} from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.core;
const DONE_COLOR = '#10b981';
const ERROR_COLOR = '#ef4444';

/** Lifecycle of a single wizard step's dispatched CLI task. */
export type WizardStepStatus = 'idle' | 'running' | 'done' | 'error';

export function Step({
  n, title, children, status = 'idle', locked = false,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  /** Drives the badge (running spinner / done check / error icon). */
  status?: WizardStepStatus;
  /** Dim + block interaction until prior steps complete. */
  locked?: boolean;
}) {
  const running = status === 'running';
  const done = status === 'done';
  const error = status === 'error';
  const badgeColor = done ? DONE_COLOR : error ? ERROR_COLOR : ACCENT;

  return (
    <div
      className="flex flex-col gap-2 transition-opacity duration-200"
      style={{ opacity: locked ? 0.45 : 1 }}
      aria-disabled={locked || undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold font-mono"
          style={{ backgroundColor: withOpacity(badgeColor, OPACITY_20), color: badgeColor }}
        >
          {locked ? <Lock className="w-3 h-3" />
            : running ? <Loader2 className="w-3 h-3 animate-spin" />
            : done ? <Check className="w-3 h-3" />
            : error ? <AlertTriangle className="w-3 h-3" />
            : n}
        </span>
        <span className="text-xs font-semibold text-text">{title}</span>
      </div>
      <div
        className="flex flex-col gap-2 pl-7"
        style={locked ? { pointerEvents: 'none' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Top progress rail: "Step X of N" plus one connected segment per step,
 * lit for completed/active steps so the user can see how far they are.
 */
export function StepRail({ steps }: { steps: WizardStepStatus[] }) {
  const doneCount = steps.filter((s) => s === 'done').length;
  const current = Math.min(doneCount + 1, steps.length);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-mono text-text-muted">Step {current} of {steps.length}</span>
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const done = s === 'done';
          const active = i + 1 === current;
          const color = done ? DONE_COLOR : s === 'error' ? ERROR_COLOR : ACCENT;
          return (
            <span
              key={i}
              className="h-1.5 rounded-full flex-1 transition-all duration-200"
              style={{ backgroundColor: withOpacity(color, done || active ? OPACITY_50 : OPACITY_12) }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DispatchButton({
  onClick, isRunning, icon: Icon, label, disabled = false,
}: {
  onClick: () => void;
  isRunning: boolean;
  icon: LucideIcon;
  label: string;
  /** External gate (e.g. step locked) — disables without showing the spinner. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRunning || disabled}
      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed w-fit"
      style={{ backgroundColor: withOpacity(ACCENT, OPACITY_12), border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}`, color: ACCENT }}
    >
      {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </button>
  );
}
