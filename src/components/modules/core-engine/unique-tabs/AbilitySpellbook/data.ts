import type { RadarDataPoint, TimelineEvent } from '@/types/unique-tab-improvements';
import {
  ACCENT_CYAN, ACCENT_EMERALD_DARK, ACCENT_GREEN, ACCENT_ORANGE,
  ACCENT_PURPLE_BOLD, ACCENT_RED, MODULE_COLORS, STATUS_STALE, STATUS_WARNING,
} from '@/lib/chart-colors';
import type { ParsedUE5Data, ParsedTag, ParsedAbility } from '@/lib/ue5-source-parser';

/* ── Attribute radar data ──────────────────────────────────────────────── */

export const CORE_ATTRIBUTES = ['Health', 'Mana', 'Strength', 'Dexterity', 'Intelligence'];
export const DERIVED_ATTRIBUTES = ['Armor', 'AttackPower', 'CritChance', 'CritDamage'];

/* ── Tag hierarchy ─────────────────────────────────────────────────────── */

export interface TagNode {
  name: string;
  children?: TagNode[];
}

export const TAG_TREE: TagNode[] = [
  {
    name: 'Ability', children: [
      { name: 'Ability.MeleeAttack' },
      { name: 'Ability.Dodge' },
      { name: 'Ability.Spell' },
    ]
  },
  {
    name: 'State', children: [
      { name: 'State.Dead' },
      { name: 'State.Invulnerable' },
      { name: 'State.Stunned' },
    ]
  },
  {
    name: 'Damage', children: [
      { name: 'Damage.Physical' },
      { name: 'Damage.Magical' },
      { name: 'Damage.Fire' },
    ]
  },
  {
    name: 'Input', children: [
      { name: 'Input.Attack' },
      { name: 'Input.Dodge' },
      { name: 'Input.Interact' },
    ]
  },
];

/* ── Effect pipeline ───────────────────────────────────────────────────── */

export const EFFECT_TYPES = [
  { name: 'GE_Damage', desc: 'Instant damage application', color: ACCENT_RED },
  { name: 'GE_Heal', desc: 'Health restoration over time', color: ACCENT_EMERALD_DARK },
  { name: 'GE_Buff', desc: 'Temporary stat modifier', color: MODULE_COLORS.core },
  { name: 'GE_Regen', desc: 'Periodic health/mana regen', color: STATUS_STALE },
];

/* ── 3.1 Attribute Relationship Web data ───────────────────────────────── */

export interface AttrNode { id: string; label: string }
export interface AttrEdge { from: string; to: string; type: 'scales' | 'partial'; label: string }

export const ATTR_WEB_NODES: AttrNode[] = [
  { id: 'str', label: 'Strength' },
  { id: 'dex', label: 'Dexterity' },
  { id: 'int', label: 'Intelligence' },
  { id: 'hp', label: 'Health' },
  { id: 'mp', label: 'Mana' },
  { id: 'arm', label: 'Armor' },
  { id: 'atk', label: 'AttackPower' },
  { id: 'crit', label: 'CritChance' },
  { id: 'cdmg', label: 'CritDamage' },
];

export const ATTR_WEB_EDGES: AttrEdge[] = [
  { from: 'str', to: 'atk', type: 'scales', label: 'Scales' },
  { from: 'dex', to: 'crit', type: 'scales', label: 'Scales' },
  { from: 'int', to: 'mp', type: 'scales', label: 'Scales' },
  { from: 'str', to: 'arm', type: 'partial', label: 'Partial' },
  { from: 'dex', to: 'atk', type: 'partial', label: 'Partial' },
];

/* ── 3.2 Ability Cost/Benefit Radar data ───────────────────────────────── */

export const ABILITY_RADAR_AXES = ['Damage', 'Range', 'AOE', 'Speed', 'Efficiency'];

