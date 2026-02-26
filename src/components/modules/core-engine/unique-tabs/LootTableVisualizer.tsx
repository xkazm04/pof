'use client';

import { useMemo, useState, useCallback } from 'react';
import { Coins, Dices, Package, BarChart3, Diff, Clock, Sparkles, SlidersHorizontal, Timer, Radio, Calculator, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_8, OPACITY_20, OPACITY_30,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { TabHeader, PipelineFlow, SectionLabel, FeatureCard, LoadingSpinner, LiveMetricGauge, DiffViewer, HeatmapGrid } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import type { GaugeMetric, DiffEntry, HeatmapCell } from '@/types/unique-tab-improvements';

const ACCENT = ACCENT_ORANGE;

/* ── Rarity tiers ──────────────────────────────────────────────────────────── */

interface RarityTier {
  name: string;
  color: string;
  weight: number;
}

const RARITY_TIERS: RarityTier[] = [
  { name: 'Common', color: '#94a3b8', weight: 50 },
  { name: 'Uncommon', color: ACCENT_EMERALD, weight: 25 },
  { name: 'Rare', color: '#60a5fa', weight: 15 },
  { name: 'Epic', color: '#a78bfa', weight: 8 },
  { name: 'Legendary', color: '#fbbf24', weight: 2 },
];

const TOTAL_WEIGHT = RARITY_TIERS.reduce((sum, t) => sum + t.weight, 0);

/* ── World item examples per rarity ───────────────────────────────────────── */

const WORLD_ITEMS = [
  { name: 'Iron Sword', rarity: 'Common', beamColor: '#94a3b8', pickup: 'Auto-pickup on overlap' },
  { name: 'Forest Bow', rarity: 'Uncommon', beamColor: ACCENT_EMERALD, pickup: 'Prompt on interact' },
  { name: 'Azure Staff', rarity: 'Rare', beamColor: '#60a5fa', pickup: 'Highlight + prompt' },
  { name: 'Shadow Cloak', rarity: 'Epic', beamColor: '#a78bfa', pickup: 'Glow + prompt + SFX' },
  { name: 'Sunfire Amulet', rarity: 'Legendary', beamColor: '#fbbf24', pickup: 'Beam + VFX + fanfare' },
];

/* ── Feature names for this module ────────────────────────────────────────── */

const LOOT_FEATURES = [
  'UARPGLootTable',
  'Weighted random selection',
  'AARPGWorldItem',
  'Loot drop on death',
  'Item pickup',
  'Loot visual feedback',
  'Chest/container actors',
];

/* ── 7.1 Treemap static data ──────────────────────────────────────────────── */

interface TreemapRect {
  name: string;
  probability: number;
  color: string;
  affixes: string[];
}

const TREEMAP_DATA: TreemapRect[] = [
  { name: 'Common', probability: 50, color: '#94a3b8', affixes: ['Sturdy', 'Worn', 'Basic', 'Plain'] },
  { name: 'Uncommon', probability: 25, color: ACCENT_EMERALD, affixes: ['Keen', 'Swift', 'Reinforced'] },
  { name: 'Rare', probability: 15, color: '#60a5fa', affixes: ['Blazing', 'Frozen', 'Vampiric'] },
  { name: 'Epic', probability: 8, color: '#a78bfa', affixes: ['Celestial', 'Void-touched'] },
  { name: 'Legendary', probability: 2, color: '#fbbf24', affixes: ['Godslayer'] },
];

/* ── 7.3 Loot Table Diff data ─────────────────────────────────────────────── */

const LOOT_DIFF_ENTRIES: DiffEntry[] = [
  { field: 'Common weight', oldValue: 50, newValue: 35, changeType: 'changed' },
  { field: 'Uncommon weight', oldValue: 25, newValue: 25, changeType: 'unchanged' },
  { field: 'Rare weight', oldValue: 15, newValue: 20, changeType: 'changed' },
  { field: 'Epic weight', oldValue: 8, newValue: 15, changeType: 'changed' },
  { field: 'Legendary weight', oldValue: 2, newValue: 5, changeType: 'changed' },
];

/* ── 7.4 Expected Drops data ──────────────────────────────────────────────── */

const DROPS_PER_HOUR_GAUGE: GaugeMetric = { label: 'Items/Hour', current: 45, target: 60, unit: '/hr' };
const GOLD_PER_HOUR_GAUGE: GaugeMetric = { label: 'Gold/Hour', current: 2300, target: 3000, unit: 'g' };

const DROP_SOURCE_BREAKDOWN = [
  { source: 'Grunt', pct: 40, color: '#94a3b8' },
  { source: 'Caster', pct: 30, color: '#60a5fa' },
  { source: 'Boss', pct: 20, color: '#a78bfa' },
  { source: 'Chest', pct: 10, color: '#fbbf24' },
];

/* ── 7.5 Affix data ──────────────────────────────────────────────────────── */

const AFFIX_POOL = [
  'Blazing', 'Frozen', 'Vampiric', 'Swift', 'Sturdy', 'Keen', 'Celestial', 'Void-touched',
  'Thorned', 'Lucky', 'Empowered', 'Berserker',
];

const AFFIX_COOCCURRENCE_ROWS = ['Blazing', 'Frozen', 'Vampiric', 'Swift'];
const AFFIX_COOCCURRENCE_COLS = ['Keen', 'Sturdy', 'Lucky', 'Thorned'];

const AFFIX_COOCCURRENCE_CELLS: HeatmapCell[] = [
  { row: 0, col: 0, value: 0.8, label: '80%' }, { row: 0, col: 1, value: 0.3, label: '30%' }, { row: 0, col: 2, value: 0.5, label: '50%' }, { row: 0, col: 3, value: 0.2, label: '20%' },
  { row: 1, col: 0, value: 0.4, label: '40%' }, { row: 1, col: 1, value: 0.6, label: '60%' }, { row: 1, col: 2, value: 0.3, label: '30%' }, { row: 1, col: 3, value: 0.7, label: '70%' },
  { row: 2, col: 0, value: 0.2, label: '20%' }, { row: 2, col: 1, value: 0.5, label: '50%' }, { row: 2, col: 2, value: 0.9, label: '90%' }, { row: 2, col: 3, value: 0.1, label: '10%' },
  { row: 3, col: 0, value: 0.6, label: '60%' }, { row: 3, col: 1, value: 0.4, label: '40%' }, { row: 3, col: 2, value: 0.7, label: '70%' }, { row: 3, col: 3, value: 0.5, label: '50%' },
];

/* ── 7.6 Loot Table Editor default entries ────────────────────────────────── */

interface LootEditorEntry {
  id: string;
  name: string;
  weight: number;
  rarity: string;
  color: string;
}

const DEFAULT_EDITOR_ENTRIES: LootEditorEntry[] = [
  { id: 'e1', name: 'Iron Sword', weight: 35, rarity: 'Common', color: '#94a3b8' },
  { id: 'e2', name: 'Forest Bow', weight: 25, rarity: 'Uncommon', color: ACCENT_EMERALD },
  { id: 'e3', name: 'Azure Staff', weight: 20, rarity: 'Rare', color: '#60a5fa' },
  { id: 'e4', name: 'Shadow Cloak', weight: 15, rarity: 'Epic', color: '#a78bfa' },
  { id: 'e5', name: 'Sunfire Amulet', weight: 5, rarity: 'Legendary', color: '#fbbf24' },
];

/* ── 7.8 Beacon config data ───────────────────────────────────────────────── */

interface BeaconConfig {
  rarity: string;
  color: string;
  beamHeight: number;
  pulseSpeed: number;
  pickupRadius: number;
}

const BEACON_CONFIGS: BeaconConfig[] = [
  { rarity: 'Common', color: '#94a3b8', beamHeight: 20, pulseSpeed: 0, pickupRadius: 50 },
  { rarity: 'Uncommon', color: ACCENT_EMERALD, beamHeight: 40, pulseSpeed: 1, pickupRadius: 80 },
  { rarity: 'Rare', color: '#60a5fa', beamHeight: 60, pulseSpeed: 2, pickupRadius: 120 },
  { rarity: 'Epic', color: '#a78bfa', beamHeight: 80, pulseSpeed: 3, pickupRadius: 160 },
  { rarity: 'Legendary', color: '#fbbf24', beamHeight: 100, pulseSpeed: 4, pickupRadius: 200 },
];

/* ── 7.9 Economy Impact data ──────────────────────────────────────────────── */

const ECONOMY_SURPLUS = [
  { type: 'Weapons', delta: +5, color: STATUS_SUCCESS },
  { type: 'Armor', delta: +3, color: STATUS_SUCCESS },
  { type: 'Consumables', delta: -2, color: STATUS_ERROR },
  { type: 'Materials', delta: +1, color: STATUS_SUCCESS },
  { type: 'Gems', delta: -1, color: STATUS_ERROR },
];

/* ── 7.10 Smart Loot data ─────────────────────────────────────────────────── */

interface SmartLootSlot {
  slot: string;
  rawPct: number;
  smartPct: number;
  gearScoreGap: number;
}

const SMART_LOOT_DATA: SmartLootSlot[] = [
  { slot: 'Helmet', rawPct: 12, smartPct: 18, gearScoreGap: 15 },
  { slot: 'Chest', rawPct: 12, smartPct: 8, gearScoreGap: 3 },
  { slot: 'Legs', rawPct: 12, smartPct: 16, gearScoreGap: 12 },
  { slot: 'Boots', rawPct: 12, smartPct: 14, gearScoreGap: 8 },
  { slot: 'Weapon', rawPct: 16, smartPct: 22, gearScoreGap: 20 },
  { slot: 'Shield', rawPct: 12, smartPct: 6, gearScoreGap: 2 },
  { slot: 'Ring', rawPct: 12, smartPct: 10, gearScoreGap: 5 },
  { slot: 'Amulet', rawPct: 12, smartPct: 6, gearScoreGap: 1 },
];

/* ── Helper: squarified treemap layout ────────────────────────────────────── */

function computeTreemapLayout(data: TreemapRect[], w: number, h: number) {
  const total = data.reduce((s, d) => s + d.probability, 0);
  const rects: { x: number; y: number; w: number; h: number; item: TreemapRect }[] = [];
  let x = 0;
  let y = 0;
  let remainingW = w;
  let remainingH = h;
  let horizontal = true;

  for (const item of data) {
    const ratio = item.probability / total;
    if (horizontal) {
      const rw = remainingW * ratio / (data.slice(data.indexOf(item)).reduce((s, d) => s + d.probability, 0) / total);
      rects.push({ x, y, w: Math.max(rw, 0), h: remainingH, item });
      x += rw;
    } else {
      const rh = remainingH * ratio / (data.slice(data.indexOf(item)).reduce((s, d) => s + d.probability, 0) / total);
      rects.push({ x, y, w: remainingW, h: Math.max(rh, 0), item });
      y += rh;
    }
    if (rects.length === 1) {
      if (horizontal) { remainingW -= rects[0].w; x = rects[0].x + rects[0].w; } else { remainingH -= rects[0].h; y = rects[0].y + rects[0].h; }
    }
    horizontal = !horizontal;
  }
  return rects;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

interface LootTableVisualizerProps {
  moduleId: SubModuleId;
}

export function LootTableVisualizer({ moduleId }: LootTableVisualizerProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [rollCount, setRollCount] = useState<number | null>(null);
  const [rollResults, setRollResults] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  /* 7.1 Treemap state */
  const [treemapHover, setTreemapHover] = useState<string | null>(null);
  const [treemapDrill, setTreemapDrill] = useState<string | null>(null);

  /* 7.2 Monte Carlo state */
  const [mcRollCount, setMcRollCount] = useState<number | null>(null);
  const [mcResults, setMcResults] = useState<{ tally: Record<string, number[]>; total: number } | null>(null);

  /* 7.4 Drops per hour state */
  const [playerLevel, setPlayerLevel] = useState(20);

  /* 7.5 Affix state */
  const [affixSlots, setAffixSlots] = useState<string[]>(['?', '?', '?']);
  const [affixSpinning, setAffixSpinning] = useState(false);
  const [affixHistory, setAffixHistory] = useState<Record<string, number>>({});
  const [affixRollCount, setAffixRollCount] = useState(0);

  /* 7.6 Editor state */
  const [editorEntries, setEditorEntries] = useState<LootEditorEntry[]>(DEFAULT_EDITOR_ENTRIES);
  const [editorHistory, setEditorHistory] = useState<LootEditorEntry[][]>([DEFAULT_EDITOR_ENTRIES]);
  const [showEditorJson, setShowEditorJson] = useState(false);

  /* 7.7 Pity timer state */
  const [pityCount, setPityCount] = useState(0);
  const [pityThreshold, setPityThreshold] = useState(20);
  const [pityHistory, setPityHistory] = useState<number[]>([]);
  const [lastRareAt, setLastRareAt] = useState(0);

  /* 7.8 Beacon state */
  const [colorblindMode, setColorblindMode] = useState(false);

  /* 7.9 Economy state */
  const [economyProfile, setEconomyProfile] = useState<'casual' | 'hardcore'>('casual');

  /* 7.10 Smart loot state */
  const [smartMode, setSmartMode] = useState(false);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    let implemented = 0;
    for (const name of LOOT_FEATURES) {
      const status = featureMap.get(name)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
    }
    return { total: LOOT_FEATURES.length, implemented };
  }, [featureMap]);

  const rollDrops = useCallback((n: number) => {
    setRollCount(n);
    const tally: Record<string, number> = {};
    for (const t of RARITY_TIERS) tally[t.name] = 0;
    for (let i = 0; i < n; i++) {
      let roll = Math.random() * TOTAL_WEIGHT;
      for (const tier of RARITY_TIERS) {
        roll -= tier.weight;
        if (roll <= 0) { tally[tier.name]++; break; }
      }
    }
    setRollResults(tally);
  }, []);

  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  /* 7.1 Treemap layout */
  const treemapLayout = useMemo(() => computeTreemapLayout(TREEMAP_DATA, 260, 120), []);

  /* 7.2 Monte Carlo roller */
  const runMonteCarlo = useCallback((n: number) => {
    setMcRollCount(n);
    const runs = 10;
    const tally: Record<string, number[]> = {};
    for (const t of RARITY_TIERS) tally[t.name] = [];
    for (let run = 0; run < runs; run++) {
      const counts: Record<string, number> = {};
      for (const t of RARITY_TIERS) counts[t.name] = 0;
      for (let i = 0; i < n; i++) {
        let roll = Math.random() * TOTAL_WEIGHT;
        for (const tier of RARITY_TIERS) {
          roll -= tier.weight;
          if (roll <= 0) { counts[tier.name]++; break; }
        }
      }
      for (const t of RARITY_TIERS) tally[t.name].push(counts[t.name]);
    }
    setMcResults({ tally, total: n });
  }, []);

  /* 7.5 Affix roller */
  const spinAffixes = useCallback(() => {
    setAffixSpinning(true);
    setTimeout(() => {
      const picks = [0, 1, 2].map(() => AFFIX_POOL[Math.floor(Math.random() * AFFIX_POOL.length)]);
      setAffixSlots(picks);
      setAffixSpinning(false);
      setAffixRollCount((c) => c + 1);
      setAffixHistory((prev) => {
        const next = { ...prev };
        for (const p of picks) next[p] = (next[p] ?? 0) + 1;
        return next;
      });
    }, 600);
  }, []);

  /* 7.6 Editor helpers */
  const editorTotalWeight = useMemo(() => editorEntries.reduce((s, e) => s + e.weight, 0), [editorEntries]);
  const updateEditorWeight = useCallback((id: string, weight: number) => {
    setEditorEntries((prev) => {
      const next = prev.map((e) => e.id === id ? { ...e, weight } : e);
      setEditorHistory((h) => [...h, next]);
      return next;
    });
  }, []);
  const addEditorEntry = useCallback(() => {
    const id = `e${Date.now()}`;
    setEditorEntries((prev) => {
      const next = [...prev, { id, name: 'New Item', weight: 0, rarity: 'Common', color: '#94a3b8' }];
      setEditorHistory((h) => [...h, next]);
      return next;
    });
  }, []);
  const removeEditorEntry = useCallback((id: string) => {
    setEditorEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      setEditorHistory((h) => [...h, next]);
      return next;
    });
  }, []);
  const undoEditor = useCallback(() => {
    if (editorHistory.length > 1) {
      const newHistory = editorHistory.slice(0, -1);
      setEditorHistory(newHistory);
      setEditorEntries(newHistory[newHistory.length - 1]);
    }
  }, [editorHistory]);

  /* 7.7 Pity timer drop */
  const doPityDrop = useCallback(() => {
    const forced = pityCount + 1 >= pityThreshold;
    let gotRare = false;
    if (forced) {
      gotRare = true;
    } else {
      let roll = Math.random() * TOTAL_WEIGHT;
      for (const tier of RARITY_TIERS) {
        roll -= tier.weight;
        if (roll <= 0) {
          if (tier.name === 'Rare' || tier.name === 'Epic' || tier.name === 'Legendary') gotRare = true;
          break;
        }
      }
    }
    if (gotRare) {
      setPityHistory((prev) => [...prev, pityCount + 1]);
      setPityCount(0);
      setLastRareAt(pityCount + 1);
    } else {
      setPityCount((c) => c + 1);
    }
  }, [pityCount, pityThreshold]);

  /* 7.4 Level-adjusted metrics */
  const levelMultiplier = 1 + (playerLevel - 1) * 0.04;
  const adjItemsPerHour = Math.round(45 * levelMultiplier);
  const adjGoldPerHour = Math.round(2300 * levelMultiplier);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-3">
      {/* Header + pipeline */}
      <TabHeader icon={Coins} title="Loot Table Visualizer" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <SurfaceCard level={2} className="p-3">
        <SectionLabel label="Pipeline" />
        <div className="mt-2">
          <PipelineFlow steps={['LootTable', 'WeightedRandom', 'WorldItem', 'Pickup', 'Inventory']} accent={ACCENT} />
        </div>
      </SurfaceCard>

      {/* Stacked weight bar + rarity distribution */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <SurfaceCard level={2} className="p-3">
          <div className="text-2xs text-text-muted font-medium mb-2">Drop Weight Distribution</div>
          <div className="flex h-5 rounded overflow-hidden w-full">
            {RARITY_TIERS.map((tier) => (
              <div
                key={tier.name}
                title={`${tier.name}: ${tier.weight}% weight`}
                style={{ width: `${(tier.weight / TOTAL_WEIGHT) * 100}%`, backgroundColor: tier.color }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {RARITY_TIERS.map((tier) => (
              <span key={tier.name} className="flex items-center gap-1 text-2xs text-text-muted">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: tier.color }} />
                {tier.name}
              </span>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard level={2} className="p-3 min-w-[140px]">
          <div className="text-2xs text-text-muted font-medium mb-2">Rarity %</div>
          <div className="space-y-1">
            {RARITY_TIERS.map((tier) => (
              <div key={tier.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }} />
                <span className="text-2xs text-text w-16">{tier.name}</span>
                <span className="text-2xs font-mono text-text-muted ml-auto">
                  {((tier.weight / TOTAL_WEIGHT) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* Drop simulator */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Dices className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
          <span className="text-xs font-semibold text-text">Drop Simulator</span>
          <div className="flex gap-1 ml-auto">
            {[10, 100, 1000].map((n) => (
              <button
                key={n}
                onClick={() => rollDrops(n)}
                className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
                style={{
                  borderColor: `${ACCENT_CYAN}${OPACITY_30}`,
                  backgroundColor: rollCount === n ? `${ACCENT_CYAN}${OPACITY_20}` : 'transparent',
                  color: ACCENT_CYAN,
                }}
              >
                Roll {n}
              </button>
            ))}
          </div>
        </div>
        {rollCount !== null ? (
          <div className="flex flex-wrap gap-2">
            {RARITY_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
                style={{ borderColor: `${tier.color}${OPACITY_30}`, backgroundColor: `${tier.color}${OPACITY_8}` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                <span className="text-xs text-text">{tier.name}</span>
                <span className="text-xs font-mono font-semibold" style={{ color: tier.color }}>
                  {rollResults[tier.name] ?? 0}
                </span>
              </div>
            ))}
            <span className="text-2xs text-text-muted self-center">/ {rollCount} drops</span>
          </div>
        ) : (
          <p className="text-2xs text-text-muted italic">Click a button to simulate drops.</p>
        )}
      </SurfaceCard>

      {/* World item preview */}
      <div>
        <div className="mb-2 px-1"><SectionLabel label="World Item Preview" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WORLD_ITEMS.map((item) => (
            <motion.div
              key={item.name}
              whileHover={{ y: -4, scale: 1.02 }}
              className="relative group h-full"
              style={{ perspective: 1000 }}
            >
              <SurfaceCard level={2} className="h-full px-3 py-3 flex items-start gap-3 relative overflow-hidden transition-all duration-300 border border-transparent group-hover:border-text-muted/20"
                style={{
                  boxShadow: `0 4px 15px -5px rgba(0,0,0,0.5), inset 0 0 10px -5px ${item.beamColor}40`,
                }}
              >
                {/* Glow & Particles */}
                <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: item.beamColor }} />
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" style={{ backgroundImage: `radial-gradient(circle at center, ${item.beamColor}20 1px, transparent 1px)`, backgroundSize: '8px 8px' }} />

                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0 relative z-10 shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: item.beamColor, color: item.beamColor }}
                />
                <div className="min-w-0 relative z-10 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded bg-surface border border-border/50 shadow-inner">
                      <Package className="w-3.5 h-3.5 flex-shrink-0" style={{ color: item.beamColor, filter: `drop-shadow(0 0 4px ${item.beamColor}80)` }} />
                    </div>
                    <span className="text-sm font-bold text-text truncate tracking-wide">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.beamColor, boxShadow: `0 0 5px ${item.beamColor}` }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: item.beamColor }}>{item.rarity}</span>
                  </div>
                  <p className="text-xs text-text-muted bg-surface-deep/50 px-2 py-1.5 rounded border border-border/30 shadow-inner leading-relaxed">{item.pickup}</p>
                </div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ═══ 7.1 Drop Probability Treemap ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-semibold text-text">Drop Probability Treemap</span>
        </div>
        <svg width={260} height={120} viewBox="0 0 260 120" className="w-full max-w-[260px]">
          {treemapLayout.map((rect) => (
            <g
              key={rect.item.name}
              onMouseEnter={() => setTreemapHover(rect.item.name)}
              onMouseLeave={() => setTreemapHover(null)}
              onClick={() => setTreemapDrill((prev) => prev === rect.item.name ? null : rect.item.name)}
              className="cursor-pointer"
            >
              <rect
                x={rect.x} y={rect.y} width={Math.max(rect.w, 0)} height={Math.max(rect.h, 0)}
                fill={rect.item.color}
                opacity={treemapHover === rect.item.name ? 0.9 : 0.65}
                rx={2}
                stroke="rgba(0,0,0,0.3)" strokeWidth={1}
              />
              {rect.w > 30 && rect.h > 20 && (
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 - 4}
                  textAnchor="middle" dominantBaseline="central"
                  className="text-[10px] font-mono font-bold fill-white pointer-events-none"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {rect.item.name}
                </text>
              )}
              {rect.w > 30 && rect.h > 34 && (
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + 10}
                  textAnchor="middle" dominantBaseline="central"
                  className="text-[9px] font-mono fill-white/70 pointer-events-none"
                >
                  {rect.item.probability}%
                </text>
              )}
            </g>
          ))}
        </svg>
        {treemapHover && (
          <div className="mt-2 text-2xs text-text-muted font-mono">
            Hover: <span className="text-text">{treemapHover}</span> - {TREEMAP_DATA.find((d) => d.name === treemapHover)?.probability}% drop rate
          </div>
        )}
        <AnimatePresence>
          {treemapDrill && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-2 rounded border border-border/40 bg-surface/50">
                <div className="text-2xs font-semibold text-text mb-1">
                  {treemapDrill} Affix Outcomes:
                </div>
                <div className="flex flex-wrap gap-1">
                  {TREEMAP_DATA.find((d) => d.name === treemapDrill)?.affixes.map((affix) => (
                    <span key={affix} className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${TREEMAP_DATA.find((d) => d.name === treemapDrill)?.color ?? ACCENT}${OPACITY_20}`, color: TREEMAP_DATA.find((d) => d.name === treemapDrill)?.color ?? ACCENT }}>
                      {affix}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SurfaceCard>

      {/* ═══ 7.2 Monte Carlo Loot Simulation ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Dices className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="text-xs font-semibold text-text">Monte Carlo Simulation</span>
          <div className="flex gap-1 ml-auto">
            {[10, 100, 1000, 10000].map((n) => (
              <button
                key={n}
                onClick={() => runMonteCarlo(n)}
                className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
                style={{
                  borderColor: `#a78bfa${OPACITY_30}`,
                  backgroundColor: mcRollCount === n ? `#a78bfa${OPACITY_20}` : 'transparent',
                  color: '#a78bfa',
                }}
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
        {mcResults ? (
          <div className="space-y-3">
            {/* Stats table */}
            <div className="overflow-x-auto">
              <table className="w-full text-2xs font-mono">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-left py-1 pr-2">Rarity</th>
                    <th className="text-right py-1 px-1">Mean</th>
                    <th className="text-right py-1 px-1">Median</th>
                    <th className="text-right py-1 px-1">Mode</th>
                    <th className="text-right py-1 px-1">Min</th>
                    <th className="text-right py-1 px-1">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {RARITY_TIERS.map((tier) => {
                    const vals = mcResults.tally[tier.name].sort((a, b) => a - b);
                    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
                    const median = vals[Math.floor(vals.length / 2)];
                    const freqMap = new Map<number, number>();
                    for (const v of vals) freqMap.set(v, (freqMap.get(v) ?? 0) + 1);
                    let mode = vals[0];
                    let maxFreq = 0;
                    for (const [v, f] of freqMap) { if (f > maxFreq) { maxFreq = f; mode = v; } }
                    return (
                      <tr key={tier.name} className="border-t border-border/20">
                        <td className="py-1 pr-2 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                          <span style={{ color: tier.color }}>{tier.name}</span>
                        </td>
                        <td className="text-right py-1 px-1 text-text">{mean.toFixed(1)}</td>
                        <td className="text-right py-1 px-1 text-text">{median}</td>
                        <td className="text-right py-1 px-1 text-text">{mode}</td>
                        <td className="text-right py-1 px-1 text-text-muted">{vals[0]}</td>
                        <td className="text-right py-1 px-1 text-text-muted">{vals[vals.length - 1]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Histogram bars */}
            <div className="space-y-1">
              <div className="text-2xs text-text-muted font-medium">Distribution (avg of 10 runs)</div>
              {RARITY_TIERS.map((tier) => {
                const avg = mcResults.tally[tier.name].reduce((s, v) => s + v, 0) / mcResults.tally[tier.name].length;
                const pct = (avg / mcResults.total) * 100;
                return (
                  <div key={tier.name} className="flex items-center gap-2">
                    <span className="text-2xs font-mono w-20 text-text-muted truncate">{tier.name}</span>
                    <div className="flex-1 h-3 bg-surface-deep rounded overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded"
                        style={{ backgroundColor: tier.color }}
                      />
                    </div>
                    <span className="text-2xs font-mono w-12 text-right" style={{ color: tier.color }}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            {/* Expected value per kill */}
            <div className="flex items-center gap-2 p-2 rounded border border-border/30 bg-surface/30">
              <span className="text-2xs text-text-muted">Expected value per kill:</span>
              <span className="text-xs font-mono font-semibold" style={{ color: '#fbbf24' }}>
                {(RARITY_TIERS.reduce((s, t) => s + (t.weight / TOTAL_WEIGHT) * ({ Common: 5, Uncommon: 15, Rare: 50, Epic: 200, Legendary: 1000 }[t.name] ?? 0), 0)).toFixed(1)} gold
              </span>
            </div>
          </div>
        ) : (
          <p className="text-2xs text-text-muted italic">Select a sample size to run 10 Monte Carlo simulations.</p>
        )}
      </SurfaceCard>

      {/* ═══ 7.3 Loot Table Diff Viewer ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Diff className="w-3.5 h-3.5" style={{ color: ACCENT_EMERALD }} />
          <span className="text-xs font-semibold text-text">Loot Table Diff</span>
          <span className="text-2xs text-text-muted ml-1">Level 10 Boss vs Level 20 Boss</span>
        </div>
        <DiffViewer entries={LOOT_DIFF_ENTRIES} accent={ACCENT_EMERALD} />
        <div className="mt-2 flex gap-3 text-2xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_WARNING }} />
            Changed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#64748b' }} />
            Unchanged
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_SUCCESS }} />
            Increased rate
          </span>
        </div>
      </SurfaceCard>

      {/* ═══ 7.4 Expected Drops per Hour ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
          <span className="text-xs font-semibold text-text">Expected Drops per Hour</span>
        </div>
        {/* Player level slider */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xs text-text-muted">Player Level:</span>
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
            <LiveMetricGauge metric={{ ...GOLD_PER_HOUR_GAUGE, current: adjGoldPerHour }} accent="#fbbf24" />
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-2xs text-text-muted font-medium uppercase tracking-widest">Time to Legendary</span>
            <span className="text-lg font-mono font-bold" style={{ color: '#fbbf24' }}>
              {(8.5 / levelMultiplier).toFixed(1)}h
            </span>
            <span className="text-2xs text-text-muted">estimated</span>
          </div>
        </div>
        {/* Source breakdown pie-like bar */}
        <div className="space-y-1">
          <div className="text-2xs text-text-muted font-medium">Drop Source Breakdown</div>
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
      </SurfaceCard>

      {/* ═══ 7.5 Affix Roll Simulator ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} />
          <span className="text-xs font-semibold text-text">Affix Roll Simulator</span>
          <span className="text-2xs text-text-muted ml-auto font-mono">Godroll: 0.02%</span>
        </div>
        {/* Slot machine */}
        <div className="flex items-center justify-center gap-3 mb-3">
          {affixSlots.map((slot, i) => (
            <motion.div
              key={i}
              className="w-24 h-12 rounded-lg border flex items-center justify-center text-xs font-mono font-bold overflow-hidden"
              style={{ borderColor: `#fbbf24${OPACITY_30}`, backgroundColor: `#fbbf24${OPACITY_8}`, color: '#fbbf24' }}
              animate={affixSpinning ? { y: [0, -10, 10, -5, 5, 0] } : {}}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
              {affixSpinning ? '...' : slot}
            </motion.div>
          ))}
          <button
            onClick={spinAffixes}
            disabled={affixSpinning}
            className="text-xs font-semibold px-3 py-2 rounded-lg border transition-all hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: `#fbbf24${OPACITY_30}`, backgroundColor: `#fbbf24${OPACITY_20}`, color: '#fbbf24' }}
          >
            Spin
          </button>
        </div>
        {affixRollCount > 0 && (
          <div className="text-2xs text-text-muted mb-2 text-center font-mono">{affixRollCount} roll{affixRollCount !== 1 ? 's' : ''} performed</div>
        )}
        {/* Frequency table */}
        {Object.keys(affixHistory).length > 0 && (
          <div className="space-y-1 mb-3">
            <div className="text-2xs text-text-muted font-medium">Affix Frequency</div>
            {Object.entries(affixHistory).sort((a, b) => b[1] - a[1]).map(([affix, count]) => (
              <div key={affix} className="flex items-center gap-2">
                <span className="text-2xs font-mono w-20 text-text truncate">{affix}</span>
                <div className="flex-1 h-2 bg-surface-deep rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(count / (affixRollCount * 3)) * 100}%`, backgroundColor: '#fbbf24' }} />
                </div>
                <span className="text-2xs font-mono w-6 text-right text-text-muted">{count}</span>
              </div>
            ))}
          </div>
        )}
        {/* Co-occurrence matrix */}
        <div className="text-2xs text-text-muted font-medium mb-1">Affix Co-occurrence Matrix</div>
        <HeatmapGrid
          rows={AFFIX_COOCCURRENCE_ROWS}
          cols={AFFIX_COOCCURRENCE_COLS}
          cells={AFFIX_COOCCURRENCE_CELLS}
          accent="#fbbf24"
        />
      </SurfaceCard>

      {/* ═══ 7.6 Loot Table Editor ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-semibold text-text">Loot Table Editor</span>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={undoEditor}
              disabled={editorHistory.length <= 1}
              className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 disabled:opacity-40"
              style={{ borderColor: `${ACCENT}${OPACITY_30}`, color: ACCENT }}
            >
              Undo
            </button>
            <button
              onClick={addEditorEntry}
              className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
              style={{ borderColor: `${ACCENT}${OPACITY_30}`, color: ACCENT }}
            >
              + Add
            </button>
            <button
              onClick={() => setShowEditorJson((v) => !v)}
              className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
              style={{ borderColor: `${ACCENT}${OPACITY_30}`, color: ACCENT }}
            >
              {showEditorJson ? 'Hide' : 'Export'} JSON
            </button>
          </div>
        </div>
        {/* Validation */}
        {editorTotalWeight !== 100 && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_8}`, color: STATUS_WARNING, border: `1px solid ${STATUS_WARNING}${OPACITY_30}` }}>
            Weights sum to {editorTotalWeight} (must be 100)
          </div>
        )}
        {/* Entries */}
        <div className="space-y-2 mb-3">
          {editorEntries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-2xs text-text w-24 truncate">{entry.name}</span>
              <input
                type="range" min={0} max={100} value={entry.weight}
                onChange={(e) => updateEditorWeight(entry.id, Number(e.target.value))}
                className="flex-1 h-1 accent-orange-500"
              />
              <span className="text-2xs font-mono w-8 text-right" style={{ color: entry.color }}>{entry.weight}%</span>
              {/* Live probability preview */}
              <span className="text-2xs font-mono w-14 text-right text-text-muted">
                ({editorTotalWeight > 0 ? ((entry.weight / editorTotalWeight) * 100).toFixed(1) : '0.0'}%)
              </span>
              <button
                onClick={() => removeEditorEntry(entry.id)}
                className="text-2xs text-text-muted hover:text-red-400 transition-colors px-1"
              >
                x
              </button>
            </div>
          ))}
        </div>
        {/* Live preview bar */}
        {editorTotalWeight > 0 && (
          <div className="flex h-4 rounded overflow-hidden w-full mb-2">
            {editorEntries.map((entry) => (
              <div
                key={entry.id}
                title={`${entry.name}: ${((entry.weight / editorTotalWeight) * 100).toFixed(1)}%`}
                style={{ width: `${(entry.weight / editorTotalWeight) * 100}%`, backgroundColor: entry.color }}
              />
            ))}
          </div>
        )}
        {/* Export JSON */}
        <AnimatePresence>
          {showEditorJson && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <pre className="text-2xs font-mono text-text-muted bg-surface-deep p-2 rounded border border-border/30 overflow-x-auto max-h-40">
                {JSON.stringify(editorEntries.map((e) => ({ name: e.name, weight: e.weight, rarity: e.rarity })), null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </SurfaceCard>

      {/* ═══ 7.7 Rarity Pity Timer System ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} />
          <span className="text-xs font-semibold text-text">Rarity Pity Timer</span>
          <span className="ml-auto text-2xs font-mono" style={{ color: pityCount >= pityThreshold * 0.8 ? STATUS_WARNING : '#60a5fa' }}>
            {pityCount} / {pityThreshold} drops
          </span>
        </div>
        {/* Progress bar */}
        <div className="relative h-4 bg-surface-deep rounded overflow-hidden mb-2">
          <motion.div
            className="h-full rounded"
            style={{ backgroundColor: pityCount >= pityThreshold * 0.8 ? STATUS_WARNING : '#60a5fa' }}
            animate={{ width: `${Math.min((pityCount / pityThreshold) * 100, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-2xs font-mono font-bold text-white/80">
            {pityCount >= pityThreshold ? 'GUARANTEED RARE NEXT!' : `${pityCount} since last Rare+`}
          </div>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={doPityDrop}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
            style={{ borderColor: `#60a5fa${OPACITY_30}`, backgroundColor: `#60a5fa${OPACITY_20}`, color: '#60a5fa' }}
          >
            Drop!
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-2xs text-text-muted">Pity Threshold:</span>
            <input
              type="range" min={10} max={50} value={pityThreshold}
              onChange={(e) => setPityThreshold(Number(e.target.value))}
              className="flex-1 h-1 accent-blue-500"
            />
            <span className="text-2xs font-mono" style={{ color: '#60a5fa' }}>{pityThreshold}</span>
          </div>
        </div>
        {/* Bad luck protection indicator */}
        <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded" style={{ backgroundColor: pityCount >= pityThreshold * 0.5 ? `${STATUS_WARNING}${OPACITY_8}` : `${STATUS_SUCCESS}${OPACITY_8}`, border: `1px solid ${pityCount >= pityThreshold * 0.5 ? STATUS_WARNING : STATUS_SUCCESS}${OPACITY_30}` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pityCount >= pityThreshold * 0.5 ? STATUS_WARNING : STATUS_SUCCESS }} />
          <span className="text-2xs font-mono" style={{ color: pityCount >= pityThreshold * 0.5 ? STATUS_WARNING : STATUS_SUCCESS }}>
            Bad Luck Protection: {pityCount >= pityThreshold * 0.8 ? 'ACTIVE - guaranteed soon' : pityCount >= pityThreshold * 0.5 ? 'Warming up...' : 'Inactive'}
          </span>
        </div>
        {/* History */}
        {pityHistory.length > 0 && (
          <div>
            <div className="text-2xs text-text-muted font-medium mb-1">Drop Gaps (drops between Rare+)</div>
            <div className="flex items-end gap-1 h-12">
              {pityHistory.slice(-20).map((gap, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }} animate={{ height: `${(gap / pityThreshold) * 100}%` }}
                  className="flex-1 rounded-t min-w-[4px]"
                  style={{ backgroundColor: gap >= pityThreshold * 0.8 ? STATUS_WARNING : '#60a5fa', maxHeight: '100%' }}
                  title={`${gap} drops`}
                />
              ))}
            </div>
          </div>
        )}
      </SurfaceCard>

      {/* ═══ 7.8 World Drop Beacon Visualizer ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-semibold text-text">World Drop Beacon Config</span>
          <button
            onClick={() => setColorblindMode((v) => !v)}
            className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 ml-auto"
            style={{ borderColor: `${ACCENT}${OPACITY_30}`, color: ACCENT, backgroundColor: colorblindMode ? `${ACCENT}${OPACITY_20}` : 'transparent' }}
          >
            {colorblindMode ? 'CB Mode ON' : 'Colorblind'}
          </button>
        </div>
        {/* Config grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-2xs font-mono">
            <thead>
              <tr className="text-text-muted border-b border-border/30">
                <th className="text-left py-1 pr-2">Rarity</th>
                <th className="text-center py-1 px-2">Color</th>
                <th className="text-center py-1 px-2">Beam Height</th>
                <th className="text-center py-1 px-2">Pulse Speed</th>
                <th className="text-center py-1 px-2">Pickup Radius</th>
              </tr>
            </thead>
            <tbody>
              {BEACON_CONFIGS.map((cfg) => {
                const displayColor = colorblindMode
                  ? { Common: '#888888', Uncommon: '#4488ff', Rare: '#ff8844', Epic: '#ff44ff', Legendary: '#ffff44' }[cfg.rarity] ?? cfg.color
                  : cfg.color;
                return (
                  <tr key={cfg.rarity} className="border-t border-border/20">
                    <td className="py-1.5 pr-2" style={{ color: displayColor }}>{cfg.rarity}</td>
                    <td className="text-center py-1.5 px-2">
                      <span className="inline-block w-5 h-3 rounded-sm" style={{ backgroundColor: displayColor, boxShadow: `0 0 6px ${displayColor}80` }} />
                    </td>
                    <td className="text-center py-1.5 px-2 text-text">{cfg.beamHeight}m</td>
                    <td className="text-center py-1.5 px-2 text-text">{cfg.pulseSpeed > 0 ? `${cfg.pulseSpeed}x` : 'None'}</td>
                    <td className="text-center py-1.5 px-2 text-text">{cfg.pickupRadius}u</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 3D-ish beam height preview */}
        <div className="mt-3">
          <div className="text-2xs text-text-muted font-medium mb-2">Relative Beam Heights</div>
          <div className="flex items-end justify-center gap-2.5 h-28">
            {BEACON_CONFIGS.map((cfg) => {
              const displayColor = colorblindMode
                ? { Common: '#888888', Uncommon: '#4488ff', Rare: '#ff8844', Epic: '#ff44ff', Legendary: '#ffff44' }[cfg.rarity] ?? cfg.color
                : cfg.color;
              return (
                <div key={cfg.rarity} className="flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${cfg.beamHeight}%` }}
                    transition={{ duration: 0.5, delay: BEACON_CONFIGS.indexOf(cfg) * 0.1 }}
                    className="w-3 rounded-t relative overflow-hidden"
                    style={{ backgroundColor: displayColor, boxShadow: `0 0 10px ${displayColor}60`, minHeight: cfg.beamHeight > 0 ? 4 : 0 }}
                  >
                    {/* Shimmer */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent"
                      animate={{ y: ['-100%', '100%'] }}
                      transition={{ duration: cfg.pulseSpeed > 0 ? 2 / cfg.pulseSpeed : 10, repeat: Infinity, ease: 'linear' }}
                    />
                  </motion.div>
                  <span className="text-[9px] font-mono text-text-muted">{cfg.rarity.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </SurfaceCard>

      {/* ═══ 7.9 Loot Economy Impact Calculator ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-3.5 h-3.5" style={{ color: ACCENT_EMERALD }} />
          <span className="text-xs font-semibold text-text">Loot Economy Impact</span>
          <div className="flex gap-1 ml-auto">
            {(['casual', 'hardcore'] as const).map((profile) => (
              <button
                key={profile}
                onClick={() => setEconomyProfile(profile)}
                className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 capitalize"
                style={{
                  borderColor: `${ACCENT_EMERALD}${OPACITY_30}`,
                  backgroundColor: economyProfile === profile ? `${ACCENT_EMERALD}${OPACITY_20}` : 'transparent',
                  color: ACCENT_EMERALD,
                }}
              >
                {profile}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {/* Gold injection */}
          <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
            <span className="text-2xs text-text-muted font-medium mb-1">Gold/Hour Injection</span>
            <span className="text-lg font-mono font-bold" style={{ color: '#fbbf24' }}>
              {economyProfile === 'casual' ? '2,300' : '8,400'}
            </span>
            <span className="text-2xs text-text-muted">{economyProfile === 'casual' ? '30 min/day' : '4 hr/day'}</span>
          </div>
          {/* Inflation gauge */}
          <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
            <span className="text-2xs text-text-muted font-medium mb-1">Inflation Risk</span>
            <div className="w-16 h-16">
              <LiveMetricGauge
                metric={{ label: 'Risk', current: economyProfile === 'casual' ? 35 : 65, target: 100, unit: '%' }}
                size={64}
                accent={economyProfile === 'casual' ? STATUS_SUCCESS : STATUS_WARNING}
              />
            </div>
          </div>
          {/* Time to legendary */}
          <div className="flex flex-col items-center p-2 rounded border border-border/30 bg-surface/30">
            <span className="text-2xs text-text-muted font-medium mb-1">Full Legendary Set</span>
            <span className="text-lg font-mono font-bold" style={{ color: '#a78bfa' }}>
              {economyProfile === 'casual' ? '~42d' : '~6d'}
            </span>
            <span className="text-2xs text-text-muted">estimated playtime</span>
          </div>
        </div>
        {/* Surplus/deficit */}
        <div className="text-2xs text-text-muted font-medium mb-1">Item Surplus / Deficit</div>
        <div className="space-y-1">
          {ECONOMY_SURPLUS.map((item) => {
            const multiplied = economyProfile === 'hardcore' ? item.delta * 3 : item.delta;
            const isPositive = multiplied >= 0;
            return (
              <div key={item.type} className="flex items-center gap-2">
                <span className="text-2xs font-mono w-20 text-text-muted">{item.type}</span>
                <div className="flex-1 h-2 bg-surface-deep rounded overflow-hidden relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/60" />
                  {isPositive ? (
                    <div className="h-full rounded absolute left-1/2" style={{ width: `${Math.abs(multiplied) * 5}%`, backgroundColor: STATUS_SUCCESS }} />
                  ) : (
                    <div className="h-full rounded absolute right-1/2" style={{ width: `${Math.abs(multiplied) * 5}%`, backgroundColor: STATUS_ERROR }} />
                  )}
                </div>
                <span className="text-2xs font-mono w-8 text-right" style={{ color: isPositive ? STATUS_SUCCESS : STATUS_ERROR }}>
                  {isPositive ? '+' : ''}{multiplied}
                </span>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* ═══ 7.10 Smart Loot Recommendations ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="text-xs font-semibold text-text">Smart Loot Recommendations</span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-2xs text-text-muted">{smartMode ? 'Smart' : 'Raw'}</span>
            <button
              onClick={() => setSmartMode((v) => !v)}
              className="w-8 h-4 rounded-full relative transition-colors"
              style={{ backgroundColor: smartMode ? '#a78bfa' : '#64748b' }}
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
          <span className="text-xs font-mono font-bold" style={{ color: '#a78bfa' }}>23% better targeting</span>
          <span className="text-2xs text-text-muted ml-auto">vs raw distribution</span>
        </div>
        {/* Side-by-side probability bars */}
        <div className="space-y-2">
          {SMART_LOOT_DATA.map((slot) => {
            const activePct = smartMode ? slot.smartPct : slot.rawPct;
            return (
              <div key={slot.slot} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-mono w-14 text-text-muted">{slot.slot}</span>
                  <div className="flex-1 flex gap-1">
                    {/* Raw bar */}
                    <div className="flex-1 h-2.5 bg-surface-deep rounded overflow-hidden relative" title={`Raw: ${slot.rawPct}%`}>
                      <motion.div
                        className="h-full rounded"
                        style={{ backgroundColor: '#64748b' }}
                        animate={{ width: `${slot.rawPct * 3}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    {/* Smart bar */}
                    <div className="flex-1 h-2.5 bg-surface-deep rounded overflow-hidden relative" title={`Smart: ${slot.smartPct}%`}>
                      <motion.div
                        className="h-full rounded"
                        style={{ backgroundColor: '#a78bfa' }}
                        animate={{ width: `${slot.smartPct * 3}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                  <span className="text-2xs font-mono w-8 text-right" style={{ color: smartMode ? '#a78bfa' : '#64748b' }}>
                    {activePct}%
                  </span>
                  {/* Gear score gap */}
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
        <div className="flex gap-2.5 mt-2">
          <span className="flex items-center gap-1 text-2xs text-text-muted">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#64748b' }} />
            Raw
          </span>
          <span className="flex items-center gap-1 text-2xs text-text-muted">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#a78bfa' }} />
            Smart
          </span>
        </div>
      </SurfaceCard>

      {/* Feature status list */}
      <div className="space-y-1.5">
        {LOOT_FEATURES.map((name) => (
          <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} accent={ACCENT} />
        ))}
      </div>
    </div>
  );
}
