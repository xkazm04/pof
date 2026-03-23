'use client';

import { useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET,
  ACCENT_EMERALD, STATUS_ERROR, OVERLAY_WHITE,
} from '@/lib/chart-colors';
import type { DodgePhases, Phase, HitMarker } from '../dodge-types';
import type { HapticEffect } from './types';

export function TimelineBar({
  phases,
  playhead,
  hitMarkers,
  totalTime,
  onScrub,
  hapticEffect,
}: {
  phases: DodgePhases;
  playhead: number;
  hitMarkers: HitMarker[];
  totalTime: number;
  onScrub: (t: number) => void;
  hapticEffect?: HapticEffect;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleInteraction = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrub(pct * totalTime);
  }, [totalTime, onScrub]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) handleInteraction(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [handleInteraction]);

  const phaseBars: Phase[] = [phases.movement, phases.invuln, phases.cancel, phases.recovery];

  const isDodgeHaptic = hapticEffect?.type === 'dodge';
  const isHitHaptic = hapticEffect?.type === 'hit';

  return (
    <div className="space-y-1">
      <div
        ref={barRef}
        className="relative h-8 rounded-md overflow-hidden cursor-pointer select-none"
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: `1px solid ${isDodgeHaptic ? ACCENT_EMERALD : isHitHaptic ? STATUS_ERROR : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isDodgeHaptic
            ? `0 0 12px ${ACCENT_EMERALD}50, inset 0 0 8px ${ACCENT_EMERALD}15`
            : isHitHaptic
              ? `0 0 16px ${STATUS_ERROR}60, inset 0 0 10px ${STATUS_ERROR}20`
              : 'none',
          transform: isHitHaptic ? 'translateX(2px)' : 'none',
          transition: isDodgeHaptic
            ? 'border-color 0.1s ease-out, box-shadow 0.1s ease-out'
            : isHitHaptic
              ? 'border-color 0.05s, box-shadow 0.05s'
              : 'border-color 0.3s ease-out, box-shadow 0.3s ease-out, transform 0.05s',
          animation: isHitHaptic ? 'dodge-hit-shake 0.15s ease-in-out 0s 2' : 'none',
        }}
        onMouseDown={(e) => { dragging.current = true; handleInteraction(e.clientX); }}
      >
        {/* Haptic flash overlay */}
        <AnimatePresence>
          {hapticEffect && (
            <motion.div
              key={hapticEffect.id}
              className="absolute inset-0 z-30 pointer-events-none rounded-md"
              initial={{ opacity: isDodgeHaptic ? 0.35 : 0.5 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: isDodgeHaptic ? 0.45 : 0.3 }}
              style={{
                background: isDodgeHaptic
                  ? `linear-gradient(90deg, transparent, ${ACCENT_EMERALD}30, transparent)`
                  : `linear-gradient(90deg, ${STATUS_ERROR}40, transparent 30%, transparent 70%, ${STATUS_ERROR}40)`,
              }}
            />
          )}
        </AnimatePresence>

        {/* Phase segments */}
        {phaseBars.map((phase) => {
          const left = (phase.start / totalTime) * 100;
          const width = ((phase.end - phase.start) / totalTime) * 100;
          const isInvuln = phase.label === 'I-Frames';
          const isCancel = phase.label === 'Cancel';
          return (
            <div
              key={phase.label}
              className={`absolute top-0 h-full ${isInvuln ? 'phase-iframe-pulse' : isCancel ? 'phase-cancel-spark' : ''}`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: isInvuln || isCancel ? 'transparent' : `${phase.color}25`,
                borderBottom: `2px solid ${phase.color}`,
                ...(isCancel ? { borderTop: `2px solid ${phase.color}`, borderBottom: 'none' } : {}),
                ...(isInvuln || isCancel ? {
                  '--phase-color-10': `${phase.color}1a`,
                  '--phase-color-18': `${phase.color}2e`,
                  '--phase-color-20': `${phase.color}33`,
                  '--phase-color-25': `${phase.color}40`,
                  '--phase-color-30': `${phase.color}4d`,
                } as React.CSSProperties : {}),
              }}
            />
          );
        })}

        {/* Phase boundary markers */}
        {[phases.invuln.end, phases.cancel.start, phases.movement.end].map((t, i) => (
          <div
            key={`boundary-${i}`}
            className="absolute top-0 h-full w-px"
            style={{ left: `${(t / totalTime) * 100}%`, backgroundColor: 'rgba(255,255,255,0.15)' }}
          />
        ))}

        {/* Hit markers */}
        <HitMarkerDots hitMarkers={hitMarkers} phases={phases} totalTime={totalTime} />

        {/* Playhead */}
        <motion.div
          className="absolute top-0 h-full w-0.5 z-20"
          style={{
            left: `${(playhead / totalTime) * 100}%`,
            backgroundColor: OVERLAY_WHITE,
            boxShadow: '0 0 6px rgba(255,255,255,0.6)',
          }}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white rounded-sm" style={{ boxShadow: '0 0 4px rgba(255,255,255,0.8)' }} />
        </motion.div>
      </div>

      {/* Time labels */}
      <TimeLabels phases={phases} totalTime={totalTime} />
    </div>
  );
}

/* ── Hit marker dots (inline sub-component) ────────────────────────────── */

function HitMarkerDots({ hitMarkers, phases, totalTime }: {
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
                backgroundColor: `${dotColor}30`,
                borderColor: dotColor,
                boxShadow: `0 0 6px ${dotColor}60`,
              }}
            >
              <span className="text-[6px] font-bold" style={{ color: dotColor }}>
                {iFrameActive ? '\u2713' : '!'}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ── Time labels row ───────────────────────────────────────────────────── */

function TimeLabels({ phases, totalTime }: { phases: DodgePhases; totalTime: number }) {
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
