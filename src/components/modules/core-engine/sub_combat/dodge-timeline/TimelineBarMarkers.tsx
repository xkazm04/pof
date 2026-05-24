'use client';

import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET,
  ACCENT_EMERALD, STATUS_ERROR,
  withOpacity, OPACITY_20, OPACITY_37,
} from '@/lib/chart-colors';
import type { DodgePhases, HitMarker } from '../_shared/dodge-types';

/* ── Hit marker dots ────────────────────────────────────────────────────── */

export function HitMarkerDots({ hitMarkers, phases, totalTime }: {
  hitMarkers: HitMarker[];
  phases: DodgePhases;
  totalTime: number;
}) {
  return (
    <>
      {hitMarkers.map((hit) => {
        const left = (hit.time / totalTime) * 100;
        const iFrameActive = hit.time >= phases.invuln.start && hit.time < phases.invuln.end;
        const dotColor = iFrameActive ? ACCENT_EMERALD : STATUS_ERROR;
        return (
          <div
            key={hit.id}
            className="absolute top-0 h-full flex items-center justify-center z-10"
            style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
            title={`${hit.label}: ${hit.damage} dmg @ ${hit.time.toFixed(2)}s ${iFrameActive ? '(DODGED)' : '(HIT!)'}`}
          >
            <div
              className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
              style={{
                backgroundColor: `${withOpacity(dotColor, OPACITY_20)}`,
                borderColor: dotColor,
                boxShadow: `0 0 6px ${withOpacity(dotColor, OPACITY_37)}`,
              }}
            >
              <span className="text-[6px] font-bold" style={{ color: dotColor }}>
                {iFrameActive ? '✓' : '!'}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ── Time labels row ───────────────────────────────────────────────────── */

export function TimeLabels({ phases, totalTime }: { phases: DodgePhases; totalTime: number }) {
  return (
    <div className="flex justify-between text-xs font-mono text-text-muted px-0.5">
      <span>0s</span>
      <span style={{ color: ACCENT_ORANGE }}>{phases.invuln.end.toFixed(2)}s</span>
      <span style={{ color: ACCENT_VIOLET }}>{phases.cancel.start.toFixed(2)}s</span>
      <span style={{ color: ACCENT_CYAN }}>{phases.movement.end.toFixed(2)}s</span>
      <span>{totalTime.toFixed(2)}s</span>
    </div>
  );
}
