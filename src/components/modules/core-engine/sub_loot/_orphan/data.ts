import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_EMERALD, ACCENT_CYAN,
} from '@/lib/chart-colors';

// ── Types mirroring C++ structs ──

export type ItemType = 'Weapon' | 'Armor' | 'Consumable' | 'Material' | 'Quest';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: STATUS_INFO,
  Uncommon: STATUS_SUCCESS,
  Rare: MODULE_COLORS.core,
  Epic: MODULE_COLORS.systems,
  Legendary: MODULE_COLORS.content,
};

export const RARITY_AFFIX_COUNTS: Record<Rarity, { min: number; max: number }> = {
  Common: { min: 0, max: 0 },
  Uncommon: { min: 1, max: 2 },
  Rare: { min: 3, max: 4 },
  Epic: { min: 4, max: 5 },
  Legendary: { min: 5, max: 6 },
};

export interface AffixPoolEntry {
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

export interface CraftedAffix {
  poolEntryId: string;
  tag: string;
  displayName: string;
  bIsPrefix: boolean;
  magnitude: number;
  stat: string;
  category: 'offensive' | 'defensive' | 'utility';
  locked?: boolean;
}

export interface ItemBase {
  name: string;
  type: ItemType;
  rarity: Rarity;
  itemLevel: number;
  baseValue: number;
}

// ── Affix Pool Data (matches FAffixTableRow from C++) ──

export const AFFIX_POOL: AffixPoolEntry[] = [
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

export interface SynergyRule {
  affixTags: [string, string]; // pair of affix tags
  label: string;
  severity: 'broken' | 'strong' | 'good';
  description: string;
}

export const SYNERGY_RULES: SynergyRule[] = [
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

export const SYNERGY_COLORS: Record<string, string> = {
  broken: STATUS_ERROR,
  strong: STATUS_WARNING,
  good: STATUS_SUCCESS,
};

// ── Rarity Archetype Patterns ──

export interface RarityArchetype {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  color: string;
  affixTags: string[]; // ordered affix tags for this archetype
  synergies: string[]; // synergy labels this archetype triggers
}

export function detectArchetypes(pool: AffixPoolEntry[], rarity: Rarity): RarityArchetype[] {
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
      color: categoryColors[cat] ?? ACCENT_EMERALD,
      affixTags: [...cluster],
      synergies: [...clusterRules],
    });

    for (const tag of cluster) visited.add(tag);
  }

  return archetypes.slice(0, 4); // max 4 suggestions
}

// ── Item bases ──

export const ITEM_BASES: ItemBase[] = [
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

export function getItemLevelScaling(level: number): number {
  return 1.0 + 0.1 * level;
}

export function buildAffixName(baseName: string, affixes: CraftedAffix[]): string {
  const prefixes = affixes.filter((a) => a.bIsPrefix).map((a) => a.displayName);
  const suffixes = affixes.filter((a) => !a.bIsPrefix).map((a) => a.displayName);

  let name = baseName;
  if (prefixes.length > 0) name = prefixes.join(' ') + ' ' + name;
  if (suffixes.length > 0) name = name + ' ' + suffixes.join(' ');
  return name;
}

export function computePowerBudget(affixes: CraftedAffix[], itemLevel: number): { offense: number; defense: number; utility: number; total: number } {
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
export const RARITY_BUDGET_MAX: Record<Rarity, number> = {
  Common: 0,
  Uncommon: 50,
  Rare: 150,
  Epic: 300,
  Legendary: 500,
};

export function generateExportCode(base: ItemBase, affixes: CraftedAffix[]): string {
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
