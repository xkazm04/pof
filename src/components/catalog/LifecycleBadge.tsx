'use client';

import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_NEUTRAL,
  withOpacity, OPACITY_15,
} from '@/lib/chart-colors';
import type { LifecycleState } from '@/lib/catalog/types';

const LIFECYCLE_COLOR: Record<LifecycleState, string> = {
  planned: STATUS_NEUTRAL,
  scaffolded: STATUS_INFO,
  generated: STATUS_INFO,
  wired: STATUS_WARNING,
  verified: STATUS_SUCCESS,
  failed: STATUS_ERROR,
};

export function LifecycleBadge({ state }: { state: LifecycleState }) {
  const color = LIFECYCLE_COLOR[state];
  return (
    <span
      className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded capitalize"
      style={{ backgroundColor: withOpacity(color, OPACITY_15), color }}
    >
      {state}
    </span>
  );
}
