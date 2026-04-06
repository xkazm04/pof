import {
  STATUS_ERROR, STATUS_NEUTRAL,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { EntityMetadata, EntityGrouping } from '@/types/game-metadata';
import type { HeatmapCell, TimelineEvent, SankeyLink, SankeyColumn, PieSlice, GaugeMetric } from '@/types/unique-tab-improvements';

/* ── Weapon Categories & Tiers ─────────────────────────────────────────── */

export type WeaponCategory = 'Sword' | 'Axe' | 'Mace' | 'Bow' | 'Staff' | 'Dagger' | 'Polearm';
export type WeaponTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

const TIER_COLORS: Record<WeaponTier, string> = {
  Common: STATUS_NEUTRAL,
  Uncommon: ACCENT_EMERALD,
  Rare: ACCENT_CYAN,
  Epic: ACCENT_VIOLET,
  Legendary: ACCENT_ORANGE,
};

/* ── Weapon definition ─────────────────────────────────────────────────── */

export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  tier: WeaponTier;
  baseDamage: string;
  attackSpeed: string;
  critChance: string;
  color: string;
  description: string;
  /** Damage element — Physical if omitted. */
  element?: string;
}

function w(
  id: string, name: string, category: WeaponCategory, tier: WeaponTier,
  baseDamage: string, attackSpeed: string, critChance: string,
  description: string, element?: string,
): Weapon {
  return { id, name, category, tier, baseDamage, attackSpeed, critChance, color: TIER_COLORS[tier], description, element };
}

