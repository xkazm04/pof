'use client';

import { useMemo, useState, useCallback } from 'react';
import { Coins, Dices, Package, BarChart3, Diff, Clock, Sparkles, SlidersHorizontal, Timer, Radio, Calculator, Brain, Skull, Play, Code, Copy, CheckCircle2 } from 'lucide-react';
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

/* ── 7.7b Drought Streak Probability Calculator ───────────────────────────── */

const DROUGHT_RARITY_OPTIONS = RARITY_TIERS.map(t => ({
  name: t.name,
  color: t.color,
  dropRate: t.weight / TOTAL_WEIGHT,
}));

/** Cumulative probability of getting ≥1 drop in N attempts.
 *  Without pity: P(N) = 1 - (1 - rate)^N
 *  With pity threshold T: P(N) = 1 for N >= T, else adjusted via inclusion. */
function cumulativeProbCurve(
  dropRate: number,
  maxKills: number,
  pityThreshold: number | null,
): { kill: number; probNoPity: number; probWithPity: number }[] {
  const points: { kill: number; probNoPity: number; probWithPity: number }[] = [];
  for (let n = 1; n <= maxKills; n++) {
    const probNoPity = 1 - Math.pow(1 - dropRate, n);
    // With pity: guaranteed at threshold, so cap the no-drop tail
    const probWithPity = pityThreshold && n >= pityThreshold
      ? 1.0
      : pityThreshold
        ? 1 - Math.pow(1 - dropRate, n) * ((pityThreshold - Math.min(n, pityThreshold)) / pityThreshold)
        : probNoPity;
    points.push({ kill: n, probNoPity, probWithPity: Math.min(probWithPity, 1) });
  }
  return points;
}

/** Find the kill count where cumulative probability first crosses a threshold */
function findPercentileKill(dropRate: number, percentile: number, pityThreshold: number | null): number {
  const target = percentile / 100;
  for (let n = 1; n <= 2000; n++) {
    if (pityThreshold && n >= pityThreshold) return n;
    const prob = 1 - Math.pow(1 - dropRate, n);
    if (prob >= target) return n;
  }
  return 2000;
}

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

/* ── 7.11 Enemy-to-LootTable Binding Data ──────────────────────────────────── */

interface EnemyLootBinding {
  archetypeId: string;
  archetypeName: string;
  color: string;
  icon: string;
  lootTableName: string;
  dropChance: number; // 0-1, chance of dropping any item
  rarityWeights: number[]; // weights for each RARITY_TIERS entry
  bonusGold: number;
}

const DEFAULT_ENEMY_LOOT_BINDINGS: EnemyLootBinding[] = [
  {
    archetypeId: 'MeleeGrunt', archetypeName: 'Melee Grunt', color: ACCENT_EMERALD, icon: 'FG',
    lootTableName: 'LT_Grunt', dropChance: 0.3,
    rarityWeights: [60, 25, 10, 4, 1], bonusGold: 15,
  },
  {
    archetypeId: 'RangedCaster', archetypeName: 'Ranged Caster', color: '#60a5fa', icon: 'DM',
    lootTableName: 'LT_Caster', dropChance: 0.35,
    rarityWeights: [40, 30, 18, 9, 3], bonusGold: 20,
  },
  {
    archetypeId: 'Brute', archetypeName: 'Brute', color: ACCENT_ORANGE, icon: 'SB',
    lootTableName: 'LT_Brute', dropChance: 0.5,
    rarityWeights: [30, 25, 25, 15, 5], bonusGold: 40,
  },
];

interface SimulatedDrop {
  rarityIndex: number;
  count: number;
}

function simulateKills(binding: EnemyLootBinding, killCount: number): SimulatedDrop[] {
  const totalWeight = binding.rarityWeights.reduce((s, w) => s + w, 0);
  const counts = binding.rarityWeights.map(() => 0);

  // Deterministic simulation using distribution
  const expectedDrops = killCount * binding.dropChance;
  for (let i = 0; i < binding.rarityWeights.length; i++) {
    counts[i] = Math.round(expectedDrops * (binding.rarityWeights[i] / totalWeight));
  }

  return counts.map((count, rarityIndex) => ({ rarityIndex, count }));
}

