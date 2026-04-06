'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { ACCENT_CYAN, STATUS_WARNING } from '@/lib/chart-colors';
import { LiveMetricGauge } from '../../_shared';
import { DROPS_PER_HOUR_GAUGE, GOLD_PER_HOUR_GAUGE, DROP_SOURCE_BREAKDOWN } from '../data';
import { BlueprintPanel, SectionHeader } from '../design';

export function DropsPerHour() {
  const [playerLevel, setPlayerLevel] = useState(20);
  const levelMultiplier = 1 + (playerLevel - 1) * 0.04;
  const adjItemsPerHour = Math.round(45 * levelMultiplier);
  const adjGoldPerHour = Math.round(2300 * levelMultiplier);

  return (
    <BlueprintPanel className="p-3">
      <SectionHeader icon={Clock} label="Expected Drops per Hour" color={ACCENT_CYAN} />
      {/* Player level slider */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Player Level:</span>
        <input
          type="range" min={1} max={50} value={playerLevel}
          onChange={(e) => setPlayerLevel(Number(e.target.value))}
          className="flex-1 h-1 accent-cyan-500"
        />
        <span className="text-xs font-mono font-semibold" style={{ color: ACCENT_CYAN }}>{playerLevel}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="flex justify-center">
          <LiveMetricGauge metric={{ ...DROPS_PER_HOUR_GAUGE, current: adjItemsPerHour }} accent={ACCENT_CYAN} />
        </div>
        <div className="flex justify-center">
          <LiveMetricGauge metric={{ ...GOLD_PER_HOUR_GAUGE, current: adjGoldPerHour }} accent={STATUS_WARNING} />
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Time to Legendary</span>
          <span className="text-lg font-mono font-bold" style={{ color: STATUS_WARNING }}>
            {(8.5 / levelMultiplier).toFixed(1)}h
          </span>
          <span className="text-2xs text-text-muted">estimated</span>
        </div>
      </div>
      {/* Source breakdown bar */}
      <div className="space-y-1">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Drop Source Breakdown</div>
        <div className="flex h-4 rounded overflow-hidden w-full">
          {DROP_SOURCE_BREAKDOWN.map((src) => (
            <div
              key={src.source}
              title={`${src.source}: ${src.pct}%`}
              style={{ width: `${src.pct}%`, backgroundColor: src.color }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {DROP_SOURCE_BREAKDOWN.map((src) => (
            <span key={src.source} className="flex items-center gap-1 text-2xs text-text-muted">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: src.color }} />
              {src.source} {src.pct}%
            </span>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
