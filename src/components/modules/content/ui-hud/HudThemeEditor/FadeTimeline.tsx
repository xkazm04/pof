'use client';

import { STATUS_SUCCESS, ACCENT_CYAN, ACCENT_VIOLET } from '@/lib/chart-colors';
import type { HudTheme } from './types';

// ── Fade Timeline sub-component ────────────────────────────────────────────

export function FadeTimeline({ theme }: { theme: HudTheme }) {
  const totalDuration = theme.fadeInDuration + theme.fadeOutDelay + theme.fadeOutDuration;
  const fadeInEnd = (theme.fadeInDuration / totalDuration) * 100;
  const visibleEnd = ((theme.fadeInDuration + theme.fadeOutDelay) / totalDuration) * 100;

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
      {/* Fade-in ramp */}
      <polygon
        points={`0,40 ${fadeInEnd},0 ${fadeInEnd},40`}
        fill={`${STATUS_SUCCESS}30`}
        stroke={STATUS_SUCCESS}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Visible plateau */}
      <rect
        x={fadeInEnd}
        y={0}
        width={visibleEnd - fadeInEnd}
        height={40}
        fill={`${ACCENT_CYAN}20`}
        stroke={ACCENT_CYAN}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Fade-out ramp */}
      <polygon
        points={`${visibleEnd},0 ${visibleEnd},40 100,40`}
        fill={`${ACCENT_VIOLET}30`}
        stroke={ACCENT_VIOLET}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Labels */}
      <text x={fadeInEnd / 2} y={25} textAnchor="middle" fontSize="5" fill={STATUS_SUCCESS} fontFamily="monospace">
        {theme.fadeInDuration.toFixed(2)}s
      </text>
      <text x={(fadeInEnd + visibleEnd) / 2} y={25} textAnchor="middle" fontSize="5" fill={ACCENT_CYAN} fontFamily="monospace">
        {theme.fadeOutDelay.toFixed(1)}s
      </text>
      <text x={(visibleEnd + 100) / 2} y={25} textAnchor="middle" fontSize="5" fill={ACCENT_VIOLET} fontFamily="monospace">
        {theme.fadeOutDuration.toFixed(2)}s
      </text>
    </svg>
  );
}