export const WEAPONS: Weapon[] = [
  /* ── Swords (8) ─────────────────────────────────────────────── */
  w('sw-iron',      'Iron Longsword',          'Sword', 'Common',    '8-14',  '1.4s', '5%',  'A sturdy standard-issue blade.'),
  w('sw-steel',     'Tempered Steel Blade',    'Sword', 'Uncommon',  '12-18', '1.3s', '6%',  'Heat-treated for superior edge retention.'),
  w('sw-vibro',     'Vibrosword',              'Sword', 'Rare',      '14-22', '1.2s', '8%',  'Ultrasonic blade with armour-piercing capability.'),
  w('sw-flamberge', 'Flamberge',               'Sword', 'Rare',      '16-24', '1.5s', '7%',  'Wavy-edged greatsword that tears through shields.'),
  w('sw-void',      'Voidsteel Falchion',      'Sword', 'Epic',      '20-30', '1.3s', '10%', 'Forged in null-space, it severs magical bonds.'),
  w('sw-dawn',      'Dawnbreaker',             'Sword', 'Legendary', '24-36', '1.2s', '15%', 'Radiant blade that burns undead on contact.', 'Fire'),
  w('sw-echani',    'Echani Foil',             'Sword', 'Epic',      '11-17', '1.1s', '10%', 'An elegant dueling weapon prized for its crit range.'),
  w('sw-sith',      'Sith Tremor Sword',       'Sword', 'Legendary', '20-30', '1.9s', '8%',  'Unleashes kinetic tremors on impact.'),

  /* ── Axes (6) ───────────────────────────────────────────────── */
  w('ax-hatchet',   'Wood Hatchet',            'Axe',   'Common',    '10-16', '1.6s', '4%',  'Simple woodcutter hatchet, decent in a fight.'),
  w('ax-broad',     'Broadaxe',                'Axe',   'Uncommon',  '14-22', '1.8s', '5%',  'Wide crescent blade for sweeping attacks.'),
  w('ax-gamorrean', 'Gamorrean Battleaxe',     'Axe',   'Rare',      '18-28', '2.0s', '6%',  'Massive axe with devastating overhead swings.'),
  w('ax-frost',     'Frostbite Cleaver',       'Axe',   'Epic',      '22-32', '1.7s', '8%',  'Each strike applies a frost debuff stack.', 'Ice'),
  w('ax-executioner','Executioner\'s Verdict',  'Axe',   'Legendary', '28-40', '2.1s', '12%', 'Guaranteed crit on targets below 20% HP.'),
  w('ax-twin',      'Twin Crescents',          'Axe',   'Rare',      '12-20', '1.4s', '7%',  'Dual axes swung in alternating arcs.'),

  /* ── Maces (6) ──────────────────────────────────────────────── */
  w('mc-club',      'Ironwood Club',           'Mace',  'Common',    '9-15',  '1.5s', '3%',  'Blunt and simple, high stagger potential.'),
  w('mc-flange',    'Flanged Mace',            'Mace',  'Uncommon',  '13-19', '1.6s', '4%',  'Flanged head concentrates force on impact.'),
  w('mc-morningstar','Morningstar',            'Mace',  'Rare',      '16-26', '1.7s', '6%',  'Spiked ball on chain — unpredictable swings.'),
  w('mc-thunder',   'Thunderstrike Maul',      'Mace',  'Epic',      '24-34', '2.0s', '7%',  'Electrical discharge stuns on crit.', 'Lightning'),
  w('mc-warhammer', 'Titan Warhammer',         'Mace',  'Legendary', '30-42', '2.2s', '10%', 'AoE ground pound on heavy attack.'),
  w('mc-scepter',   'Arcane Scepter',          'Mace',  'Epic',      '14-20', '1.3s', '9%',  'Channels spell damage through melee strikes.'),

  /* ── Bows (6) ───────────────────────────────────────────────── */
  w('bw-short',     'Short Hunting Bow',       'Bow',   'Common',    '6-12',  '1.0s', '5%',  'Lightweight ranged weapon for quick shots.'),
  w('bw-recurve',   'Recurve Bow',             'Bow',   'Uncommon',  '10-16', '1.1s', '7%',  'Improved draw power, longer effective range.'),
  w('bw-composite', 'Composite Warbow',        'Bow',   'Rare',      '14-22', '1.3s', '8%',  'Bone-and-sinew construction, pierces medium armor.'),
  w('bw-venom',     'Venomfang Bow',           'Bow',   'Epic',      '12-18', '0.9s', '10%', 'Arrows coated in paralytic venom.'),
  w('bw-stellar',   'Stellar Longbow',         'Bow',   'Legendary', '18-28', '1.2s', '14%', 'Arrows trail starfire that ignites on impact.', 'Fire'),
  w('bw-crossbow',  'Repeating Crossbow',      'Bow',   'Rare',      '8-14',  '0.7s', '6%',  'Three-bolt burst fire, low damage per shot.'),

  /* ── Staves (6) ─────────────────────────────────────────────── */
  w('st-walking',   'Walking Staff',           'Staff', 'Common',    '5-10',  '1.3s', '3%',  'A humble quarterstaff, surprisingly effective.'),
  w('st-iron',      'Iron-Shod Staff',         'Staff', 'Uncommon',  '8-14',  '1.2s', '5%',  'Metal caps add impact to sweeping blows.'),
  w('st-arcane',    'Arcane Focus Staff',       'Staff', 'Rare',      '10-18', '1.1s', '8%',  'Amplifies force ability damage by 15%.'),
  w('st-lightning', 'Stormcaller',             'Staff', 'Epic',      '14-24', '1.0s', '10%', 'Channels chain lightning through melee range.', 'Lightning'),
  w('st-void',      'Voidweaver Staff',        'Staff', 'Legendary', '18-30', '1.1s', '12%', 'Opens micro-rifts that drain enemy stamina.'),
  w('st-dual',      'Dual-Headed Polestaff',   'Staff', 'Rare',      '12-20', '1.4s', '6%',  'Blade on each end, alternating attack patterns.'),

  /* ── Daggers (6) ────────────────────────────────────────────── */
  w('dg-shiv',      'Rusty Shiv',              'Dagger','Common',    '4-8',   '0.8s', '8%',  'Fast and dirty — hits before they know it.'),
  w('dg-stiletto',  'Stiletto',                'Dagger','Uncommon',  '6-12',  '0.7s', '10%', 'Needle-thin blade, high crit multiplier.'),
  w('dg-curved',    'Curved Kris',             'Dagger','Rare',      '8-14',  '0.6s', '12%', 'Wavy blade causes bleeding wounds.'),
  w('dg-shadow',    'Shadowfang',              'Dagger','Epic',      '10-18', '0.5s', '15%', 'Backstab bonus: 3x damage from stealth.'),
  w('dg-soul',      'Soulreaper',              'Dagger','Legendary', '14-22', '0.6s', '18%', 'Each kill restores HP equal to overkill damage.'),
  w('dg-twin',      'Twin Fangs',              'Dagger','Rare',      '5-10',  '0.4s', '14%', 'Fastest weapon — dual-wielded with flurry attacks.'),

  /* ── Polearms (6) ───────────────────────────────────────────── */
  w('pl-spear',     'Wooden Spear',            'Polearm','Common',   '7-13',  '1.5s', '4%',  'Long reach compensates for low damage.'),
  w('pl-halberd',   'Halberd',                 'Polearm','Uncommon', '12-20', '1.7s', '5%',  'Axe-spear hybrid with versatile movepool.'),
  w('pl-glaive',    'Crescent Glaive',         'Polearm','Rare',     '16-24', '1.6s', '7%',  'Wide sweeping arcs hit multiple targets.'),
  w('pl-lance',     'Mounted Lance',           'Polearm','Rare',     '20-28', '2.0s', '5%',  'Massive charge damage, slow recovery.'),
  w('pl-dragonpike','Dragonpike',              'Polearm','Epic',     '22-34', '1.8s', '9%',  'Dragonbone tip that sears on thrust.', 'Fire'),
  w('pl-celestial', 'Celestial Partisan',      'Polearm','Legendary','26-38', '1.6s', '13%', 'Holy reach weapon with AoE smite on finisher.'),
];

