'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RARITY_TIERS, TOTAL_WEIGHT, TREEMAP_DATA } from '../data';

/* Pre-compute name→affixes map for O(1) drill-down lookup */
const AFFIX_BY_RARITY = new Map(TREEMAP_DATA.map(d => [d.name, d.affixes]));
import { withOpacity, OPACITY_8, OPACITY_20, GLOW_MD } from '@/lib/chart-colors';
import { BlueprintPanel } from '../design';

const CX = 60;
const CY = 60;
const R = 46;
const STROKE_W = 14;
const CIRC = 2 * Math.PI * R;

/* Pre-compute donut segments at module scope */
const SEGMENTS = (() => {
  let offset = 0;
  return RARITY_TIERS.map(tier => {
    const pct = tier.weight / TOTAL_WEIGHT;
    const len = CIRC * pct;
    const seg = { tier, pct, len, offset };
    offset += len;
    return seg;
  });
})();

export function WeightDistribution() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const activeName = selected ?? hovered;
  const activeTier = activeName ? RARITY_TIERS.find(t => t.name === activeName) : null;

  return (
    <BlueprintPanel className="p-3">
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">
        Drop Weight Distribution
      </div>
      <div className="flex items-center gap-4">
        {/* Donut chart */}
        <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
          <svg width={120} height={120} viewBox="0 0 120 120">
            {SEGMENTS.map(seg => {
              const isActive = seg.tier.name === activeName;
              return (
                <circle
                  key={seg.tier.name}
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke={seg.tier.color}
                  strokeWidth={isActive ? STROKE_W + 4 : STROKE_W}
                  strokeDasharray={`${seg.len} ${CIRC - seg.len}`}
                  strokeDashoffset={-seg.offset}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  opacity={activeName && !isActive ? 0.3 : 1}
                  className="cursor-pointer"
                  style={{
                    filter: isActive ? `drop-shadow(${GLOW_MD} ${seg.tier.color})` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={() => setHovered(seg.tier.name)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(p => p === seg.tier.name ? null : seg.tier.name)}
                />
              );
            })}
          </svg>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {activeTier ? (
              <>
                <span className="text-lg font-mono font-bold" style={{ color: activeTier.color }}>
                  {((activeTier.weight / TOTAL_WEIGHT) * 100).toFixed(0)}%
                </span>
                <span className="text-2xs text-text-muted">{activeTier.name}</span>
              </>
            ) : (
              <>
                <span className="text-lg font-mono font-bold text-text">{RARITY_TIERS.length}</span>
                <span className="text-2xs text-text-muted">tiers</span>
              </>
            )}
          </div>
        </div>

        {/* Interactive legend */}
        <div className="space-y-1 flex-1">
          {RARITY_TIERS.map(tier => {
            const pct = ((tier.weight / TOTAL_WEIGHT) * 100).toFixed(0);
            const isActive = tier.name === activeName;
            return (
              <button
                key={tier.name}
                className="flex items-center gap-2 w-full text-left px-2 py-1 rounded transition-all cursor-pointer"
                style={{ backgroundColor: isActive ? withOpacity(tier.color, OPACITY_8) : 'transparent' }}
                onMouseEnter={() => setHovered(tier.name)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(p => p === tier.name ? null : tier.name)}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                  backgroundColor: tier.color,
                  boxShadow: isActive ? `${GLOW_MD} ${tier.color}` : 'none',
                }} />
                <span className="text-2xs font-mono text-text flex-1">{tier.name}</span>
                <span className="text-2xs font-mono" style={{ color: tier.color }}>{pct}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drill-down detail on selection */}
      <AnimatePresence>
        {selected && activeTier && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-2 rounded border bg-surface/30" style={{ borderColor: withOpacity(activeTier.color, OPACITY_20) }}>
              <div className="text-2xs font-semibold mb-1" style={{ color: activeTier.color }}>
                {activeTier.name} Details
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-2xs font-mono">
                <span className="text-text-muted">Weight</span>
                <span className="text-text">{activeTier.weight} / {TOTAL_WEIGHT}</span>
                <span className="text-text-muted">Drop Rate</span>
                <span className="text-text">{((activeTier.weight / TOTAL_WEIGHT) * 100).toFixed(2)}%</span>
                <span className="text-text-muted">Avg per 100 kills</span>
                <span className="text-text">{((activeTier.weight / TOTAL_WEIGHT) * 100).toFixed(0)}</span>
                <span className="text-text-muted">Affixes</span>
                <span className="text-text">
                  {AFFIX_BY_RARITY.get(activeTier.name)?.join(', ') ?? '—'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BlueprintPanel>
  );
}