export const ABILITY_RADAR_DATA: { name: string; color: string; values: number[] }[] = [
  { name: 'MeleeAttack', color: ACCENT_RED, values: [0.85, 0.2, 0, 0.9, 0.6] },
  { name: 'Fireball', color: ACCENT_ORANGE, values: [0.9, 0.85, 0.6, 0.3, 0.25] },
  { name: 'Dodge', color: MODULE_COLORS.core, values: [0, 0, 0, 0.95, 0.8] },
];

/* ── 3.3 Tag Dependency Graph data ─────────────────────────────────────── */

export interface TagDepNode { id: string; label: string; category: string; color: string }
export interface TagDepEdge { from: string; to: string; type: 'blocks' | 'requires' }

export const TAG_DEP_CATEGORIES: Record<string, string> = {
  Ability: ACCENT_PURPLE_BOLD,
  State: ACCENT_RED,
  Damage: ACCENT_ORANGE,
  Input: ACCENT_CYAN,
};

export const TAG_DEP_NODES: TagDepNode[] = [
  { id: 'melee', label: 'Ability.MeleeAttack', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'dodge', label: 'Ability.Dodge', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'spell', label: 'Ability.Spell', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'stunned', label: 'State.Stunned', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'dead', label: 'State.Dead', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'invuln', label: 'State.Invulnerable', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'dmg_phys', label: 'Damage.Physical', category: 'Damage', color: TAG_DEP_CATEGORIES.Damage },
  { id: 'dmg_magic', label: 'Damage.Magical', category: 'Damage', color: TAG_DEP_CATEGORIES.Damage },
  { id: 'input_atk', label: 'Input.Attack', category: 'Input', color: TAG_DEP_CATEGORIES.Input },
];

export const TAG_DEP_EDGES: TagDepEdge[] = [
  { from: 'stunned', to: 'melee', type: 'blocks' },
  { from: 'dead', to: 'melee', type: 'blocks' },
  { from: 'dead', to: 'dodge', type: 'blocks' },
  { from: 'dead', to: 'spell', type: 'blocks' },
  { from: 'invuln', to: 'dmg_phys', type: 'blocks' },
  { from: 'invuln', to: 'dmg_magic', type: 'blocks' },
];

/* ── 3.4 Effect Stack Timeline data ────────────────────────────────────── */

export const EFFECT_TIMELINE_EVENTS: TimelineEvent[] = [
  { id: 'e1', timestamp: 0.5, label: 'GE_Damage', category: 'damage', color: ACCENT_RED, details: 'Instant damage' },
  { id: 'e2', timestamp: 1.0, label: 'GE_Buff(AtkUp)', category: 'buff', color: MODULE_COLORS.core, duration: 3.0, details: 'Attack buff 3s' },
  { id: 'e3', timestamp: 2.0, label: 'GE_Regen', category: 'regen', color: ACCENT_EMERALD_DARK, duration: 5.0, details: 'HP regen 5s' },
  { id: 'e4', timestamp: 3.5, label: 'GE_Damage', category: 'damage', color: ACCENT_RED, details: 'Instant damage' },
  { id: 'e5', timestamp: 4.0, label: 'GE_Buff(DefUp)', category: 'buff', color: MODULE_COLORS.core, duration: 4.0, details: 'Defense buff 4s' },
  { id: 'e6', timestamp: 5.5, label: 'GE_Heal', category: 'heal', color: ACCENT_GREEN, details: 'Instant heal' },
  { id: 'e7', timestamp: 7.0, label: 'GE_Damage', category: 'damage', color: ACCENT_RED, details: 'Instant damage' },
  { id: 'e8', timestamp: 8.5, label: 'GE_Regen', category: 'regen', color: STATUS_STALE, duration: 2.0, details: 'Mana regen 2s' },
];

/* ── 3.6 Attribute Growth Projections data ─────────────────────────────── */

export interface GrowthPoint { level: number; power: number }

