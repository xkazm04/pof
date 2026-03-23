'use client';

import { useState } from 'react';
import { Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_8, STATUS_WARNING, ACCENT_VIOLET, STATUS_SUBDUED } from '@/lib/chart-colors';
import { SMART_LOOT_DATA } from './data';
import { BlueprintPanel, SectionHeader } from './design';

export function SmartLoot() {
  const [smartMode, setSmartMode] = useState(false);

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Brain} label="Smart Loot Recommendations" color={ACCENT_VIOLET} />
        <div className="flex items-center gap-2">
          <span className="text-2xs text-text-muted">{smartMode ? 'Smart' : 'Raw'}</span>
          <button
            onClick={() => setSmartMode((v) => !v)}
            className="w-8 h-4 rounded-full relative transition-colors"
            style={{ backgroundColor: smartMode ? ACCENT_VIOLET : STATUS_SUBDUED }}
          >
            <motion.div
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
              animate={{ left: smartMode ? 16 : 2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            />
          </button>
        </div>
      </div>
      {/* Effectiveness metric */}
      <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded border border-border/30 bg-surface/30">
        <span className="text-2xs text-text-muted">Smart Loot Effectiveness:</span>
        <span className="text-xs font-mono font-bold" style={{ color: ACCENT_VIOLET }}>23% better targeting</span>
        <span className="text-2xs text-text-muted ml-auto">vs raw distribution</span>
      </div>
      {/* Side-by-side probability bars */}
      <div className="space-y-3">
        {SMART_LOOT_DATA.map((slot) => {
          const activePct = smartMode ? slot.smartPct : slot.rawPct;
          return (
            <div key={slot.slot} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono w-14 text-text-muted">{slot.slot}</span>
                <div className="flex-1 flex gap-1">
                  <div className="flex-1 h-2.5 bg-surface-deep rounded overflow-hidden relative" title={`Raw: ${slot.rawPct}%`}>
                    <motion.div className="h-full rounded" style={{ backgroundColor: STATUS_SUBDUED }} animate={{ width: `${slot.rawPct * 3}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <div className="flex-1 h-2.5 bg-surface-deep rounded overflow-hidden relative" title={`Smart: ${slot.smartPct}%`}>
                    <motion.div className="h-full rounded" style={{ backgroundColor: ACCENT_VIOLET }} animate={{ width: `${slot.smartPct * 3}%` }} transition={{ duration: 0.3 }} />
                  </div>
                </div>
                <span className="text-2xs font-mono w-8 text-right" style={{ color: smartMode ? ACCENT_VIOLET : STATUS_SUBDUED }}>
                  {activePct}%
                </span>
                {slot.gearScoreGap > 10 && (
                  <span className="text-2xs font-mono px-1 rounded" style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_8}`, color: STATUS_WARNING }}>
                    Gap:{slot.gearScoreGap}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-4 mt-2">
        <span className="flex items-center gap-1 text-2xs text-text-muted">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_SUBDUED }} /> Raw
        </span>
        <span className="flex items-center gap-1 text-2xs text-text-muted">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ACCENT_VIOLET }} /> Smart
        </span>
      </div>
    </BlueprintPanel>
  );
}