/** Weapon count by category for quick reference. */
export const WEAPON_COUNT = WEAPONS.length;

/* ── Weapon Metadata for ScalableSelector ──────────────────────────────── */

export const WEAPON_METADATA: EntityMetadata[] = WEAPONS.map((wp) => ({
  id: wp.id,
  name: wp.name,
  category: wp.category,
  tier: wp.tier,
  tags: [wp.category.toLowerCase(), wp.tier.toLowerCase(), ...(wp.element ? [wp.element.toLowerCase()] : [])],
}));

export const WEAPON_GROUPINGS: EntityGrouping[] = [
  { field: 'category', label: 'Category', order: ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'] },
  { field: 'tier', label: 'Tier', order: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] },
];

/* ── Combo Sequences ───────────────────────────────────────────────────── */

export interface ComboSequence {
  id: string;
  name: string;
  weaponCategory: WeaponCategory;
  hits: number;
  totalTime: string;
  dps: number;
  /** Combo chain: list of attack names in order. */
  chain: string[];
}

export const COMBO_SEQUENCES: ComboSequence[] = [
  /* Sword combos */
  { id: 'cb-sw-basic',   name: 'Slash Combo',           weaponCategory: 'Sword',   hits: 3, totalTime: '1.5s', dps: 245, chain: ['Slash', 'Cross Cut', 'Thrust'] },
  { id: 'cb-sw-heavy',   name: 'Overhead Cleave',       weaponCategory: 'Sword',   hits: 2, totalTime: '2.0s', dps: 280, chain: ['Wind Up', 'Overhead Slam'] },
  { id: 'cb-sw-whirl',   name: 'Whirlwind Slash',       weaponCategory: 'Sword',   hits: 4, totalTime: '2.2s', dps: 310, chain: ['Sweep', 'Spin', 'Reverse', 'Finisher'] },
  { id: 'cb-sw-riposte', name: 'Riposte Chain',         weaponCategory: 'Sword',   hits: 3, totalTime: '1.8s', dps: 265, chain: ['Parry', 'Counter', 'Lunge'] },
  { id: 'cb-sw-berserk', name: 'Berserk Flurry',        weaponCategory: 'Sword',   hits: 5, totalTime: '2.5s', dps: 330, chain: ['Slash', 'Slash', 'Stab', 'Spin Cut', 'Execute'] },

  /* Axe combos */
  { id: 'cb-ax-chop',    name: 'Chop Combo',            weaponCategory: 'Axe',     hits: 2, totalTime: '2.0s', dps: 260, chain: ['Overhead', 'Downward Cleave'] },
  { id: 'cb-ax-sweep',   name: 'Wide Sweep',            weaponCategory: 'Axe',     hits: 3, totalTime: '2.4s', dps: 285, chain: ['Sweep Left', 'Sweep Right', 'Uppercut'] },
  { id: 'cb-ax-rage',    name: 'Raging Strikes',        weaponCategory: 'Axe',     hits: 4, totalTime: '3.0s', dps: 300, chain: ['Chop', 'Chop', 'Spin Slash', 'Ground Pound'] },
  { id: 'cb-ax-throw',   name: 'Throw & Recall',        weaponCategory: 'Axe',     hits: 2, totalTime: '1.8s', dps: 240, chain: ['Throw', 'Recall Slash'] },

  /* Mace combos */
  { id: 'cb-mc-bash',    name: 'Skull Bash',            weaponCategory: 'Mace',    hits: 2, totalTime: '1.8s', dps: 230, chain: ['Bash', 'Overhead Smash'] },
  { id: 'cb-mc-stagger', name: 'Stagger Chain',         weaponCategory: 'Mace',    hits: 3, totalTime: '2.2s', dps: 250, chain: ['Jab', 'Hook', 'Uppercut Smash'] },
  { id: 'cb-mc-quake',   name: 'Earthquake Slam',       weaponCategory: 'Mace',    hits: 3, totalTime: '2.8s', dps: 290, chain: ['Charge', 'Leap', 'Ground Slam'] },
  { id: 'cb-mc-flail',   name: 'Flail Spin',            weaponCategory: 'Mace',    hits: 4, totalTime: '2.5s', dps: 270, chain: ['Swing', 'Spin', 'Spin', 'Release'] },

  /* Bow combos */
  { id: 'cb-bw-rapid',   name: 'Rapid Fire',            weaponCategory: 'Bow',     hits: 3, totalTime: '1.5s', dps: 200, chain: ['Quick Shot', 'Quick Shot', 'Quick Shot'] },
  { id: 'cb-bw-charged', name: 'Charged Volley',        weaponCategory: 'Bow',     hits: 2, totalTime: '2.0s', dps: 250, chain: ['Charge', 'Power Shot'] },
  { id: 'cb-bw-rain',    name: 'Arrow Rain',            weaponCategory: 'Bow',     hits: 5, totalTime: '3.0s', dps: 220, chain: ['Aim High', 'Volley', 'Volley', 'Volley', 'Volley'] },
  { id: 'cb-bw-snipe',   name: 'Sniper Combo',          weaponCategory: 'Bow',     hits: 2, totalTime: '2.5s', dps: 275, chain: ['Mark', 'Headshot'] },

  /* Staff combos */
  { id: 'cb-st-sweep',   name: 'Staff Sweep',           weaponCategory: 'Staff',   hits: 3, totalTime: '1.6s', dps: 190, chain: ['Low Sweep', 'Mid Strike', 'Overhead'] },
  { id: 'cb-st-channel', name: 'Force Channel',         weaponCategory: 'Staff',   hits: 4, totalTime: '2.4s', dps: 260, chain: ['Tap', 'Channel', 'Pulse', 'Blast'] },
  { id: 'cb-st-vault',   name: 'Vault Strike',          weaponCategory: 'Staff',   hits: 2, totalTime: '1.8s', dps: 220, chain: ['Vault', 'Diving Strike'] },
  { id: 'cb-st-flurry',  name: 'Quarterstaff Flurry',   weaponCategory: 'Staff',   hits: 5, totalTime: '2.0s', dps: 240, chain: ['Jab', 'Jab', 'Sweep', 'Spin', 'Thrust'] },

  /* Dagger combos */
  { id: 'cb-dg-flurry',  name: 'Dagger Flurry',         weaponCategory: 'Dagger',  hits: 5, totalTime: '1.5s', dps: 280, chain: ['Stab', 'Stab', 'Slash', 'Stab', 'Twist'] },
  { id: 'cb-dg-backstab', name: 'Backstab Combo',       weaponCategory: 'Dagger',  hits: 2, totalTime: '1.0s', dps: 350, chain: ['Shadow Step', 'Backstab'] },
  { id: 'cb-dg-bleed',   name: 'Lacerate',              weaponCategory: 'Dagger',  hits: 3, totalTime: '1.2s', dps: 300, chain: ['Slash', 'Cross', 'Deep Cut'] },
  { id: 'cb-dg-fan',     name: 'Fan of Knives',         weaponCategory: 'Dagger',  hits: 4, totalTime: '1.4s', dps: 260, chain: ['Throw', 'Throw', 'Throw', 'Throw'] },
  { id: 'cb-dg-execute', name: 'Assassinate',           weaponCategory: 'Dagger',  hits: 3, totalTime: '1.6s', dps: 320, chain: ['Mark', 'Vanish', 'Execute'] },

  /* Polearm combos */
  { id: 'cb-pl-thrust',  name: 'Spear Thrust',          weaponCategory: 'Polearm', hits: 2, totalTime: '1.6s', dps: 210, chain: ['Jab', 'Impale'] },
  { id: 'cb-pl-sweep',   name: 'Halberd Sweep',         weaponCategory: 'Polearm', hits: 3, totalTime: '2.2s', dps: 255, chain: ['Sweep', 'Reverse', 'Overhead'] },
  { id: 'cb-pl-charge',  name: 'Lance Charge',          weaponCategory: 'Polearm', hits: 1, totalTime: '1.5s', dps: 310, chain: ['Full Charge'] },
  { id: 'cb-pl-whirl',   name: 'Polearm Cyclone',       weaponCategory: 'Polearm', hits: 4, totalTime: '2.5s', dps: 275, chain: ['Spin', 'Spin', 'Thrust', 'Slam'] },
  { id: 'cb-pl-dragon',  name: 'Dragon Dance',          weaponCategory: 'Polearm', hits: 5, totalTime: '3.0s', dps: 295, chain: ['Thrust', 'Sweep', 'Vault', 'Dive', 'Impale'] },
];

