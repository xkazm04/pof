'use client';

import { Settings2, Wand2, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_20 } from '@/lib/chart-colors';
import type { Rarity, AffixPoolEntry, DropSimResult } from '@/lib/loot-designer/drop-simulator';
import { BlueprintPanel, SectionHeader } from './design';
import { ACCENT, RARITY_COLORS, RARITIES } from './constants';
import type { ItemConcept } from './constants';
import { LiveMetrics } from './MetricsAndWeights';
import { WeightTuning } from './MetricsAndWeights';

export interface DesignerPanelProps {
  concept: ItemConcept;
  presets: ItemConcept[];
  selectedPreset: number;
  onSelectPreset: (i: number) => void;
  affixPool: AffixPoolEntry[];
  customWeights: Record<string, number>;
  onUpdateWeight: (id: string, val: number) => void;
  onResetWeights: () => void;
  rarity: Rarity;
  onRarityChange: (r: Rarity) => void;
  itemLevel: number;
  onItemLevelChange: (l: number) => void;
  rollCount: number;
  onRollCountChange: (c: number) => void;
  seed: number;
  onReseed: () => void;
  simResult: DropSimResult;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export function DesignerPanel({
  concept, presets, selectedPreset, onSelectPreset,
  affixPool, customWeights, onUpdateWeight, onResetWeights,
  rarity, onRarityChange, itemLevel, onItemLevelChange,
  rollCount, onRollCountChange, seed, onReseed,
  simResult, showAdvanced, onToggleAdvanced,
}: DesignerPanelProps) {
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Preset selector */}
      <BlueprintPanel color={ACCENT} className="p-2 space-y-3">
        <SectionHeader icon={Wand2} label="Item Concept" color={ACCENT} />
        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((p, i) => {
            const Icon = p.icon;
            const isActive = i === selectedPreset;
            return (
              <button
                key={p.name}
                onClick={() => onSelectPreset(i)}
                className={`relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${isActive ? 'text-white' : 'text-text-muted hover:text-text hover:bg-surface/50'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="presetBg"
                    className="absolute inset-0 rounded-lg opacity-20"
                    style={{ backgroundColor: p.color }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" style={{ color: isActive ? p.color : 'currentColor' }} />
                <span className="relative z-10 truncate">{p.displayName}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${concept.color}${OPACITY_20}`, color: concept.color }}>
            {concept.type}
          </span>
          <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${RARITY_COLORS[concept.rarity]}${OPACITY_20}`, color: RARITY_COLORS[concept.rarity] }}>
            {concept.rarity}
          </span>
          <span className="text-text-muted flex-1 truncate">{concept.description}</span>
        </div>
      </BlueprintPanel>

      {/* Simulation parameters */}
      <SimulationParams
        rarity={rarity} onRarityChange={onRarityChange}
        itemLevel={itemLevel} onItemLevelChange={onItemLevelChange}
        rollCount={rollCount} onRollCountChange={onRollCountChange}
        seed={seed} onReseed={onReseed}
      />

      <LiveMetrics simResult={simResult} rollCount={rollCount} itemLevel={itemLevel} />

      <WeightTuning
        affixPool={affixPool} customWeights={customWeights}
        onUpdateWeight={onUpdateWeight} onResetWeights={onResetWeights}
        rarity={rarity} showAdvanced={showAdvanced} onToggleAdvanced={onToggleAdvanced}
      />
    </motion.div>
  );
}

/* -- Simulation parameters ------------------------------------------------- */

function SimulationParams({
  rarity, onRarityChange, itemLevel, onItemLevelChange,
  rollCount, onRollCountChange, seed, onReseed,
}: Pick<DesignerPanelProps, 'rarity' | 'onRarityChange' | 'itemLevel' | 'onItemLevelChange' | 'rollCount' | 'onRollCountChange' | 'seed' | 'onReseed'>) {
  return (
    <BlueprintPanel color={ACCENT} className="p-2 space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader icon={Settings2} label="Simulation" color={ACCENT} />
        <div className="flex items-center gap-1.5">
          <button onClick={onReseed} className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface/50">
            <RotateCcw className="w-3 h-3" /> Reseed
          </button>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted opacity-60">#{seed}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Rarity</span>
          <select
            value={rarity}
            onChange={(e) => onRarityChange(e.target.value as Rarity)}
            className="w-full bg-surface-deep text-xs font-mono text-text rounded px-1.5 py-1 border border-border/40 focus:outline-none"
            style={{ color: RARITY_COLORS[rarity] }}
          >
            {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Level</span>
          <div className="flex items-center gap-1">
            <input type="range" min={1} max={50} value={itemLevel} onChange={(e) => onItemLevelChange(Number(e.target.value))} className="flex-1 h-1 accent-blue-500" />
            <span className="text-xs font-mono w-6 text-right" style={{ color: ACCENT }}>{itemLevel}</span>
          </div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Rolls</span>
          <select
            value={rollCount}
            onChange={(e) => onRollCountChange(Number(e.target.value))}
            className="w-full bg-surface-deep text-xs font-mono text-text rounded px-1.5 py-1 border border-border/40 focus:outline-none"
          >
            {[500, 1000, 2000, 5000, 10000].map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
          </select>
        </div>
      </div>
    </BlueprintPanel>
  );
}
