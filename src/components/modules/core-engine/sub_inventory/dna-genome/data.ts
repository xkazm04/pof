'use client';

import {
  Swords, Shield, Wrench, Coins, Dna, Shuffle, GitMerge, TrendingUp,
} from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_ERROR, STATUS_SUCCESS,
} from '@/lib/chart-colors';
import type { SubTab } from '@/components/modules/core-engine/unique-tabs/_shared';
import type {
  ItemGenome, TraitAxis, DNAAffix,
} from '@/types/item-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface AxisConfig {
  axis: TraitAxis;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  tags: string[];
}

/* ── Constants ─────────────────────────────────────────────────────────── */

export const ACCENT = MODULE_COLORS.core;

export const AXIS_CONFIGS: AxisConfig[] = [
  { axis: 'offensive', label: 'Offensive', icon: Swords, color: STATUS_ERROR, tags: ['Stat.Strength', 'Stat.AttackPower', 'Stat.CritChance', 'Stat.CritDamage', 'Stat.AttackSpeed', 'Stat.PenArmor'] },
  { axis: 'defensive', label: 'Defensive', icon: Shield, color: ACCENT_CYAN, tags: ['Stat.Armor', 'Stat.MaxHealth', 'Stat.HealthRegen', 'Stat.BlockChance', 'Stat.DodgeChance', 'Stat.Resistance'] },
  { axis: 'utility', label: 'Utility', icon: Wrench, color: ACCENT_EMERALD, tags: ['Stat.MoveSpeed', 'Stat.CooldownReduction', 'Stat.ManaCost', 'Stat.ManaRegen', 'Stat.MaxMana', 'Stat.AreaOfEffect'] },
  { axis: 'economic', label: 'Economic', icon: Coins, color: ACCENT_ORANGE, tags: ['Stat.GoldFind', 'Stat.MagicFind', 'Stat.XPBonus', 'Stat.ItemQuantity', 'Stat.VendorPrice', 'Stat.CraftBonus'] },
];

export const SUB_TABS: SubTab[] = [
  { id: 'editor', label: 'DNA Editor', icon: Dna },
  { id: 'roller', label: 'Affix Roller', icon: Shuffle },
  { id: 'breeding', label: 'Breeding Lab', icon: GitMerge },
  { id: 'evolution', label: 'Evolution', icon: TrendingUp },
];

/* ── Demo affix pool ───────────────────────────────────────────────────── */