export const COMBO_COUNT = COMBO_SEQUENCES.length;

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Parse "lo-hi" damage string and return the midpoint. */
export function parseDamageMidpoint(dmg: string): number {
  const [lo, hi] = dmg.split('-').map(Number);
  return (lo + hi) / 2;
}

/* ── DPS Calculator data ───────────────────────────────────────────────── */

export interface DPSStrategy {
  name: string;
  dps: number;
  time: string;
  color: string;
}

export const DPS_STRATEGIES: DPSStrategy[] = [
  { name: 'SingleAttackSpam', dps: 180, time: 'Infinite', color: STATUS_NEUTRAL },
  { name: 'Full3HitCombo', dps: 245, time: '1.55s', color: ACCENT_CYAN },
  { name: 'CancelIntoAbility', dps: 310, time: '1.2s', color: ACCENT_EMERALD },
  { name: 'Lightsaber Basic Combo', dps: 145, time: '1.8s per cycle', color: ACCENT_CYAN },
  { name: 'Force Lightning Channel', dps: 200, time: '2.0s channel', color: ACCENT_VIOLET },
  { name: 'Saber + Force Weave', dps: 280, time: '3.2s rotation', color: ACCENT_EMERALD },
];

export const DPS_MAX = 350;

export const CUMULATIVE_POINTS = [0, 1, 2, 3, 4, 5];

