'use client';

import { useMemo } from 'react';
import { STATUS_SUCCESS, STATUS_ERROR, ACCENT_EMERALD, ACCENT_RED, OVERLAY_WHITE,
  withOpacity, OPACITY_50, OPACITY_25, OPACITY_37, OPACITY_20, OPACITY_12, OPACITY_10,
} from '@/lib/chart-colors';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { NeonBar } from '../../_design';
import { STATUS_COLORS } from '../../_shared';
import type { ArchetypeConfig, EliteModifier } from '../data';
import { ELITE_MODIFIERS, applyModifiers, TIER_GLOW_COLORS, STAT_AVERAGES } from '../data';
import { ExpandedDetails } from './ExpandedDetails';

interface ArchetypeCardProps {
  archetype: ArchetypeConfig;
  featureMap: Map<string, FeatureRow>;
  expanded: boolean;
  onToggle: (id: string) => void;
  activeModifiers: string[];
  onToggleModifier: (modId: string) => void;
  onViewCodegen: (mod: EliteModifier) => void;
}

export function ArchetypeCard({
  archetype, featureMap, expanded, onToggle,
  activeModifiers, onToggleModifier, onViewCodegen,
}: ArchetypeCardProps) {
  const ArchIcon = archetype.icon;
  const row = featureMap.get(archetype.featureName);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];
  const appliedMods = useMemo(
    () => ELITE_MODIFIERS.filter(m => activeModifiers.includes(m.id)),
    [activeModifiers],
  );

  const tierColor = TIER_GLOW_COLORS[archetype.tier];

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      whileHover={{ y: expanded ? 0 : -5, scale: expanded ? 1 : 1.02 }}
      className="h-full relative group"
      style={{ perspective: 1000 }}
    >
      <div
        className="relative rounded-lg border-2 bg-surface-deep overflow-hidden h-full flex flex-col transition-all duration-300 shadow-xl"
        style={{
          borderColor: expanded ? `${withOpacity(tierColor, OPACITY_50)}` : `${withOpacity(tierColor, OPACITY_25)}`,
          boxShadow: expanded
            ? `0 0 30px -5px ${withOpacity(tierColor, OPACITY_37)}, inset 0 0 30px -10px ${withOpacity(tierColor, OPACITY_20)}`
            : `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 0 20px -10px ${withOpacity(tierColor, OPACITY_20)}`,
        }}
      >
        {/* Shimmer effect */}
        <div className="absolute -inset-[100%] -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" style={{ backgroundImage: `linear-gradient(to right, transparent, ${withOpacity(OVERLAY_WHITE, OPACITY_10)}, transparent)` }} />

        <button
          onClick={() => onToggle(archetype.id)}
          className="w-full text-left p-3 hover:bg-surface-hover/20 transition-colors relative z-10 focus:outline-none flex-1 flex flex-col cursor-pointer"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border shadow-inner"
                style={{ backgroundColor: `${withOpacity(archetype.color, OPACITY_12)}`, borderColor: `${withOpacity(archetype.color, OPACITY_25)}` }}>
                <ArchIcon className="w-4 h-4" style={{ color: archetype.color }} />
              </div>
              <div>
                <div className="text-sm font-bold text-text leading-tight">{archetype.label}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono uppercase tracking-[0.15em] opacity-80" style={{ color: archetype.color }}>
                    {archetype.class} / {archetype.role}
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase px-1 py-px rounded border"
                    style={{ color: tierColor, borderColor: withOpacity(tierColor, OPACITY_25), backgroundColor: withOpacity(tierColor, OPACITY_10) }}>
                    {archetype.tier}
                  </span>
                </div>
              </div>
            </div>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="p-0.5">
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </motion.div>
          </div>

          {/* Active modifier badges */}
          {appliedMods.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {appliedMods.map(mod => (
                <span key={mod.id} className="text-xs font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1"
                  style={{ backgroundColor: `${withOpacity(mod.color, OPACITY_10)}`, borderColor: `${withOpacity(mod.color, OPACITY_25)}`, color: mod.color }}
                  title={`${mod.name}: ${mod.statMods.map(s => s.label).join(', ')}`}>
                  <span>{mod.icon}</span>
                  {mod.name}
                </span>
              ))}
            </div>
          )}

          {/* Stat bars with modifier effects */}
          <div className="space-y-1.5 mt-auto">
            {archetype.stats.map((stat) => {
              const effective = appliedMods.length > 0
                ? applyModifiers(stat.value, stat.label, appliedMods)
                : stat.value;
              const diff = effective - stat.value;
              const avg = STAT_AVERAGES[stat.label];
              return (
                <div key={stat.label} className="flex items-center gap-2 group/stat relative">
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-10 flex-shrink-0 text-right">
                    {stat.label}
                  </span>
                  <div className="flex-1 relative">
                    <NeonBar
                      pct={effective}
                      color={diff > 0 ? STATUS_SUCCESS : diff < 0 ? STATUS_ERROR : archetype.color}
                      glow={diff !== 0}
                    />
                    {avg !== undefined && (
                      <div
                        className="absolute top-0 h-full w-px pointer-events-none"
                        style={{ left: `${Math.min(100, avg)}%`, backgroundColor: withOpacity(OVERLAY_WHITE, OPACITY_25) }}
                        title={`Avg: ${avg}`}
                      />
                    )}
                  </div>
                  <span className="text-2xs font-mono font-bold w-6 text-right"
                    style={{ color: diff > 0 ? ACCENT_EMERALD : diff < 0 ? ACCENT_RED : 'var(--text)' }}>
                    {effective}
                  </span>
                </div>
              );
            })}
          </div>
        </button>

        {/* Expanded Details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative z-10"
            >
              <ExpandedDetails
                archetype={archetype}
                activeModifiers={activeModifiers}
                appliedMods={appliedMods}
                onToggleModifier={onToggleModifier}
                onViewCodegen={onViewCodegen}
                sc={sc}
                row={row}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

