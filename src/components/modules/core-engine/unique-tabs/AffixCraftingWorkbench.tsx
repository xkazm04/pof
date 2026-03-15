'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Hammer, Plus, Trash2, Download, Copy, Check, RotateCcw,
  ChevronDown, ChevronRight, Shuffle, AlertTriangle,
  Sparkles, Crown, Zap, GripVertical, ToggleLeft, ToggleRight,
  Wand2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, STAGGER_SLOW } from './_shared';
import { logger } from '@/lib/logger';
import type { SubModuleId } from '@/types/modules';

const ACCENT = MODULE_COLORS.core;

// ── Types mirroring C++ structs ──

type ItemType = 'Weapon' | 'Armor' | 'Consumable' | 'Material' | 'Quest';
type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

const RARITY_COLORS: Record<Rarity, string> = {
  Common: STATUS_INFO,
  Uncommon: STATUS_SUCCESS,
  Rare: MODULE_COLORS.core,
  Epic: MODULE_COLORS.systems,
  Legendary: MODULE_COLORS.content,
};

const RARITY_AFFIX_COUNTS: Record<Rarity, { min: number; max: number }> = {
  Common: { min: 0, max: 0 },
  Uncommon: { min: 1, max: 2 },
  Rare: { min: 3, max: 4 },
  Epic: { min: 4, max: 5 },
  Legendary: { min: 5, max: 6 },
};

interface AffixPoolEntry {
  id: string;
  tag: string; // e.g., 'Affix.Strength'
  displayName: string; // e.g., 'of Strength' or 'Blazing'
  bIsPrefix: boolean;
  minValue: number;
  maxValue: number;
  weight: number;
  minRarity: Rarity;
  stat: string; // what it affects e.g., 'Strength', 'Fire Damage'
  category: 'offensive' | 'defensive' | 'utility';
}

interface CraftedAffix {
  poolEntryId: string;
  tag: string;
  displayName: string;
  bIsPrefix: boolean;
  magnitude: number;
  stat: string;
  category: 'offensive' | 'defensive' | 'utility';
}

interface ItemBase {
  name: string;
  type: ItemType;
  rarity: Rarity;
  itemLevel: number;
  baseValue: number;
}

// ── Affix Pool Data (matches FAffixTableRow from C++) ──

const AFFIX_POOL: AffixPoolEntry[] = [
  // Offensive prefixes
  { id: 'aff-blazing', tag: 'Affix.FireDmg', displayName: 'Blazing', bIsPrefix: true, minValue: 5, maxValue: 15, weight: 1.0, minRarity: 'Common', stat: 'Fire Damage', category: 'offensive' },
  { id: 'aff-frozen', tag: 'Affix.IceDmg', displayName: 'Frozen', bIsPrefix: true, minValue: 5, maxValue: 15, weight: 1.0, minRarity: 'Common', stat: 'Ice Damage', category: 'offensive' },
  { id: 'aff-vampiric', tag: 'Affix.LifeSteal', displayName: 'Vampiric', bIsPrefix: true, minValue: 2, maxValue: 8, weight: 0.5, minRarity: 'Rare', stat: 'Life Steal %', category: 'offensive' },
  { id: 'aff-vicious', tag: 'Affix.CritDmg', displayName: 'Vicious', bIsPrefix: true, minValue: 10, maxValue: 30, weight: 0.6, minRarity: 'Rare', stat: 'Crit Damage %', category: 'offensive' },
  { id: 'aff-celestial', tag: 'Affix.AllDmg', displayName: 'Celestial', bIsPrefix: true, minValue: 10, maxValue: 25, weight: 0.2, minRarity: 'Legendary', stat: 'All Damage %', category: 'offensive' },
  { id: 'aff-thunderous', tag: 'Affix.LightningDmg', displayName: 'Thunderous', bIsPrefix: true, minValue: 8, maxValue: 18, weight: 0.8, minRarity: 'Uncommon', stat: 'Lightning Damage', category: 'offensive' },
  { id: 'aff-brutal', tag: 'Affix.PhysDmg', displayName: 'Brutal', bIsPrefix: true, minValue: 5, maxValue: 20, weight: 1.2, minRarity: 'Common', stat: 'Physical Damage', category: 'offensive' },

  // Offensive suffixes
  { id: 'aff-strength', tag: 'Affix.Strength', displayName: 'of Strength', bIsPrefix: false, minValue: 3, maxValue: 10, weight: 1.5, minRarity: 'Common', stat: 'Strength', category: 'offensive' },
  { id: 'aff-precision', tag: 'Affix.CritChance', displayName: 'of Precision', bIsPrefix: false, minValue: 2, maxValue: 8, weight: 0.7, minRarity: 'Uncommon', stat: 'Crit Chance %', category: 'offensive' },
  { id: 'aff-fury', tag: 'Affix.AtkSpeed', displayName: 'of Fury', bIsPrefix: false, minValue: 5, maxValue: 15, weight: 0.6, minRarity: 'Rare', stat: 'Attack Speed %', category: 'offensive' },

  // Defensive prefixes
  { id: 'aff-sturdy', tag: 'Affix.Armor', displayName: 'Sturdy', bIsPrefix: true, minValue: 10, maxValue: 30, weight: 1.2, minRarity: 'Common', stat: 'Armor', category: 'defensive' },
  { id: 'aff-warding', tag: 'Affix.MagicRes', displayName: 'Warding', bIsPrefix: true, minValue: 5, maxValue: 20, weight: 0.8, minRarity: 'Uncommon', stat: 'Magic Resistance', category: 'defensive' },
  { id: 'aff-titanic', tag: 'Affix.MaxHP', displayName: 'Titanic', bIsPrefix: true, minValue: 50, maxValue: 200, weight: 0.4, minRarity: 'Epic', stat: 'Max HP', category: 'defensive' },

  // Defensive suffixes
  { id: 'aff-fortitude', tag: 'Affix.Vitality', displayName: 'of Fortitude', bIsPrefix: false, minValue: 5, maxValue: 15, weight: 1.0, minRarity: 'Common', stat: 'Vitality', category: 'defensive' },
  { id: 'aff-endurance', tag: 'Affix.Stamina', displayName: 'of Endurance', bIsPrefix: false, minValue: 5, maxValue: 12, weight: 0.9, minRarity: 'Uncommon', stat: 'Stamina', category: 'defensive' },
  { id: 'aff-void', tag: 'Affix.DmgReduc', displayName: 'of the Void', bIsPrefix: false, minValue: 3, maxValue: 10, weight: 0.3, minRarity: 'Epic', stat: 'Damage Reduction %', category: 'defensive' },

  // Utility suffixes
  { id: 'aff-haste', tag: 'Affix.MoveSpeed', displayName: 'of Haste', bIsPrefix: false, minValue: 3, maxValue: 10, weight: 0.8, minRarity: 'Uncommon', stat: 'Move Speed %', category: 'utility' },
  { id: 'aff-fortune', tag: 'Affix.GoldFind', displayName: 'of Fortune', bIsPrefix: false, minValue: 5, maxValue: 20, weight: 0.5, minRarity: 'Rare', stat: 'Gold Find %', category: 'utility' },
  { id: 'aff-legends', tag: 'Affix.AllSkills', displayName: 'of Legends', bIsPrefix: false, minValue: 1, maxValue: 3, weight: 0.2, minRarity: 'Legendary', stat: '+All Skills', category: 'utility' },

  // Utility prefix
  { id: 'aff-swift', tag: 'Affix.CDR', displayName: 'Swift', bIsPrefix: true, minValue: 5, maxValue: 15, weight: 0.6, minRarity: 'Rare', stat: 'Cooldown Reduction %', category: 'utility' },
];

