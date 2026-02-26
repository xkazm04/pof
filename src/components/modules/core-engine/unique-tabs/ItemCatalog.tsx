'use client';

import { useMemo, useState, useCallback } from 'react';
import { Package, ChevronRight, Layers, Search, Filter, Plus, Sparkles, X, Target, TreePine, Shield, Swords, FlaskConical, MapPin, BarChart3, Crown, TrendingUp, PieChart } from 'lucide-react';
import Image from 'next/image';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, LoadingSpinner, RadarChart, DiffViewer, SubTabNavigation, SubTab } from './_shared';
import type { RadarDataPoint, DiffEntry, StatComparison, LoadoutSlot, ProbabilityEntry } from '@/types/unique-tab-improvements';

const ACCENT = MODULE_COLORS.core;

/* ── Rarity colors ─────────────────────────────────────────────────────── */

const RARITY_COLORS: Record<string, string> = {
  Common: '#94a3b8',
  Uncommon: STATUS_SUCCESS,
  Rare: MODULE_COLORS.core,
  Epic: MODULE_COLORS.systems,
  Legendary: '#f59e0b',
};

/* ── Equipment slot layout ─────────────────────────────────────────────── */

interface SlotConfig {
  id: string;
  label: string;
  featureName: string;
}

const EQUIPMENT_SLOTS: SlotConfig[] = [
  { id: 'Head', label: 'Head', featureName: 'Equipment slot system' },
  { id: 'Chest', label: 'Chest', featureName: 'Equipment slot system' },
  { id: 'Legs', label: 'Legs', featureName: 'Equipment slot system' },
  { id: 'Feet', label: 'Feet', featureName: 'Equipment slot system' },
  { id: 'MainHand', label: 'Main Hand', featureName: 'Equipment slot system' },
  { id: 'OffHand', label: 'Off Hand', featureName: 'Equipment slot system' },
];

/* ── Affix examples ────────────────────────────────────────────────────── */

const AFFIX_EXAMPLES = [
  { name: 'of Power', stat: '+15% Atk Power', tier: 'Prefix', rarity: 'Uncommon' },
  { name: 'of Fortitude', stat: '+200 Max HP', tier: 'Prefix', rarity: 'Rare' },
  { name: 'Blazing', stat: '+Fire Damage', tier: 'Suffix', rarity: 'Rare' },
  { name: 'Vampiric', stat: '+8% Life Steal', tier: 'Prefix', rarity: 'Epic' },
  { name: 'of Legends', stat: '+2 All Skills', tier: 'Suffix', rarity: 'Legendary' },
];

/* ── System pipeline nodes ─────────────────────────────────────────────── */

const SYSTEM_PIPELINE = [
  { label: 'ItemDefinition', featureName: 'UARPGItemDefinition' },
  { label: 'ItemInstance', featureName: 'UARPGItemInstance' },
  { label: 'InventoryComponent', featureName: 'UARPGInventoryComponent' },
  { label: 'EquipmentSlot', featureName: 'Equipment slot system' },
  { label: 'GAS Effect', featureName: 'Equip/unequip GAS flow' },
];

/* ── Dummy Items for Catalog ───────────────────────────────────────────── */

interface ItemData {
  id: string;
  name: string;
  type: 'Weapon' | 'Armor' | 'Consumable';
  subtype: string;
  rarity: string;
  stats: { label: string; value: string }[];
  description: string;
  effect?: string;
  imagePath?: string;
}

const DUMMY_ITEMS: ItemData[] = [
  { id: '1', name: 'Iron Longsword', type: 'Weapon', subtype: 'Sword', rarity: 'Common', stats: [{ label: 'Damage', value: '12-18' }, { label: 'Speed', value: '1.2s' }], description: 'A standard issue longsword.' },
  { id: '2', name: 'Ranger\'s Bow', type: 'Weapon', subtype: 'Bow', rarity: 'Uncommon', stats: [{ label: 'Damage', value: '15-22' }, { label: 'Range', value: '25m' }], description: 'A sturdy bow made of yew.' },
  { id: '3', name: 'Crystal Staff', type: 'Weapon', subtype: 'Staff', rarity: 'Rare', stats: [{ label: 'M. Atk', value: '25-35' }, { label: 'Mana Regen', value: '+5/s' }], description: 'Pulsing with arcane energy.', effect: 'Spells cost 10% less mana.' },
  { id: '4', name: 'Steel Chestplate', type: 'Armor', subtype: 'Chestplate', rarity: 'Uncommon', stats: [{ label: 'Armor', value: '45' }, { label: 'Weight', value: 'Heavy' }], description: 'Solid protection for the frontline.' },
  { id: '5', name: 'Assassin\'s Cowl', type: 'Armor', subtype: 'Helm', rarity: 'Epic', stats: [{ label: 'Armor', value: '15' }, { label: 'Crit Chance', value: '+5%' }], description: 'Cloaks the wearer in shadows.', effect: 'Stealth detection reduced by 20%.' },
  { id: '6', name: 'Sunfire Amulet', type: 'Consumable', subtype: 'Elixir', rarity: 'Legendary', stats: [{ label: 'Uses', value: '1' }], description: 'Contains the essence of a dying star.', effect: 'Grants immunity to Fire damage for 60s.' },
  { id: '7', name: 'Minor Health Potion', type: 'Consumable', subtype: 'Potion', rarity: 'Common', stats: [{ label: 'Heal', value: '50 HP' }], description: 'A basic healing draft.' },
  { id: '8', name: 'Void Daggers', type: 'Weapon', subtype: 'Dagger', rarity: 'Legendary', stats: [{ label: 'Damage', value: '35-45' }, { label: 'Speed', value: '0.8s' }], description: 'Forged in the abyss.', effect: 'Attacks tear reality, ignoring 20% armor.' },
];

/* ── 6.1 Item Power Budget Radar Data ────────────────────────────────── */

const POWER_BUDGET_AXES = ['Offense', 'Defense', 'Utility', 'Economic', 'Rarity'];

const IRON_LONGSWORD_RADAR: RadarDataPoint[] = [
  { axis: 'Offense', value: 0.35, maxLabel: '100' },
  { axis: 'Defense', value: 0.1, maxLabel: '100' },
  { axis: 'Utility', value: 0.2, maxLabel: '100' },
  { axis: 'Economic', value: 0.15, maxLabel: '1000g' },
  { axis: 'Rarity', value: 0.2, maxLabel: 'Legendary' },
];

const VOID_DAGGERS_RADAR: RadarDataPoint[] = [
  { axis: 'Offense', value: 0.92, maxLabel: '100' },
  { axis: 'Defense', value: 0.05, maxLabel: '100' },
  { axis: 'Utility', value: 0.55, maxLabel: '100' },
  { axis: 'Economic', value: 0.95, maxLabel: '1000g' },
  { axis: 'Rarity', value: 1.0, maxLabel: 'Legendary' },
];

/* ── 6.2 Affix Probability Tree Data ────────────────────────────────── */