export const GROWTH_BUILDS: { name: string; color: string; points: GrowthPoint[] }[] = [
  {
    name: 'Warrior', color: ACCENT_RED,
    points: [
      { level: 1, power: 10 }, { level: 5, power: 35 }, { level: 10, power: 80 },
      { level: 15, power: 140 }, { level: 20, power: 210 }, { level: 25, power: 290 },
      { level: 30, power: 370 }, { level: 35, power: 440 }, { level: 40, power: 500 },
      { level: 45, power: 550 }, { level: 50, power: 600 },
    ],
  },
  {
    name: 'Mage', color: MODULE_COLORS.core,
    points: [
      { level: 1, power: 8 }, { level: 5, power: 25 }, { level: 10, power: 60 },
      { level: 15, power: 110 }, { level: 20, power: 190 }, { level: 25, power: 300 },
      { level: 30, power: 420 }, { level: 35, power: 530 }, { level: 40, power: 620 },
      { level: 45, power: 690 }, { level: 50, power: 750 },
    ],
  },
  {
    name: 'Rogue', color: ACCENT_GREEN,
    points: [
      { level: 1, power: 12 }, { level: 5, power: 40 }, { level: 10, power: 90 },
      { level: 15, power: 150 }, { level: 20, power: 220 }, { level: 25, power: 280 },
      { level: 30, power: 350 }, { level: 35, power: 420 }, { level: 40, power: 510 },
      { level: 45, power: 610 }, { level: 50, power: 720 },
    ],
  },
];

/* ── 3.7 Cooldown Flow data ────────────────────────────────────────────── */

export const COOLDOWN_ABILITIES = [
  { name: 'MeleeAttack', cd: 0.5, remaining: 0.2, color: ACCENT_RED },
  { name: 'Fireball', cd: 3.0, remaining: 1.8, color: ACCENT_ORANGE },
  { name: 'FrostNova', cd: 8.0, remaining: 5.5, color: MODULE_COLORS.core },
  { name: 'Dodge', cd: 1.5, remaining: 0.0, color: ACCENT_GREEN },
];

/* ── 3.8 GAS Architecture Explorer steps ───────────────────────────────── */

export const GAS_STEPS = [
  { label: 'CommitAbility', desc: 'Lock resources, check tags', color: MODULE_COLORS.core },
  { label: 'CheckCost', desc: 'Verify mana/stamina available', color: STATUS_STALE },
  { label: 'ApplyCost', desc: 'Deduct resource from AttributeSet', color: ACCENT_PURPLE_BOLD },
  { label: 'SpawnProjectile', desc: 'Create projectile actor (if ranged)', color: MODULE_COLORS.content },
  { label: 'OnHit', desc: 'Collision triggers effect application', color: ACCENT_ORANGE },
  { label: 'ApplyDamage', desc: 'GameplayEffect modifies target HP', color: ACCENT_RED },
  { label: 'PostGEExecute', desc: 'Run post-effect callbacks', color: ACCENT_EMERALD_DARK },
];

/* ── 3.9 Tag Audit Dashboard data ──────────────────────────────────────── */

export interface AuditCategory { name: string; status: 'pass' | 'warning' | 'error'; count: number; detail: string }

export const TAG_AUDIT_CATEGORIES: AuditCategory[] = [
  { name: 'Duplicates', status: 'pass', count: 0, detail: 'No duplicate tags found' },
  { name: 'Unused', status: 'warning', count: 3, detail: 'Input.Interact, Damage.Fire, State.Invulnerable' },
  { name: 'Missing', status: 'error', count: 1, detail: 'Ability.RangedAttack referenced but not defined' },
  { name: 'Naming', status: 'pass', count: 0, detail: 'All tags follow naming convention' },
];

export const TAG_USAGE_FREQUENCY = [
  { tag: 'State.Dead', count: 14 },
  { tag: 'Ability.MeleeAttack', count: 12 },
  { tag: 'Damage.Physical', count: 11 },
  { tag: 'State.Stunned', count: 9 },
  { tag: 'Ability.Dodge', count: 8 },
  { tag: 'Input.Attack', count: 7 },
  { tag: 'Damage.Magical', count: 6 },
  { tag: 'Ability.Spell', count: 5 },
  { tag: 'Input.Dodge', count: 4 },
  { tag: 'State.Invulnerable', count: 2 },
];

