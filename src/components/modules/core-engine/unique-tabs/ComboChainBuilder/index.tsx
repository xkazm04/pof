'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Plus, Timer, Flame, Shield,
  RotateCcw, Copy,
} from 'lucide-react';
import {
  ACCENT_RED, ACCENT_CYAN, ACCENT_ORANGE,
  ACCENT_PURPLE_BOLD, MODULE_COLORS, STATUS_WARNING,
  OPACITY_15, OPACITY_30,
} from '@/lib/chart-colors';
import {
  COMBO_ABILITIES, COMBO_ABILITY_MAP, COMBO_EVENT_TAGS,
  PRESET_COMBOS,
  type ComboAbility, type ComboChain,
} from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook.data';
import { BlueprintPanel, SectionHeader, GlowStat } from './design';
import { AbilityChip } from './AbilityChip';
import { TimelineBlock, TimeRuler } from './TimelineBlock';
import { CooldownOverlapChart } from './CooldownOverlapChart';
import { computeComboStats } from './helpers';

/* ── Main component ────────────────────────────────────────────────── */

export function ComboChainBuilder() {
  const [chain, setChain] = useState<string[]>(PRESET_COMBOS[0].abilities);
  const [activePreset, setActivePreset] = useState<string>(PRESET_COMBOS[0].id);

  const addAbility = useCallback((id: string) => {
    setChain(prev => [...prev, id]);
    setActivePreset('');
  }, []);

  const removeAbility = useCallback((index: number) => {
    setChain(prev => prev.filter((_, i) => i !== index));
    setActivePreset('');
  }, []);

  const loadPreset = useCallback((preset: ComboChain) => {
    setChain(preset.abilities);
    setActivePreset(preset.id);
  }, []);

  const clearChain = useCallback(() => {
    setChain([]);
    setActivePreset('');
  }, []);

  const stats = useMemo(() => computeComboStats(chain), [chain]);

  const chainAbilities = useMemo(() =>
    chain.map(id => COMBO_ABILITY_MAP.get(id)).filter(Boolean) as ComboAbility[],
    [chain],
  );

  return (
    <div className="space-y-4">
      {/* Combo Event Tags reference */}
      <BlueprintPanel color={ACCENT_CYAN} className="p-4">
        <SectionHeader icon={Zap} label="UE5 Combo Event Tags" color={ACCENT_CYAN} />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          {COMBO_EVENT_TAGS.map((evt, i) => (
            <motion.div
              key={evt.tag}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="text-xs bg-surface-deep/50 p-2 rounded-lg border border-border/40"
            >
              <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT_CYAN }}>{evt.tag}</span>
              <p className="text-text-muted mt-0.5 leading-relaxed">{evt.desc}</p>
            </motion.div>
          ))}
        </div>
      </BlueprintPanel>

      {/* Preset combos */}
      <BlueprintPanel color={ACCENT_PURPLE_BOLD} className="p-4">
        <SectionHeader icon={Copy} label="Preset Combos" color={ACCENT_PURPLE_BOLD} />
        <div className="flex flex-wrap gap-1.5 mt-1">
          {PRESET_COMBOS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-[0.15em] border transition-all cursor-pointer ${
                activePreset === preset.id ? 'shadow-sm' : 'opacity-60 hover:opacity-90'
              }`}
              style={activePreset === preset.id ? {
                backgroundColor: `${ACCENT_PURPLE_BOLD}${OPACITY_15}`,
                borderColor: `${ACCENT_PURPLE_BOLD}${OPACITY_30}`,
                color: ACCENT_PURPLE_BOLD,
              } : {
                backgroundColor: 'transparent',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </BlueprintPanel>

      {/* Ability palette */}
      <BlueprintPanel color={MODULE_COLORS.core} className="p-4">
        <div className="flex items-center justify-between">
          <SectionHeader icon={Plus} label="Ability Palette" color={MODULE_COLORS.core} />
          <button
            onClick={clearChain}
            className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] text-text-muted hover:text-text transition-colors cursor-pointer px-2 py-0.5 rounded border border-border/40 hover:border-border"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {COMBO_ABILITIES.map(ab => (
            <AbilityChip key={ab.id} ability={ab} onAdd={addAbility} />
          ))}
        </div>
      </BlueprintPanel>

      {/* Timeline */}
      <BlueprintPanel color={ACCENT_RED} className="p-4">
        <SectionHeader icon={Timer} label="Combo Timeline" color={ACCENT_RED} />

        {/* Stats strip */}
        {chain.length > 0 && (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1 mb-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <GlowStat label="Total DMG" value={stats.totalDamage} color={ACCENT_RED} delay={0} />
            <GlowStat label="DPS" value={stats.dps} color={ACCENT_ORANGE} delay={0.05} />
            <GlowStat label="Mana" value={stats.totalMana} color={MODULE_COLORS.core} delay={0.1} />
            <GlowStat label="Duration" value={`${stats.totalDuration.toFixed(1)}`} unit="sec" color={ACCENT_CYAN} delay={0.15} />
            {stats.maxCooldown > 0 && (
              <GlowStat label="Max CD" value={stats.maxCooldown} unit="sec" color={STATUS_WARNING} delay={0.2} />
            )}
          </motion.div>
        )}

        {/* Timeline lane */}
        <div className="mt-2 relative">
          {chain.length > 0 && <TimeRuler totalDuration={stats.totalDuration} />}
          <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar pb-2 pt-1 min-h-[80px]">
            <AnimatePresence mode="popLayout">
              {chainAbilities.map((ab, i) => (
                <TimelineBlock
                  key={`${ab.id}-${i}`}
                  ability={ab}
                  index={i}
                  total={chainAbilities.length}
                  onRemove={removeAbility}
                />
              ))}
            </AnimatePresence>
            {chain.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-xs font-mono uppercase tracking-[0.15em] text-text-muted py-6">
                Click abilities above to build a combo chain
              </div>
            )}
          </div>
        </div>
      </BlueprintPanel>

      {/* Cooldown overlap analysis */}
      {chain.length > 1 && <CooldownOverlapChart chain={chainAbilities} totalDuration={stats.totalDuration} />}
    </div>
  );
}