/* ── Damage Type Effectiveness data ────────────────────────────────────── */

export const DMG_TYPES = ['Physical', 'Fire', 'Ice', 'Lightning'];
export const ARMOR_TYPES = ['Light', 'Medium', 'Heavy', 'Magical'];

export const EFFECTIVENESS_DATA: HeatmapCell[] = [
  { row: 0, col: 0, value: 0.8, label: '1.2', tooltip: 'Physical vs Light: 1.2x (effective)' },
  { row: 0, col: 1, value: 0.6, label: '1.0', tooltip: 'Physical vs Medium: 1.0x (neutral)' },
  { row: 0, col: 2, value: 0.2, label: '0.5', tooltip: 'Physical vs Heavy: 0.5x (resisted)' },
  { row: 0, col: 3, value: 0.4, label: '0.8', tooltip: 'Physical vs Magical: 0.8x (slightly resisted)' },
  { row: 1, col: 0, value: 1.0, label: '1.5', tooltip: 'Fire vs Light: 1.5x (very effective)' },
  { row: 1, col: 1, value: 0.7, label: '1.1', tooltip: 'Fire vs Medium: 1.1x (slightly effective)' },
  { row: 1, col: 2, value: 0.5, label: '0.9', tooltip: 'Fire vs Heavy: 0.9x (slightly resisted)' },
  { row: 1, col: 3, value: 0.25, label: '0.7', tooltip: 'Fire vs Magical: 0.7x (resisted)' },
  { row: 2, col: 0, value: 0.5, label: '0.9', tooltip: 'Ice vs Light: 0.9x (slightly resisted)' },
  { row: 2, col: 1, value: 0.85, label: '1.3', tooltip: 'Ice vs Medium: 1.3x (effective)' },
  { row: 2, col: 2, value: 0.7, label: '1.1', tooltip: 'Ice vs Heavy: 1.1x (slightly effective)' },
  { row: 2, col: 3, value: 0.6, label: '1.0', tooltip: 'Ice vs Magical: 1.0x (neutral)' },
  { row: 3, col: 0, value: 0.6, label: '1.0', tooltip: 'Lightning vs Light: 1.0x (neutral)' },
  { row: 3, col: 1, value: 0.5, label: '0.9', tooltip: 'Lightning vs Medium: 0.9x (slightly resisted)' },
  { row: 3, col: 2, value: 0.3, label: '0.6', tooltip: 'Lightning vs Heavy: 0.6x (resisted)' },
  { row: 3, col: 3, value: 1.0, label: '1.5', tooltip: 'Lightning vs Magical: 1.5x (very effective)' },
];

