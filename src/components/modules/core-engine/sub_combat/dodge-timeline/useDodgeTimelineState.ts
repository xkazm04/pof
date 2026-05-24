import { useEffect, useMemo } from 'react';
import type { DodgeParams, DodgePhases, HitMarker } from '../_shared/dodge-types';
import { speedCurve, distanceCurve } from '../_shared/dodge-math';
import type { HapticEffect, PlayheadStats } from './types';

/**
 * Custom hooks extracted from dodge-timeline/index.tsx to keep that file under 200 LOC.
 */

export function useHapticDetection(
  playhead: number, hitMarkers: HitMarker[], params: DodgeParams,
  prevRef: React.MutableRefObject<number>,
  triggeredRef: React.MutableRefObject<Set<string>>,
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>,
  setEffect: (e: HapticEffect) => void,
) {
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = playhead;
    if (playhead <= prev) return;
    for (const hit of hitMarkers) {
      if (hit.time > prev && hit.time <= playhead && !triggeredRef.current.has(hit.id)) {
        triggeredRef.current.add(hit.id);
        const dodged = hit.time >= params.iFrameStart && hit.time < params.iFrameStart + params.iFrameDuration;
        clearTimeout(timerRef.current);
        setEffect({ type: dodged ? 'dodge' : 'hit', id: hit.id });
        timerRef.current = setTimeout(() => setEffect(null), dodged ? 500 : 400);
      }
    }
  }, [playhead, hitMarkers, params.iFrameStart, params.iFrameDuration, prevRef, triggeredRef, timerRef, setEffect]);
}

export function usePlayheadStats(playhead: number, params: DodgeParams, phases: DodgePhases, hitMarkers: HitMarker[]): PlayheadStats {
  return useMemo(() => {
    const t = playhead;
    const alpha = params.dodgeDuration > 0 ? Math.min(t / params.dodgeDuration, 1) : 0;
    const maxSpeed = params.dodgeDistance / params.dodgeDuration;
    const speed = t <= params.dodgeDuration ? speedCurve(alpha) * maxSpeed : 0;
    const dist = t <= params.dodgeDuration ? distanceCurve(alpha) * params.dodgeDistance : params.dodgeDistance;
    return {
      speed, dist,
      inMovement: t >= phases.movement.start && t < phases.movement.end,
      inInvuln: t >= phases.invuln.start && t < phases.invuln.end,
      inCancel: t >= phases.cancel.start && t < phases.cancel.end,
      inCooldown: t >= phases.recovery.start,
      dodgedHits: hitMarkers.filter((h) => h.time >= phases.invuln.start && h.time < phases.invuln.end).length,
      totalHits: hitMarkers.length,
    };
  }, [playhead, params, phases, hitMarkers]);
}