const AFFIX_PROB_TREE: ProbabilityEntry = {
  id: 'rare-root',
  label: 'Rare',
  probability: 1,
  color: RARITY_COLORS.Rare,
  children: [
    {
      id: 'prefix-0', label: '0 Prefixes', probability: 0.2, color: '#64748b',
      children: [],
    },
    {
      id: 'prefix-1', label: '1 Prefix', probability: 0.5, color: MODULE_COLORS.core,
      children: [
        { id: 'p1-power', label: 'Power', probability: 0.4, color: '#f87171' },
        { id: 'p1-fortitude', label: 'Fortitude', probability: 0.3, color: '#4ade80' },
        { id: 'p1-blazing', label: 'Blazing', probability: 0.2, color: '#fb923c' },
        { id: 'p1-vampiric', label: 'Vampiric', probability: 0.1, color: '#c084fc' },
      ],
    },
    {
      id: 'prefix-2', label: '2 Prefixes', probability: 0.3, color: '#fbbf24',
      children: [
        { id: 'p2-power', label: 'Power', probability: 0.4, color: '#f87171' },
        { id: 'p2-fortitude', label: 'Fortitude', probability: 0.3, color: '#4ade80' },
        { id: 'p2-blazing', label: 'Blazing', probability: 0.2, color: '#fb923c' },
        { id: 'p2-vampiric', label: 'Vampiric', probability: 0.1, color: '#c084fc' },
      ],
    },
  ],
};

/* ── 6.3 Equipment Loadout Data ──────────────────────────────────────── */

const LOADOUT_SLOTS: LoadoutSlot[] = [
  { slotId: 'Head', slotName: 'Head', item: { name: "Assassin's Cowl", rarity: 'Epic', stats: { Armor: 15, CritChance: 5 } }, isEmpty: false },
  { slotId: 'Chest', slotName: 'Chest', item: { name: 'Steel Chestplate', rarity: 'Uncommon', stats: { Armor: 45 } }, isEmpty: false },
  { slotId: 'Legs', slotName: 'Legs', isEmpty: true },
  { slotId: 'Feet', slotName: 'Feet', isEmpty: true },
  { slotId: 'MainHand', slotName: 'Main Hand', item: { name: 'Void Daggers', rarity: 'Legendary', stats: { Damage: 40, Speed: 8 } }, isEmpty: false },
  { slotId: 'OffHand', slotName: 'Off Hand', isEmpty: true },
];

const LOADOUT_SLOT_POSITIONS: Record<string, { x: number; y: number }> = {
  Head: { x: 85, y: 10 },
  Chest: { x: 85, y: 60 },
  Legs: { x: 85, y: 110 },
  Feet: { x: 85, y: 155 },
  MainHand: { x: 15, y: 80 },
  OffHand: { x: 155, y: 80 },
};

/* ── 6.4 Item Comparison Data ────────────────────────────────────────── */

const COMPARISON_ENTRIES: DiffEntry[] = [
  { field: 'Name', oldValue: 'Iron Longsword', newValue: 'Void Daggers', changeType: 'changed' },
  { field: 'Rarity', oldValue: 'Common', newValue: 'Legendary', changeType: 'changed' },
  { field: 'Min Damage', oldValue: 12, newValue: 35, changeType: 'changed' },
  { field: 'Max Damage', oldValue: 18, newValue: 45, changeType: 'changed' },
  { field: 'Attack Speed', oldValue: '1.2s', newValue: '0.8s', changeType: 'changed' },
  { field: 'Armor Pen', oldValue: '0%', newValue: '20%', changeType: 'added' },
  { field: 'Special Effect', oldValue: 'None', newValue: 'Tears reality', changeType: 'added' },
];

const COMPARISON_STATS: StatComparison[] = [
  { stat: 'Avg Damage', valueA: 15, valueB: 40, unit: '', higherIsBetter: true },
  { stat: 'Attack Speed', valueA: 1.2, valueB: 0.8, unit: 's', higherIsBetter: false },
  { stat: 'DPS', valueA: 12.5, valueB: 50.0, unit: '', higherIsBetter: true },
];

/* ── 6.5 Crafting Recipe Data ────────────────────────────────────────── */

interface CraftMaterial { name: string; quantity: number; rarity: string }
interface CraftRecipe {
  output: string;
  outputRarity: string;
  materials: CraftMaterial[];
  successRate: number;
  cost: number;
  affixChances: { affix: string; chance: number; color: string }[];
}

const SAMPLE_RECIPE: CraftRecipe = {
  output: 'Crystal Staff',
  outputRarity: 'Rare',
  materials: [
    { name: 'Arcane Shard', quantity: 3, rarity: 'Uncommon' },
    { name: 'Mithril Rod', quantity: 1, rarity: 'Rare' },
    { name: 'Mana Crystal', quantity: 2, rarity: 'Common' },
  ],
  successRate: 0.85,
  cost: 500,
  affixChances: [
    { affix: 'Mana Regen +5/s', chance: 0.6, color: '#60a5fa' },
    { affix: 'Spell Cost -10%', chance: 0.35, color: '#c084fc' },
    { affix: 'of Power', chance: 0.15, color: '#f87171' },
    { affix: 'Blazing', chance: 0.08, color: '#fb923c' },
  ],
};

/* ── 6.6 Item Drop Source Data ───────────────────────────────────────── */

interface DropSource { name: string; type: 'enemy' | 'loot_table' | 'zone'; dropRate: number; color: string }

const CRYSTAL_STAFF_SOURCES: DropSource[] = [
  { name: 'Caster', type: 'enemy', dropRate: 0.05, color: '#f87171' },
  { name: 'Rare_Weapons', type: 'loot_table', dropRate: 0.03, color: '#fbbf24' },
  { name: 'Whispering Woods', type: 'zone', dropRate: 0.01, color: '#4ade80' },
];

/* ── 6.7 Inventory Capacity Data ─────────────────────────────────────── */

interface InventorySlotGroup { type: string; count: number; color: string }

const INVENTORY_GROUPS: InventorySlotGroup[] = [
  { type: 'Weapons', count: 4, color: '#f87171' },
  { type: 'Armor', count: 5, color: '#60a5fa' },
  { type: 'Consumables', count: 3, color: '#4ade80' },
  { type: 'Materials', count: 5, color: '#fbbf24' },
];

const INVENTORY_TOTAL = 20;
const INVENTORY_USED = INVENTORY_GROUPS.reduce((a, g) => a + g.count, 0);
const INVENTORY_GOLD_VALUE = 2450;

const INVENTORY_BY_RARITY = [
  { rarity: 'Common', count: 7, color: RARITY_COLORS.Common },
  { rarity: 'Uncommon', count: 5, color: RARITY_COLORS.Uncommon },
  { rarity: 'Rare', count: 3, color: RARITY_COLORS.Rare },
  { rarity: 'Epic', count: 1, color: RARITY_COLORS.Epic },
  { rarity: 'Legendary', count: 1, color: RARITY_COLORS.Legendary },
];

const CLEANUP_SUGGESTIONS = [
  'Sell 3x Common potions (+45g)',
  'Salvage 2x Uncommon armor (+6 materials)',
  'Drop 1x Iron Longsword (lowest DPS weapon)',
];

/* ── 6.8 Set Bonus Data ──────────────────────────────────────────────── */

interface SetBonus { pieces: number; description: string }
interface ItemSet {
  name: string;
  color: string;
  pieces: { slot: string; name: string; owned: boolean }[];
  bonuses: SetBonus[];
}

