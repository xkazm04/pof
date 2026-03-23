'use client';

import { useMemo } from 'react';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { NeonBar } from '../_design';
import { STATUS_COLORS } from '../_shared';
import type { ArchetypeConfig, EliteModifier } from './data';
import { ELITE_MODIFIERS, applyModifiers } from './data';
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
          borderColor: expanded ? `${archetype.color}80` : `${archetype.color}40`,
          boxShadow: expanded
            ? `0 0 30px -5px ${archetype.color}60, inset 0 0 30px -10px ${archetype.color}30`
            : `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 0 20px -10px ${archetype.color}30`,
        }}
      >
        {/* Shimmer effect */}
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" />

        <button
          onClick={() => onToggle(archetype.id)}
          className="w-full text-left p-3 hover:bg-surface-hover/20 transition-colors relative z-10 focus:outline-none flex-1 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border shadow-inner"
                style={{ backgroundColor: `${archetype.color}20`, borderColor: `${archetype.color}40` }}>
                <ArchIcon className="w-4 h-4" style={{ color: archetype.color }} />
              </div>
              <div>
                <div className="text-sm font-bold text-text leading-tight">{archetype.label}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] opacity-80" style={{ color: archetype.color }}>
                  {archetype.class} / {archetype.role}
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
                <span key={mod.id} className="text-[11px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1"
                  style={{ backgroundColor: `${mod.color}15`, borderColor: `${mod.color}40`, color: mod.color }}
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
              return (
                <div key={stat.label} className="flex items-center gap-2 group/stat relative">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-10 flex-shrink-0 text-right">
                    {stat.label}
                  </span>
                  <div className="flex-1">
                    <NeonBar
                      pct={effective}
                      color={diff > 0 ? STATUS_SUCCESS : diff < 0 ? STATUS_ERROR : archetype.color}
                      glow={diff !== 0}
                    />
                  </div>
                  <span className={`text-2xs font-mono font-bold w-6 text-right ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-text'}`}>
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

