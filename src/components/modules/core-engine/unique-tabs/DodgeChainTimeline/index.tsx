'use client';

import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  STATUS_NEUTRAL, OVERLAY_WHITE,
  OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';
import { useScrubBar } from '@/hooks/useScrubBar';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { DodgeChainEntry } from '../dodge-types';
import { computePhases, getChainEndTime } from '../dodge-math';

/* ── Multi-Dodge Chain Visualization ──────────────────────────────────────── */

export function DodgeChainTimeline({
  chain,
  playhead,
  onScrub,
}: {
  chain: DodgeChainEntry[];
  playhead: number;
  onScrub: (t: number) => void;
}) {
  const totalChainTime = useMemo(() => getChainEndTime(chain), [chain]);
  const { barRef, onMouseDown } = useScrubBar(totalChainTime, onScrub);

  if (chain.length === 0) return null;

  // Stamina tracking
  const maxStamina = 100;
  let staminaRemaining = maxStamina;
  const staminaPoints: { t: number; stamina: number }[] = [{ t: 0, stamina: maxStamina }];
  for (const entry of chain) {
    staminaRemaining = Math.max(0, staminaRemaining - entry.params.staminaCost);
    staminaPoints.push({ t: entry.startTime, stamina: staminaRemaining });
    staminaPoints.push({ t: entry.startTime + 0.01, stamina: staminaRemaining });
  }
  staminaPoints.push({ t: totalChainTime, stamina: staminaRemaining });

  return (
    <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
      <SectionHeader icon={Zap} label={`Dodge Chain (${chain.length}× dodges)`} color={ACCENT_EMERALD} />

      {/* Chain timeline bar */}
      <div
        ref={barRef}
        className="relative h-10 rounded-md overflow-hidden cursor-pointer select-none"
        style={{ backgroundColor: `${OVERLAY_WHITE}${OPACITY_5}`, border: `1px solid ${OVERLAY_WHITE}${OPACITY_8}` }}
        onMouseDown={onMouseDown}
      >
        {chain.map((entry, i) => {
          const entryPhases = computePhases(entry.params);
          const leftPct = (entry.startTime / totalChainTime) * 100;
          const widthPct = (entryPhases.totalTimeline / totalChainTime) * 100;
          const mvPct = (entryPhases.movement.end / entryPhases.totalTimeline) * widthPct;
          const invStart = ((entry.startTime + entryPhases.invuln.start) / totalChainTime) * 100;
          const invWidth = ((entryPhases.invuln.end - entryPhases.invuln.start) / totalChainTime) * 100;

          return (
            <div key={entry.id}>
              {/* Movement phase */}
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${leftPct}%`,
                  width: `${mvPct}%`,
                  backgroundColor: `${ACCENT_CYAN}20`,
                  borderBottom: `2px solid ${ACCENT_CYAN}`,
                }}
              />
              {/* I-Frame overlay */}
              <div
                className="absolute top-0 h-full phase-iframe-pulse"
                style={{
                  left: `${invStart}%`,
                  width: `${invWidth}%`,
                  borderBottom: `2px solid ${ACCENT_ORANGE}`,
                  '--phase-color-10': `${ACCENT_ORANGE}1a`,
                  '--phase-color-18': `${ACCENT_ORANGE}2e`,
                  '--phase-color-20': `${ACCENT_ORANGE}33`,
                  '--phase-color-25': `${ACCENT_ORANGE}40`,
                  '--phase-color-30': `${ACCENT_ORANGE}4d`,
                } as React.CSSProperties}
              />
              {/* Cooldown */}
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${leftPct + mvPct}%`,
                  width: `${widthPct - mvPct}%`,
                  backgroundColor: `${STATUS_NEUTRAL}${OPACITY_10}`,
                  borderBottom: `2px solid ${STATUS_NEUTRAL}${OPACITY_30}`,
                }}
              />
              {/* Dodge number label */}
              <div
                className="absolute top-0.5 text-[10px] font-mono uppercase tracking-[0.15em] font-bold"
                style={{ left: `${leftPct + 1}%`, color: ACCENT_CYAN }}
              >
                #{i + 1}
              </div>
            </div>
          );
        })}

        {/* Stamina curve (bottom half) */}
        <svg className="absolute bottom-0 left-0 w-full h-3 overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${totalChainTime} ${maxStamina}`}>
          <path
            d={staminaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.t},${maxStamina - p.stamina}`).join(' ')}
            fill="none" stroke={ACCENT_EMERALD} strokeWidth={maxStamina * 0.05} strokeLinecap="round" opacity={0.6}
          />
        </svg>

        {/* Playhead */}
        <motion.div
          className="absolute top-0 h-full w-0.5 z-20"
          style={{
            left: `${(playhead / totalChainTime) * 100}%`,
            backgroundColor: OVERLAY_WHITE,
            boxShadow: `0 0 6px ${OVERLAY_WHITE}99`,
          }}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white rounded-sm"
            style={{ boxShadow: `0 0 4px ${OVERLAY_WHITE}cc` }} />
        </motion.div>
      </div>

      {/* Time labels + stamina readout */}
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted px-0.5 mt-1.5">
        <span>0s</span>
        <span style={{ color: ACCENT_EMERALD }}>
          Stamina: {staminaRemaining}/{maxStamina}
        </span>
        <span>{totalChainTime.toFixed(2)}s</span>
      </div>
    </BlueprintPanel>
  );
}
