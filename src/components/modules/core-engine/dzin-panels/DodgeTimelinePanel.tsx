'use client';

import { Shield, Timer } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, OPACITY_15 } from '@/lib/chart-colors';

/* -- Props ----------------------------------------------------------------- */

export interface DodgeTimelinePanelProps {
  featureMap: Map<string, unknown>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* -- Constants -------------------------------------------------------------- */

const ACCENT = MODULE_COLORS.core;

const DODGE_MOVES = [
  { name: 'Quick Step', iFrameStart: 2, iFrameEnd: 8, recoveryStart: 9, recoveryEnd: 18, totalFrames: 24, cancelPoint: 14, hasHitMarker: false },
  { name: 'Roll Dodge', iFrameStart: 3, iFrameEnd: 14, recoveryStart: 15, recoveryEnd: 28, totalFrames: 32, cancelPoint: 22, hasHitMarker: true },
  { name: 'Backstep', iFrameStart: 1, iFrameEnd: 6, recoveryStart: 7, recoveryEnd: 20, totalFrames: 26, cancelPoint: 16, hasHitMarker: false },
  { name: 'Dash Cancel', iFrameStart: 4, iFrameEnd: 10, recoveryStart: 11, recoveryEnd: 16, totalFrames: 20, cancelPoint: 12, hasHitMarker: false },
  { name: 'Perfect Dodge', iFrameStart: 1, iFrameEnd: 12, recoveryStart: 13, recoveryEnd: 22, totalFrames: 28, cancelPoint: 18, hasHitMarker: true },
] as const;

/* -- Micro density --------------------------------------------------------- */

function TimelineMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Shield className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{DODGE_MOVES.length} dodges</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function TimelineCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      <div className="flex items-center justify-between text-text-muted mb-1">
        <span>Dodge Moves</span>
        <span className="font-mono text-text">{DODGE_MOVES.length} moves</span>
      </div>
      {DODGE_MOVES.map((d) => (
        <div key={d.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_SUCCESS }}
          />
          <span className="text-text-muted flex-1 truncate">{d.name}</span>
          <span className="font-mono text-text">f{d.iFrameStart}-{d.iFrameEnd}</span>
        </div>
      ))}
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function TimelineFull() {
  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Dodge chain timeline with i-frame windows, recovery phases, cancel points, and hit markers.
      </SurfaceCard>

      {/* Timeline Bars */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Shield} label="I-Frame Timeline" color={ACCENT} />
        <div className="space-y-3 mt-2">
          {DODGE_MOVES.map((dodge, i) => {
            const iFramePct = ((dodge.iFrameEnd - dodge.iFrameStart) / dodge.totalFrames) * 100;
            const iFrameOffset = (dodge.iFrameStart / dodge.totalFrames) * 100;
            const recoveryPct = ((dodge.recoveryEnd - dodge.recoveryStart) / dodge.totalFrames) * 100;
            const recoveryOffset = (dodge.recoveryStart / dodge.totalFrames) * 100;
            const cancelPct = (dodge.cancelPoint / dodge.totalFrames) * 100;
            return (
              <motion.div
                key={dodge.name}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text font-medium">{dodge.name}</span>
                  <span className="text-text-muted font-mono">{dodge.totalFrames}f total</span>
                </div>
                <div className="relative h-4 rounded" style={{ backgroundColor: `${ACCENT}${OPACITY_15}` }}>
                  {/* I-frame window */}
                  <motion.div
                    className="absolute top-0 h-full rounded"
                    style={{ left: `${iFrameOffset}%`, backgroundColor: STATUS_SUCCESS }}
                    initial={{ width: 0 }}
                    animate={{ width: `${iFramePct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                  />
                  {/* Recovery window */}
                  <motion.div
                    className="absolute top-0 h-full rounded opacity-60"
                    style={{ left: `${recoveryOffset}%`, backgroundColor: STATUS_WARNING }}
                    initial={{ width: 0 }}
                    animate={{ width: `${recoveryPct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.06 + 0.1 }}
                  />
                  {/* Cancel point marker */}
                  <div
                    className="absolute top-0 h-full w-0.5"
                    style={{ left: `${cancelPct}%`, backgroundColor: STATUS_INFO }}
                  />
                  {/* Hit marker */}
                  {dodge.hasHitMarker && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border"
                      style={{ right: '4px', backgroundColor: STATUS_WARNING, borderColor: STATUS_WARNING }}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Frame Data Table */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Timer} label="Frame Data" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {DODGE_MOVES.map((dodge, i) => (
            <motion.div
              key={dodge.name}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="text-text flex-1 truncate font-medium">{dodge.name}</span>
              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}`, color: STATUS_SUCCESS }}>
                i:{dodge.iFrameEnd - dodge.iFrameStart}f
              </span>
              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_15}`, color: STATUS_WARNING }}>
                rec:{dodge.recoveryEnd - dodge.recoveryStart}f
              </span>
              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_INFO}${OPACITY_15}`, color: STATUS_INFO }}>
                @{dodge.cancelPoint}f
              </span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* -- Main ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DodgeTimelinePanel({ featureMap, defs }: DodgeTimelinePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Dodge Timeline" icon={<Shield className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <TimelineMicro />}
          {density === 'compact' && <TimelineCompact />}
          {density === 'full' && <TimelineFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