const ITEM_SETS: ItemSet[] = [
  {
    name: "Warrior's Resolve",
    color: '#f87171',
    pieces: [
      { slot: 'Chest', name: 'Resolve Chestplate', owned: true },
      { slot: 'Head', name: 'Resolve Helm', owned: true },
      { slot: 'Legs', name: 'Resolve Greaves', owned: false },
    ],
    bonuses: [
      { pieces: 2, description: '+10% Armor' },
      { pieces: 3, description: '+25% Max HP' },
    ],
  },
  {
    name: 'Arcane Scholar',
    color: '#c084fc',
    pieces: [
      { slot: 'MainHand', name: 'Scholar Staff', owned: true },
      { slot: 'Amulet', name: 'Scholar Amulet', owned: true },
    ],
    bonuses: [
      { pieces: 2, description: '+20% Mana' },
    ],
  },
];

/* ── 6.9 Item Level Scaling Data ─────────────────────────────────────── */

interface ScalingLine { label: string; color: string; points: { level: number; min: number; max: number }[] }

const SCALING_LINES: ScalingLine[] = [
  {
    label: 'Weapon Damage',
    color: '#f87171',
    points: Array.from({ length: 10 }, (_, i) => {
      const lvl = (i + 1) * 5;
      const base = 5 + lvl * 2;
      return { level: lvl, min: base * 0.85, max: base * 1.15 };
    }),
  },
  {
    label: 'Armor Defense',
    color: '#60a5fa',
    points: Array.from({ length: 10 }, (_, i) => {
      const lvl = (i + 1) * 5;
      const base = 10 + lvl * 1.5;
      return { level: lvl, min: base * 0.9, max: base * 1.1 };
    }),
  },
  {
    label: 'Affix Magnitude',
    color: '#4ade80',
    points: Array.from({ length: 10 }, (_, i) => {
      const lvl = (i + 1) * 5;
      const base = 2 + lvl * 0.8;
      return { level: lvl, min: base * 0.8, max: base * 1.2 };
    }),
  },
];

/* ── 6.10 Rarity Distribution Data ───────────────────────────────────── */

interface RarityDistEntry { rarity: string; expected: number; actual: number; color: string }

const RARITY_DIST: RarityDistEntry[] = [
  { rarity: 'Common', expected: 0.40, actual: 0.55, color: RARITY_COLORS.Common },
  { rarity: 'Uncommon', expected: 0.30, actual: 0.25, color: RARITY_COLORS.Uncommon },
  { rarity: 'Rare', expected: 0.20, actual: 0.15, color: RARITY_COLORS.Rare },
  { rarity: 'Epic', expected: 0.08, actual: 0.05, color: RARITY_COLORS.Epic },
  { rarity: 'Legendary', expected: 0.02, actual: 0.0, color: RARITY_COLORS.Legendary },
];

const LUCK_SCORE = 72;

/* ── Component ─────────────────────────────────────────────────────────── */

interface ItemCatalogProps {
  moduleId: SubModuleId;
}

