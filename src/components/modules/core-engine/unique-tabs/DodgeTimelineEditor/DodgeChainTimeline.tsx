'use client';

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_EMERALD, OVERLAY_WHITE,
} from '@/lib/chart-colors';
import type { DodgeChainEntry } from '../dodge-types';
import { computePhases } from '../dodge-math';
import { SectionHeader } from '../_design';

export function DodgeChainTimeline({
  chain,
  playhead,
  onScrub,
}: {
  chain: DodgeChainEntry[];
  playhead: number;
  onScrub: (t: number) => void;
}) {
  const totalChainTime = useMemo(() => {
    if (chain.length === 0) return 0;
    const last = chain[chain.length - 1];
    const phases = computePhases(last.params);
    return last.startTime + phases.totalTimeline;
  }, [chain]);

  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleInteraction = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrub(pct * totalChainTime);
  }, [totalChainTime, onScrub]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) handleInteraction(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [handleInteraction]);

  if (chain.length === 0) return null;

  /* Stamina tracking */
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
    <div className="space-y-1.5">
      <SectionHeader icon={Zap} label={`Dodge Chain (${chain.length}\u00d7 dodges)`} color={ACCENT_EMERALD} />

      {/* Chain timeline bar */}
      <div
        ref={barRef}
        className="relative h-10 rounded-md overflow-hidden cursor-pointer select-none"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
        onMouseDown={(e) => { dragging.current = true; handleInteraction(e.clientX); }}
      >
        {chain.map((entry, i) => (
          <ChainSegment key={entry.id} entry={entry} index={i} totalChainTime={totalChainTime} />
        ))}

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
            boxShadow: '0 0 6px rgba(255,255,255,0.6)',
          }}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white rounded-sm" style={{ boxShadow: '0 0 4px rgba(255,255,255,0.8)' }} />
        </motion.div>
      </div>

      {/* Time labels + stamina readout */}
      <div className="flex justify-between text-xs font-mono text-text-muted px-0.5">
        <span>0s</span>
        <span style={{ color: ACCENT_EMERALD }}>
          Stamina: {staminaRemaining}/{maxStamina}
        </span>
        <span>{totalChainTime.toFixed(2)}s</span>
      </div>
    </div>
  );
}

/* ── Chain segment for a single dodge entry ─────────────────────────────── */

function ChainSegment({ entry, index, totalChainTime }: {
  entry: DodgeChainEntry;
  index: number;
  totalChainTime: number;
}) {
  const entryPhases = computePhases(entry.params);
  const leftPct = (entry.startTime / totalChainTime) * 100;
  const widthPct = (entryPhases.totalTimeline / totalChainTime) * 100;
  const mvPct = (entryPhases.movement.end / entryPhases.totalTimeline) * widthPct;
  const invStart = ((entry.startTime + entryPhases.invuln.start) / totalChainTime) * 100;
  const invWidth = ((entryPhases.invuln.end - entryPhases.invuln.start) / totalChainTime) * 100;

  return (
    <div>
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
          backgroundColor: 'rgba(100,116,139,0.1)',
          borderBottom: '2px solid rgba(100,116,139,0.3)',
        }}
      />
      {/* Dodge number label */}
      <div
        className="absolute top-0.5 text-xs font-mono font-bold"
        style={{ left: `${leftPct + 1}%`, color: ACCENT_CYAN }}
      >
        #{index + 1}
      </div>
    </div>
  );
}