function generateEnemyLootCpp(bindings: EnemyLootBinding[]): string {
  return `// Add to ARPGEnemyCharacter.h — protected section:
//
// /** Loot table to roll on death. Assign per-archetype in the enemy BP. */
// UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot")
// TObjectPtr<UARPGLootTable> LootTable;
//
// /** Chance to drop any item on death [0.0 - 1.0]. */
// UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loot", meta = (ClampMin = "0.0", ClampMax = "1.0"))
// float DropChance = 0.3f;
//
// /** Bonus gold dropped on death. */
// UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loot", meta = (ClampMin = "0"))
// int32 BonusGold = 15;

// ─── Add to OnDeathFromAbility() in ARPGEnemyCharacter.cpp ───

void AARPGEnemyCharacter::OnDeathFromAbility(AActor* KillingActor)
{
\t// ... existing XP award code ...

\t// Loot drop
\tif (LootTable && FMath::FRand() <= DropChance)
\t{
\t\tFARPGLootResult LootResult;
\t\tif (LootTable->RollLoot(CharacterLevel, LootResult))
\t\t{
\t\t\t// Spawn world item at death location
\t\t\tconst FVector SpawnLoc = GetActorLocation() + FVector(0, 0, 50.f);
\t\t\tFActorSpawnParameters SpawnParams;
\t\t\tSpawnParams.SpawnCollisionHandlingOverride =
\t\t\t\tESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

\t\t\tif (AARPGWorldItem* WorldItem = GetWorld()->SpawnActor<AARPGWorldItem>(
\t\t\t\tAARPGWorldItem::StaticClass(), SpawnLoc, FRotator::ZeroRotator, SpawnParams))
\t\t\t{
\t\t\t\tWorldItem->InitFromLootResult(LootResult);
\t\t\t}
\t\t}
\t}

\t// Gold drop
\tif (BonusGold > 0 && KillingActor)
\t{
\t\tif (AARPGPlayerCharacter* Player = Cast<AARPGPlayerCharacter>(KillingActor))
\t\t{
\t\t\t// Player->AddGold(BonusGold);
\t\t}
\t}

\t// ... existing death broadcast ...
}

// ─── Default values per archetype (set in constructor or BP) ───
${bindings.map(b => `// ${b.archetypeName}: LootTable=${b.lootTableName}, DropChance=${b.dropChance.toFixed(2)}, Gold=${b.bonusGold}`).join('\n')}
`;
}

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

  /* 7.7b Drought calculator state */
  const [droughtRarity, setDroughtRarity] = useState<number>(4); // index into DROUGHT_RARITY_OPTIONS, default Legendary
  const [droughtPityEnabled, setDroughtPityEnabled] = useState(true);

  const droughtData = useMemo(() => {
    const opt = DROUGHT_RARITY_OPTIONS[droughtRarity];
    const rate = opt.dropRate;
    const pity = droughtPityEnabled ? pityThreshold : null;
    const maxKills = Math.min(Math.max(Math.ceil(5 / rate), 50), 500);
    const curve = cumulativeProbCurve(rate, maxKills, pity);
    const expectedDry = Math.round(1 / rate);
    const p50 = findPercentileKill(rate, 50, null);
    const p95 = findPercentileKill(rate, 95, null);
    const p99 = findPercentileKill(rate, 99, null);
    const p95Pity = findPercentileKill(rate, 95, pity);
    const p99Pity = findPercentileKill(rate, 99, pity);
    return { opt, rate, pity, maxKills, curve, expectedDry, p50, p95, p99, p95Pity, p99Pity };
  }, [droughtRarity, droughtPityEnabled, pityThreshold]);

  /* 7.8 Beacon state */
  const [colorblindMode, setColorblindMode] = useState(false);

  /* 7.9 Economy state */
  const [economyProfile, setEconomyProfile] = useState<'casual' | 'hardcore'>('casual');

  /* 7.10 Smart loot state */
  const [smartMode, setSmartMode] = useState(false);

  /* 7.11 Enemy-to-LootTable binding state */
  const [enemyLootBindings, setEnemyLootBindings] = useState<EnemyLootBinding[]>(DEFAULT_ENEMY_LOOT_BINDINGS);
  const [simKillCount, setSimKillCount] = useState(100);
  const [copiedLootCpp, setCopiedLootCpp] = useState(false);
  const [showLootCpp, setShowLootCpp] = useState(false);

  const simResults = useMemo(
    () => enemyLootBindings.map(b => ({ binding: b, drops: simulateKills(b, simKillCount) })),
    [enemyLootBindings, simKillCount],
  );

  const handleCopyLootCpp = useCallback(() => {
    navigator.clipboard.writeText(generateEnemyLootCpp(enemyLootBindings));
    setCopiedLootCpp(true);
    setTimeout(() => setCopiedLootCpp(false), 2000);
  }, [enemyLootBindings]);

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

      {/* ═══ 7.7b Drought Streak & Luck Probability Calculator ═══ */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-3.5 h-3.5" style={{ color: droughtData.opt.color }} />
          <span className="text-xs font-semibold text-text">Drought Streak Calculator</span>
          <span className="ml-auto text-2xs font-mono text-text-muted">
            P(drop) = {(droughtData.rate * 100).toFixed(1)}%
          </span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex gap-1">
            {DROUGHT_RARITY_OPTIONS.map((opt, i) => (
              <button
                key={opt.name}
                onClick={() => setDroughtRarity(i)}
                className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
                style={{
                  borderColor: droughtRarity === i ? `${opt.color}60` : 'var(--border)',
                  backgroundColor: droughtRarity === i ? `${opt.color}20` : 'transparent',
                  color: droughtRarity === i ? opt.color : 'var(--text-muted)',
                }}
              >
                {opt.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDroughtPityEnabled(v => !v)}
            className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 ml-auto"
            style={{
              borderColor: droughtPityEnabled ? `${STATUS_SUCCESS}${OPACITY_30}` : 'var(--border)',
              backgroundColor: droughtPityEnabled ? `${STATUS_SUCCESS}${OPACITY_8}` : 'transparent',
              color: droughtPityEnabled ? STATUS_SUCCESS : 'var(--text-muted)',
            }}
          >
            {droughtPityEnabled ? `Pity @ ${pityThreshold}` : 'No Pity'}
          </button>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Expected Dry', value: `${droughtData.expectedDry} kills`, color: droughtData.opt.color },
            { label: 'Median (P50)', value: `${droughtData.p50} kills`, color: ACCENT_CYAN },
            { label: 'P95 Worst', value: `${droughtPityEnabled ? droughtData.p95Pity : droughtData.p95} kills`, color: STATUS_WARNING },
            { label: 'P99 Worst', value: `${droughtPityEnabled ? droughtData.p99Pity : droughtData.p99} kills`, color: STATUS_ERROR },
          ].map(stat => (
            <div key={stat.label} className="text-center p-1.5 rounded border" style={{ borderColor: `${stat.color}${OPACITY_30}`, backgroundColor: `${stat.color}${OPACITY_8}` }}>
              <div className="text-2xs text-text-muted">{stat.label}</div>
              <div className="text-xs font-mono font-bold" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Cumulative probability curve SVG */}
        <div className="relative">
          <div className="text-2xs text-text-muted font-medium mb-1">Cumulative P(≥1 drop) vs Kill Count</div>
          <svg viewBox="0 0 400 180" className="w-full" role="img" aria-label={`Cumulative probability curve for ${droughtData.opt.name} rarity drops over ${droughtData.maxKills} kills`}>
            <title>Drought Streak Probability Curve</title>
            <desc>Shows the probability of receiving at least one drop as kill count increases, with and without pity timer.</desc>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1.0].map(pct => (
              <g key={pct}>
                <line x1={40} y1={160 - pct * 140} x2={390} y2={160 - pct * 140} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                <text x={36} y={160 - pct * 140 + 3} textAnchor="end" className="text-[8px] font-mono" fill="var(--text-muted)">{Math.round(pct * 100)}%</text>
              </g>
            ))}
            {/* X-axis labels */}
            {Array.from({ length: 5 }, (_, i) => {
              const kill = Math.round((droughtData.maxKills / 4) * i);
              const x = 40 + (kill / droughtData.maxKills) * 350;
              return (
                <text key={i} x={x} y={175} textAnchor="middle" className="text-[8px] font-mono" fill="var(--text-muted)">{kill}</text>
              );
            })}

            {/* No-pity curve */}
            <polyline
              fill="none"
              stroke={droughtData.opt.color}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity={droughtPityEnabled ? 0.35 : 0.8}
              points={droughtData.curve.map(p => `${40 + (p.kill / droughtData.maxKills) * 350},${160 - p.probNoPity * 140}`).join(' ')}
            />

            {/* With-pity curve */}
            {droughtPityEnabled && (
              <polyline
                fill="none"
                stroke={droughtData.opt.color}
                strokeWidth="2"
                points={droughtData.curve.map(p => `${40 + (p.kill / droughtData.maxKills) * 350},${160 - p.probWithPity * 140}`).join(' ')}
                style={{ filter: `drop-shadow(0 0 3px ${droughtData.opt.color}60)` }}
              />
            )}

            {/* Pity threshold vertical line */}
            {droughtPityEnabled && droughtData.pity && droughtData.pity <= droughtData.maxKills && (
              <g>
                <line
                  x1={40 + (droughtData.pity / droughtData.maxKills) * 350}
                  y1={18}
                  x2={40 + (droughtData.pity / droughtData.maxKills) * 350}
                  y2={160}
                  stroke={STATUS_SUCCESS}
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity={0.6}
                />
                <text
                  x={40 + (droughtData.pity / droughtData.maxKills) * 350}
                  y={14}
                  textAnchor="middle"
                  className="text-[7px] font-mono font-bold"
                  fill={STATUS_SUCCESS}
                >
                  Pity@{droughtData.pity}
                </text>
              </g>
            )}

            {/* Percentile annotations */}
            {[
              { label: 'P50', kill: droughtData.p50, pct: 0.5, color: ACCENT_CYAN },
              { label: 'P95', kill: droughtPityEnabled ? droughtData.p95Pity : droughtData.p95, pct: 0.95, color: STATUS_WARNING },
              { label: 'P99', kill: droughtPityEnabled ? droughtData.p99Pity : droughtData.p99, pct: 0.99, color: STATUS_ERROR },
            ].filter(a => a.kill <= droughtData.maxKills).map(ann => {
              const x = 40 + (ann.kill / droughtData.maxKills) * 350;
              const y = 160 - ann.pct * 140;
              return (
                <g key={ann.label}>
                  <circle cx={x} cy={y} r={3} fill={ann.color} opacity={0.8} />
                  <text x={x} y={y - 6} textAnchor="middle" className="text-[7px] font-mono font-bold" fill={ann.color}>
                    {ann.label} ({ann.kill})
                  </text>
                </g>
              );
            })}

            {/* Axis labels */}
            <text x={215} y={175} textAnchor="middle" className="text-[8px] font-mono" fill="var(--text-muted)">Kills</text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-1 text-2xs font-mono text-text-muted">
          {droughtPityEnabled && (
            <>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: droughtData.opt.color }} /> With Pity</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 rounded opacity-40" style={{ backgroundColor: droughtData.opt.color, borderTop: '1px dashed' }} /> No Pity</span>
            </>
          )}
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT_CYAN }} /> P50</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_WARNING }} /> P95</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_ERROR }} /> P99</span>
        </div>

        {/* Interpretation */}
        <div className="mt-2 p-2 rounded border text-2xs font-mono" style={{ borderColor: `${droughtData.opt.color}${OPACITY_30}`, backgroundColor: `${droughtData.opt.color}${OPACITY_8}` }}>
          <span style={{ color: droughtData.opt.color }} className="font-bold">{droughtData.opt.name}</span>
          <span className="text-text-muted"> — {(droughtData.rate * 100).toFixed(1)}% per kill. </span>
          <span className="text-text-muted">50% of players get a drop within </span>
          <span className="text-text font-bold">{droughtData.p50}</span>
          <span className="text-text-muted"> kills. 99% within </span>
          <span className="text-text font-bold">{droughtPityEnabled ? droughtData.p99Pity : droughtData.p99}</span>
          <span className="text-text-muted"> kills{droughtPityEnabled ? ` (pity caps at ${pityThreshold})` : ''}.</span>
        </div>
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

      {/* ═══ 7.11 Enemy-to-LootTable Binding with Drop Simulation ═══ */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <SectionLabel label="Enemy → LootTable Binding" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-2xs font-mono text-text-muted">
              <span>Kills:</span>
              <input
                type="number" min={10} max={10000} step={10} value={simKillCount}
                onChange={e => setSimKillCount(Math.max(10, Number(e.target.value)))}
                className="w-16 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              />
            </div>
            <button
              onClick={() => setShowLootCpp(!showLootCpp)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-mono font-bold transition-all border"
              style={{ borderColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, backgroundColor: `${ACCENT}08` }}
            >
              <Code className="w-3 h-3" /> C++
            </button>
          </div>
        </div>

        {/* Binding cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-2.5">
          {simResults.map(({ binding, drops }) => {
            const totalDrops = drops.reduce((s, d) => s + d.count, 0);
            const maxCount = Math.max(...drops.map(d => d.count), 1);
            const totalWeight = binding.rarityWeights.reduce((s, w) => s + w, 0);

            return (
              <div key={binding.archetypeId} className="rounded-lg border p-3" style={{ borderColor: `${binding.color}${OPACITY_20}`, backgroundColor: `${binding.color}05` }}>
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${binding.color}20`, color: binding.color }}>
                    {binding.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold" style={{ color: binding.color }}>{binding.archetypeName}</div>
                    <div className="text-[9px] font-mono text-text-muted">{binding.lootTableName}</div>
                  </div>
                  <Skull className="w-3.5 h-3.5 text-text-muted" />
                </div>

                {/* Config row */}
                <div className="flex items-center gap-3 mb-2.5 text-[9px] font-mono text-text-muted">
                  <span>Drop: <span className="font-bold text-text">{(binding.dropChance * 100).toFixed(0)}%</span></span>
                  <span>Gold: <span className="font-bold text-text">{binding.bonusGold}</span></span>
                  <span>Items: <span className="font-bold" style={{ color: binding.color }}>{totalDrops}</span></span>
                </div>

                {/* Stacked bar chart */}
                <div className="space-y-1">
                  {RARITY_TIERS.map((tier, ri) => {
                    const drop = drops[ri];
                    const pct = totalWeight > 0 ? (binding.rarityWeights[ri] / totalWeight * 100) : 0;
                    const barW = maxCount > 0 ? (drop.count / maxCount * 100) : 0;
                    return (
                      <div key={tier.name} className="flex items-center gap-1.5">
                        <span className="text-[8px] font-mono w-12 text-right text-text-muted truncate">{tier.name}</span>
                        <div className="flex-1 h-2.5 bg-surface-deep/50 rounded-full overflow-hidden relative">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: tier.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${barW}%` }}
                            transition={{ duration: 0.4, delay: ri * 0.05 }}
                          />
                        </div>
                        <span className="text-[8px] font-mono w-6 text-right font-bold" style={{ color: tier.color }}>
                          {drop.count}
                        </span>
                        <span className="text-[7px] font-mono w-8 text-right text-text-muted">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stacked horizontal summary bar */}
                <div className="mt-2 h-3 rounded-full overflow-hidden flex">
                  {RARITY_TIERS.map((tier, ri) => {
                    const drop = drops[ri];
                    const pct = totalDrops > 0 ? (drop.count / totalDrops * 100) : 0;
                    return (
                      <motion.div
                        key={tier.name}
                        className="h-full"
                        style={{ backgroundColor: tier.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, delay: ri * 0.05 }}
                        title={`${tier.name}: ${drop.count} (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Gold summary */}
                <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-text-muted">Total gold ({simKillCount} kills)</span>
                  <span className="font-bold" style={{ color: '#fbbf24' }}>{(simKillCount * binding.bonusGold).toLocaleString()}g</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rarity legend */}
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {RARITY_TIERS.map(tier => (
            <div key={tier.name} className="flex items-center gap-1 text-[9px] font-mono">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: tier.color }} />
              <span style={{ color: tier.color }}>{tier.name}</span>
            </div>
          ))}
        </div>

        {/* C++ code output */}
        <AnimatePresence>
          {showLootCpp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="bg-[#0d1117] rounded-xl border border-border/40 overflow-hidden">
                <div className="px-3 py-1.5 bg-surface-deep/50 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-3 h-3 text-text-muted" />
                    <span className="text-2xs font-mono text-text-muted">ARPGEnemyCharacter — LootTable Integration</span>
                  </div>
                  <button
                    onClick={handleCopyLootCpp}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold"
                    style={{
                      color: copiedLootCpp ? STATUS_SUCCESS : ACCENT,
                      backgroundColor: copiedLootCpp ? `${STATUS_SUCCESS}15` : `${ACCENT}10`,
                    }}
                  >
                    {copiedLootCpp ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedLootCpp ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 text-2xs font-mono leading-relaxed text-cyan-100/90 overflow-x-auto custom-scrollbar max-h-[350px] overflow-y-auto">
                  {generateEnemyLootCpp(enemyLootBindings)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