export const DEMO_AFFIX_POOL: DNAAffix[] = [
  // Offensive
  { id: 'aff-str', name: 'of Strength', isPrefix: false, axis: 'offensive', tags: ['Stat.Strength'], minValue: 3, maxValue: 15, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-atk', name: 'Fierce', isPrefix: true, axis: 'offensive', tags: ['Stat.AttackPower'], minValue: 5, maxValue: 25, baseWeight: 1.2, minRarity: 'Common' },
  { id: 'aff-crit', name: 'of Precision', isPrefix: false, axis: 'offensive', tags: ['Stat.CritChance'], minValue: 2, maxValue: 12, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-cdmg', name: 'Devastating', isPrefix: true, axis: 'offensive', tags: ['Stat.CritDamage'], minValue: 10, maxValue: 50, baseWeight: 0.5, minRarity: 'Epic' },
  { id: 'aff-aspd', name: 'of Haste', isPrefix: false, axis: 'offensive', tags: ['Stat.AttackSpeed'], minValue: 3, maxValue: 15, baseWeight: 0.7, minRarity: 'Rare' },
  // Defensive
  { id: 'aff-arm', name: 'Fortified', isPrefix: true, axis: 'defensive', tags: ['Stat.Armor'], minValue: 5, maxValue: 30, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-hp', name: 'of Vitality', isPrefix: false, axis: 'defensive', tags: ['Stat.MaxHealth'], minValue: 10, maxValue: 80, baseWeight: 1.3, minRarity: 'Common' },
  { id: 'aff-regen', name: 'Regenerating', isPrefix: true, axis: 'defensive', tags: ['Stat.HealthRegen'], minValue: 1, maxValue: 8, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-dodge', name: 'of Evasion', isPrefix: false, axis: 'defensive', tags: ['Stat.DodgeChance'], minValue: 2, maxValue: 10, baseWeight: 0.5, minRarity: 'Epic' },
  // Utility
  { id: 'aff-spd', name: 'of Swiftness', isPrefix: false, axis: 'utility', tags: ['Stat.MoveSpeed'], minValue: 3, maxValue: 12, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-cdr', name: 'Quickened', isPrefix: true, axis: 'utility', tags: ['Stat.CooldownReduction'], minValue: 2, maxValue: 10, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-mana', name: 'of Intellect', isPrefix: false, axis: 'utility', tags: ['Stat.MaxMana'], minValue: 10, maxValue: 60, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-mregen', name: 'Flowing', isPrefix: true, axis: 'utility', tags: ['Stat.ManaRegen'], minValue: 1, maxValue: 8, baseWeight: 0.7, minRarity: 'Rare' },
  // Economic
  { id: 'aff-gold', name: 'Prosperous', isPrefix: true, axis: 'economic', tags: ['Stat.GoldFind'], minValue: 5, maxValue: 30, baseWeight: 0.8, minRarity: 'Uncommon' },
  { id: 'aff-mf', name: 'of Fortune', isPrefix: false, axis: 'economic', tags: ['Stat.MagicFind'], minValue: 3, maxValue: 20, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-xp', name: 'of the Scholar', isPrefix: false, axis: 'economic', tags: ['Stat.XPBonus'], minValue: 3, maxValue: 15, baseWeight: 0.5, minRarity: 'Epic' },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

export function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createGenome(name: string, color: string, overrides: Partial<ItemGenome>): ItemGenome {
  return {
    id: createId(),
    name,
    description: '',
    author: 'User',
    version: '1.0.0',
    color,
    updatedAt: new Date().toISOString(),
    traits: [
      { axis: 'offensive', weight: 0.25, affinityTags: [] },
      { axis: 'defensive', weight: 0.25, affinityTags: [] },
      { axis: 'utility', weight: 0.25, affinityTags: [] },
      { axis: 'economic', weight: 0.25, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.08, maxMutations: 1, wildMutation: false },
    itemType: 'Weapon',
    minRarity: 'Common',
    ...overrides,
  };
}

export function genomeToRadar(genome: ItemGenome): RadarDataPoint[] {
  return AXIS_CONFIGS.map((cfg) => {
    const gene = genome.traits.find((g) => g.axis === cfg.axis);
    return { axis: cfg.label, value: gene?.weight ?? 0 };
  });
}

/* ── Preset genomes ────────────────────────────────────────────────────── */

export const PRESET_GENOMES: ItemGenome[] = [
  createGenome('Warrior Blade', STATUS_ERROR, {
    description: 'Heavy melee weapon — biased toward raw strength and critical hits',
    itemType: 'Weapon',
    traits: [
      { axis: 'offensive', weight: 0.85, affinityTags: ['Stat.Strength', 'Stat.CritChance', 'Stat.AttackPower'] },
      { axis: 'defensive', weight: 0.15, affinityTags: ['Stat.Armor'] },
      { axis: 'utility', weight: 0.05, affinityTags: [] },
      { axis: 'economic', weight: 0.05, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.05, maxMutations: 1, wildMutation: false },
    tags: ['melee', 'physical', 'warrior'],
  }),
  createGenome('Mage Staff', ACCENT_VIOLET, {
    description: 'Arcane catalyst — gravitates toward mana, cooldown, and spell amplification',
    itemType: 'Weapon',
    traits: [
      { axis: 'offensive', weight: 0.30, affinityTags: ['Stat.CritDamage'] },
      { axis: 'defensive', weight: 0.10, affinityTags: [] },
      { axis: 'utility', weight: 0.80, affinityTags: ['Stat.MaxMana', 'Stat.ManaRegen', 'Stat.CooldownReduction'] },
      { axis: 'economic', weight: 0.10, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.10, maxMutations: 2, wildMutation: true },
    tags: ['ranged', 'magical', 'caster'],
  }),
  createGenome('Guardian Plate', ACCENT_CYAN, {
    description: 'Heavy armor — prioritizes survivability stats above all else',
    itemType: 'Armor',
    traits: [
      { axis: 'offensive', weight: 0.05, affinityTags: [] },
      { axis: 'defensive', weight: 0.90, affinityTags: ['Stat.Armor', 'Stat.MaxHealth', 'Stat.HealthRegen', 'Stat.BlockChance'] },
      { axis: 'utility', weight: 0.10, affinityTags: [] },
      { axis: 'economic', weight: 0.05, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.03, maxMutations: 1, wildMutation: false },
    tags: ['heavy', 'tank', 'defense'],
  }),
  createGenome('Rogue Leather', ACCENT_EMERALD, {
    description: 'Agile armor — balanced offensive and utility with evasion traits',
    itemType: 'Armor',
    traits: [
      { axis: 'offensive', weight: 0.45, affinityTags: ['Stat.CritChance', 'Stat.AttackSpeed'] },
      { axis: 'defensive', weight: 0.20, affinityTags: ['Stat.DodgeChance'] },
      { axis: 'utility', weight: 0.40, affinityTags: ['Stat.MoveSpeed', 'Stat.CooldownReduction'] },
      { axis: 'economic', weight: 0.15, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.12, maxMutations: 2, wildMutation: true },
    tags: ['light', 'agile', 'rogue'],
  }),
  createGenome('Merchant\'s Ring', ACCENT_ORANGE, {
    description: 'Economic accessory — maximizes gold find and magic find',
    itemType: 'Accessory',
    traits: [
      { axis: 'offensive', weight: 0.10, affinityTags: [] },
      { axis: 'defensive', weight: 0.10, affinityTags: [] },
      { axis: 'utility', weight: 0.20, affinityTags: ['Stat.XPBonus'] },
      { axis: 'economic', weight: 0.90, affinityTags: ['Stat.GoldFind', 'Stat.MagicFind', 'Stat.ItemQuantity'] },
    ],
    mutation: { mutationRate: 0.15, maxMutations: 2, wildMutation: true },
    tags: ['economic', 'farming', 'merchant'],
  }),
];
