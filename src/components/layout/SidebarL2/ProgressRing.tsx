'use client';

import { memo } from 'react';
import { Check } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';
import {
  RING_SIZE,
  RING_STROKE,
  RING_RADIUS,
  RING_CIRCUMFERENCE,
  WIDE_SIDEBAR_THRESHOLD,
} from './constants';

export const ProgressRing = memo(function ProgressRing({
  moduleId,
  accentColor,
  sidebarWidth = 0,
}: {
  moduleId: SubModuleId;
  accentColor: string;
  sidebarWidth?: number;
}) {
  const progress = useModuleStore((s) => s.checklistProgress[moduleId]);
  const mod = SUB_MODULE_MAP[moduleId];
  const total = mod?.checklist?.length ?? 0;

  // No checklist → no ring, show nothing
  if (total === 0) return null;

  // progress === undefined means data hasn't loaded yet
  const isLoading = progress === undefined;
  const completed = progress
    ? Object.values(progress).filter(Boolean).length
    : 0;
  const pct = isLoading ? 0 : Math.min(completed / total, 1);
  const pctInt = Math.round(pct * 100);
  const dashOffset = isLoading
    ? RING_CIRCUMFERENCE * 0.75
    : RING_CIRCUMFERENCE * (1 - pct);

  const tooltipText = isLoading
    ? 'Loading…'
    : `${completed}/${total} complete (${pctInt}%)`;
  const showInlineCount = sidebarWidth > WIDE_SIDEBAR_THRESHOLD && !isLoading;

  // 100% complete → checkmark
  if (!isLoading && pct >= 1) {
    return (
      <div
        className="ml-auto flex-shrink-0 flex items-center gap-1.5"
        title={tooltipText}
      >
        {showInlineCount && (
          <span className="text-2xs text-text-muted whitespace-nowrap">{completed}/{total}</span>
        )}
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}24` }}
          role="progressbar"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${mod?.label ?? moduleId}: complete`}
        >
          <Check className="w-2.5 h-2.5" style={{ color: accentColor }} strokeWidth={3} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="ml-auto flex-shrink-0 flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={isLoading ? undefined : pctInt}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={
        isLoading
          ? `${mod?.label ?? moduleId}: loading progress`
          : `${mod?.label ?? moduleId}: ${pctInt}% complete`
      }
      title={tooltipText}
    >
      {showInlineCount && (
        <span className="text-2xs text-text-muted whitespace-nowrap">{completed}/{total}</span>
      )}
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth={RING_STROKE}
        />
        {/* Fill */}
        {(pct > 0 || isLoading) && (
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={accentColor}
            strokeWidth={RING_STROKE}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={isLoading ? 'animate-progress-spin' : ''}
            style={isLoading ? { opacity: 0.4 } : { transition: 'stroke-dashoffset 0.4s ease' }}
          />
        )}
      </svg>
    </div>
  );
});