export const TAG_AUDIT_SCORE = 85;

/* ── Tag quick-view popover data ───────────────────────────────────────── */

export interface TagDetail {
  name: string;
  prefix: string;
  cooldown?: string;
  manaCost?: number;
  blockingTags: string[];
  lifecycle: string[];
  color: string;
}

export const TAG_DETAIL_MAP: Record<string, TagDetail> = {
  'State.Dead': {
    name: 'Dead State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnHealthDepleted', 'SetTag', 'BlockAll', 'Ragdoll', 'Cleanup'],
    color: ACCENT_RED,
  },
  'Ability.MeleeAttack': {
    name: 'Melee Attack', prefix: 'Ability', cooldown: 'Cooldown.MeleeAttack (0.5s)',
    manaCost: 0, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CommitAbility', 'PlayMontage', 'ApplyDamage', 'EndAbility'],
    color: ACCENT_PURPLE_BOLD,
  },
  'Damage.Physical': {
    name: 'Physical Damage', prefix: 'Damage', blockingTags: ['State.Invulnerable'],
    lifecycle: ['CalcMagnitude', 'ArmorReduction', 'ApplyToTarget', 'PostExecute'],
    color: ACCENT_ORANGE,
  },
  'State.Stunned': {
    name: 'Stunned State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnStunApplied', 'SetTag', 'BlockAbilities', 'Duration', 'RemoveTag'],
    color: ACCENT_RED,
  },
  'Ability.Dodge': {
    name: 'Dodge', prefix: 'Ability', cooldown: 'Cooldown.Dodge (1.5s)',
    manaCost: 10, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CommitAbility', 'GrantInvuln', 'PlayMontage', 'EndAbility'],
    color: MODULE_COLORS.core,
  },
  'Input.Attack': {
    name: 'Attack Input', prefix: 'Input', blockingTags: ['State.Dead'],
    lifecycle: ['InputPressed', 'FindAbility', 'TryActivate', 'InputReleased'],
    color: ACCENT_CYAN,
  },
  'Damage.Magical': {
    name: 'Magical Damage', prefix: 'Damage', blockingTags: ['State.Invulnerable'],
    lifecycle: ['CalcMagnitude', 'ResistCheck', 'ApplyToTarget', 'PostExecute'],
    color: ACCENT_ORANGE,
  },
  'Ability.Spell': {
    name: 'Spell Cast', prefix: 'Ability', cooldown: 'Cooldown.Spell (3.0s)',
    manaCost: 25, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CheckMana', 'CommitAbility', 'SpawnProjectile', 'EndAbility'],
    color: ACCENT_PURPLE_BOLD,
  },
  'Input.Dodge': {
    name: 'Dodge Input', prefix: 'Input', blockingTags: ['State.Dead'],
    lifecycle: ['InputPressed', 'FindAbility', 'TryActivate', 'InputReleased'],
    color: ACCENT_CYAN,
  },
  'State.Invulnerable': {
    name: 'Invulnerable State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnDodge', 'SetTag', 'BlockDamage', 'Duration', 'RemoveTag'],
    color: ACCENT_GREEN,
  },
};

/* ── 3.10 Ability Loadout Optimizer data ───────────────────────────────── */

export interface LoadoutEntry { slot: number; ability: string; color: string }

export const OPTIMAL_LOADOUT: LoadoutEntry[] = [
  { slot: 1, ability: 'MeleeAttack', color: ACCENT_RED },
  { slot: 2, ability: 'Fireball', color: ACCENT_ORANGE },
  { slot: 3, ability: 'FrostNova', color: MODULE_COLORS.core },
  { slot: 4, ability: 'Dodge', color: ACCENT_GREEN },
];