export function ItemCatalog({ moduleId }: ItemCatalogProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);

  const [activeTab, setActiveTab] = useState('catalog-gear');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'catalog-gear', label: 'Catalog & Gear', icon: Package },
    { id: 'economy-sourcing', label: 'Economy & Sourcing', icon: FlaskConical },
    { id: 'mechanics-scaling', label: 'Mechanics & Scaling', icon: TrendingUp },
  ], []);

  const [filterType, setFilterType] = useState<string>('All');
  const [filterRarity, setFilterRarity] = useState<string>('All');
  const [affixOpen, setAffixOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', type: 'Weapon' as ItemData['type'], rarity: 'Common', description: '' });

  const { execute: executeCli, isRunning: isCliRunning } = useModuleCLI({
    moduleId,
    sessionKey: 'item-gen',
    label: 'Item Generator',
    accentColor: ACCENT,
  });

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0, missing = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
      else if (status === 'missing') missing++;
    }
    return { total, implemented, partial, missing };
  }, [defs, featureMap]);

  const filteredItems = useMemo(() => {
    return DUMMY_ITEMS.filter(item => {
      if (filterType !== 'All' && item.type !== filterType) return false;
      if (filterRarity !== 'All' && item.rarity !== filterRarity) return false;
      return true;
    });
  }, [filterType, filterRarity]);

  const handleCreateItem = useCallback(() => {
    if (!newItem.name.trim()) return;
    const slug = newItem.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const imagePrompt = `Game item icon, ${newItem.rarity} ${newItem.type}, ${newItem.name}, ${newItem.description}, dark fantasy ARPG style, centered on black background, high detail`.slice(0, 1500);

    const prompt = `Create a new item for the ARPG loot system:
Name: ${newItem.name}
Type: ${newItem.type}
Rarity: ${newItem.rarity}
Description: ${newItem.description}

Steps:
1. Call POST /api/leonardo with prompt: "${imagePrompt}"
2. The API will return { imageUrl, generationId }
3. Download the image from imageUrl and save to public/items/${slug}.webp
4. Confirm the item was created with its image path

Item slug: ${slug}`;

    executeCli({
      type: 'checklist',
      moduleId,
      prompt,
      label: `Create item: ${newItem.name}`,
    });
    setShowAddForm(false);
    setNewItem({ name: '', type: 'Weapon', rarity: 'Common', description: '' });
  }, [newItem, moduleId, executeCli]);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-2.5">
      {/* Header with stats */}
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Package} title="Item Catalog" implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>


      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'catalog-gear' && (
            <motion.div
              key="catalog-gear"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              {/* Main layout: Grid + Filters */}
              <div className="flex flex-col gap-2.5">
                {/* Filters bar */}
                <SurfaceCard level={2} className="p-3 flex flex-wrap items-center gap-2.5 sticky top-4 z-20 shadow-md">
                  <div className="flex items-center gap-2 mr-auto">
                    <Filter className="w-4 h-4 text-text-muted" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Filters</span>
                  </div>
                  <button
                    onClick={() => setShowAddForm((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: showAddForm ? `${ACCENT}20` : 'var(--surface)',
                      color: showAddForm ? ACCENT : 'var(--text-muted)',
                      border: `1px solid ${showAddForm ? `${ACCENT}50` : 'var(--border)'}`,
                    }}
                  >
                    {showAddForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showAddForm ? 'Cancel' : 'Add Item'}
                  </button>
                  <div className="flex items-center gap-1.5 bg-surface-deep p-1 rounded-lg border border-border/40">
                    {['All', 'Weapon', 'Armor', 'Consumable'].map(t => (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${filterType === t ? 'bg-surface text-text shadow-sm border border-border/50' : 'text-text-muted hover:text-text'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface-deep p-1 rounded-lg border border-border/40">
                    {['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map(r => (
                      <button
                        key={r}
                        onClick={() => setFilterRarity(r)}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${filterRarity === r ? 'bg-surface text-text shadow-sm border border-border/50' : 'text-text-muted hover:text-text'}`}
                      >
                        {r === 'All' ? 'All Rarities' : <span style={{ color: RARITY_COLORS[r] }}>{r}</span>}
                      </button>
                    ))}
                  </div>
                </SurfaceCard>

                {/* Add Item Form */}
                <AnimatePresence>
                  {showAddForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <SurfaceCard level={2} className="p-4 space-y-3" style={{ borderColor: `${ACCENT}30` }}>
                        <div className="grid grid-cols-3 gap-3">
                          <input
                            type="text"
                            placeholder="Item Name"
                            value={newItem.name}
                            onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                            className="col-span-1 text-xs px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text placeholder:text-text-muted focus:outline-none focus:border-text-muted/50"
                          />
                          <select
                            value={newItem.type}
                            onChange={(e) => setNewItem((prev) => ({ ...prev, type: e.target.value as ItemData['type'] }))}
                            className="text-xs px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text focus:outline-none"
                          >
                            <option value="Weapon">Weapon</option>
                            <option value="Armor">Armor</option>
                            <option value="Consumable">Consumable</option>
                          </select>
                          <select
                            value={newItem.rarity}
                            onChange={(e) => setNewItem((prev) => ({ ...prev, rarity: e.target.value }))}
                            className="text-xs px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text focus:outline-none"
                          >
                            {Object.keys(RARITY_COLORS).map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          placeholder="Brief description..."
                          value={newItem.description}
                          onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                          rows={2}
                          className="w-full text-xs px-3 py-2 rounded-lg bg-surface-deep border border-border/50 text-text placeholder:text-text-muted focus:outline-none resize-none"
                        />
                        <button
                          onClick={handleCreateItem}
                          disabled={!newItem.name.trim() || isCliRunning}
                          className="flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                          style={{ backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {isCliRunning ? 'Creating...' : 'Create with AI Image'}
                        </button>
                      </SurfaceCard>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Item Catalog Grid with Layout Animations */}
                <div className="relative min-h-[300px]">
                  <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    <AnimatePresence mode="popLayout">
                      {filteredItems.map(item => (
                        <TradingCard key={item.id} item={item} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                  {filteredItems.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted opacity-50">
                      <Search className="w-12 h-12 mb-2.5" />
                      <p>No items found matching the current filters.</p>
                    </div>
                  )}
                </div>
              </div>


              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* Legacy Equipment slots info (mini view) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* Affix table collapsible */}
                  <SurfaceCard level={2} className="p-0 overflow-hidden">
                    <button
                      onClick={() => setAffixOpen((v) => !v)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/30 transition-colors text-left focus:outline-none"
                    >
                      <motion.div animate={{ rotate: affixOpen ? 90 : 0 }}>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </motion.div>
                      <span className="text-sm font-bold text-text">Affix System Definitions</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border shadow-sm ml-auto" style={{ backgroundColor: STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].bg, color: STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].dot, borderColor: `${STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].dot}40` }}>
                        {STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].label}
                      </span>
                    </button>
                    <AnimatePresence>
                      {affixOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/40 overflow-x-auto bg-surface/30">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border/30 bg-surface-deep/50">
                                  {['Affix', 'Modifier', 'Tier', 'Rarity'].map((h) => (
                                    <th key={h} className="text-left px-4 py-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {AFFIX_EXAMPLES.map((affix, i) => (
                                  <motion.tr
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                    key={affix.name} className="hover:bg-surface-hover/20 transition-colors"
                                  >
                                    <td className="px-4 py-2 font-mono text-text font-medium">{affix.name}</td>
                                    <td className="px-4 py-2 text-text-muted">{affix.stat}</td>
                                    <td className="px-4 py-2">
                                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold border shadow-sm" style={{ backgroundColor: affix.tier === 'Prefix' ? `${MODULE_COLORS.core}${OPACITY_10}` : `${MODULE_COLORS.systems}${OPACITY_10}`, color: affix.tier === 'Prefix' ? MODULE_COLORS.core : MODULE_COLORS.systems, borderColor: affix.tier === 'Prefix' ? `${MODULE_COLORS.core}40` : `${MODULE_COLORS.systems}40` }}>
                                        {affix.tier}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 font-medium" style={{ color: RARITY_COLORS[affix.rarity] }}>{affix.rarity}</td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SurfaceCard>

                  {/* Equipment Slots Status */}
                  <SurfaceCard level={2} className="p-4">
                    <SectionLabel label="Equipment Slot Topology" />
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {EQUIPMENT_SLOTS.map((slot) => {
                        const slotStatus: FeatureStatus = featureMap.get(slot.featureName)?.status ?? 'unknown';
                        const sc = STATUS_COLORS[slotStatus];
                        return (
                          <div
                            key={slot.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs shadow-sm border"
                            style={{ backgroundColor: `${sc.dot}${OPACITY_10}`, borderColor: `${sc.dot}${OPACITY_20}` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                            <span className="text-text font-medium">{slot.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </SurfaceCard>
                </div>


                {/* ── 6.3 Equipment Loadout Visualizer ───────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={Shield} label="Equipment Loadout Visualizer" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Paper-doll layout with equipped items and stat contribution summary.</p>
                  <div className="flex flex-wrap gap-2.5 items-start justify-center">
                    {/* Paper doll SVG */}
                    <div className="relative" style={{ width: 180, height: 160 }}>
                      <svg width={180} height={160} viewBox="0 0 220 200" className="absolute inset-0">
                        {/* Simple character outline */}
                        <ellipse cx="95" cy="25" rx="14" ry="16" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                        <line x1="95" y1="41" x2="95" y2="110" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                        <line x1="95" y1="55" x2="60" y2="85" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                        <line x1="95" y1="55" x2="130" y2="85" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                        <line x1="95" y1="110" x2="75" y2="165" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                        <line x1="95" y1="110" x2="115" y2="165" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                      </svg>
                      {/* Slot markers */}
                      {LOADOUT_SLOTS.map(slot => {
                        const pos = LOADOUT_SLOT_POSITIONS[slot.slotId];
                        const color = slot.item ? RARITY_COLORS[slot.item.rarity] ?? '#64748b' : '#334155';
                        return (
                          <motion.div
                            key={slot.slotId}
                            className="absolute flex flex-col items-center"
                            style={{ left: pos.x, top: pos.y }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.1 }}
                          >
                            <div
                              className="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-[8px] font-bold font-mono shadow-lg"
                              style={{
                                borderColor: `${color}80`,
                                backgroundColor: `${color}20`,
                                color: color,
                                boxShadow: slot.item ? `0 0 8px ${color}40` : 'none',
                              }}
                              title={slot.item ? `${slot.item.name} (${slot.item.rarity})` : `Empty: ${slot.slotName}`}
                            >
                              {slot.item ? slot.item.name.charAt(0) : '?'}
                            </div>
                            <span className="text-[8px] font-mono text-text-muted mt-0.5">{slot.slotName}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                    {/* Stat summary */}
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Stat Contributions</p>
                      {(() => {
                        const totals: Record<string, { value: number; sources: string[] }> = {};
                        for (const slot of LOADOUT_SLOTS) {
                          if (!slot.item) continue;
                          for (const [stat, val] of Object.entries(slot.item.stats)) {
                            if (!totals[stat]) totals[stat] = { value: 0, sources: [] };
                            totals[stat].value += val;
                            totals[stat].sources.push(slot.item.name);
                          }
                        }
                        const maxVal = Math.max(...Object.values(totals).map(t => t.value), 1);
                        return Object.entries(totals).map(([stat, data]) => (
                          <div key={stat} className="space-y-0.5">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-text-muted">{stat}</span>
                              <span className="text-text font-bold">{data.value}</span>
                            </div>
                            <div className="h-2 rounded-full bg-surface-deep overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: ACCENT }}
                                initial={{ width: 0 }}
                                animate={{ width: `${(data.value / maxVal) * 100}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                              />
                            </div>
                            <p className="text-[8px] text-text-muted opacity-60">{data.sources.join(', ')}</p>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </SurfaceCard>


              </div>
              {/* ── 6.4 Item Comparison Side-by-Side ───────────────────────────────── */}
              <SurfaceCard level={2} className="p-4">
                <SectionLabel icon={Swords} label="Item Comparison" color={ACCENT} />
                <p className="text-xs text-text-muted mt-1 mb-2.5">Side-by-side comparison with stat deltas.</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2.5 items-start">
                  {/* Item A */}
                  <div className="p-3 rounded-lg border" style={{ borderColor: `${RARITY_COLORS.Common}40`, backgroundColor: `${RARITY_COLORS.Common}08` }}>
                    <p className="text-xs font-bold text-text">Iron Longsword</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: RARITY_COLORS.Common }}>Common Sword</p>
                    <div className="mt-2 space-y-1 text-[10px] font-mono text-text-muted">
                      <p>Damage: 12-18</p>
                      <p>Speed: 1.2s</p>
                      <p>DPS: 12.5</p>
                    </div>
                  </div>
                  {/* Delta column */}
                  <div className="flex flex-col items-center gap-1 pt-4">
                    {COMPARISON_STATS.map(s => {
                      const diff = s.valueB - s.valueA;
                      const isBetter = s.higherIsBetter ? diff > 0 : diff < 0;
                      return (
                        <div key={s.stat} className="flex items-center gap-1 text-[10px] font-mono">
                          <span className="text-text-muted w-16 text-right">{s.stat}</span>
                          <span className={isBetter ? 'text-emerald-400' : 'text-red-400'}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}{s.unit}
                            {isBetter ? ' \u25B2' : ' \u25BC'}
                          </span>
                        </div>
                      );
                    })}
                    <div className="mt-2 px-2 py-1 rounded border text-[10px] font-mono font-bold" style={{ borderColor: `${STATUS_SUCCESS}40`, color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}10` }}>
                      Net DPS: +37.5
                    </div>
                  </div>
                  {/* Item B */}
                  <div className="p-3 rounded-lg border" style={{ borderColor: `${RARITY_COLORS.Legendary}40`, backgroundColor: `${RARITY_COLORS.Legendary}08` }}>
                    <p className="text-xs font-bold text-text">Void Daggers</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: RARITY_COLORS.Legendary }}>Legendary Dagger</p>
                    <div className="mt-2 space-y-1 text-[10px] font-mono text-text-muted">
                      <p>Damage: 35-45</p>
                      <p>Speed: 0.8s</p>
                      <p>DPS: 50.0</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Full Diff</p>
                  <DiffViewer entries={COMPARISON_ENTRIES} accent={ACCENT} />
                </div>
              </SurfaceCard>


              {/* ── 6.8 Set Bonus System Preview ───────────────────────────────────── */}
              <SurfaceCard level={2} className="p-4">
                <SectionLabel icon={Crown} label="Set Bonus System Preview" color={ACCENT} />
                <p className="text-xs text-text-muted mt-1 mb-2.5">Track set collection progress and bonus thresholds.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {ITEM_SETS.map(set => {
                    const ownedCount = set.pieces.filter(p => p.owned).length;
                    return (
                      <motion.div
                        key={set.name}
                        className="p-3 rounded-lg border space-y-3"
                        style={{ borderColor: `${set.color}40`, backgroundColor: `${set.color}06` }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text">{set.name}</span>
                          <span className="text-[10px] font-mono font-bold" style={{ color: set.color }}>
                            {ownedCount}/{set.pieces.length}
                          </span>
                        </div>
                        {/* Pieces */}
                        <div className="flex flex-wrap gap-1.5">
                          {set.pieces.map(piece => (
                            <div
                              key={piece.slot}
                              className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border"
                              style={{
                                borderColor: piece.owned ? `${set.color}50` : 'var(--border)',
                                backgroundColor: piece.owned ? `${set.color}15` : 'transparent',
                                opacity: piece.owned ? 1 : 0.5,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: piece.owned ? set.color : '#64748b' }} />
                              <span className="text-text-muted">{piece.slot}:</span>
                              <span className={piece.owned ? 'text-text' : 'text-text-muted'}>{piece.name}</span>
                              {!piece.owned && <span className="text-red-400 text-[8px]">(missing)</span>}
                            </div>
                          ))}
                        </div>
                        {/* Bonuses */}
                        <div className="space-y-1.5 border-t border-border/30 pt-2">
                          {set.bonuses.map(bonus => {
                            const active = ownedCount >= bonus.pieces;
                            return (
                              <div
                                key={bonus.pieces}
                                className="flex items-center gap-2 text-[10px] font-mono"
                                style={{ opacity: active ? 1 : 0.4 }}
                              >
                                <span
                                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border"
                                  style={{
                                    borderColor: active ? `${set.color}60` : 'var(--border)',
                                    backgroundColor: active ? `${set.color}20` : 'transparent',
                                    color: active ? set.color : 'var(--text-muted)',
                                  }}
                                >
                                  {bonus.pieces}
                                </span>
                                <span className={active ? 'text-text' : 'text-text-muted'}>{bonus.description}</span>
                                {active && <span className="text-emerald-400 text-[8px] font-bold ml-auto">ACTIVE</span>}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </SurfaceCard>


            </motion.div>
          )}
          {activeTab === 'economy-sourcing' && (
            <motion.div
              key="economy-sourcing"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* ── 6.5 Crafting Recipe Preview ────────────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={FlaskConical} label="Crafting Recipe Preview" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Recipe card showing materials, output, and affix probability ranges.</p>
                  <div className="flex flex-wrap gap-2.5 items-start">
                    {/* Materials → Output flow */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="space-y-2">
                        {SAMPLE_RECIPE.materials.map(mat => (
                          <div
                            key={mat.name}
                            className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border"
                            style={{ borderColor: `${RARITY_COLORS[mat.rarity] ?? '#64748b'}40`, backgroundColor: `${RARITY_COLORS[mat.rarity] ?? '#64748b'}08` }}
                          >
                            <span className="text-text font-bold">{mat.quantity}x</span>
                            <span className="text-text-muted">{mat.name}</span>
                            <span className="text-[9px] opacity-60" style={{ color: RARITY_COLORS[mat.rarity] }}>{mat.rarity}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-text-muted text-lg font-bold">&rarr;</div>
                      <div
                        className="p-3 rounded-lg border-2 text-center min-w-[120px]"
                        style={{ borderColor: `${RARITY_COLORS[SAMPLE_RECIPE.outputRarity]}60`, backgroundColor: `${RARITY_COLORS[SAMPLE_RECIPE.outputRarity]}10` }}
                      >
                        <p className="text-xs font-bold text-text">{SAMPLE_RECIPE.output}</p>
                        <p className="text-[10px] font-mono" style={{ color: RARITY_COLORS[SAMPLE_RECIPE.outputRarity] }}>{SAMPLE_RECIPE.outputRarity}</p>
                      </div>
                    </div>
                    {/* Success gauge + cost */}
                    <div className="flex flex-col gap-2 min-w-[150px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-text-muted">Success Rate</span>
                          <span className="text-emerald-400 font-bold">{(SAMPLE_RECIPE.successRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-3 rounded-full bg-surface-deep overflow-hidden border border-border/30">
                          <motion.div
                            className="h-full rounded-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${SAMPLE_RECIPE.successRate * 100}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-text-muted">
                        Cost: <span className="text-amber-400 font-bold">{SAMPLE_RECIPE.cost}g</span>
                      </p>
                      <div className="mt-1 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Output Affixes</p>
                        {SAMPLE_RECIPE.affixChances.map(ac => (
                          <div key={ac.affix} className="flex items-center gap-2 text-[10px] font-mono">
                            <div className="flex-1 h-1.5 rounded-full bg-surface-deep overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${ac.chance * 100}%`, backgroundColor: ac.color }} />
                            </div>
                            <span className="text-text-muted w-20 truncate">{ac.affix}</span>
                            <span style={{ color: ac.color }}>{(ac.chance * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-surface-hover/30"
                      style={{ borderColor: `${ACCENT}40`, color: ACCENT, backgroundColor: `${ACCENT}10` }}
                      onClick={() => { }}
                    >
                      Simulate 100 Crafts
                    </button>
                    <span className="text-[10px] text-text-muted italic">(Static preview)</span>
                  </div>
                </SurfaceCard>


                {/* ── 6.6 Item Drop Source Map ───────────────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={MapPin} label="Item Drop Source Map" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Trace drop sources for Crystal Staff: enemies, loot tables, and zones.</p>
                  <div className="flex items-center gap-2.5 flex-wrap justify-center">
                    {/* Target item */}
                    <div
                      className="p-3 rounded-lg border-2 text-center min-w-[110px] flex-shrink-0"
                      style={{ borderColor: `${RARITY_COLORS.Rare}60`, backgroundColor: `${RARITY_COLORS.Rare}10` }}
                    >
                      <p className="text-xs font-bold text-text">Crystal Staff</p>
                      <p className="text-[10px] font-mono" style={{ color: RARITY_COLORS.Rare }}>Rare Staff</p>
                    </div>
                    <div className="text-text-muted text-lg font-bold">&larr;</div>
                    {/* Sources */}
                    <div className="space-y-2 flex-1 min-w-[200px]">
                      {CRYSTAL_STAFF_SOURCES.map(src => (
                        <motion.div
                          key={src.name}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                          style={{ borderColor: `${src.color}30`, backgroundColor: `${src.color}08` }}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <span
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${src.color}20`, color: src.color }}
                          >
                            {src.type === 'enemy' ? 'Enemy' : src.type === 'loot_table' ? 'Loot Table' : 'Zone'}
                          </span>
                          <span className="text-xs font-mono text-text flex-1">{src.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-surface-deep overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${src.dropRate * 100 * 5}%`, backgroundColor: src.color }} />
                            </div>
                            <span className="text-[10px] font-mono font-bold" style={{ color: src.color }}>
                              {(src.dropRate * 100).toFixed(1)}%
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </SurfaceCard>


              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* ── 6.10 Rarity Distribution Analyzer ──────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={BarChart3} label="Rarity Distribution Analyzer" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Compare expected vs actual inventory rarity at Level 14.</p>
                  <div className="space-y-3">
                    {RARITY_DIST.map(r => {
                      const maxPct = Math.max(r.expected, r.actual);
                      const barScale = maxPct > 0 ? 100 / maxPct : 100;
                      return (
                        <div key={r.rarity} className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold" style={{ color: r.color }}>{r.rarity}</span>
                            <span className="text-text-muted">
                              Expected {(r.expected * 100).toFixed(0)}% | Actual {(r.actual * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <div className="flex-1 space-y-0.5">
                              <div className="h-2 rounded-full bg-surface-deep overflow-hidden relative">
                                <div
                                  className="h-full rounded-full opacity-50"
                                  style={{ width: `${r.expected * barScale}%`, backgroundColor: r.color }}
                                />
                              </div>
                              <div className="h-2 rounded-full bg-surface-deep overflow-hidden relative">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: r.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${r.actual * barScale}%` }}
                                  transition={{ duration: 0.6 }}
                                />
                              </div>
                            </div>
                            <div className="w-8 flex flex-col items-center justify-center text-[8px] font-mono">
                              {r.actual > r.expected ? (
                                <span className="text-red-400">{'\u25B2'}</span>
                              ) : r.actual < r.expected ? (
                                <span className="text-emerald-400">{'\u25BC'}</span>
                              ) : (
                                <span className="text-text-muted">=</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted">
                      <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm opacity-50" style={{ backgroundColor: '#94a3b8' }} /> Expected</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#94a3b8' }} /> Actual</span>
                    </div>
                    {/* Luck Score */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-deep border border-border/30">
                      <div className="relative w-10 h-10">
                        <svg width={40} height={40} viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                          <circle
                            cx="24" cy="24" r="20" fill="none"
                            stroke={LUCK_SCORE >= 80 ? STATUS_SUCCESS : LUCK_SCORE >= 50 ? STATUS_WARNING : STATUS_ERROR}
                            strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 20}`}
                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - LUCK_SCORE / 100)}`}
                            transform="rotate(-90 24 24)"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-text">{LUCK_SCORE}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text">Luck Score</p>
                        <p className="text-[10px] text-text-muted">Based on deviation from expected rarity distribution at Level 14</p>
                      </div>
                    </div>
                  </div>
                </SurfaceCard>

                {/* ── 6.7 Inventory Capacity Planner ─────────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={PieChart} label="Inventory Capacity Planner" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Slots by type, rarity breakdown, total value, and cleanup suggestions.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {/* Pie chart (SVG donut) */}
                    <div className="flex flex-col items-center gap-2">
                      <svg width={110} height={110} viewBox="0 0 140 140">
                        {(() => {
                          const cx = 70, cy = 70, outerR = 55, innerR = 35;
                          let cumAngle = -Math.PI / 2;
                          return INVENTORY_GROUPS.map(g => {
                            const angle = (g.count / INVENTORY_TOTAL) * 2 * Math.PI;
                            const x1o = cx + outerR * Math.cos(cumAngle);
                            const y1o = cy + outerR * Math.sin(cumAngle);
                            const x1i = cx + innerR * Math.cos(cumAngle);
                            const y1i = cy + innerR * Math.sin(cumAngle);
                            cumAngle += angle;
                            const x2o = cx + outerR * Math.cos(cumAngle);
                            const y2o = cy + outerR * Math.sin(cumAngle);
                            const x2i = cx + innerR * Math.cos(cumAngle);
                            const y2i = cy + innerR * Math.sin(cumAngle);
                            const large = angle > Math.PI ? 1 : 0;
                            const d = `M${x1o},${y1o} A${outerR},${outerR} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${innerR},${innerR} 0 ${large} 0 ${x1i},${y1i} Z`;
                            return <path key={g.type} d={d} fill={g.color} opacity={0.8} stroke="var(--surface)" strokeWidth="1.5" />;
                          });
                        })()}
                        {/* Empty wedge */}
                        {(() => {
                          const cx = 70, cy = 70, outerR = 55, innerR = 35;
                          const usedAngle = (INVENTORY_USED / INVENTORY_TOTAL) * 2 * Math.PI;
                          const emptyAngle = 2 * Math.PI - usedAngle;
                          const startAngle = -Math.PI / 2 + usedAngle;
                          if (emptyAngle <= 0) return null;
                          const x1o = cx + outerR * Math.cos(startAngle);
                          const y1o = cy + outerR * Math.sin(startAngle);
                          const x1i = cx + innerR * Math.cos(startAngle);
                          const y1i = cy + innerR * Math.sin(startAngle);
                          const endAngle = startAngle + emptyAngle;
                          const x2o = cx + outerR * Math.cos(endAngle);
                          const y2o = cy + outerR * Math.sin(endAngle);
                          const x2i = cx + innerR * Math.cos(endAngle);
                          const y2i = cy + innerR * Math.sin(endAngle);
                          const large = emptyAngle > Math.PI ? 1 : 0;
                          const d = `M${x1o},${y1o} A${outerR},${outerR} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${innerR},${innerR} 0 ${large} 0 ${x1i},${y1i} Z`;
                          return <path d={d} fill="rgba(255,255,255,0.05)" stroke="var(--surface)" strokeWidth="1.5" />;
                        })()}
                        <text x="70" y="66" textAnchor="middle" className="text-sm font-bold fill-text font-mono">{INVENTORY_USED}/{INVENTORY_TOTAL}</text>
                        <text x="70" y="80" textAnchor="middle" className="text-[9px] fill-[var(--text-muted)] font-mono">slots</text>
                      </svg>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {INVENTORY_GROUPS.map(g => (
                          <span key={g.type} className="text-[9px] font-mono flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: g.color }} />
                            {g.type} ({g.count})
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Rarity bars */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">By Rarity</p>
                      {INVENTORY_BY_RARITY.map(r => (
                        <div key={r.rarity} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span style={{ color: r.color }}>{r.rarity}</span>
                            <span className="text-text-muted">{r.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-deep overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: r.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(r.count / INVENTORY_USED) * 100}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-text-muted mt-2">
                        Total Value: <span className="text-amber-400 font-bold">{INVENTORY_GOLD_VALUE}g</span>
                      </p>
                    </div>
                    {/* Cleanup suggestions */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Auto-Cleanup Suggestions</p>
                      {CLEANUP_SUGGESTIONS.map((sug, i) => (
                        <motion.div
                          key={i}
                          className="flex items-start gap-2 text-[10px] font-mono p-2 rounded-lg bg-surface-deep border border-border/30"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <span className="text-amber-400 font-bold flex-shrink-0">{i + 1}.</span>
                          <span className="text-text-muted">{sug}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </SurfaceCard>


              </div>
            </motion.div>
          )}
          {activeTab === 'mechanics-scaling' && (
            <motion.div
              key="mechanics-scaling"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              {/* System pipeline header */}
              <SurfaceCard level={2} className="p-3 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent pointer-events-none" />
                <SectionLabel icon={Layers} label="System Pipeline" />
                <div className="mt-2.5 relative z-10">
                  <PipelineFlow
                    steps={SYSTEM_PIPELINE.map(n => ({ label: n.label, status: (featureMap.get(n.featureName)?.status ?? 'unknown') as FeatureStatus }))}
                    accent={ACCENT}
                    showStatus
                  />
                </div>
              </SurfaceCard>


              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* ── 6.1 Item Power Budget Radar ────────────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={Target} label="Item Power Budget Radar" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Compare item power distribution across 5 budget axes. Outer ring = rarity cap.</p>
                  <div className="flex items-center justify-center gap-8 flex-wrap">
                    <div className="flex flex-col items-center gap-2">
                      <RadarChart
                        data={IRON_LONGSWORD_RADAR}
                        size={180}
                        accent={RARITY_COLORS.Common}
                        overlays={[{ data: VOID_DAGGERS_RADAR, color: RARITY_COLORS.Legendary, label: 'Void Daggers' }]}
                        showLabels
                      />
                    </div>
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: RARITY_COLORS.Common }} />
                        <span className="text-text-muted font-mono">Iron Longsword</span>
                        <span className="text-text-muted opacity-50">(Common)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 rounded border-b border-dashed" style={{ borderColor: RARITY_COLORS.Legendary, backgroundColor: 'transparent' }} />
                        <span className="text-text-muted font-mono">Void Daggers</span>
                        <span className="font-medium" style={{ color: RARITY_COLORS.Legendary }}>(Legendary)</span>
                      </div>
                      <div className="mt-2 p-2 rounded-lg bg-surface-deep border border-border/40 space-y-1">
                        {POWER_BUDGET_AXES.map((axis, i) => {
                          const a = IRON_LONGSWORD_RADAR[i].value;
                          const b = VOID_DAGGERS_RADAR[i].value;
                          const delta = ((b - a) * 100).toFixed(0);
                          return (
                            <div key={axis} className="flex items-center gap-2 font-mono text-[10px]">
                              <span className="w-14 text-text-muted">{axis}</span>
                              <span className="text-text">{(a * 100).toFixed(0)}%</span>
                              <span className="text-text-muted">vs</span>
                              <span className="text-text">{(b * 100).toFixed(0)}%</span>
                              <span className={Number(delta) > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {Number(delta) > 0 ? '+' : ''}{delta}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </SurfaceCard>


                {/* ── 6.2 Affix Probability Tree ─────────────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={TreePine} label="Affix Probability Tree" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Sunburst view: center = Rare rarity, first ring = prefix count, second ring = specific affixes.</p>
                  <div className="flex items-center justify-center">
                    <AffixSunburst tree={AFFIX_PROB_TREE} size={260} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 justify-center">
                    {AFFIX_PROB_TREE.children?.map(c => (
                      <span key={c.id} className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ color: c.color, borderColor: `${c.color}40`, backgroundColor: `${c.color}10` }}>
                        {c.label}: {(c.probability * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </SurfaceCard>


              </div>
              <div className="grid grid-cols-1 xl:grid-cols-1 gap-2.5">
                {/* ── 6.9 Item Level Scaling Preview ─────────────────────────────────── */}
                <SurfaceCard level={2} className="p-4">
                  <SectionLabel icon={TrendingUp} label="Item Level Scaling Preview" color={ACCENT} />
                  <p className="text-xs text-text-muted mt-1 mb-2.5">Stat values across item levels 1-50 with min-max bands.</p>
                  <div className="flex justify-center">
                    <ItemScalingChart lines={SCALING_LINES} width={280} height={110} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 justify-center">
                    {SCALING_LINES.map(line => (
                      <span key={line.label} className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: line.color }} />
                        <span style={{ color: line.color }}>{line.label}</span>
                      </span>
                    ))}
                  </div>
                </SurfaceCard>


                {/* Note: since scaling chart is 320px wide we could put it next to legacy Eq but it's fine taking the full row since scaling visualization is long. Actually, let's wrap it nicely */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      \n</div>
  );
}

/* ── Trading Card Component ────────────────────────────────────────────── */

function TradingCard({ item }: { item: ItemData }) {
  const color = RARITY_COLORS[item.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="group relative h-full"
      style={{ perspective: 1000 }}
    >
      <SurfaceCard
        level={3}
        className="h-full flex flex-col overflow-hidden relative border-2 shadow-xl transition-all duration-300"
        style={{
          borderColor: `${color}40`,
          boxShadow: `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 0 20px -10px ${color}30`,
        }}
      >
        {/* Glow Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" />

        {/* Header (Top) */}
        <div className="p-4 border-b relative" style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}>
          <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none opacity-50" style={{ backgroundColor: color }} />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-text leading-tight">{item.name}</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest mt-1 opacity-80" style={{ color }}>{item.rarity} {item.subtype}</p>
            </div>
          </div>
        </div>

        {/* Content (Middle) */}
        <div className="p-4 flex-1 flex flex-col gap-3 relative z-10 bg-surface/50">
          {/* Main Artwork */}
          <div className="w-full h-24 rounded-lg bg-surface-deep border flex items-center justify-center relative overflow-hidden group-hover:border-text-muted/50 transition-colors" style={{ borderColor: `${color}20` }}>
            {item.imagePath ? (
              <Image
                src={item.imagePath}
                width={512}
                height={512}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Package className="w-10 h-10 opacity-30" style={{ color }} />
              </motion.div>
            )}
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ backgroundImage: `radial-gradient(circle at center, ${color}20 1px, transparent 1px)`, backgroundSize: '10px 10px' }} />
          </div>

          {/* Stats Bar */}
          <div className="flex justify-around items-center py-2 border-y border-border/40">
            {item.stats.map(s => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">{s.label}</span>
                <span className="text-xs font-mono font-bold text-text mt-0.5">{s.value}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted italic leading-relaxed text-center">"{item.description}"</p>

          {item.effect && (
            <div className="mt-auto p-2.5 rounded-lg border text-xs font-medium text-text bg-surface-deep shadow-inner" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
              <span className="font-bold mr-1" style={{ color }}>Equip:</span>
              <span>{item.effect}</span>
            </div>
          )}
        </div>
      </SurfaceCard>
    </motion.div>
  );
}

/* ── Affix Sunburst Component (6.2) ──────────────────────────────────── */

function AffixSunburst({ tree, size }: { tree: ProbabilityEntry; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const innerR = 30;
  const ring1Inner = 40;
  const ring1Outer = 80;
  const ring2Inner = 85;
  const ring2Outer = 120;

  const describeArc = (
    cxA: number, cyA: number, rInner: number, rOuter: number,
    startAngle: number, endAngle: number
  ): string => {
    const cos1 = Math.cos(startAngle);
    const sin1 = Math.sin(startAngle);
    const cos2 = Math.cos(endAngle);
    const sin2 = Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1o = cxA + rOuter * cos1;
    const y1o = cyA + rOuter * sin1;
    const x2o = cxA + rOuter * cos2;
    const y2o = cyA + rOuter * sin2;
    const x1i = cxA + rInner * cos1;
    const y1i = cyA + rInner * sin1;
    const x2i = cxA + rInner * cos2;
    const y2i = cyA + rInner * sin2;
    return `M${x1o},${y1o} A${rOuter},${rOuter} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${rInner},${rInner} 0 ${large} 0 ${x1i},${y1i} Z`;
  };

  const arcs: { d: string; fill: string; label: string; midAngle: number; midR: number }[] = [];

  if (tree.children) {
    let cumAngle = -Math.PI / 2;
    for (const child of tree.children) {
      const angle = child.probability * 2 * Math.PI;
      const midAngle = cumAngle + angle / 2;
      const midR = (ring1Inner + ring1Outer) / 2;
      arcs.push({
        d: describeArc(cx, cy, ring1Inner, ring1Outer, cumAngle, cumAngle + angle),
        fill: child.color ?? '#64748b',
        label: `${child.label} (${(child.probability * 100).toFixed(0)}%)`,
        midAngle, midR,
      });

      // Second ring: children of this child
      if (child.children && child.children.length > 0) {
        let childCum = cumAngle;
        for (const grandchild of child.children) {
          const childAngle = grandchild.probability * angle;
          const gcMidAngle = childCum + childAngle / 2;
          const gcMidR = (ring2Inner + ring2Outer) / 2;
          arcs.push({
            d: describeArc(cx, cy, ring2Inner, ring2Outer, childCum, childCum + childAngle),
            fill: grandchild.color ?? child.color ?? '#64748b',
            label: `${grandchild.label} (${(grandchild.probability * 100).toFixed(0)}%)`,
            midAngle: gcMidAngle, midR: gcMidR,
          });
          childCum += childAngle;
        }
      }

      cumAngle += angle;
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={innerR} fill={`${tree.color ?? ACCENT}20`} stroke={tree.color ?? ACCENT} strokeWidth="1.5" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold font-mono" fill={tree.color ?? ACCENT}>
        {tree.label}
      </text>
      {/* Arcs */}
      {arcs.map((arc, i) => (
        <g key={i}>
          <path
            d={arc.d}
            fill={`${arc.fill}40`}
            stroke={arc.fill}
            strokeWidth="1"
            className="hover:opacity-80 transition-opacity cursor-default"
          >
            <title>{arc.label}</title>
          </path>
        </g>
      ))}
      {/* Labels for first ring only */}
      {arcs.filter((_, i) => i < (tree.children?.length ?? 0)).map((arc, i) => {
        const lx = cx + (arc.midR + 5) * Math.cos(arc.midAngle);
        const ly = cy + (arc.midR + 5) * Math.sin(arc.midAngle);
        return (
          <text key={`label-${i}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            className="text-[7px] font-mono fill-[var(--text-muted)] pointer-events-none"
          >
            {arc.label.split('(')[0].trim()}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Item Level Scaling Chart Component (6.9) ────────────────────────── */

function ItemScalingChart({ lines, width, height }: { lines: ScalingLine[]; width: number; height: number }) {
  const padL = 35;
  const padR = 10;
  const padT = 10;
  const padB = 25;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = lines.flatMap(l => l.points.flatMap(p => [p.min, p.max]));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valRange = maxVal - minVal || 1;

  const allLevels = lines[0]?.points.map(p => p.level) ?? [];
  const minLvl = Math.min(...allLevels);
  const maxLvl = Math.max(...allLevels);
  const lvlRange = maxLvl - minLvl || 1;

  const xScale = (lvl: number) => padL + ((lvl - minLvl) / lvlRange) * plotW;
  const yScale = (val: number) => padT + plotH - ((val - minVal) / valRange) * plotH;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + plotH * (1 - frac);
        const val = minVal + valRange * frac;
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 4} y={y} textAnchor="end" dominantBaseline="central" className="text-[7px] font-mono fill-[var(--text-muted)]">
              {val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* X axis labels */}
      {allLevels.filter((_, i) => i % 2 === 0).map(lvl => (
        <text key={lvl} x={xScale(lvl)} y={height - 4} textAnchor="middle" className="text-[7px] font-mono fill-[var(--text-muted)]">
          {lvl}
        </text>
      ))}
      {/* Axis labels */}
      <text x={width / 2} y={height} textAnchor="middle" className="text-[7px] font-mono fill-[var(--text-muted)]">Item Level</text>

      {/* Lines with min/max bands */}
      {lines.map(line => {
        const bandPath = line.points.map((p, i) => {
          const x = xScale(p.level);
          const yMax = yScale(p.max);
          return i === 0 ? `M${x},${yMax}` : `L${x},${yMax}`;
        }).join(' ') + ' ' + [...line.points].reverse().map((p, i) => {
          const x = xScale(p.level);
          const yMin = yScale(p.min);
          return i === 0 ? `L${x},${yMin}` : `L${x},${yMin}`;
        }).join(' ') + ' Z';

        const midPath = line.points.map((p, i) => {
          const x = xScale(p.level);
          const y = yScale((p.min + p.max) / 2);
          return i === 0 ? `M${x},${y}` : `L${x},${y}`;
        }).join(' ');

        return (
          <g key={line.label}>
            <path d={bandPath} fill={`${line.color}15`} stroke="none" />
            <path d={midPath} fill="none" stroke={line.color} strokeWidth="1.5" strokeLinecap="round" />
            {line.points.map(p => (
              <circle
                key={p.level}
                cx={xScale(p.level)}
                cy={yScale((p.min + p.max) / 2)}
                r="2"
                fill={line.color}
                className="opacity-60"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