/* ── Combat Flow Sankey data ───────────────────────────────────────────── */

export const SANKEY_COLUMNS: SankeyColumn[] = [
  {
    label: 'Input',
    items: [
      { id: 'light', label: 'LightAttack', pct: 60, color: ACCENT_CYAN },
      { id: 'heavy', label: 'HeavyAttack', pct: 25, color: ACCENT_ORANGE },
      { id: 'dodge', label: 'Dodge', pct: 15, color: ACCENT_EMERALD },
    ],
  },
  {
    label: 'Result',
    items: [
      { id: 'hit', label: 'Hit', pct: 70, color: ACCENT_EMERALD },
      { id: 'miss', label: 'Miss', pct: 20, color: STATUS_NEUTRAL },
      { id: 'blocked', label: 'Blocked', pct: 10, color: ACCENT_ORANGE },
    ],
  },
  {
    label: 'Outcome',
    items: [
      { id: 'damage', label: 'Damage', pct: 55, color: ACCENT_EMERALD },
      { id: 'stagger', label: 'Stagger', pct: 15, color: ACCENT_VIOLET },
      { id: 'kill', label: 'Kill', pct: 5, color: STATUS_ERROR },
      { id: 'noDmg', label: 'NoDamage', pct: 25, color: STATUS_NEUTRAL },
    ],
  },
];

export const SANKEY_FLOWS: SankeyLink[] = [
  { source: 'light', target: 'hit', value: 45, color: ACCENT_CYAN },
  { source: 'light', target: 'miss', value: 10, color: STATUS_NEUTRAL },
  { source: 'light', target: 'blocked', value: 5, color: ACCENT_ORANGE },
  { source: 'heavy', target: 'hit', value: 18, color: ACCENT_ORANGE },
  { source: 'heavy', target: 'miss', value: 5, color: STATUS_NEUTRAL },
  { source: 'heavy', target: 'blocked', value: 2, color: ACCENT_ORANGE },
  { source: 'dodge', target: 'hit', value: 7, color: ACCENT_EMERALD },
  { source: 'dodge', target: 'miss', value: 5, color: STATUS_NEUTRAL },
  { source: 'dodge', target: 'blocked', value: 3, color: ACCENT_ORANGE },
  { source: 'hit', target: 'damage', value: 45, color: ACCENT_EMERALD },
  { source: 'hit', target: 'stagger', value: 15, color: ACCENT_VIOLET },
  { source: 'hit', target: 'kill', value: 5, color: STATUS_ERROR },
  { source: 'hit', target: 'noDmg', value: 5, color: STATUS_NEUTRAL },
  { source: 'miss', target: 'noDmg', value: 15, color: STATUS_NEUTRAL },
  { source: 'miss', target: 'damage', value: 5, color: ACCENT_EMERALD },
  { source: 'blocked', target: 'damage', value: 5, color: ACCENT_EMERALD },
  { source: 'blocked', target: 'noDmg', value: 5, color: STATUS_NEUTRAL },
];

