import type { EconomyFlow, EconomyItem, XPCurvePoint, SimulationConfig } from '@/types/economy-simulator';

// ── XP Curve (standard aRPG exponential) ────────────────────────────────────

export function generateXPCurve(maxLevel: number): XPCurvePoint[] {
  const points: XPCurvePoint[] = [];
  let cumulative = 0;
  for (let level = 1; level <= maxLevel; level++) {
    // Exponential: base 100 * level^1.8
    const xpRequired = level === 1 ? 0 : Math.round(100 * Math.pow(level, 1.8));
    cumulative += xpRequired;
    points.push({ level, xpRequired, cumulativeXP: cumulative });
  }
  return points;
}

// ── Gold Faucets (sources) ──────────────────────────────────────────────────

export const DEFAULT_FAUCETS: EconomyFlow[] = [
  {
    id: 'enemy-kill-gold',
    name: 'Enemy Kill Gold',
    type: 'faucet',
    baseAmount: 5,
    levelScaling: 2.5,
    frequencyPerHour: 60,
    minLevel: 1,
    maxLevel: 0,
    category: 'combat',
  },
  {
    id: 'elite-kill-gold',
    name: 'Elite Enemy Gold',
    type: 'faucet',
    baseAmount: 25,
    levelScaling: 8,
    frequencyPerHour: 8,
    minLevel: 3,
    maxLevel: 0,
    category: 'combat',
  },
  {
    id: 'boss-kill-gold',
    name: 'Boss Kill Gold',
    type: 'faucet',
    baseAmount: 150,
    levelScaling: 30,
    frequencyPerHour: 1.5,
    minLevel: 5,
    maxLevel: 0,
    category: 'combat',
  },
  {
    id: 'quest-reward',
    name: 'Quest Reward Gold',
    type: 'faucet',
    baseAmount: 50,
    levelScaling: 15,
    frequencyPerHour: 2,
    minLevel: 1,
    maxLevel: 0,
    category: 'quest',
  },
  {
    id: 'loot-vendor-sell',
    name: 'Vendor Loot Sales',
    type: 'faucet',
    baseAmount: 8,
    levelScaling: 3,
    frequencyPerHour: 25,
    minLevel: 1,
    maxLevel: 0,
    category: 'vendor',
  },
  {
    id: 'chest-gold',
    name: 'Chest Gold Drops',
    type: 'faucet',
    baseAmount: 20,
    levelScaling: 6,
    frequencyPerHour: 4,
    minLevel: 1,
    maxLevel: 0,
    category: 'exploration',
  },
];

// ── Gold Sinks (drains) ─────────────────────────────────────────────────────

export const DEFAULT_SINKS: EconomyFlow[] = [
  {
    id: 'health-potion',
    name: 'Health Potions',
    type: 'sink',
    baseAmount: 10,
    levelScaling: 3,
    frequencyPerHour: 8,
    minLevel: 1,
    maxLevel: 0,
    category: 'consumable',
  },
  {
    id: 'mana-potion',
    name: 'Mana Potions',
    type: 'sink',
    baseAmount: 12,
    levelScaling: 3.5,
    frequencyPerHour: 6,
    minLevel: 2,
    maxLevel: 0,
    category: 'consumable',
  },
  {
    id: 'repair-cost',
    name: 'Equipment Repair',
    type: 'sink',
    baseAmount: 15,
    levelScaling: 5,
    frequencyPerHour: 2,
    minLevel: 3,
    maxLevel: 0,
    category: 'maintenance',
  },
  {
    id: 'vendor-gear-buy',
    name: 'Vendor Gear Purchase',
    type: 'sink',
    baseAmount: 80,
    levelScaling: 20,
    frequencyPerHour: 0.5,
    minLevel: 1,
    maxLevel: 0,
    category: 'vendor',
  },
  {
    id: 'crafting-cost',
    name: 'Crafting Materials',
    type: 'sink',
    baseAmount: 30,
    levelScaling: 10,
    frequencyPerHour: 1.5,
    minLevel: 5,
    maxLevel: 0,
    category: 'crafting',
  },
  {
    id: 'enchant-cost',
    name: 'Enchanting / Affix Reroll',
    type: 'sink',
    baseAmount: 50,
    levelScaling: 25,
    frequencyPerHour: 0.8,
    minLevel: 8,
    maxLevel: 0,
    category: 'crafting',
  },
  {
    id: 'stash-upgrade',
    name: 'Stash/Inventory Upgrade',
    type: 'sink',
    baseAmount: 200,
    levelScaling: 100,
    frequencyPerHour: 0.05,
    minLevel: 5,
    maxLevel: 0,
    category: 'progression',
  },
  {
    id: 'waypoint-fee',
    name: 'Fast Travel Fee',
    type: 'sink',
    baseAmount: 5,
    levelScaling: 2,
    frequencyPerHour: 3,
    minLevel: 1,
    maxLevel: 0,
    category: 'travel',
  },
  {
    id: 'death-penalty',
    name: 'Death Gold Penalty',
    type: 'sink',
    baseAmount: 0,
    levelScaling: 0,
    frequencyPerHour: 1.5,
    minLevel: 1,
    maxLevel: 0,
    category: 'penalty',
  },
];

