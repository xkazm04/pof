'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Wand2, Play, Settings2, BarChart3, Grid3X3, Code,
  Swords, Shield, Wrench, Coins, Flame, Snowflake, Zap,
  Skull, Crown, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  STATUS_INFO, OPACITY_10, OPACITY_20, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { TabHeader, SectionLabel, SubTabNavigation, HeatmapGrid } from './_shared';
import type { SubTab } from './_shared';
import type { HeatmapCell } from '@/types/unique-tab-improvements';
import type { TraitAxis } from '@/types/item-genome';
import {
  runDropSimulation,
  generateUE5Code,
} from '@/lib/loot-designer/drop-simulator';
import type {
  Rarity, AffixPoolEntry, DropSimConfig, DropSimResult, ItemDesign,
} from '@/lib/loot-designer/drop-simulator';

const ACCENT = MODULE_COLORS.core;

/* ── Axis color mapping ──────────────────────────────────────────────── */

const AXIS_COLORS: Record<TraitAxis, string> = {
  offensive: STATUS_ERROR,
  defensive: ACCENT_CYAN,
  utility: ACCENT_EMERALD,
  economic: ACCENT_ORANGE,
};

const AXIS_ICONS: Record<TraitAxis, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  offensive: Swords,
  defensive: Shield,
  utility: Wrench,
  economic: Coins,
};

const AXIS_LABELS: Record<TraitAxis, string> = {
  offensive: 'OFF', defensive: 'DEF', utility: 'UTL', economic: 'ECO',
};

/* ── Rarity colors ───────────────────────────────────────────────────── */

const RARITY_COLORS: Record<Rarity, string> = {
  Common: STATUS_NEUTRAL,
  Uncommon: ACCENT_EMERALD,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};

const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/* ── Item concept presets ────────────────────────────────────────────── */

interface ItemConcept {
  name: string;
  displayName: string;
  type: string;
  rarity: Rarity;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  /** Weight overrides for specific affixes */
  weightOverrides: Record<string, number>;
}

const ITEM_PRESETS: ItemConcept[] = [
  {
    name: 'FireSword', displayName: 'Blazing Greatsword', type: 'Weapon',
    rarity: 'Legendary', description: 'Endgame fire-aspected melee weapon with critical devastation',
    icon: Flame, color: ACCENT_ORANGE,
    weightOverrides: {
      'aff-str': 2.5, 'aff-atk': 3.0, 'aff-crit': 2.0, 'aff-cdmg': 2.5,
      'aff-aspd': 1.5, 'aff-arm': 0.3, 'aff-hp': 0.3, 'aff-gold': 0.1,
    },
  },
  {
    name: 'FrostStaff', displayName: 'Glacial Focus', type: 'Weapon',
    rarity: 'Epic', description: 'Mid-tier caster staff with mana efficiency and cooldown reduction',
    icon: Snowflake, color: ACCENT_CYAN,
    weightOverrides: {
      'aff-mana': 3.0, 'aff-mregen': 2.5, 'aff-cdr': 2.5, 'aff-crit': 1.5,
      'aff-str': 0.2, 'aff-atk': 0.3, 'aff-arm': 0.5,
    },
  },
  {
    name: 'TankPlate', displayName: 'Bulwark Plate', type: 'Armor',
    rarity: 'Legendary', description: 'Heavy endgame plate armor maximizing survivability',
    icon: Shield, color: ACCENT_CYAN,
    weightOverrides: {
      'aff-arm': 3.5, 'aff-hp': 3.0, 'aff-regen': 2.5, 'aff-dodge': 1.0,
      'aff-str': 0.5, 'aff-atk': 0.2, 'aff-crit': 0.1,
    },
  },
  {
    name: 'AssassinDagger', displayName: 'Viper Fang', type: 'Weapon',
    rarity: 'Rare', description: 'Fast crit-focused dagger for agile builds',
    icon: Zap, color: ACCENT_EMERALD,
    weightOverrides: {
      'aff-crit': 3.0, 'aff-cdmg': 2.5, 'aff-aspd': 3.0, 'aff-spd': 2.0,
      'aff-str': 1.0, 'aff-arm': 0.2, 'aff-hp': 0.3,
    },
  },
  {
    name: 'NecroRing', displayName: 'Ring of the Lich', type: 'Accessory',
    rarity: 'Legendary', description: 'Dark magic ring — mana, cooldown, and economic bonuses',
    icon: Skull, color: ACCENT_VIOLET,
    weightOverrides: {
      'aff-mana': 2.5, 'aff-cdr': 3.0, 'aff-mregen': 2.5, 'aff-mf': 2.0,
      'aff-gold': 1.5, 'aff-xp': 1.5, 'aff-str': 0.1,
    },
  },
  {
    name: 'MerchantAmulet', displayName: 'Trader\'s Signet', type: 'Accessory',
    rarity: 'Epic', description: 'Gold and magic find focused amulet for farming builds',
    icon: Crown, color: STATUS_WARNING,
    weightOverrides: {
      'aff-gold': 4.0, 'aff-mf': 3.5, 'aff-xp': 2.5, 'aff-spd': 1.5,
      'aff-str': 0.1, 'aff-atk': 0.1, 'aff-arm': 0.1,
    },
  },
];