export const LOADOUT_RADAR: RadarDataPoint[] = [
  { axis: 'Coverage', value: 0.85 },
  { axis: 'Synergy', value: 0.7 },
  { axis: 'DPS', value: 0.9 },
  { axis: 'Burst', value: 0.75 },
  { axis: 'Utility', value: 0.6 },
];

export const LOADOUT_SCORE = 78;

export const ALTERNATIVE_LOADOUTS = [
  { name: 'Burst DPS', abilities: ['MeleeAttack', 'Fireball', 'Fireball', 'Dodge'], score: 72 },
  { name: 'Control', abilities: ['FrostNova', 'FrostNova', 'Dodge', 'Dodge'], score: 65 },
  { name: 'Balanced', abilities: ['MeleeAttack', 'Fireball', 'Dodge', 'Dodge'], score: 74 },
];

/* ── Combo Chain Builder data ────────────────────────────────────────── */

export interface ComboAbility {
  id: string;
  name: string;
  damage: number;
  manaCost: number;
  cooldown: number;
  /** Total animation duration in seconds */
  animDuration: number;
  /** Damage window within animation [startSec, endSec] */
  damageWindow: [number, number];
  /** Recovery frames after damage window (seconds) */
  recovery: number;
  color: string;
  /** UE5 gameplay tag */
  tag: string;
  /** Combo multiplier per hit in a chain (applies cumulatively) */
  comboMultiplier: number;
  damageType: 'Physical' | 'Fire' | 'Ice' | 'Lightning' | 'None';
}

export interface ComboChain {
  id: string;
  name: string;
  abilities: string[]; // ComboAbility ids
}

export const COMBO_ABILITIES: ComboAbility[] = [
  {
    id: 'melee1', name: 'MeleeAttack', damage: 20, manaCost: 0, cooldown: 0,
    animDuration: 0.6, damageWindow: [0.15, 0.35], recovery: 0.25,
    color: ACCENT_RED, tag: 'Ability.Melee.LightAttack',
    comboMultiplier: 1.0, damageType: 'Physical',
  },
  {
    id: 'melee2', name: 'HeavyAttack', damage: 35, manaCost: 0, cooldown: 0,
    animDuration: 0.9, damageWindow: [0.3, 0.55], recovery: 0.35,
    color: ACCENT_RED, tag: 'Ability.Melee.HeavyAttack',
    comboMultiplier: 1.5, damageType: 'Physical',
  },
  {
    id: 'dash', name: 'DashStrike', damage: 40, manaCost: 25, cooldown: 5.0,
    animDuration: 0.7, damageWindow: [0.1, 0.45], recovery: 0.25,
    color: ACCENT_CYAN, tag: 'Ability.DashStrike',
    comboMultiplier: 1.2, damageType: 'Physical',
  },
  {
    id: 'slam', name: 'GroundSlam', damage: 50, manaCost: 30, cooldown: 6.0,
    animDuration: 1.0, damageWindow: [0.4, 0.7], recovery: 0.3,
    color: ACCENT_ORANGE, tag: 'Ability.GroundSlam',
    comboMultiplier: 1.3, damageType: 'Physical',
  },
  {
    id: 'fireball', name: 'Fireball', damage: 35, manaCost: 20, cooldown: 3.0,
    animDuration: 0.8, damageWindow: [0.3, 0.5], recovery: 0.3,
    color: STATUS_WARNING, tag: 'Ability.Fireball',
    comboMultiplier: 1.1, damageType: 'Fire',
  },
  {
    id: 'warcry', name: 'WarCry', damage: 0, manaCost: 15, cooldown: 25.0,
    animDuration: 1.2, damageWindow: [0, 0], recovery: 0.2,
    color: ACCENT_PURPLE_BOLD, tag: 'Ability.WarCry',
    comboMultiplier: 1.0, damageType: 'None',
  },
  {
    id: 'dodge', name: 'Dodge', damage: 0, manaCost: 0, cooldown: 1.0,
    animDuration: 0.5, damageWindow: [0, 0], recovery: 0.1,
    color: ACCENT_GREEN, tag: 'Ability.Dodge',
    comboMultiplier: 1.0, damageType: 'None',
  },
];