/* ── Hitstop Timing data ──────────────────────────────────────────────── */

export interface HitstopAbility {
  name: string;
  hitstop: number;
  animDuration: number;
  color: string;
}

export const HITSTOP_ABILITIES: HitstopAbility[] = [
  { name: 'LightAttack1', hitstop: 0.03, animDuration: 0.4, color: ACCENT_CYAN },
  { name: 'LightAttack2', hitstop: 0.04, animDuration: 0.5, color: ACCENT_CYAN },
  { name: 'LightAttack3', hitstop: 0.06, animDuration: 0.6, color: ACCENT_ORANGE },
  { name: 'HeavyAttack', hitstop: 0.10, animDuration: 0.9, color: ACCENT_VIOLET },
  { name: 'Slam', hitstop: 0.15, animDuration: 1.2, color: STATUS_ERROR },
];

export const MAX_HITSTOP = 0.15;

/* ── Combat Metrics data ──────────────────────────────────────────────── */

export interface KPICard {
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  barPct?: number;
  barColor?: string;
  context?: string;
}

export const KPI_CARDS: KPICard[] = [
  { label: 'Total Damage Dealt', value: '12,450', trend: '+15%', trendColor: ACCENT_EMERALD, context: 'Last 100 combat encounters' },
  { label: 'Crit Rate', value: '18%', barPct: 18, barColor: ACCENT_ORANGE, context: 'Rolling avg over 500 attacks' },
  { label: 'Dodge Success', value: '85%', barPct: 85, barColor: ACCENT_CYAN, context: 'Successful i-frame dodges vs total attempts' },
  { label: 'Avg Combo Length', value: '2.3', barPct: 46, barColor: ACCENT_VIOLET, context: 'Mean hits per combo chain (max 5)' },
];

export const HIT_ACCURACY_GAUGE: GaugeMetric = {
  label: 'Hit Accuracy',
  current: 73,
  target: 100,
  unit: '%',
  trend: 'up',
};

export const ABILITY_USAGE: PieSlice[] = [
  { label: 'MeleeAttack', pct: 45, color: ACCENT_ORANGE },
  { label: 'Dodge', pct: 25, color: ACCENT_CYAN },
  { label: 'Fireball', pct: 20, color: STATUS_ERROR },
  { label: 'Other', pct: 10, color: STATUS_NEUTRAL },
];

/* ── Stagger & Status Effect data ─────────────────────────────────────── */

export const STAGGER_CONFIG = {
  currentStagger: 67,
  threshold: 100,
  decayRate: 5,
};

export const STAGGER_PIPELINE_STEPS = ['Hits Accumulate', 'Threshold Reached', 'Stun Triggered', 'Recovery'];

export const STAGGER_TIMELINE: TimelineEvent[] = [
  { id: 'st1', timestamp: 0, label: '+15', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st2', timestamp: 1.2, label: '+20', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st3', timestamp: 2.5, label: '-5 decay', category: 'decay', color: STATUS_NEUTRAL, duration: 1.0 },
  { id: 'st4', timestamp: 3.8, label: '+25', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st5', timestamp: 5.0, label: '+15', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st6', timestamp: 6.2, label: '-5 decay', category: 'decay', color: STATUS_NEUTRAL, duration: 1.0 },
  { id: 'st7', timestamp: 7.5, label: 'STUN', category: 'stun', color: STATUS_ERROR, duration: 1.5 },
  { id: 'st8', timestamp: 9.0, label: 'Recovery', category: 'recovery', color: ACCENT_EMERALD, duration: 1.0 },
];

/* ── Combo chain sections ──────────────────────────────────────────────── */

export const COMBO_SECTIONS = [
  { name: 'Attack 1', timing: '0.0s - 0.4s', window: 'Combo Window', pct: 60 },
  { name: 'Attack 2', timing: '0.0s - 0.5s', window: 'Combo Window', pct: 70 },
  { name: 'Attack 3', timing: '0.0s - 0.6s', window: 'Finisher', pct: 85 },
];