// ── Synergy definitions ──

interface SynergyRule {
  affixTags: [string, string]; // pair of affix tags
  label: string;
  severity: 'broken' | 'strong' | 'good';
  description: string;
}

const SYNERGY_RULES: SynergyRule[] = [
  { affixTags: ['Affix.LifeSteal', 'Affix.CritChance'], label: 'Vampiric Crits', severity: 'broken', description: 'Life Steal + Crit Chance = sustain-while-bursting. Very hard to kill.' },
  { affixTags: ['Affix.LifeSteal', 'Affix.AtkSpeed'], label: 'Leech Machine', severity: 'broken', description: 'Fast attacks with life steal = absurd sustain in prolonged fights.' },
  { affixTags: ['Affix.CritChance', 'Affix.CritDmg'], label: 'Crit Stacking', severity: 'strong', description: 'Crit chance + crit damage is multiplicative power. Expected but potent.' },
  { affixTags: ['Affix.AllDmg', 'Affix.CritDmg'], label: 'Double Multiplier', severity: 'broken', description: 'Both are multipliers — stacking them creates exponential damage scaling.' },
  { affixTags: ['Affix.MaxHP', 'Affix.DmgReduc'], label: 'Tank Wall', severity: 'strong', description: 'HP + damage reduction is multiplicative effective HP. Very tanky.' },
  { affixTags: ['Affix.MaxHP', 'Affix.LifeSteal'], label: 'Immortal', severity: 'broken', description: 'Huge HP pool + life steal = nearly unkillable in sustained fights.' },
  { affixTags: ['Affix.MoveSpeed', 'Affix.CDR'], label: 'Kite Master', severity: 'good', description: 'Move speed + cooldown reduction enables strong kiting gameplay.' },
  { affixTags: ['Affix.AtkSpeed', 'Affix.PhysDmg'], label: 'DPS Machine', severity: 'strong', description: 'Attack speed multiplies flat physical damage. Classic DPS combo.' },
  { affixTags: ['Affix.FireDmg', 'Affix.AllDmg'], label: 'Fire Ascendant', severity: 'strong', description: 'Flat fire + all damage % = very high elemental output.' },
  { affixTags: ['Affix.AllSkills', 'Affix.CDR'], label: 'Ability Spammer', severity: 'strong', description: '+All Skills with CDR = abilities up constantly with higher base power.' },
];

const SYNERGY_COLORS: Record<string, string> = {
  broken: STATUS_ERROR,
  strong: STATUS_WARNING,
  good: STATUS_SUCCESS,
};

// ── Rarity Archetype Patterns ──

interface RarityArchetype {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  color: string;
  affixTags: string[]; // ordered affix tags for this archetype
  synergies: string[]; // synergy labels this archetype triggers
}

