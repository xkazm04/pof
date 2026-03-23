'use client';

import { useMemo } from 'react';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import type { DodgeParams, DodgePhases } from '../dodge-types';
import { speedCurve } from '../dodge-math';

export function VelocityCurve({
  params,
  phases,
  playhead,
}: {
  params: DodgeParams;
  phases: DodgePhases;
  playhead: number;
}) {
  const maxSpeed = params.dodgeDistance / params.dodgeDuration;

  const curveD = useMemo(() => {
    return Array.from({ length: 51 }, (_, i) => {
      const frac = i / 50;
      const t = frac * phases.totalTimeline;
      const alpha = params.dodgeDuration > 0 ? Math.min(t / params.dodgeDuration, 1) : 0;
      const speed = t <= params.dodgeDuration ? speedCurve(alpha) : 0;
      const x = frac * 200;
      const y = 34 - speed * 30;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [params, phases.totalTimeline]);

  const playFrac = playhead / phases.totalTimeline;
  const playAlpha = params.dodgeDuration > 0 ? Math.min(playhead / params.dodgeDuration, 1) : 0;
  const playSpeed = playhead <= params.dodgeDuration ? speedCurve(playAlpha) * maxSpeed : 0;
  const playX = playFrac * 200;
  const playY = 34 - (playhead <= params.dodgeDuration ? speedCurve(playAlpha) * 30 : 0);

  return (
    <div>
      <svg width="100%" height={40} viewBox="0 0 200 40" preserveAspectRatio="none" className="overflow-visible">
        {/* Baseline */}
        <line x1={0} y1={34} x2={200} y2={34} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {/* Velocity curve */}
        <path
          d={curveD}
          fill="none" stroke={ACCENT_CYAN} strokeWidth="1.5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${ACCENT_CYAN}60)` }}
        />
        {/* Playhead dot */}
        <circle cx={playX} cy={Math.max(4, playY)} r={3} fill="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
      </svg>
      <div className="flex justify-between text-xs font-mono text-text-muted mt-0.5">
        <span style={{ color: ACCENT_CYAN }}>Velocity</span>
        <span className="font-bold" style={{ color: playSpeed > 0 ? ACCENT_CYAN : 'var(--text-muted)' }}>
          {playSpeed.toFixed(0)} UU/s
        </span>
      </div>
    </div>
  );
}
