'use client';

import { useState, useCallback } from 'react';
import { Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_8, OPACITY_30, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO } from '@/lib/chart-colors';
import { RARITY_TIERS, TOTAL_WEIGHT } from './data';
import { BlueprintPanel, SectionHeader } from './design';

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

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Timer} label="Rarity Pity Timer" color={STATUS_INFO} />
        <span className="text-2xs font-mono" style={{ color: pityCount >= pityThreshold * 0.8 ? STATUS_WARNING : STATUS_INFO }}>
          {pityCount} / {pityThreshold} drops
        </span>
      </div>
      {/* Progress bar */}
      <div className="relative h-4 bg-surface-deep rounded overflow-hidden mb-2">
        <motion.div
          className="h-full rounded"
          style={{ backgroundColor: pityCount >= pityThreshold * 0.8 ? STATUS_WARNING : STATUS_INFO }}
          animate={{ width: `${Math.min((pityCount / pityThreshold) * 100, 100)}%` }}
          transition={{ duration: 0.3 }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-2xs font-mono font-bold text-white/80">
          {pityCount >= pityThreshold ? 'GUARANTEED RARE NEXT!' : `${pityCount} since last Rare+`}
        </div>
      </div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={doPityDrop} className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80" style={{ borderColor: `${STATUS_INFO}${OPACITY_30}`, backgroundColor: `${STATUS_INFO}${OPACITY_8}`, color: STATUS_INFO }}>
          Drop!
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Pity Threshold:</span>
          <input type="range" min={10} max={50} value={pityThreshold} onChange={(e) => setPityThreshold(Number(e.target.value))} className="flex-1 h-1 accent-blue-500" />
          <span className="text-2xs font-mono" style={{ color: STATUS_INFO }}>{pityThreshold}</span>
        </div>
      </div>
      {/* Bad luck protection indicator */}
      <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded" style={{ backgroundColor: pityCount >= pityThreshold * 0.5 ? `${STATUS_WARNING}${OPACITY_8}` : `${STATUS_SUCCESS}${OPACITY_8}`, border: `1px solid ${pityCount >= pityThreshold * 0.5 ? STATUS_WARNING : STATUS_SUCCESS}${OPACITY_30}` }}>
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