export const COMBO_ABILITY_MAP = new Map(COMBO_ABILITIES.map(a => [a.id, a]));

/** Combo event tags from ARPGGameplayTags.h */
export const COMBO_EVENT_TAGS = [
  { tag: 'Event.Combo.Open', desc: 'Combo input window opens — player can queue next ability' },
  { tag: 'Event.Combo.Close', desc: 'Combo input window closes — chain drops if no input' },
  { tag: 'Event.Combo.Input', desc: 'Player pressed input during combo window — advance chain' },
] as const;

export const PRESET_COMBOS: ComboChain[] = [
  { id: 'basic', name: 'Basic Melee Chain', abilities: ['melee1', 'melee1', 'melee2'] },
  { id: 'dash-combo', name: 'Dash Opener', abilities: ['dash', 'melee1', 'melee1', 'slam'] },
  { id: 'spell-weave', name: 'Spell Weave', abilities: ['warcry', 'fireball', 'dash', 'slam'] },
  { id: 'burst', name: 'Burst DPS', abilities: ['melee1', 'dash', 'fireball', 'melee2', 'slam'] },
];

/* ═══════════════════════════════════════════════════════════════════════════
 * Live UE5 Source Sync — conversion functions
 *
 * These take ParsedUE5Data from the server-side C++ parser and produce
 * the same data shapes as the static exports above. Components use these
 * when live data is available, falling back to static otherwise.
 * ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORY_COLORS: Record<string, string> = {
  Ability: ACCENT_PURPLE_BOLD,
  State: ACCENT_RED,
  Damage: ACCENT_ORANGE,
  Data: STATUS_STALE,
  Event: ACCENT_EMERALD_DARK,
  Cooldown: MODULE_COLORS.core,
  InputTag: ACCENT_CYAN,
  Input: ACCENT_CYAN,
};

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? MODULE_COLORS.systems;
}

/** Build TAG_TREE from parsed tags, grouped by top-level category */
export function buildLiveTagTree(tags: ParsedTag[]): TagNode[] {
  const groups = new Map<string, TagNode[]>();

  for (const tag of tags) {
    const children = groups.get(tag.category) ?? [];
    children.push({ name: tag.tagString });
    groups.set(tag.category, children);
  }

  return Array.from(groups.entries()).map(([name, children]) => ({
    name,
    children,
  }));
}

/** Build COOLDOWN_ABILITIES from parsed abilities that have a cooldown tag */
export function buildLiveCooldownAbilities(abilities: ParsedAbility[]) {
  const ABILITY_COLORS: Record<string, string> = {
    Fireball: ACCENT_ORANGE,
    'Melee Attack': ACCENT_RED,
    'Ground Slam': MODULE_COLORS.core,
    'Dash Strike': ACCENT_CYAN,
    'War Cry': ACCENT_PURPLE_BOLD,
    Dodge: ACCENT_GREEN,
    Death: ACCENT_RED,
  };

  return abilities
    .filter((a) => a.cooldownTag && a.isPlayerAbility)
    .map((a) => ({
      name: a.displayName,
      cd: 0, // Actual CD durations are in GE blueprints, not in C++
      remaining: 0,
      color: ABILITY_COLORS[a.displayName] ?? MODULE_COLORS.systems,
      cooldownTag: a.cooldownTag!,
    }));
}

/** Normalize a value into 0..1 given a max reference */
function norm(v: number | null, max: number): number {
  if (v === null || v <= 0) return 0;
  return Math.min(v / max, 1);
}

