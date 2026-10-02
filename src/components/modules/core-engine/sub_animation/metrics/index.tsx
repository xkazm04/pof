'use client';

import { useMemo, type ReactNode } from 'react';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
import { useManifest } from '@/hooks/useManifest';
import {
  readAnimMetrics, isAnimMetricId, type AnimMetricId, type AnimMetricReading,
} from '@/lib/animation/anim-metric-readings';
import { ACCENT } from '../_shared/data';

/**
 * Feature Map tiles for the Animation module. Each tile is ONE reading of the
 * PoF bridge manifest (`readAnimMetrics`): a measured value with its source, a
 * declared target, or 'unread' with the reason — never a fixture count.
 */

/** The noun after a measured value. */
const UNIT: Record<AnimMetricId, string> = {
  states: 'states',
  transitions: 'transitions',
  heatmap: 'transitions',
  chain: 'sectioned combos',
  montages: 'montages',
  scrubber: 'notifies',
  skeleton: 'bones',
  trajectories: 'root motion clips',
  assets: 'anim assets',
  playrate: 'play rates',
};

const muted = withOpacity(ACCENT, OPACITY_50);

function ReadingView({ id, reading }: { id: AnimMetricId; reading: AnimMetricReading }) {
  if (reading.kind === 'unread') {
    return (
      <div className="text-xs font-mono leading-tight" title={reading.reason}>
        <span className="font-bold" style={{ color: ACCENT }}>unread</span>
        <span style={{ color: muted }}> {reading.reason}</span>
      </div>
    );
  }
  const title = reading.kind === 'measured'
    ? `Read from ${reading.projectName ?? 'the project'} via the PoF bridge manifest`
    : 'Declared target, not a measurement';
  return (
    <div className="text-xs font-mono leading-tight" title={title}>
      <span className="font-bold" style={{ color: ACCENT }}>{reading.value}</span>
      <span style={{ color: muted }}>
        {reading.kind === 'measured' ? ` ${UNIT[id]}` : ''}
        {reading.detail ? ` · ${reading.detail}` : ''}
      </span>
    </div>
  );
}

function AnimMetric({ id }: { id: AnimMetricId }) {
  const { manifest, isConnected } = useManifest();
  const readings = useMemo(() => readAnimMetrics(manifest, isConnected), [manifest, isConnected]);
  return <ReadingView id={id} reading={readings[id]} />;
}

export function renderAnimMetric(sectionId: string): ReactNode {
  return isAnimMetricId(sectionId) ? <AnimMetric id={sectionId} /> : null;
}