function detectArchetypes(pool: AffixPoolEntry[], rarity: Rarity): RarityArchetype[] {
  const rarityIdx = RARITIES.indexOf(rarity);
  const eligible = pool.filter(a => RARITIES.indexOf(a.minRarity) <= rarityIdx);
  const eligibleTags = new Set(eligible.map(a => a.tag));
  const maxSlots = RARITY_AFFIX_COUNTS[rarity].max;

  // Score each archetype based on: synergy count, slot fit, rarity match
  const archetypes: RarityArchetype[] = [];

  // Build candidate archetypes from synergy clusters
  const synergyGraph = new Map<string, { partners: Set<string>; rules: SynergyRule[] }>();
  for (const rule of SYNERGY_RULES) {
    const [a, b] = rule.affixTags;
    if (!eligibleTags.has(a) || !eligibleTags.has(b)) continue;
    if (!synergyGraph.has(a)) synergyGraph.set(a, { partners: new Set(), rules: [] });
    if (!synergyGraph.has(b)) synergyGraph.set(b, { partners: new Set(), rules: [] });
    synergyGraph.get(a)!.partners.add(b);
    synergyGraph.get(a)!.rules.push(rule);
    synergyGraph.get(b)!.partners.add(a);
    synergyGraph.get(b)!.rules.push(rule);
  }

  // Find clusters: start from high-connectivity nodes
  const visited = new Set<string>();
  const sortedNodes = [...synergyGraph.entries()].sort((a, b) => b[1].partners.size - a[1].partners.size);

  for (const [root, { partners, rules }] of sortedNodes) {
    if (visited.has(root)) continue;

    // Expand cluster greedily up to maxSlots
    const cluster = new Set<string>([root]);
    const clusterRules = new Set<string>();
    for (const p of partners) {
      if (cluster.size >= maxSlots) break;
      cluster.add(p);
    }

    // Add filler affixes from same categories if slots remain
    const clusterAffixes = eligible.filter(a => cluster.has(a.tag));
    const primaryCategory = clusterAffixes.length > 0
      ? clusterAffixes.reduce<Record<string, number>>((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {})
      : {};
    const dominantCategory = Object.entries(primaryCategory).sort((a, b) => b[1] - a[1])[0]?.[0] as 'offensive' | 'defensive' | 'utility' | undefined;

    if (cluster.size < maxSlots && dominantCategory) {
      for (const a of eligible) {
        if (cluster.size >= maxSlots) break;
        if (cluster.has(a.tag)) continue;
        if (a.category === dominantCategory) cluster.add(a.tag);
      }
    }

    // Compute triggered synergies
    for (const rule of SYNERGY_RULES) {
      if (cluster.has(rule.affixTags[0]) && cluster.has(rule.affixTags[1])) {
        clusterRules.add(rule.label);
      }
    }

    if (clusterRules.size === 0) continue;

    // Name the archetype based on dominant theme
    const categoryColors: Record<string, string> = {
      offensive: STATUS_ERROR,
      defensive: ACCENT_EMERALD,
      utility: ACCENT_CYAN,
    };

    const archetypeNames: Record<string, Record<string, string>> = {
      offensive: {
        broken: 'Glass Cannon',
        strong: 'DPS Specialist',
        default: 'Striker',
      },
      defensive: {
        broken: 'Immortal Tank',
        strong: 'Juggernaut',
        default: 'Guardian',
      },
      utility: {
        broken: 'Arcane Trickster',
        strong: 'Speedster',
        default: 'Utility Hybrid',
      },
    };

    const bestSeverity = rules.some(r => r.severity === 'broken') ? 'broken' : rules.some(r => r.severity === 'strong') ? 'strong' : 'default';
    const cat = dominantCategory ?? 'offensive';
    const name = archetypeNames[cat]?.[bestSeverity] ?? 'Hybrid Build';

    // Avoid duplicates by name
    if (archetypes.some(a => a.name === name)) {
      visited.add(root);
      continue;
    }

    archetypes.push({
      id: `arch-${root}`,
      name,
      description: `${clusterRules.size} synergies, ${cluster.size} affixes, ${cat}-focused`,
      rarity,
      color: categoryColors[cat] ?? ACCENT,
      affixTags: [...cluster],
      synergies: [...clusterRules],
    });

    for (const tag of cluster) visited.add(tag);
  }

  return archetypes.slice(0, 4); // max 4 suggestions
}

// ── Item bases ──

const ITEM_BASES: ItemBase[] = [
  { name: 'Iron Sword', type: 'Weapon', rarity: 'Common', itemLevel: 1, baseValue: 50 },
  { name: 'Steel Longsword', type: 'Weapon', rarity: 'Uncommon', itemLevel: 10, baseValue: 150 },
  { name: 'Mithril Blade', type: 'Weapon', rarity: 'Rare', itemLevel: 25, baseValue: 500 },
  { name: 'Adamantine Greataxe', type: 'Weapon', rarity: 'Epic', itemLevel: 40, baseValue: 1200 },
  { name: 'Dragonbone Staff', type: 'Weapon', rarity: 'Legendary', itemLevel: 60, baseValue: 5000 },
  { name: 'Leather Vest', type: 'Armor', rarity: 'Common', itemLevel: 1, baseValue: 30 },
  { name: 'Chainmail Hauberk', type: 'Armor', rarity: 'Uncommon', itemLevel: 10, baseValue: 120 },
  { name: 'Plate Cuirass', type: 'Armor', rarity: 'Rare', itemLevel: 25, baseValue: 400 },
  { name: 'Shadow Cloak', type: 'Armor', rarity: 'Epic', itemLevel: 40, baseValue: 1000 },
  { name: 'Crown of the Fallen', type: 'Armor', rarity: 'Legendary', itemLevel: 60, baseValue: 4000 },
];

// ── Helpers ──

function getItemLevelScaling(level: number): number {
  return 1.0 + 0.1 * level;
}

function buildAffixName(baseName: string, affixes: CraftedAffix[]): string {
  const prefixes = affixes.filter((a) => a.bIsPrefix).map((a) => a.displayName);
  const suffixes = affixes.filter((a) => !a.bIsPrefix).map((a) => a.displayName);

  let name = baseName;
  if (prefixes.length > 0) name = prefixes.join(' ') + ' ' + name;
  if (suffixes.length > 0) name = name + ' ' + suffixes.join(' ');
  return name;
}

function computePowerBudget(affixes: CraftedAffix[], itemLevel: number): { offense: number; defense: number; utility: number; total: number } {
  let offense = 0;
  let defense = 0;
  let utility = 0;

  for (const a of affixes) {
    const scaled = a.magnitude * getItemLevelScaling(itemLevel);
    if (a.category === 'offensive') offense += scaled;
    else if (a.category === 'defensive') defense += scaled;
    else utility += scaled;
  }

  return { offense, defense, utility, total: offense + defense + utility };
}

// Max budget reference per rarity for normalization
const RARITY_BUDGET_MAX: Record<Rarity, number> = {
  Common: 0,
  Uncommon: 50,
  Rare: 150,
  Epic: 300,
  Legendary: 500,
};

function generateExportCode(base: ItemBase, affixes: CraftedAffix[]): string {
  const lines = [
    '// =====================================================',
    '// Pre-rolled ItemInstance — Generated by PoF Workbench',
    `// ${new Date().toISOString()}`,
    '// =====================================================',
    '',
    `// Base: ${base.name} (${base.type}, ${base.rarity}, Level ${base.itemLevel})`,
    `// Full Name: "${buildAffixName(base.name, affixes)}"`,
    `// Total Power: ${computePowerBudget(affixes, base.itemLevel).total.toFixed(1)}`,
    '',
    '// Create item instance in C++:',
    'UARPGItemInstance* Item = NewObject<UARPGItemInstance>(this);',
    `Item->Definition = LoadObject<UARPGItemDefinition>(nullptr, TEXT("/Game/Items/DA_${base.name.replace(/\s+/g, '_')}"));`,
    `Item->ItemLevel = ${base.itemLevel};`,
    `Item->StackCount = 1;`,
    '',
    '// Pre-roll affixes:',
    `Item->Affixes.Reserve(${affixes.length});`,
    '',
  ];

  for (const a of affixes) {
    const scaledMag = (a.magnitude * getItemLevelScaling(base.itemLevel)).toFixed(1);
    lines.push('{');
    lines.push('\tFItemAffix Affix;');
    lines.push(`\tAffix.AffixTag = FGameplayTag::RequestGameplayTag(FName("${a.tag}"));`);
    lines.push(`\tAffix.DisplayName = FText::FromString(TEXT("${a.displayName}"));`);
    lines.push(`\tAffix.Magnitude = ${scaledMag}f;`);
    lines.push(`\tAffix.bIsPrefix = ${a.bIsPrefix ? 'true' : 'false'};`);
    lines.push(`\t// Effect: GE_${a.stat.replace(/[^a-zA-Z]/g, '')}`);
    lines.push('\tItem->Affixes.Add(Affix);');
    lines.push('}');
    lines.push('');
  }

  lines.push(`// Item power budget: Offense=${computePowerBudget(affixes, base.itemLevel).offense.toFixed(0)} Defense=${computePowerBudget(affixes, base.itemLevel).defense.toFixed(0)} Utility=${computePowerBudget(affixes, base.itemLevel).utility.toFixed(0)}`);

  return lines.join('\n');
}

// ── Component ──

interface AffixCraftingWorkbenchProps {
  moduleId: SubModuleId;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AffixCraftingWorkbench({ moduleId }: AffixCraftingWorkbenchProps) {
  // Item state
  const [selectedBase, setSelectedBase] = useState<ItemBase>(ITEM_BASES[2]); // Default: Mithril Blade
  const [craftedAffixes, setCraftedAffixes] = useState<CraftedAffix[]>([]);
  const [itemLevel, setItemLevel] = useState(25);

  // UI state
  const [poolFilter, setPoolFilter] = useState<'all' | 'offensive' | 'defensive' | 'utility'>('all');
  const [poolSearch, setPoolSearch] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [dragOverItem, setDragOverItem] = useState(false);
  const [draggingAffixId, setDraggingAffixId] = useState<string | null>(null);
  const [expandedSynergies, setExpandedSynergies] = useState(true);
  const [previewTag, setPreviewTag] = useState<string | null>(null);

  const dropRef = useRef<HTMLDivElement>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  // ── Derived ──

  const maxAffixes = RARITY_AFFIX_COUNTS[selectedBase.rarity].max;
  const canAddMore = craftedAffixes.length < maxAffixes;

  const fullItemName = useMemo(() => buildAffixName(selectedBase.name, craftedAffixes), [selectedBase.name, craftedAffixes]);

  const powerBudget = useMemo(() => computePowerBudget(craftedAffixes, itemLevel), [craftedAffixes, itemLevel]);

  const budgetMax = RARITY_BUDGET_MAX[selectedBase.rarity] || 100;
  const budgetRatio = Math.min(powerBudget.total / budgetMax, 1.5);
  const isOverBudget = budgetRatio > 1.0;

  // Filter pool
  const filteredPool = useMemo(() => {
    let pool = AFFIX_POOL;

    // Rarity gate
    const rarityIdx = RARITIES.indexOf(selectedBase.rarity);
    pool = pool.filter((a) => RARITIES.indexOf(a.minRarity) <= rarityIdx);

    // Category filter
    if (poolFilter !== 'all') {
      pool = pool.filter((a) => a.category === poolFilter);
    }

    // Search
    if (poolSearch) {
      const lower = poolSearch.toLowerCase();
      pool = pool.filter((a) => a.displayName.toLowerCase().includes(lower) || a.stat.toLowerCase().includes(lower) || a.tag.toLowerCase().includes(lower));
    }

    // Don't show already-added (by tag, since same affix can't stack)
    const usedTags = new Set(craftedAffixes.map((a) => a.tag));
    pool = pool.filter((a) => !usedTags.has(a.tag));

    return pool;
  }, [selectedBase.rarity, poolFilter, poolSearch, craftedAffixes]);

  // Weight stats for the filtered pool (bar normalization + probability)
  const { maxWeight, totalWeight } = useMemo(() => {
    const max = filteredPool.reduce((m, a) => Math.max(m, a.weight), 0);
    const total = filteredPool.reduce((s, a) => s + a.weight, 0);
    return { maxWeight: max, totalWeight: total };
  }, [filteredPool]);

  // Synergies
  const activeSynergies = useMemo(() => {
    const tags = new Set(craftedAffixes.map((a) => a.tag));
    return SYNERGY_RULES.filter(
      (r) => tags.has(r.affixTags[0]) && tags.has(r.affixTags[1]),
    );
  }, [craftedAffixes]);

  // Synergy discovery animation
  const [synergyGlow, setSynergyGlow] = useState(false);
  const [newSynergyLabels, setNewSynergyLabels] = useState<Set<string>>(new Set());
  const prevSynergyCountRef = useRef(0);

  useEffect(() => {
    const prevCount = prevSynergyCountRef.current;
    const currentCount = activeSynergies.length;

    if (currentCount > prevCount && prevCount >= 0) {
      // New synergy discovered — find which ones are new
      const currentLabels = new Set(activeSynergies.map((s) => s.label));
      setNewSynergyLabels(currentLabels);

      // Pulse the header glow
      setSynergyGlow(true);
      const timer = setTimeout(() => setSynergyGlow(false), 600);

      // Auto-expand if collapsed
      if (!expandedSynergies) setExpandedSynergies(true);

      return () => clearTimeout(timer);
    }

    // Clear new labels after animation completes
    if (currentCount <= prevCount && newSynergyLabels.size > 0) {
      setNewSynergyLabels(new Set());
    }

    prevSynergyCountRef.current = currentCount;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSynergies]);

  // ── Actions ──

  const addAffix = useCallback((poolEntry: AffixPoolEntry) => {
    if (!canAddMore) return;
    // Already have this affix?
    if (craftedAffixes.some((a) => a.tag === poolEntry.tag)) return;

    const initialMag = (poolEntry.minValue + poolEntry.maxValue) / 2;
    const affix: CraftedAffix = {
      poolEntryId: poolEntry.id,
      tag: poolEntry.tag,
      displayName: poolEntry.displayName,
      bIsPrefix: poolEntry.bIsPrefix,
      magnitude: initialMag,
      stat: poolEntry.stat,
      category: poolEntry.category,
    };
    setCraftedAffixes((prev) => [...prev, affix]);
  }, [canAddMore, craftedAffixes]);

  const removeAffix = useCallback((tag: string) => {
    setCraftedAffixes((prev) => prev.filter((a) => a.tag !== tag));
  }, []);

  const updateAffixMagnitude = useCallback((tag: string, magnitude: number) => {
    setCraftedAffixes((prev) => prev.map((a) => a.tag === tag ? { ...a, magnitude } : a));
  }, []);

  const toggleAffixPlacement = useCallback((tag: string) => {
    setCraftedAffixes((prev) => prev.map((a) => a.tag === tag ? { ...a, bIsPrefix: !a.bIsPrefix } : a));
  }, []);

  const randomRoll = useCallback(() => {
    const rarityIdx = RARITIES.indexOf(selectedBase.rarity);
    const eligible = AFFIX_POOL.filter((a) => RARITIES.indexOf(a.minRarity) <= rarityIdx);

    const { min, max } = RARITY_AFFIX_COUNTS[selectedBase.rarity];
    const count = Math.floor(Math.random() * (max - min + 1)) + min;

    // Weighted selection without replacement
    const available = [...eligible];
    const rolled: CraftedAffix[] = [];

    for (let i = 0; i < count && available.length > 0; i++) {
      const totalWeight = available.reduce((s, a) => s + a.weight, 0);
      let roll = Math.random() * totalWeight;
      let pick = available[0];
      for (const a of available) {
        roll -= a.weight;
        if (roll <= 0) { pick = a; break; }
      }

      const mag = pick.minValue + Math.random() * (pick.maxValue - pick.minValue);
      rolled.push({
        poolEntryId: pick.id,
        tag: pick.tag,
        displayName: pick.displayName,
        bIsPrefix: pick.bIsPrefix,
        magnitude: Math.round(mag * 10) / 10,
        stat: pick.stat,
        category: pick.category,
      });

      // Remove from pool (no duplicates)
      const idx = available.indexOf(pick);
      if (idx >= 0) available.splice(idx, 1);
    }

    setCraftedAffixes(rolled);
  }, [selectedBase.rarity]);

  const clearAffixes = useCallback(() => {
    setCraftedAffixes([]);
  }, []);

  // ── Smart Rarity Pattern Suggestions ──
  const suggestedArchetypes = useMemo(
    () => detectArchetypes(AFFIX_POOL, selectedBase.rarity),
    [selectedBase.rarity],
  );

  const applyArchetype = useCallback((archetype: RarityArchetype) => {
    const newAffixes: CraftedAffix[] = [];
    for (const tag of archetype.affixTags) {
      const poolEntry = AFFIX_POOL.find(a => a.tag === tag);
      if (!poolEntry) continue;
      newAffixes.push({
        poolEntryId: poolEntry.id,
        tag: poolEntry.tag,
        displayName: poolEntry.displayName,
        bIsPrefix: poolEntry.bIsPrefix,
        magnitude: Math.round(((poolEntry.minValue + poolEntry.maxValue) / 2) * 10) / 10,
        stat: poolEntry.stat,
        category: poolEntry.category,
      });
    }
    setCraftedAffixes(newAffixes);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const code = generateExportCode(selectedBase, craftedAffixes);
      await navigator.clipboard.writeText(code);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    } catch {
      logger.warn('Clipboard copy failed');
    }
  }, [selectedBase, craftedAffixes]);

  const handleExportFile = useCallback(() => {
    const code = generateExportCode(selectedBase, craftedAffixes);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ItemInstance_${selectedBase.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.cpp`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedBase, craftedAffixes]);

  // ── Category color helper ──

  const getCategoryColor = useCallback((category: 'offensive' | 'defensive' | 'utility') => {
    if (category === 'offensive') return STATUS_ERROR;
    if (category === 'defensive') return STATUS_INFO;
    return ACCENT_EMERALD;
  }, []);

  // ── Drag handlers ──

  const handleDragStart = useCallback((e: React.DragEvent, entry: AffixPoolEntry) => {
    e.dataTransfer.setData('text/plain', entry.id);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingAffixId(entry.id);

    // Create custom drag ghost pill
    const ghost = document.createElement('div');
    const catColor = getCategoryColor(entry.category);
    ghost.style.cssText = `
      position: fixed; top: -100px; left: -100px;
      width: 120px; height: 28px;
      display: flex; align-items: center; gap: 6px;
      padding: 0 10px;
      background: rgba(15, 15, 25, 0.9);
      border: 1px solid ${catColor}60;
      border-radius: 14px;
      font-family: ui-monospace, monospace;
      font-size: 11px; font-weight: 700;
      color: #e2e8f0;
      backdrop-filter: blur(8px);
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 8px ${catColor}30;
    `;

    const dot = document.createElement('span');
    dot.style.cssText = `
      width: 6px; height: 6px;
      border-radius: 50%;
      background: ${catColor};
      box-shadow: 0 0 4px ${catColor};
      flex-shrink: 0;
    `;

    const label = document.createElement('span');
    label.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    label.textContent = entry.displayName;

    ghost.appendChild(dot);
    ghost.appendChild(label);
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;

    e.dataTransfer.setDragImage(ghost, 60, 14);
  }, [getCategoryColor]);

  const handleDragEnd = useCallback(() => {
    setDraggingAffixId(null);
    if (dragGhostRef.current) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverItem(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverItem(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverItem(false);
    const entryId = e.dataTransfer.getData('text/plain');
    const entry = AFFIX_POOL.find((a) => a.id === entryId);
    if (entry) addAffix(entry);
  }, [addAffix]);

  // ── Radar data ──

  const radarAxes = ['Offense', 'Defense', 'Utility'];
  const radarValues = useMemo(() => {
    const off = Math.min(powerBudget.offense / (budgetMax * 0.6), 1);
    const def = Math.min(powerBudget.defense / (budgetMax * 0.6), 1);
    const util = Math.min(powerBudget.utility / (budgetMax * 0.3), 1);
    return [off, def, util];
  }, [powerBudget, budgetMax]);

  // Ghost radar values: what the radar would look like with the previewed affix at max magnitude
  const ghostRadarValues = useMemo(() => {
    if (!previewTag) return null;
    const affix = craftedAffixes.find((a) => a.tag === previewTag);
    if (!affix) return null;
    const poolEntry = AFFIX_POOL.find((a) => a.id === affix.poolEntryId);
    if (!poolEntry) return null;

    // Compute budget with this affix at max magnitude
    const maxedAffixes = craftedAffixes.map((a) =>
      a.tag === previewTag ? { ...a, magnitude: poolEntry.maxValue } : a,
    );
    const maxBudget = computePowerBudget(maxedAffixes, itemLevel);
    const off = Math.min(maxBudget.offense / (budgetMax * 0.6), 1);
    const def = Math.min(maxBudget.defense / (budgetMax * 0.6), 1);
    const util = Math.min(maxBudget.utility / (budgetMax * 0.3), 1);
    return [off, def, util];
  }, [previewTag, craftedAffixes, itemLevel, budgetMax]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${ACCENT}${OPACITY_15}` }}>
            <Hammer className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              Affix Crafting Workbench
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">DESIGNER TOOL</span>
            </h3>
            <p className="text-2xs text-text-muted">Craft items visually, preview names, detect synergies, export to UE5</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={randomRoll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all" style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`, color: ACCENT_VIOLET, border: `1px solid ${ACCENT_VIOLET}${OPACITY_30}` }}>
            <Shuffle className="w-3 h-3" />
            Random Roll
          </button>
          <button onClick={clearAffixes} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-text-muted hover:text-text transition-colors border border-border/40">
            <RotateCcw className="w-3 h-3" />
          </button>
          <button onClick={() => setShowExport(!showExport)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all" style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS, border: `1px solid ${STATUS_SUCCESS}${OPACITY_20}` }}>
            <Download className="w-3 h-3" />
            Export C++
          </button>
        </div>
      </div>

      {/* Main 3-column layout — 1col mobile, 2col md, 3col xl */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr_280px] gap-4">
        {/* ── Left: Affix Pool ── */}
        <SurfaceCard level={2} className="p-3 space-y-2.5 max-h-[600px] flex flex-col md:row-span-2 xl:row-span-1">
          <SectionLabel label="Affix Pool" />
          <p className="text-2xs text-text-muted">
            Drag affixes onto the item or click <Plus className="w-2.5 h-2.5 inline" /> to add.
            {maxAffixes > 0 && <span className="ml-1 font-mono" style={{ color: RARITY_COLORS[selectedBase.rarity] }}>({craftedAffixes.length}/{maxAffixes})</span>}
          </p>

          {/* Filter buttons */}
          <div className="flex gap-1">
            {(['all', 'offensive', 'defensive', 'utility'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setPoolFilter(cat)}
                className="flex-1 px-2 py-1 rounded text-[10px] font-medium capitalize transition-all"
                style={{
                  backgroundColor: poolFilter === cat ? `${ACCENT}20` : 'transparent',
                  color: poolFilter === cat ? ACCENT : 'var(--text-muted)',
                  border: `1px solid ${poolFilter === cat ? `${ACCENT}50` : 'var(--border)'}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={poolSearch}
            onChange={(e) => setPoolSearch(e.target.value)}
            placeholder="Search affixes..."
            className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
          />

          {/* Pool list */}
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {filteredPool.map((entry) => {
              const rarityColor = RARITY_COLORS[entry.minRarity];
              const isDragging = draggingAffixId === entry.id;
              return (
                <motion.div
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, entry)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/30 hover:border-border-bright cursor-grab active:cursor-grabbing group"
                  style={{
                    backgroundColor: 'var(--surface-deep)',
                    transition: 'opacity 0.15s ease, transform 0.15s ease',
                    opacity: isDragging ? 0.5 : 1,
                    transform: isDragging ? 'scale(0.95)' : 'scale(1)',
                  }}
                  whileHover={isDragging ? {} : { scale: 1.01 }}
                >
                  <GripVertical className="w-3 h-3 text-text-muted opacity-40 group-hover:opacity-80 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold font-mono text-text truncate">{entry.displayName}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded font-bold uppercase" style={{ backgroundColor: `${rarityColor}15`, color: rarityColor, border: `1px solid ${rarityColor}30` }}>
                        {entry.bIsPrefix ? 'PRE' : 'SUF'}
                      </span>
                    </div>
                    <div className="text-[9px] text-text-muted font-mono truncate">{entry.stat} ({entry.minValue}-{entry.maxValue})</div>
                    {/* Weight bar */}
                    <div
                      className="mt-0.5 h-[3px] rounded-full bg-surface overflow-hidden"
                      title={`Weight: ${entry.weight} · Probability: ${totalWeight > 0 ? ((entry.weight / totalWeight) * 100).toFixed(1) : 0}%`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: maxWeight > 0 ? `${(entry.weight / maxWeight) * 100}%` : '0%',
                          backgroundColor: getCategoryColor(entry.category),
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => addAffix(entry)}
                    disabled={!canAddMore}
                    className="p-1 rounded transition-colors disabled:opacity-30"
                    style={{ color: STATUS_SUCCESS }}
                    title="Add to item"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })}
            {filteredPool.length === 0 && (
              <div className="text-2xs text-text-muted italic text-center py-4">
                {craftedAffixes.length >= maxAffixes ? 'Item is full — remove an affix to add more' : 'No matching affixes'}
              </div>
            )}
          </div>
        </SurfaceCard>

        {/* ── Center: Item Preview ── */}
        <div className="space-y-4">
          {/* Item base selector */}
          <SurfaceCard level={2} className="p-3">
            <SectionLabel label="Item Base" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 mt-2">
              {ITEM_BASES.map((base) => {
                const rc = RARITY_COLORS[base.rarity];
                const isSelected = selectedBase.name === base.name;
                return (
                  <button
                    key={base.name}
                    onClick={() => { setSelectedBase(base); setItemLevel(base.itemLevel); setCraftedAffixes([]); }}
                    className="px-2 py-1.5 rounded-lg text-left transition-all text-[10px]"
                    style={{
                      backgroundColor: isSelected ? `${rc}15` : 'transparent',
                      border: `1px solid ${isSelected ? `${rc}60` : 'var(--border)'}`,
                      color: isSelected ? rc : 'var(--text-muted)',
                    }}
                  >
                    <div className="font-bold truncate">{base.name}</div>
                    <div className="text-[8px] opacity-70">{base.type} · Lv{base.itemLevel}</div>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          {/* Item level slider */}
          <SurfaceCard level={2} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Item Level</span>
              <span className="text-xs font-mono font-bold" style={{ color: ACCENT }}>{itemLevel}</span>
            </div>
            <input
              type="range"
              min={1} max={100} value={itemLevel}
              onChange={(e) => setItemLevel(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: ACCENT }}
            />
            <div className="flex justify-between text-[8px] text-text-muted font-mono mt-0.5">
              <span>1</span>
              <span>Scaling: {getItemLevelScaling(itemLevel).toFixed(1)}x</span>
              <span>100</span>
            </div>
          </SurfaceCard>

          {/* Item card — drop zone */}
          <SurfaceCard
            level={2}
            className="p-4 relative overflow-hidden"
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drop highlight */}
            {dragOverItem && (
              <div className="absolute inset-0 rounded-xl border-2 border-dashed pointer-events-none z-20" style={{ borderColor: `${STATUS_SUCCESS}60`, backgroundColor: `${STATUS_SUCCESS}08` }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold" style={{ color: STATUS_SUCCESS }}>Drop affix here</span>
                </div>
              </div>
            )}

            {/* Item name */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ backgroundColor: `${RARITY_COLORS[selectedBase.rarity]}10`, border: `1px solid ${RARITY_COLORS[selectedBase.rarity]}40` }}>
                {selectedBase.rarity === 'Legendary' && <Crown className="w-4 h-4" style={{ color: RARITY_COLORS.Legendary }} />}
                <span className="text-sm font-bold font-mono" style={{ color: RARITY_COLORS[selectedBase.rarity], textShadow: `0 0 12px ${RARITY_COLORS[selectedBase.rarity]}40` }}>
                  {fullItemName}
                </span>
              </div>
              <div className="text-2xs text-text-muted mt-1 font-mono">
                {selectedBase.type} · <span style={{ color: RARITY_COLORS[selectedBase.rarity] }}>{selectedBase.rarity}</span> · Level {itemLevel} · Value {selectedBase.baseValue}g
              </div>
            </div>

            {/* Crafted affixes */}
            <div className="space-y-2">
              {craftedAffixes.length === 0 ? (
                <div className="text-center py-6 text-2xs text-text-muted italic border border-dashed border-border/40 rounded-lg">
                  Drag affixes from the pool, click +, or use Random Roll
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {craftedAffixes.map((affix) => {
                    const poolEntry = AFFIX_POOL.find((a) => a.id === affix.poolEntryId);
                    if (!poolEntry) return null;
                    const scaledMag = affix.magnitude * getItemLevelScaling(itemLevel);
                    const magPercent = ((affix.magnitude - poolEntry.minValue) / (poolEntry.maxValue - poolEntry.minValue)) * 100;

                    const catColor = affix.category === 'offensive' ? STATUS_ERROR : affix.category === 'defensive' ? STATUS_INFO : ACCENT_EMERALD;

                    return (
                      <motion.div
                        key={affix.tag}
                        layout
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        className="rounded-lg border px-3 py-2.5"
                        style={{ borderColor: `${catColor}30`, backgroundColor: `${catColor}06` }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {/* Category dot */}
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />

                          {/* Name + placement toggle */}
                          <span className="text-[11px] font-bold font-mono text-text">{affix.displayName}</span>
                          <button
                            onClick={() => toggleAffixPlacement(affix.tag)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all"
                            style={{
                              backgroundColor: affix.bIsPrefix ? `${ACCENT_ORANGE}15` : `${ACCENT_CYAN}15`,
                              color: affix.bIsPrefix ? ACCENT_ORANGE : ACCENT_CYAN,
                              border: `1px solid ${affix.bIsPrefix ? `${ACCENT_ORANGE}40` : `${ACCENT_CYAN}40`}`,
                            }}
                            title="Toggle prefix/suffix"
                          >
                            {affix.bIsPrefix ? <><ToggleLeft className="w-2.5 h-2.5" /> PREFIX</> : <><ToggleRight className="w-2.5 h-2.5" /> SUFFIX</>}
                          </button>

                          <span className="ml-auto text-[10px] font-mono" style={{ color: catColor }}>
                            +{scaledMag.toFixed(1)} {affix.stat}
                          </span>

                          <button onClick={() => removeAffix(affix.tag)} className="p-0.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Magnitude slider */}
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-text-muted w-8 text-right">{poolEntry.minValue}</span>
                          <input
                            type="range"
                            min={poolEntry.minValue}
                            max={poolEntry.maxValue}
                            step={0.1}
                            value={affix.magnitude}
                            onChange={(e) => updateAffixMagnitude(affix.tag, Number(e.target.value))}
                            onMouseDown={() => setPreviewTag(affix.tag)}
                            onMouseUp={() => setPreviewTag(null)}
                            onTouchStart={() => setPreviewTag(affix.tag)}
                            onTouchEnd={() => setPreviewTag(null)}
                            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                            style={{ accentColor: catColor }}
                          />
                          <span className="text-[9px] font-mono text-text-muted w-8">{poolEntry.maxValue}</span>
                          <span className="text-[9px] font-mono font-bold w-10 text-right" style={{ color: catColor }}>
                            {affix.magnitude.toFixed(1)}
                          </span>
                        </div>

                        {/* Magnitude bar */}
                        <div className="mt-1 h-1 rounded-full bg-surface-deep overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: catColor }}
                            animate={{ width: `${magPercent}%` }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </SurfaceCard>
        </div>

        {/* ── Right: Power Budget + Synergies ── */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-1 xl:block xl:space-y-3">
          {/* Power Budget Radar */}
          <SurfaceCard level={2} className="p-3">
            <SectionLabel label="Power Budget" />
            <p className="text-2xs text-text-muted mt-1 mb-3">
              vs. max for <span style={{ color: RARITY_COLORS[selectedBase.rarity] }}>{selectedBase.rarity}</span> tier ({budgetMax} budget)
            </p>

            {/* Radar SVG */}
            <div className="flex justify-center">
              <svg width={160} height={140} viewBox="0 0 160 140" className="overflow-visible">
                {/* Grid rings */}
                {[0.25, 0.5, 0.75, 1.0].map((t) => {
                  const r = t * 50;
                  return (
                    <polygon
                      key={t}
                      points={radarAxes.map((_, i) => {
                        const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                        return `${80 + r * Math.cos(angle)},${65 + r * Math.sin(angle)}`;
                      }).join(' ')}
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                    />
                  );
                })}
                {/* Axis lines */}
                {radarAxes.map((_, i) => {
                  const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                  return (
                    <line
                      key={i}
                      x1={80} y1={65}
                      x2={80 + 50 * Math.cos(angle)} y2={65 + 50 * Math.sin(angle)}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />
                  );
                })}
                {/* Ghost polygon — shows max magnitude potential */}
                {ghostRadarValues && (
                  <polygon
                    points={ghostRadarValues.map((v, i) => {
                      const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                      const r = Math.min(v, 1.0) * 50;
                      return `${80 + r * Math.cos(angle)},${65 + r * Math.sin(angle)}`;
                    }).join(' ')}
                    fill={`${ACCENT_VIOLET}10`}
                    stroke={ACCENT_VIOLET}
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    opacity={0.7}
                  />
                )}
                {/* Data polygon */}
                <polygon
                  points={radarValues.map((v, i) => {
                    const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                    const r = Math.min(v, 1.0) * 50;
                    return `${80 + r * Math.cos(angle)},${65 + r * Math.sin(angle)}`;
                  }).join(' ')}
                  fill={isOverBudget ? `${STATUS_ERROR}20` : `${ACCENT}20`}
                  stroke={isOverBudget ? STATUS_ERROR : ACCENT}
                  strokeWidth="2"
                />
                {/* Data points */}
                {radarValues.map((v, i) => {
                  const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                  const r = Math.min(v, 1.0) * 50;
                  return (
                    <circle
                      key={i}
                      cx={80 + r * Math.cos(angle)} cy={65 + r * Math.sin(angle)}
                      r={3}
                      fill={isOverBudget ? STATUS_ERROR : ACCENT}
                    />
                  );
                })}
                {/* Axis labels */}
                {radarAxes.map((label, i) => {
                  const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                  const lx = 80 + 62 * Math.cos(angle);
                  const ly = 65 + 62 * Math.sin(angle);
                  return (
                    <text
                      key={label}
                      x={lx} y={ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[9px] font-mono fill-[var(--text-muted)]"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Budget bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-text-muted">Total Power</span>
                <span style={{ color: isOverBudget ? STATUS_ERROR : ACCENT }} className="font-bold">
                  {powerBudget.total.toFixed(0)} / {budgetMax}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-deep overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${Math.min(budgetRatio * 100, 100)}%` }}
                  style={{ backgroundColor: isOverBudget ? STATUS_ERROR : budgetRatio > 0.8 ? STATUS_WARNING : ACCENT }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
              {isOverBudget && (
                <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: STATUS_ERROR }}>
                  <AlertTriangle className="w-3 h-3" />
                  Over budget by {((budgetRatio - 1) * 100).toFixed(0)}% — consider reducing magnitudes
                </div>
              )}
            </div>

            {/* Category breakdown */}
            <div className="mt-3 space-y-1">
              {[
                { label: 'Offense', value: powerBudget.offense, color: STATUS_ERROR },
                { label: 'Defense', value: powerBudget.defense, color: STATUS_INFO },
                { label: 'Utility', value: powerBudget.utility, color: ACCENT_EMERALD },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-text-muted w-12">{row.label}</span>
                  <div className="flex-1 h-1 rounded-full bg-surface-deep overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((row.value / budgetMax) * 100, 100)}%`, backgroundColor: row.color }} />
                  </div>
                  <span className="font-bold w-8 text-right" style={{ color: row.color }}>{row.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {/* Synergy Detector */}
          <SurfaceCard
            level={2}
            className="p-3 relative overflow-hidden"
            style={{
              transition: 'box-shadow 0.3s ease',
              boxShadow: synergyGlow && activeSynergies.length > 0
                ? `0 0 16px ${SYNERGY_COLORS[activeSynergies[0].severity]}40, inset 0 0 8px ${SYNERGY_COLORS[activeSynergies[0].severity]}10`
                : 'none',
            }}
          >
            <button
              onClick={() => setExpandedSynergies(!expandedSynergies)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={synergyGlow ? { scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT_ORANGE }} />
                </motion.div>
                <span className="text-xs font-bold text-text">Synergy Detector</span>
                {activeSynergies.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${SYNERGY_COLORS[activeSynergies[0].severity]}20`, color: SYNERGY_COLORS[activeSynergies[0].severity] }}>
                    {activeSynergies.length} active
                  </span>
                )}
              </div>
              {expandedSynergies ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
            </button>

            {expandedSynergies && (
              <div className="mt-2 space-y-1.5">
                {activeSynergies.length > 0 ? (
                  activeSynergies.map((syn, idx) => {
                    const isNew = newSynergyLabels.has(syn.label);
                    const synColor = SYNERGY_COLORS[syn.severity];
                    return (
                      <motion.div
                        key={syn.label}
                        initial={isNew ? { opacity: 0, x: 30, scale: 0.9 } : { opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={isNew ? { delay: 0.2 + idx * STAGGER_SLOW, duration: 0.35, type: 'spring', stiffness: 300, damping: 25 } : undefined}
                        className="rounded-lg px-2.5 py-2 relative overflow-hidden"
                        style={{ backgroundColor: `${synColor}08`, border: `1px solid ${synColor}30` }}
                      >
                        {/* Sparkle particles on new synergy */}
                        {isNew && (
                          <>
                            {[
                              { x: 12, y: -8, delay: 0.25 },
                              { x: -10, y: -12, delay: 0.35 },
                              { x: 20, y: 6, delay: 0.3 },
                              { x: -6, y: 10, delay: 0.4 },
                            ].map((p, i) => (
                              <motion.div
                                key={i}
                                className="absolute rounded-full pointer-events-none"
                                style={{ width: 4, height: 4, backgroundColor: synColor, top: '50%', left: '50%' }}
                                initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                                animate={{ opacity: 0, x: p.x * 3, y: p.y * 3, scale: 0 }}
                                transition={{ delay: p.delay + idx * STAGGER_SLOW, duration: 0.45, ease: 'easeOut' }}
                              />
                            ))}
                          </>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-3 h-3" style={{ color: synColor }} />
                          <span className="text-[10px] font-bold" style={{ color: synColor }}>{syn.label}</span>
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: `${synColor}15`, color: synColor }}>
                            {syn.severity}
                          </span>
                        </div>
                        <p className="text-[9px] text-text-muted leading-relaxed">{syn.description}</p>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-2xs text-text-muted italic py-2">
                    {craftedAffixes.length < 2
                      ? 'Add 2+ affixes to detect synergies'
                      : 'No known synergies detected'}
                  </div>
                )}

                {/* All possible synergies hint */}
                {craftedAffixes.length >= 1 && activeSynergies.length === 0 && (
                  <div className="text-2xs text-text-muted mt-1">
                    <span className="font-medium">Hint:</span> Try combining Life Steal + Crit, or All Damage + Crit Damage
                  </div>
                )}
              </div>
            )}
          </SurfaceCard>

          {/* Quick stats */}
          <SurfaceCard level={2} className="p-3">
            <SectionLabel label="Item Stats Summary" />
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-text-muted">Affixes</span>
                <span className="font-bold" style={{ color: craftedAffixes.length >= maxAffixes ? STATUS_WARNING : ACCENT }}>
                  {craftedAffixes.length}/{maxAffixes}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-text-muted">Prefixes</span>
                <span className="font-bold text-text">{craftedAffixes.filter((a) => a.bIsPrefix).length}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-text-muted">Suffixes</span>
                <span className="font-bold text-text">{craftedAffixes.filter((a) => !a.bIsPrefix).length}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-text-muted">Level Scaling</span>
                <span className="font-bold" style={{ color: ACCENT }}>{getItemLevelScaling(itemLevel).toFixed(1)}x</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-text-muted">Synergies</span>
                <span className="font-bold" style={{ color: activeSynergies.length > 0 ? SYNERGY_COLORS[activeSynergies[0].severity] : 'var(--text-muted)' }}>
                  {activeSynergies.length}
                </span>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* ── Smart Rarity Pattern Suggestions ── */}
      {suggestedArchetypes.length > 0 && (
        <SurfaceCard level={2} className="p-4 relative overflow-hidden">
          <SectionLabel label="Smart Rarity Patterns" />
          <p className="text-2xs text-text-muted mt-1 mb-3">
            Synergy-optimized affix loadouts for <span className="font-bold" style={{ color: RARITY_COLORS[selectedBase.rarity] }}>{selectedBase.rarity}</span> items. Click to auto-fill.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {suggestedArchetypes.map((arch, ai) => {
              const isActive = craftedAffixes.length > 0 &&
                arch.affixTags.every(t => craftedAffixes.some(a => a.tag === t)) &&
                craftedAffixes.every(a => arch.affixTags.includes(a.tag));

              return (
                <motion.button
                  key={arch.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ai * 0.06 }}
                  onClick={() => applyArchetype(arch)}
                  className="text-left p-3 rounded-lg border transition-all hover:scale-[1.02] group"
                  style={{
                    borderColor: isActive ? arch.color : `${arch.color}${OPACITY_20}`,
                    backgroundColor: isActive ? `${arch.color}${OPACITY_15}` : `${arch.color}05`,
                    boxShadow: isActive ? `0 0 12px ${arch.color}30` : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Wand2 className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" style={{ color: arch.color }} />
                    <span className="text-xs font-bold" style={{ color: arch.color }}>{arch.name}</span>
                    {isActive && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${arch.color}${OPACITY_20}`, color: arch.color }}>
                        Active
                      </span>
                    )}
                  </div>

                  {/* Synergy badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {arch.synergies.map(s => {
                      const rule = SYNERGY_RULES.find(r => r.label === s);
                      const sevColor = rule ? SYNERGY_COLORS[rule.severity] : ACCENT;
                      return (
                        <span
                          key={s}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                          style={{ color: sevColor, borderColor: `${sevColor}${OPACITY_20}`, backgroundColor: `${sevColor}${OPACITY_10}` }}
                        >
                          {s}
                        </span>
                      );
                    })}
                  </div>

                  {/* Affix preview list */}
                  <div className="space-y-0.5">
                    {arch.affixTags.map(tag => {
                      const entry = AFFIX_POOL.find(a => a.tag === tag);
                      if (!entry) return null;
                      const catColor = entry.category === 'offensive' ? STATUS_ERROR : entry.category === 'defensive' ? ACCENT_EMERALD : ACCENT_CYAN;
                      return (
                        <div key={tag} className="flex items-center gap-1.5 text-[10px] font-mono">
                          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                          <span className="text-text-muted truncate">{entry.displayName}</span>
                          <span className="ml-auto text-text-muted opacity-60">{entry.stat}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="mt-2 pt-1.5 border-t border-border/30 flex items-center justify-between text-[9px] font-mono text-text-muted">
                    <span>{arch.affixTags.length} affixes</span>
                    <span>{arch.synergies.length} synergies</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* ── Export Panel ── */}
      <AnimatePresence>
        {showExport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-surface-deep overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
                <span className="text-xs font-bold text-text flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
                  UE5 C++ Export — Pre-rolled ItemInstance
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium" style={{ backgroundColor: copiedExport ? `${STATUS_SUCCESS}${OPACITY_20}` : `${ACCENT}${OPACITY_10}`, color: copiedExport ? STATUS_SUCCESS : ACCENT }}>
                    {copiedExport ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedExport ? 'Copied!' : 'Copy'}
                  </button>
                  <button onClick={handleExportFile} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium" style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}>
                    <Download className="w-3 h-3" /> .cpp
                  </button>
                </div>
              </div>
              <pre className="p-4 text-[11px] font-mono text-text-muted leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre">
                {generateExportCode(selectedBase, craftedAffixes)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