/** Build ABILITY_RADAR_DATA from parsed abilities (player only) */
export function buildLiveAbilityRadar(abilities: ParsedAbility[]) {
  const ABILITY_COLORS: Record<string, string> = {
    'Melee Attack': ACCENT_RED,
    Fireball: ACCENT_ORANGE,
    'Ground Slam': MODULE_COLORS.core,
    'Dash Strike': ACCENT_CYAN,
    'War Cry': ACCENT_PURPLE_BOLD,
    Dodge: ACCENT_GREEN,
  };

  // Max values for normalization (from real data: highest BaseDamage=50, AoE=400, Dash=800)
  const MAX_DAMAGE = 50;
  const MAX_AOE = 400;

  return abilities
    .filter((a) => a.isPlayerAbility && a.displayName !== 'Death')
    .map((a) => {
      const hasAoE = (a.aoERadius ?? 0) > 0 || (a.explosionRadius ?? 0) > 0;
      const isRanged = a.explosionRadius !== null || a.className.includes('Fireball') || a.className.includes('Ranged');
      const hasDash = (a.dashDistance ?? 0) > 0;
      const damage = norm(a.baseDamage, MAX_DAMAGE);
      const range = isRanged ? 0.85 : hasDash ? 0.5 : 0.2;
      const aoe = norm((a.aoERadius ?? a.explosionRadius ?? 0), MAX_AOE);
      const speed = a.baseDamage === null || a.baseDamage === 0 ? 0.95 : damage > 0.7 ? 0.3 : 0.7;
      const efficiency = a.manaCost === 0 ? 0.9 : 1 - norm(a.manaCost, 40);

      return {
        name: a.displayName,
        color: ABILITY_COLORS[a.displayName] ?? MODULE_COLORS.systems,
        values: [
          Math.round(damage * 100) / 100,
          Math.round(range * 100) / 100,
          Math.round(aoe * 100) / 100,
          Math.round(speed * 100) / 100,
          Math.round(efficiency * 100) / 100,
        ],
      };
    });
}

/** Build TAG_DEP_NODES and TAG_DEP_EDGES from parsed abilities */
export function buildLiveTagDeps(abilities: ParsedAbility[], tags: ParsedTag[]) {
  const nodeSet = new Set<string>();
  const nodes: TagDepNode[] = [];
  const edges: TagDepEdge[] = [];

  const ensureNode = (tagString: string) => {
    if (nodeSet.has(tagString)) return;
    nodeSet.add(tagString);
    const cat = tagString.split('.')[0];
    const id = tagString.replace(/\./g, '_').toLowerCase();
    nodes.push({
      id,
      label: tagString,
      category: cat,
      color: categoryColor(cat),
    });
  };

  for (const ab of abilities) {
    if (!ab.isPlayerAbility) continue;
    if (ab.abilityTag) ensureNode(ab.abilityTag);

    for (const blockedBy of ab.activationBlockedTags) {
      ensureNode(blockedBy);
      if (ab.abilityTag) {
        const fromId = blockedBy.replace(/\./g, '_').toLowerCase();
        const toId = ab.abilityTag.replace(/\./g, '_').toLowerCase();
        edges.push({ from: fromId, to: toId, type: 'blocks' });
      }
    }

    for (const owned of ab.activationOwnedTags) {
      ensureNode(owned);
    }
  }

  return { nodes, edges };
}

/** Build TAG_DETAIL_MAP from parsed abilities and tags */
export function buildLiveTagDetailMap(
  abilities: ParsedAbility[],
  tags: ParsedTag[]
): Record<string, TagDetail> {
  const map: Record<string, TagDetail> = {};

  // Add ability tags
  for (const ab of abilities) {
    if (!ab.abilityTag || !ab.isPlayerAbility) continue;
    const prefix = ab.abilityTag.split('.')[0];

    map[ab.abilityTag] = {
      name: ab.displayName,
      prefix,
      cooldown: ab.cooldownTag ? `${ab.cooldownTag}` : undefined,
      manaCost: ab.manaCost,
      blockingTags: ab.activationBlockedTags,
      lifecycle: buildLifecycle(ab),
      color: categoryColor(prefix),
    };
  }

  // Add state/damage/input/event tags from parsed tag definitions
  for (const tag of tags) {
    if (map[tag.tagString]) continue; // Already added as ability
    if (tag.category === 'Data') continue; // Skip SetByCaller data tags

    map[tag.tagString] = {
      name: tag.comment,
      prefix: tag.category,
      blockingTags: [],
      lifecycle: [],
      color: categoryColor(tag.category),
    };
  }

  return map;
}

