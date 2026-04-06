'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Sparkles, Download, ChevronDown, ChevronUp,
  Shield, Gauge,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_CYAN, ACCENT_RED, ACCENT_PURPLE_BOLD,
  ACCENT_GREEN, ACCENT_EMERALD_DARK, MODULE_COLORS,
  OVERLAY_WHITE, OPACITY_4, withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { RadarChart } from '../_shared';
import { ABILITY_RADAR_AXES } from '../AbilitySpellbook.data';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { ACCENT, DAMAGE_TYPE_COLORS } from './constants';
import { StatBar } from './StatBar';
import { TagRow } from './TagRow';
import { CodeBlock } from './CodeBlock';
import { ComboTimeline } from './ComboTimeline';

/* ── Forged ability result card ──────────────────────────────────────── */

export function ForgeResult({ ability, existingRadar }: {
  ability: ForgedAbility;
  existingRadar: { name: string; color: string; values: number[] }[];
}) {
  const [showHeader, setShowHeader] = useState(true);
  const [showCpp, setShowCpp] = useState(false);

  const radarData: RadarDataPoint[] = ABILITY_RADAR_AXES.map((axis, i) => ({
    axis, value: ability.radarValues[i] ?? 0,
  }));

  const overlays = useMemo(() => [
    ...existingRadar.map(r => ({
      data: ABILITY_RADAR_AXES.map((axis, i) => ({ axis, value: r.values[i] })),
      color: r.color,
      label: r.name,
    })),
    {
      data: ABILITY_RADAR_AXES.map((axis, i) => ({ axis, value: ability.radarValues[i] ?? 0 })),
      color: ACCENT,
      label: ability.displayName,
    },
  ], [existingRadar, ability]);

  const handleDownload = useCallback(() => {
    const blob = new Blob(
      [`// ${ability.className}.h\n${ability.headerCode}\n\n// ${ability.className}.cpp\n${ability.cppCode}`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ability.className}.cpp`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ability]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
          <span className="text-sm font-semibold text-zinc-200">{ability.displayName}</span>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-500">
            {ability.className}
          </span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          style={{ background: withOpacity(OVERLAY_WHITE, OPACITY_4) }}
        >
          <Download size={12} /> Download .h/.cpp
        </button>
      </div>

      <p className="text-[12px] text-zinc-400 leading-relaxed">{ability.description}</p>

      {/* Stats + Radar + Tags grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Stats */}
        <BlueprintPanel color={ACCENT_RED} className="p-3 space-y-2">
          <SectionHeader icon={Gauge} label="Stats" color={ACCENT_RED} />
          <StatBar label="Damage" value={ability.stats.baseDamage} max={80}
            color={DAMAGE_TYPE_COLORS[ability.stats.damageType] ?? ACCENT_RED} />
          <StatBar label="Mana" value={ability.stats.manaCost} max={50} color={MODULE_COLORS.core} />
          <StatBar label="Cooldown" value={ability.stats.cooldownSec} max={30} color={ACCENT_CYAN} unit="s" />
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-2 h-2 rounded-full"
              style={{ background: DAMAGE_TYPE_COLORS[ability.stats.damageType] ?? DAMAGE_TYPE_COLORS.None }} />
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-400">
              {ability.stats.damageType} damage
            </span>
          </div>
        </BlueprintPanel>

        {/* Radar comparison */}
        <BlueprintPanel color={ACCENT} className="p-3 flex flex-col items-center">
          <SectionHeader icon={Sparkles} label="Radar Profile" color={ACCENT} />
          <RadarChart data={radarData} size={160} accent={ACCENT} overlays={overlays} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
            {overlays.map(o => (
              <div key={o.label} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: o.color }} />
                <span className="text-[9px] text-zinc-500">{o.label}</span>
              </div>
            ))}
          </div>
        </BlueprintPanel>

        {/* Tags */}
        <BlueprintPanel color={ACCENT_GREEN} className="p-3 space-y-2">
          <SectionHeader icon={Shield} label="GAS Tags" color={ACCENT_GREEN} />
          <div className="space-y-1.5">
            <TagRow label="Ability" tag={ability.tags.abilityTag} color={ACCENT_PURPLE_BOLD} />
            <TagRow label="Cooldown" tag={ability.tags.cooldownTag} color={MODULE_COLORS.core} />
            {ability.tags.ownedTags.map(t => (
              <TagRow key={t} label="Owned" tag={t} color={ACCENT_EMERALD_DARK} />
            ))}
            {ability.tags.blockedTags.map(t => (
              <TagRow key={t} label="Blocked" tag={t} color={ACCENT_RED} />
            ))}
          </div>
        </BlueprintPanel>
      </div>

      {/* Combo Timeline */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <ComboTimeline ability={ability} />
      </BlueprintPanel>

      {/* Code output */}
      <div className="space-y-2">
        <button
          onClick={() => setShowHeader(v => !v)}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {showHeader ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {ability.className}.h
        </button>
        <AnimatePresence>
          {showHeader && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <CodeBlock code={ability.headerCode} filename={`${ability.className}.h`} />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowCpp(v => !v)}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {showCpp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {ability.className}.cpp
        </button>
        <AnimatePresence>
          {showCpp && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <CodeBlock code={ability.cppCode} filename={`${ability.className}.cpp`} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