/* ── Base affix pool (same as ItemDNAGenomeEditor) ───────────────────── */

const BASE_AFFIX_POOL: AffixPoolEntry[] = [
  { id: 'aff-str', name: 'of Strength', isPrefix: false, axis: 'offensive', tags: ['Stat.Strength'], minValue: 3, maxValue: 15, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-atk', name: 'Fierce', isPrefix: true, axis: 'offensive', tags: ['Stat.AttackPower'], minValue: 5, maxValue: 25, baseWeight: 1.2, minRarity: 'Common' },
  { id: 'aff-crit', name: 'of Precision', isPrefix: false, axis: 'offensive', tags: ['Stat.CritChance'], minValue: 2, maxValue: 12, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-cdmg', name: 'Devastating', isPrefix: true, axis: 'offensive', tags: ['Stat.CritDamage'], minValue: 10, maxValue: 50, baseWeight: 0.5, minRarity: 'Epic' },
  { id: 'aff-aspd', name: 'of Haste', isPrefix: false, axis: 'offensive', tags: ['Stat.AttackSpeed'], minValue: 3, maxValue: 15, baseWeight: 0.7, minRarity: 'Rare' },
  { id: 'aff-arm', name: 'Fortified', isPrefix: true, axis: 'defensive', tags: ['Stat.Armor'], minValue: 5, maxValue: 30, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-hp', name: 'of Vitality', isPrefix: false, axis: 'defensive', tags: ['Stat.MaxHealth'], minValue: 10, maxValue: 80, baseWeight: 1.3, minRarity: 'Common' },
  { id: 'aff-regen', name: 'Regenerating', isPrefix: true, axis: 'defensive', tags: ['Stat.HealthRegen'], minValue: 1, maxValue: 8, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-dodge', name: 'of Evasion', isPrefix: false, axis: 'defensive', tags: ['Stat.DodgeChance'], minValue: 2, maxValue: 10, baseWeight: 0.5, minRarity: 'Epic' },
  { id: 'aff-spd', name: 'of Swiftness', isPrefix: false, axis: 'utility', tags: ['Stat.MoveSpeed'], minValue: 3, maxValue: 12, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-cdr', name: 'Quickened', isPrefix: true, axis: 'utility', tags: ['Stat.CooldownReduction'], minValue: 2, maxValue: 10, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-mana', name: 'of Intellect', isPrefix: false, axis: 'utility', tags: ['Stat.MaxMana'], minValue: 10, maxValue: 60, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-mregen', name: 'Flowing', isPrefix: true, axis: 'utility', tags: ['Stat.ManaRegen'], minValue: 1, maxValue: 8, baseWeight: 0.7, minRarity: 'Rare' },
  { id: 'aff-gold', name: 'Prosperous', isPrefix: true, axis: 'economic', tags: ['Stat.GoldFind'], minValue: 5, maxValue: 30, baseWeight: 0.8, minRarity: 'Uncommon' },
  { id: 'aff-mf', name: 'of Fortune', isPrefix: false, axis: 'economic', tags: ['Stat.MagicFind'], minValue: 3, maxValue: 20, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-xp', name: 'of the Scholar', isPrefix: false, axis: 'economic', tags: ['Stat.XPBonus'], minValue: 3, maxValue: 15, baseWeight: 0.5, minRarity: 'Epic' },
];

/* ── Sub-tabs ────────────────────────────────────────────────────────── */

const SUB_TABS: SubTab[] = [
  { id: 'designer', label: 'Item Designer', icon: Wand2 },
  { id: 'distributions', label: 'Distributions', icon: BarChart3 },
  { id: 'heatmap', label: 'Co-Occurrence', icon: Grid3X3 },
  { id: 'code', label: 'UE5 Code', icon: Code },
];

/* ── Component ───────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AILootDesigner({ moduleId }: { moduleId: string }) {
  const [activeTab, setActiveTab] = useState('designer');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [rarity, setRarity] = useState<Rarity>('Legendary');
  const [itemLevel, setItemLevel] = useState(20);
  const [rollCount, setRollCount] = useState(2000);
  const [seed, setSeed] = useState(42);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const concept = ITEM_PRESETS[selectedPreset];

  // Build affix pool with weight overrides
  const affixPool = useMemo((): AffixPoolEntry[] => {
    const overrides = { ...concept.weightOverrides, ...customWeights };
    return BASE_AFFIX_POOL.map((a) => ({
      ...a,
      designerWeight: overrides[a.id] ?? a.baseWeight,
    }));
  }, [concept.weightOverrides, customWeights]);

  // Run simulation
  const simResult = useMemo((): DropSimResult => {
    const config: DropSimConfig = {
      affixPool,
      rarity,
      itemLevel,
      rollCount,
      seed,
    };
    return runDropSimulation(config);
  }, [affixPool, rarity, itemLevel, rollCount, seed]);

  const updateWeight = useCallback((affixId: string, value: number) => {
    setCustomWeights((prev) => ({ ...prev, [affixId]: value }));
  }, []);

  const resetWeights = useCallback(() => {
    setCustomWeights({});
  }, []);

  const reseed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  // UE5 code generation
  const ue5Code = useMemo(() => {
    const design: ItemDesign = {
      name: concept.name,
      displayName: concept.displayName,
      type: concept.type,
      rarity,
      description: concept.description,
      affixPool,
    };
    return generateUE5Code(design);
  }, [concept, rarity, affixPool]);

  return (
    <div className="space-y-2">
      <TabHeader
        icon={Wand2}
        title="AI Loot Designer"
        implemented={4}
        total={4}
        accent={ACCENT}
      />

      <SubTabNavigation
        tabs={SUB_TABS}
        activeTabId={activeTab}
        onChange={setActiveTab}
        accent={ACCENT}
      />

      {activeTab === 'designer' && (
        <DesignerPanel
          concept={concept}
          presets={ITEM_PRESETS}
          selectedPreset={selectedPreset}
          onSelectPreset={setSelectedPreset}
          affixPool={affixPool}
          customWeights={customWeights}
          onUpdateWeight={updateWeight}
          onResetWeights={resetWeights}
          rarity={rarity}
          onRarityChange={setRarity}
          itemLevel={itemLevel}
          onItemLevelChange={setItemLevel}
          rollCount={rollCount}
          onRollCountChange={setRollCount}
          seed={seed}
          onReseed={reseed}
          simResult={simResult}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        />
      )}

      {activeTab === 'distributions' && (
        <DistributionsPanel simResult={simResult} affixPool={affixPool} />
      )}

      {activeTab === 'heatmap' && (
        <CoOccurrencePanel simResult={simResult} affixPool={affixPool} />
      )}

      {activeTab === 'code' && (
        <CodePanel code={ue5Code} concept={concept} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Designer Panel — preset selection, weight tuning, live metrics
   ══════════════════════════════════════════════════════════════════════════ */

interface DesignerPanelProps {
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

function DesignerPanel({
  concept, presets, selectedPreset, onSelectPreset,
  affixPool, customWeights, onUpdateWeight, onResetWeights,
  rarity, onRarityChange, itemLevel, onItemLevelChange,
  rollCount, onRollCountChange, seed, onReseed,
  simResult, showAdvanced, onToggleAdvanced,
}: DesignerPanelProps) {
  return (
    <div className="space-y-2">
      {/* Preset selector */}
      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={Wand2} label="Item Concept" color={ACCENT} />
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
      </SurfaceCard>

      {/* Sim parameters */}
      <SurfaceCard level={2} className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Settings2} label="Simulation" color={ACCENT} />
          <div className="flex items-center gap-1.5">
            <button
              onClick={onReseed}
              className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface/50"
            >
              <RotateCcw className="w-3 h-3" /> Reseed
            </button>
            <span className="text-xs font-mono text-text-muted opacity-60">#{seed}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Rarity */}
          <div className="space-y-0.5">
            <span className="text-xs font-mono text-text-muted">Rarity</span>
            <select
              value={rarity}
              onChange={(e) => onRarityChange(e.target.value as Rarity)}
              className="w-full bg-surface-deep text-xs font-mono text-text rounded px-1.5 py-1 border border-border/40 focus:outline-none"
              style={{ color: RARITY_COLORS[rarity] }}
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Item Level */}
          <div className="space-y-0.5">
            <span className="text-xs font-mono text-text-muted">Level</span>
            <div className="flex items-center gap-1">
              <input
                type="range"
                min={1}
                max={50}
                value={itemLevel}
                onChange={(e) => onItemLevelChange(Number(e.target.value))}
                className="flex-1 h-1 accent-blue-500"
              />
              <span className="text-xs font-mono w-6 text-right" style={{ color: ACCENT }}>{itemLevel}</span>
            </div>
          </div>

          {/* Roll Count */}
          <div className="space-y-0.5">
            <span className="text-xs font-mono text-text-muted">Rolls</span>
            <select
              value={rollCount}
              onChange={(e) => onRollCountChange(Number(e.target.value))}
              className="w-full bg-surface-deep text-xs font-mono text-text rounded px-1.5 py-1 border border-border/40 focus:outline-none"
            >
              {[500, 1000, 2000, 5000, 10000].map((n) => (
                <option key={n} value={n}>{n.toLocaleString()}</option>
              ))}
            </select>
          </div>
        </div>
      </SurfaceCard>

      {/* Live metrics */}
      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={Play} label="Live Results" color={STATUS_SUCCESS} />
        <div className="grid grid-cols-4 gap-1.5">
          <MetricBox label="Avg Affixes" value={simResult.avgAffixCount.toFixed(1)} color={ACCENT} />
          <MetricBox label="Avg Power" value={simResult.avgPower.toFixed(0)} color={STATUS_WARNING} />
          <MetricBox label="Items Rolled" value={rollCount.toLocaleString()} color={STATUS_INFO} />
          <MetricBox label="Level Scale" value={`${(1 + 0.1 * Math.max(1, itemLevel)).toFixed(1)}×`} color={ACCENT_EMERALD} />
        </div>

        {/* Axis coverage bars */}
        <div className="space-y-1">
          <span className="text-xs font-mono text-text-muted font-bold">Axis Coverage</span>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(simResult.axisCoverage) as TraitAxis[]).map((ax) => {
              const pct = simResult.axisCoverage[ax];
              const Icon = AXIS_ICONS[ax];
              return (
                <div key={ax} className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs font-mono">
                    <Icon className="w-3 h-3" style={{ color: AXIS_COLORS[ax] }} />
                    <span style={{ color: AXIS_COLORS[ax] }}>{AXIS_LABELS[ax]}</span>
                    <span className="ml-auto text-text-muted">{(pct * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-deep rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: AXIS_COLORS[ax] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Power histogram */}
        <div className="space-y-1">
          <span className="text-xs font-mono text-text-muted font-bold">Power Distribution</span>
          <div className="flex items-end gap-px h-12">
            {simResult.powerHistogram.map((count, i) => {
              const maxH = Math.max(...simResult.powerHistogram) || 1;
              const h = (count / maxH) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all"
                  style={{
                    height: `${h}%`,
                    backgroundColor: ACCENT,
                    opacity: 0.3 + (h / 100) * 0.7,
                  }}
                  title={`Bucket ${i + 1}: ${count} items`}
                />
              );
            })}
          </div>
        </div>
      </SurfaceCard>

      {/* Weight tuning */}
      <SurfaceCard level={2} className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Settings2} label="Affix Weights" color={ACCENT_ORANGE} />
          <div className="flex items-center gap-1.5">
            <button
              onClick={onResetWeights}
              className="text-xs font-mono text-text-muted hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface/50"
            >
              Reset
            </button>
            <button
              onClick={onToggleAdvanced}
              className="flex items-center gap-0.5 text-xs font-mono text-text-muted hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface/50"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showAdvanced ? 'Less' : 'More'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {affixPool
            .filter((_, i) => showAdvanced || i < 8)
            .map((affix) => {
              const w = affix.designerWeight ?? affix.baseWeight;
              const isCustom = customWeights[affix.id] !== undefined;
              const eligible = RARITIES.indexOf(affix.minRarity as Rarity) <= RARITIES.indexOf(rarity);
              return (
                <div key={affix.id} className={`flex items-center gap-1.5 ${eligible ? '' : 'opacity-30'}`}>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: AXIS_COLORS[affix.axis] }}
                  />
                  <span className="text-xs font-mono text-text-muted truncate w-20">{affix.name}</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={Math.round(w * 10)}
                    onChange={(e) => onUpdateWeight(affix.id, Number(e.target.value) / 10)}
                    className="flex-1 h-1 accent-blue-500"
                    disabled={!eligible}
                  />
                  <span
                    className="text-xs font-mono w-8 text-right"
                    style={{ color: isCustom ? STATUS_WARNING : 'var(--text-muted)' }}
                  >
                    {w.toFixed(1)}
                  </span>
                </div>
              );
            })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Distributions Panel — frequency bars, magnitude histograms
   ══════════════════════════════════════════════════════════════════════════ */

function DistributionsPanel({ simResult }: { simResult: DropSimResult; affixPool: AffixPoolEntry[] }) {
  const sorted = useMemo(() =>
    [...simResult.affixDistributions]
      .filter((d) => d.frequency > 0)
      .sort((a, b) => b.frequency - a.frequency),
    [simResult.affixDistributions]
  );

  const maxFreq = sorted.length > 0 ? sorted[0].frequency : 1;

  return (
    <div className="space-y-2">
      {/* Frequency bar chart */}
      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={BarChart3} label="Affix Frequency" color={ACCENT} />
        <div className="space-y-1">
          {sorted.map((dist) => {
            const barW = (dist.frequency / maxFreq) * 100;
            return (
              <div key={dist.affixId} className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: AXIS_COLORS[dist.axis] }}
                />
                <span className="text-xs font-mono text-text-muted truncate w-24">{dist.name}</span>
                <div className="flex-1 h-3 bg-surface-deep rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: AXIS_COLORS[dist.axis] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${barW}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-xs font-mono w-10 text-right" style={{ color: AXIS_COLORS[dist.axis] }}>
                  {(dist.frequency * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Magnitude ranges */}
      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={BarChart3} label="Magnitude Ranges" color={STATUS_WARNING} />
        <div className="space-y-1">
          {sorted.map((dist) => (
            <div key={dist.affixId} className="flex items-center gap-1.5 text-xs font-mono">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: AXIS_COLORS[dist.axis] }}
              />
              <span className="text-text-muted truncate w-24">{dist.name}</span>
              <span className="text-text-muted">{dist.minMagnitude}</span>
              <div className="flex-1 h-2 bg-surface-deep rounded-full overflow-hidden relative">
                {/* Range bar */}
                <div
                  className="absolute h-full rounded-full opacity-30"
                  style={{
                    backgroundColor: AXIS_COLORS[dist.axis],
                    left: '0%',
                    width: '100%',
                  }}
                />
                {/* Average marker */}
                {dist.maxMagnitude > dist.minMagnitude && (
                  <div
                    className="absolute top-0 bottom-0 w-1 rounded-full"
                    style={{
                      backgroundColor: AXIS_COLORS[dist.axis],
                      left: `${((dist.avgMagnitude - dist.minMagnitude) / (dist.maxMagnitude - dist.minMagnitude)) * 100}%`,
                      boxShadow: `0 0 4px ${AXIS_COLORS[dist.axis]}`,
                    }}
                  />
                )}
              </div>
              <span style={{ color: AXIS_COLORS[dist.axis] }}>{dist.maxMagnitude}</span>
              <span className="text-text-muted opacity-60 w-10 text-right">avg {dist.avgMagnitude}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* Affix count breakdown */}
      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={BarChart3} label="Affix Count Distribution" color={ACCENT_EMERALD} />
        <div className="flex items-end gap-2 h-16">
          {simResult.rarityBreakdown.map((rb) => {
            const maxC = Math.max(...simResult.rarityBreakdown.map((r) => r.count)) || 1;
            const h = (rb.count / maxC) * 100;
            return (
              <div key={rb.affixCount} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-xs font-mono text-text-muted">{rb.count}</span>
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    backgroundColor: ACCENT_EMERALD,
                    opacity: 0.4 + (h / 100) * 0.6,
                  }}
                />
                <span className="text-xs font-mono text-text-muted">{rb.affixCount}</span>
              </div>
            );
          })}
        </div>
        <div className="text-xs font-mono text-text-muted text-center opacity-60">
          number of affixes per item
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Co-Occurrence Heatmap Panel
   ══════════════════════════════════════════════════════════════════════════ */

function CoOccurrencePanel({ simResult, affixPool }: { simResult: DropSimResult; affixPool: AffixPoolEntry[] }) {
  // Build matrix from affixes that actually appeared
  const activeAffixes = useMemo(() =>
    affixPool.filter((a) =>
      simResult.affixDistributions.some((d) => d.affixId === a.id && d.frequency > 0)
    ),
    [affixPool, simResult.affixDistributions]
  );

  const coMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const cell of simResult.coOccurrence) {
      m.set(`${cell.affixA}|${cell.affixB}`, cell.probability);
      m.set(`${cell.affixB}|${cell.affixA}`, cell.probability);
    }
    return m;
  }, [simResult.coOccurrence]);

  const rows = activeAffixes.map((a) => a.name);
  const cols = activeAffixes.map((a) => a.name);

  const cells = useMemo((): HeatmapCell[] => {
    const result: HeatmapCell[] = [];
    for (let ri = 0; ri < activeAffixes.length; ri++) {
      for (let ci = 0; ci < activeAffixes.length; ci++) {
        if (ri === ci) {
          // Diagonal: self-frequency
          const dist = simResult.affixDistributions.find((d) => d.affixId === activeAffixes[ri].id);
          result.push({
            row: ri, col: ci, value: dist?.frequency ?? 0,
            tooltip: `${activeAffixes[ri].name}: ${((dist?.frequency ?? 0) * 100).toFixed(0)}% occurrence`,
          });
        } else {
          const key = `${activeAffixes[ri].id}|${activeAffixes[ci].id}`;
          const prob = coMap.get(key) ?? 0;
          result.push({
            row: ri, col: ci, value: prob,
            tooltip: `${activeAffixes[ri].name} + ${activeAffixes[ci].name}: ${(prob * 100).toFixed(1)}%`,
          });
        }
      }
    }
    return result;
  }, [activeAffixes, coMap, simResult.affixDistributions]);

  // Top co-occurrence pairs
  const topPairs = useMemo(() =>
    [...simResult.coOccurrence]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 8),
    [simResult.coOccurrence]
  );

  return (
    <div className="space-y-2">
      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={Grid3X3} label="Affix Co-Occurrence Matrix" color={ACCENT} />
        <div className="overflow-x-auto custom-scrollbar">
          <HeatmapGrid
            rows={rows}
            cols={cols}
            cells={cells}
            accent={ACCENT}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={BarChart3} label="Top Affix Pairs" color={ACCENT_VIOLET} />
        <div className="space-y-1">
          {topPairs.map((pair, i) => {
            const nameA = affixPool.find((a) => a.id === pair.affixA)?.name ?? pair.affixA;
            const nameB = affixPool.find((a) => a.id === pair.affixB)?.name ?? pair.affixB;
            const axisA = affixPool.find((a) => a.id === pair.affixA)?.axis ?? 'offensive';
            const axisB = affixPool.find((a) => a.id === pair.affixB)?.axis ?? 'offensive';
            return (
              <div key={`${pair.affixA}-${pair.affixB}`} className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-text-muted w-4">{i + 1}.</span>
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${AXIS_COLORS[axisA]}${OPACITY_10}`, color: AXIS_COLORS[axisA] }}
                >
                  {nameA}
                </span>
                <span className="text-text-muted">+</span>
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${AXIS_COLORS[axisB]}${OPACITY_10}`, color: AXIS_COLORS[axisB] }}
                >
                  {nameB}
                </span>
                <span className="ml-auto" style={{ color: ACCENT_VIOLET }}>
                  {(pair.probability * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Code Panel — UE5 C++ generation
   ══════════════════════════════════════════════════════════════════════════ */

function CodePanel({ code, concept }: { code: string; concept: ItemConcept }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <div className="space-y-2">
      <SurfaceCard level={2} className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Code} label={`UE5 Code: ${concept.displayName}`} color={ACCENT} />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors"
            style={{
              backgroundColor: copied ? `${STATUS_SUCCESS}${OPACITY_20}` : `${ACCENT}${OPACITY_10}`,
              color: copied ? STATUS_SUCCESS : ACCENT,
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="bg-surface-deep rounded-lg p-3 text-xs font-mono text-text overflow-x-auto custom-scrollbar whitespace-pre leading-relaxed border border-border/40 max-h-[500px] overflow-y-auto">
          {code}
        </pre>
      </SurfaceCard>

      <SurfaceCard level={2} className="p-2 space-y-2">
        <SectionLabel icon={Settings2} label="Integration Steps" color={STATUS_WARNING} />
        <div className="space-y-1 text-xs text-text-muted">
          <IntegrationStep num={1} text="Create a UARPGItemDefinition Data Asset from the generated code" />
          <IntegrationStep num={2} text="Add rows to DT_AffixPool DataTable using the weight values above" />
          <IntegrationStep num={3} text="Create the GE_OnEquip GameplayEffect with SetByCaller modifiers" />
          <IntegrationStep num={4} text="Assign the AffixPool reference to the ItemDefinition" />
          <IntegrationStep num={5} text="Test with UARPGAffixRoller::RollAffixes to verify distributions match" />
        </div>
      </SurfaceCard>
    </div>
  );
}

function IntegrationStep({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT }}
      >
        {num}
      </span>
      <span>{text}</span>
    </div>
  );
}

/* ── Metric box helper ───────────────────────────────────────────────── */

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center border border-border/30"
      style={{ backgroundColor: `${color}${OPACITY_10}` }}
    >
      <div className="text-sm font-mono font-bold" style={{ color }}>{value}</div>
      <div className="text-xs font-mono text-text-muted truncate">{label}</div>
    </div>
  );
}