function buildLifecycle(ab: ParsedAbility): string[] {
  const steps: string[] = ['CanActivate', 'CommitAbility'];
  if (ab.manaCost > 0) steps.splice(1, 0, 'CheckMana');
  if (ab.staminaCost !== null) steps.splice(1, 0, 'CheckStamina');
  if (ab.activationOwnedTags.some((t) => t.includes('Invulnerable'))) {
    steps.push('GrantInvuln');
  }
  steps.push('PlayMontage');
  if (ab.baseDamage !== null && ab.baseDamage > 0) {
    if (ab.explosionRadius !== null || ab.className.includes('Fireball')) {
      steps.push('SpawnProjectile');
    } else if (ab.aoERadius !== null) {
      steps.push('AoEOverlap');
    }
    steps.push('ApplyDamage');
  }
  steps.push('EndAbility');
  return steps;
}

/** Build TAG_USAGE_FREQUENCY from parsed data (count how many abilities reference each tag) */
export function buildLiveTagUsageFrequency(abilities: ParsedAbility[], tags: ParsedTag[]) {
  const counts = new Map<string, number>();

  for (const ab of abilities) {
    const allTags = [
      ab.abilityTag,
      ab.cooldownTag,
      ...ab.activationOwnedTags,
      ...ab.activationBlockedTags,
    ].filter(Boolean) as string[];

    for (const t of allTags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** Build CORE_ATTRIBUTES and DERIVED_ATTRIBUTES from Data.Init.* tags */
export function buildLiveAttributes(tags: ParsedTag[]) {
  const initTags = tags.filter((t) => t.tagString.startsWith('Data.Init.'));
  const core: string[] = [];
  const derived: string[] = [];

  const CORE_SET = new Set(['Health', 'MaxHealth', 'Mana', 'MaxMana', 'Strength', 'Dexterity', 'Intelligence']);

  for (const tag of initTags) {
    const attrName = tag.tagString.replace('Data.Init.', '');
    if (CORE_SET.has(attrName)) {
      core.push(attrName);
    } else {
      derived.push(attrName);
    }
  }

  return {
    core: core.length > 0 ? core : CORE_ATTRIBUTES,
    derived: derived.length > 0 ? derived : DERIVED_ATTRIBUTES,
  };
}

/** Build COMBO_ABILITIES with real values from parsed abilities (damage, manaCost) */
export function buildLiveComboAbilities(
  abilities: ParsedAbility[],
  fallback: ComboAbility[]
): ComboAbility[] {
  // Map parsed ability class names to combo ability ids
  const classToComboId: Record<string, string> = {
    UGA_MeleeAttack: 'melee1',
    UGA_DashStrike: 'dash',
    UGA_GroundSlam: 'slam',
    UGA_Fireball: 'fireball',
    UGA_WarCry: 'warcry',
    UGA_Dodge: 'dodge',
  };

  const parsedMap = new Map<string, ParsedAbility>();
  for (const ab of abilities) {
    const comboId = classToComboId[ab.className];
    if (comboId) parsedMap.set(comboId, ab);
  }

  return fallback.map((combo) => {
    const parsed = parsedMap.get(combo.id);
    if (!parsed) return combo;

    return {
      ...combo,
      damage: parsed.baseDamage ?? combo.damage,
      manaCost: parsed.manaCost,
      tag: parsed.abilityTag ?? combo.tag,
    };
  });
}