// ── Item Archetypes ─────────────────────────────────────────────────────────

export const DEFAULT_ITEMS: EconomyItem[] = [
  // Consumables
  { id: 'health-potion', name: 'Health Potion', category: 'consumable', rarity: 'common', buyPrice: 10, sellPrice: 3, levelScaling: 3, dropWeight: 40, minLevel: 1 },
  { id: 'mana-potion', name: 'Mana Potion', category: 'consumable', rarity: 'common', buyPrice: 12, sellPrice: 4, levelScaling: 3.5, dropWeight: 35, minLevel: 2 },
  { id: 'elixir-strength', name: 'Elixir of Strength', category: 'consumable', rarity: 'uncommon', buyPrice: 40, sellPrice: 15, levelScaling: 8, dropWeight: 10, minLevel: 5 },
  { id: 'scroll-portal', name: 'Portal Scroll', category: 'consumable', rarity: 'common', buyPrice: 5, sellPrice: 1, levelScaling: 1, dropWeight: 50, minLevel: 1 },

  // Weapons
  { id: 'sword-common', name: 'Iron Sword', category: 'weapon', rarity: 'common', buyPrice: 50, sellPrice: 12, levelScaling: 10, dropWeight: 20, minLevel: 1 },
  { id: 'sword-uncommon', name: 'Steel Blade', category: 'weapon', rarity: 'uncommon', buyPrice: 150, sellPrice: 40, levelScaling: 25, dropWeight: 12, minLevel: 5 },
  { id: 'sword-rare', name: 'Enchanted Longsword', category: 'weapon', rarity: 'rare', buyPrice: 500, sellPrice: 150, levelScaling: 60, dropWeight: 5, minLevel: 10 },
  { id: 'sword-epic', name: 'Runic Greatsword', category: 'weapon', rarity: 'epic', buyPrice: 2000, sellPrice: 600, levelScaling: 150, dropWeight: 1.5, minLevel: 15 },
  { id: 'sword-legendary', name: 'Worldcleaver', category: 'weapon', rarity: 'legendary', buyPrice: 10000, sellPrice: 3000, levelScaling: 400, dropWeight: 0.2, minLevel: 20 },

  // Armor
  { id: 'armor-common', name: 'Leather Tunic', category: 'armor', rarity: 'common', buyPrice: 40, sellPrice: 10, levelScaling: 8, dropWeight: 22, minLevel: 1 },
  { id: 'armor-uncommon', name: 'Chain Mail', category: 'armor', rarity: 'uncommon', buyPrice: 120, sellPrice: 35, levelScaling: 20, dropWeight: 14, minLevel: 4 },
  { id: 'armor-rare', name: 'Plated Brigandine', category: 'armor', rarity: 'rare', buyPrice: 450, sellPrice: 130, levelScaling: 55, dropWeight: 5, minLevel: 9 },
  { id: 'armor-epic', name: 'Dragonscale Plate', category: 'armor', rarity: 'epic', buyPrice: 1800, sellPrice: 550, levelScaling: 130, dropWeight: 1.5, minLevel: 14 },
  { id: 'armor-legendary', name: 'Voidforged Aegis', category: 'armor', rarity: 'legendary', buyPrice: 8500, sellPrice: 2500, levelScaling: 350, dropWeight: 0.2, minLevel: 19 },

  // Materials
  { id: 'material-common', name: 'Iron Ore', category: 'material', rarity: 'common', buyPrice: 5, sellPrice: 2, levelScaling: 1, dropWeight: 30, minLevel: 1 },
  { id: 'material-rare', name: 'Enchanted Dust', category: 'material', rarity: 'rare', buyPrice: 30, sellPrice: 10, levelScaling: 5, dropWeight: 8, minLevel: 8 },
  { id: 'material-epic', name: 'Dragon Scale', category: 'material', rarity: 'epic', buyPrice: 100, sellPrice: 35, levelScaling: 15, dropWeight: 2, minLevel: 15 },

  // Gems
  { id: 'gem-common', name: 'Cracked Ruby', category: 'gem', rarity: 'common', buyPrice: 15, sellPrice: 5, levelScaling: 3, dropWeight: 15, minLevel: 3 },
  { id: 'gem-rare', name: 'Flawless Sapphire', category: 'gem', rarity: 'rare', buyPrice: 80, sellPrice: 25, levelScaling: 12, dropWeight: 4, minLevel: 10 },
  { id: 'gem-legendary', name: 'Star of Azkarath', category: 'gem', rarity: 'legendary', buyPrice: 5000, sellPrice: 1500, levelScaling: 200, dropWeight: 0.1, minLevel: 20 },
];

// ── Default Config ──────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: SimulationConfig = {
  agentCount: 100,
  maxLevel: 25,
  maxPlayHours: 80,
  philosophy: 'loot-driven',
  seed: 42,
};

export function getAllFlows(): EconomyFlow[] {
  return [...DEFAULT_FAUCETS, ...DEFAULT_SINKS];
}
