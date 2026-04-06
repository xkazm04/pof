'use client';

import { useState, useCallback } from 'react';
import { Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_6, OPACITY_8, OPACITY_30, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, OVERLAY_WHITE, withOpacity, GLOW_MD } from '@/lib/chart-colors';
import { RARITY_TIERS, TOTAL_WEIGHT } from '../data';
import { BlueprintPanel, SectionHeader } from '../design';

/* ── Circular gauge constants ─────────────────────────────────────────── */
const GS = 100;         // gauge SVG size
const GCX = GS / 2;     // center x
const GCY = GS / 2;     // center y
const GR = 38;           // radius
const GSW = 8;           // stroke width
const ARC_DEG = 270;     // arc sweep degrees
const GCIRC = 2 * Math.PI * GR;
const ARC_LEN = GCIRC * (ARC_DEG / 360);
const START_ANGLE = 135;  // rotated so gap is at bottom

function arcPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

interface PityTimerSectionProps {
  pityThreshold: number;
  setPityThreshold: (v: number) => void;
}

export function PityTimerSection({ pityThreshold, setPityThreshold }: PityTimerSectionProps) {
  const [pityCount, setPityCount] = useState(0);
  const [pityHistory, setPityHistory] = useState<number[]>([]);

  const doPityDrop = useCallback(() => {
    const forced = pityCount + 1 >= pityThreshold;
    let gotRare = false;
    if (forced) {
      gotRare = true;
    } else {
      let roll = Math.random() * TOTAL_WEIGHT;
      for (const tier of RARITY_TIERS) {
        roll -= tier.weight;
        if (roll <= 0) {
          if (tier.name === 'Rare' || tier.name === 'Epic' || tier.name === 'Legendary') gotRare = true;
          break;
        }
      }
    }
    if (gotRare) {
      setPityHistory((prev) => [...prev, pityCount + 1]);
      setPityCount(0);
    } else {
      setPityCount((c) => c + 1);
    }
  }, [pityCount, pityThreshold]);

  const progress = Math.min(pityCount / pityThreshold, 1);
  const fillColor = pityCount >= pityThreshold * 0.8 ? STATUS_WARNING : STATUS_INFO;
  const fillLen = ARC_LEN * progress;

  // Threshold marker at 80% of arc
  const thresholdAngle = START_ANGLE + ARC_DEG * 0.8;
  const tOuter = arcPoint(GCX, GCY, GR + GSW / 2 + 2, thresholdAngle);
  const tInner = arcPoint(GCX, GCY, GR - GSW / 2 - 2, thresholdAngle);

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Timer} label="Rarity Pity Timer" color={STATUS_INFO} />
      </div>

      {/* Circular gauge + controls side by side */}
      <div className="flex items-center gap-4 mb-3">
        {/* Gauge */}
        <div className="relative flex-shrink-0" style={{ width: GS, height: GS }}>
          <svg width={GS} height={GS} viewBox={`0 0 ${GS} ${GS}`}>
            {/* Track */}
            <circle
              cx={GCX} cy={GCY} r={GR} fill="none"
              stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth={GSW}
              strokeDasharray={`${ARC_LEN} ${GCIRC}`}
              strokeDashoffset={0} strokeLinecap="round"
              transform={`rotate(${START_ANGLE} ${GCX} ${GCY})`}
            />
            {/* Fill arc */}
            <motion.circle
              cx={GCX} cy={GCY} r={GR} fill="none"
              stroke={fillColor} strokeWidth={GSW}
              strokeDasharray={`${fillLen} ${GCIRC}`}
              strokeDashoffset={0} strokeLinecap="round"
              transform={`rotate(${START_ANGLE} ${GCX} ${GCY})`}
              style={{ filter: `drop-shadow(${GLOW_MD} ${fillColor})` }}
              animate={{ strokeDasharray: `${fillLen} ${GCIRC}` }}
              transition={{ duration: 0.3 }}
            />
            {/* 80% threshold marker */}
            <line
              x1={tOuter.x} y1={tOuter.y} x2={tInner.x} y2={tInner.y}
              stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-mono font-bold" style={{ color: fillColor }}>{pityCount}</span>
            <span className="text-2xs text-text-muted">/ {pityThreshold}</span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex-1 space-y-2">
          <button onClick={doPityDrop} className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 cursor-pointer" style={{ borderColor: withOpacity(STATUS_INFO, OPACITY_30), backgroundColor: withOpacity(STATUS_INFO, OPACITY_8), color: STATUS_INFO }}>
            Drop!
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono text-text-muted">Threshold:</span>
            <input type="range" min={10} max={50} value={pityThreshold} onChange={(e) => setPityThreshold(Number(e.target.value))} className="flex-1 h-1 accent-blue-500" />
            <span className="text-2xs font-mono" style={{ color: STATUS_INFO }}>{pityThreshold}</span>
          </div>
          <div className="text-2xs font-mono" style={{ color: fillColor }}>
            {pityCount >= pityThreshold ? 'GUARANTEED RARE NEXT!' : `${pityCount} since last Rare+`}
          </div>
        </div>
      </div>

      {/* Bad luck protection indicator */}
      <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded" style={{ backgroundColor: pityCount >= pityThreshold * 0.5 ? withOpacity(STATUS_WARNING, OPACITY_8) : withOpacity(STATUS_SUCCESS, OPACITY_8), border: `1px solid ${withOpacity(pityCount >= pityThreshold * 0.5 ? STATUS_WARNING : STATUS_SUCCESS, OPACITY_30)}` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pityCount >= pityThreshold * 0.5 ? STATUS_WARNING : STATUS_SUCCESS }} />
        <span className="text-2xs font-mono" style={{ color: pityCount >= pityThreshold * 0.5 ? STATUS_WARNING : STATUS_SUCCESS }}>
          Bad Luck Protection: {pityCount >= pityThreshold * 0.8 ? 'ACTIVE - guaranteed soon' : pityCount >= pityThreshold * 0.5 ? 'Warming up...' : 'Inactive'}
        </span>
      </div>

      {/* History */}
      {pityHistory.length > 0 && (
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Drop Gaps (drops between Rare+)</div>
          <div className="flex items-end gap-1 h-12">
            {pityHistory.slice(-20).map((gap, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }} animate={{ height: `${(gap / pityThreshold) * 100}%` }}
                className="flex-1 rounded-t min-w-[4px]"
                style={{ backgroundColor: gap >= pityThreshold * 0.8 ? STATUS_WARNING : STATUS_INFO, maxHeight: '100%' }}
                title={`${gap} drops`}
              />
            ))}
          </div>
        </div>
      )}
    </BlueprintPanel>
  );
}
