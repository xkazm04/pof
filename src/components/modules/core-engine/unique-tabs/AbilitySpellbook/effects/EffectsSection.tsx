'use client';

import { useState, useMemo } from 'react';
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_RED, withOpacity, OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_37,
} from '@/lib/chart-colors';
import {
  FeatureCard as SharedFeatureCard, PipelineFlow,
} from '../../_shared';
import { BlueprintPanel, SectionHeader } from '../../_design';
import {
  EXPANDED_EFFECTS, EFFECT_TYPE_COLORS,
  type EffectDurationType, type GameplayEffectEntry,
} from '../data';
import type { SectionProps } from '../types';

const PAGE_SIZE = 8;
const EFFECT_TYPES: EffectDurationType[] = ['Instant', 'Duration', 'Periodic', 'Infinite'];

export function EffectsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const [activeType, setActiveType] = useState<EffectDurationType | 'All'>('All');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (activeType === 'All') return EXPANDED_EFFECTS;
    return EXPANDED_EFFECTS.filter(e => e.type === activeType);
  }, [activeType]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of EXPANDED_EFFECTS) counts[e.type] = (counts[e.type] ?? 0) + 1;
    return counts;
  }, []);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const grouped = useMemo(() => {
    const map = new Map<EffectDurationType, GameplayEffectEntry[]>();
    for (const e of pageItems) {
      const arr = map.get(e.type);
      if (arr) arr.push(e);
      else map.set(e.type, [e]);
    }
    return Array.from(map.entries());
  }, [pageItems]);

  const handleTypeChange = (type: EffectDurationType | 'All') => {
    setActiveType(type);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SharedFeatureCard name="Core Gameplay Effects" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_RED} />
        <SharedFeatureCard name="Damage execution calculation" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_RED} />
      </div>

      {/* Effects catalog with pagination */}
      <BlueprintPanel color={ACCENT_RED} className="p-3">
        <SectionHeader icon={Flame} label={`Gameplay Effects (${EXPANDED_EFFECTS.length})`} color={ACCENT_RED} />
        <p className="text-xs font-mono text-text-muted mt-1 mb-3">
          Browse all GAS gameplay effects grouped by duration type.
        </p>

        {/* Type filter */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <TypeButton active={activeType === 'All'} label={`All (${EXPANDED_EFFECTS.length})`}
            color={ACCENT_RED} onClick={() => handleTypeChange('All')} />
          {EFFECT_TYPES.map(type => (
            <TypeButton key={type} active={activeType === type}
              label={`${type} (${typeCounts[type] ?? 0})`} color={EFFECT_TYPE_COLORS[type]}
              onClick={() => handleTypeChange(type)} />
          ))}
        </div>

        {/* Grouped effect cards */}
        <AnimatePresence mode="sync">
          <motion.div key={`${activeType}-${page}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {grouped.map(([type, effects]) => (
              <div key={type} className="mb-3">
                {activeType === 'All' && (
                  <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2"
                    style={{ color: EFFECT_TYPE_COLORS[type] }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_TYPE_COLORS[type] }} />
                    {type}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {effects.map((effect, i) => (
                    <motion.div
                      key={effect.id}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                      className="rounded-xl p-3 border relative overflow-hidden"
                      style={{ borderColor: withOpacity(effect.color, OPACITY_15), backgroundColor: withOpacity(effect.color, OPACITY_5) }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${withOpacity(effect.color, OPACITY_37)}` }} />
                        <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text truncate"
                          style={{ textShadow: `0 0 12px ${withOpacity(effect.color, OPACITY_25)}` }}>{effect.name}</span>
                      </div>
                      <p className="text-2xs text-text-muted leading-relaxed">{effect.description}</p>
                      <div className="flex gap-2 mt-1.5 text-2xs font-mono text-text-muted">
                        {effect.magnitude > 0 && <span>×{effect.magnitude}</span>}
                        {effect.duration != null && <span>{effect.duration}s</span>}
                        {effect.period != null && <span>⟳{effect.period}s</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-border/30">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1 rounded-md hover:bg-surface-hover transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default">
              <ChevronLeft className="w-4 h-4 text-text-muted" />
            </button>
            <span className="text-xs font-mono text-text-muted">
              Page {page + 1} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1 rounded-md hover:bg-surface-hover transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default">
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        )}
      </BlueprintPanel>

      {/* Damage execution pipeline */}
      <BlueprintPanel color={ACCENT_RED} className="p-4">
        <SectionHeader icon={Flame} label="Damage Execution Pipeline" color={ACCENT_RED} />
        <div className="mt-4">
          <PipelineFlow steps={['GameplayEffect', 'ExecutionCalc', 'Armor Reduction', 'Crit Multiplier', 'Final Damage']} accent={ACCENT_RED} />
        </div>
      </BlueprintPanel>
    </div>
  );
}

function TypeButton({ active, label, color, onClick }: {
  active: boolean; label: string; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
        active ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
      }`}
      style={active ? {
        backgroundColor: withOpacity(color, OPACITY_8),
        borderColor: withOpacity(color, OPACITY_25),
        color,
      } : {
        backgroundColor: 'transparent',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
      }}>
      {label}
    </button>
  );
}
