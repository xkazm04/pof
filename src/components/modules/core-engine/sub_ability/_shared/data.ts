import type { RadarDataPoint, TimelineEvent } from '@/types/unique-tab-improvements';
import {
  ACCENT_CYAN, ACCENT_EMERALD_DARK, ACCENT_GREEN, ACCENT_ORANGE,
  ACCENT_PINK, ACCENT_PURPLE_BOLD, ACCENT_RED, ACCENT_VIOLET,
  HEATMAP_STEP_1, MODULE_COLORS, STATUS_INFO, STATUS_STALE, STATUS_WARNING,
} from '@/lib/chart-colors';
import type { ParsedUE5Data, ParsedTag, ParsedAbility } from '@/lib/ue5-source-parser';
import type { EntityMetadata } from '@/types/game-metadata';

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
      { name: 'Ability.Force.Push' },
      { name: 'Ability.Force.Lightning' },
      { name: 'Ability.Force.Heal' },
      { name: 'Ability.Force.Wave' },
      { name: 'Ability.Force.MindTrick' },
      { name: 'Ability.Force.DeathField' },
      { name: 'Ability.Saber.Throw' },
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
  {
    id: 'force-push', name: 'Force Push', damage: 80, manaCost: 30, cooldown: 8,
    animDuration: 0.8, damageWindow: [0.3, 0.5], recovery: 0.3,
    color: STATUS_INFO, tag: 'Ability.Force.Push',
    comboMultiplier: 1.2, damageType: 'Physical',
  },
  {
    id: 'force-lightning', name: 'Force Lightning', damage: 200, manaCost: 50, cooldown: 12,
    animDuration: 2.0, damageWindow: [0.5, 1.8], recovery: 0.2,
    color: ACCENT_VIOLET, tag: 'Ability.Force.Lightning',
    comboMultiplier: 0.8, damageType: 'Lightning',
  },
  {
    id: 'force-heal', name: 'Force Heal', damage: 0, manaCost: 40, cooldown: 20,
    animDuration: 1.5, damageWindow: [0.5, 1.2], recovery: 0.3,
    color: ACCENT_GREEN, tag: 'Ability.Force.Heal',
    comboMultiplier: 0, damageType: 'None',
  },
  {
    id: 'saber-throw', name: 'Lightsaber Throw', damage: 120, manaCost: 15, cooldown: 10,
    animDuration: 1.2, damageWindow: [0.3, 0.9], recovery: 0.3,
    color: STATUS_WARNING, tag: 'Ability.Saber.Throw',
    comboMultiplier: 1.5, damageType: 'Physical',
  },
  {
    id: 'force-wave', name: 'Force Wave', damage: 180, manaCost: 40, cooldown: 15,
    animDuration: 0.5, damageWindow: [0.2, 0.4], recovery: 0.1,
    color: ACCENT_CYAN, tag: 'Ability.Force.Wave',
    comboMultiplier: 1.0, damageType: 'Physical',
  },
  {
    id: 'mind-trick', name: 'Mind Trick', damage: 0, manaCost: 35, cooldown: 18,
    animDuration: 0.8, damageWindow: [0.3, 0.6], recovery: 0.2,
    color: ACCENT_PINK, tag: 'Ability.Force.MindTrick',
    comboMultiplier: 0, damageType: 'None',
  },
  {
    id: 'death-field', name: 'Death Field', damage: 240, manaCost: 55, cooldown: 20,
    animDuration: 0.6, damageWindow: [0.2, 0.5], recovery: 0.1,
    color: HEATMAP_STEP_1, tag: 'Ability.Force.DeathField',
    comboMultiplier: 0.7, damageType: 'Fire',
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
  { id: 'kotor-force-chain', name: 'KOTOR Force Chain', abilities: ['force-push', 'saber-throw', 'force-lightning'] },
  { id: 'kotor-dark-side', name: 'Dark Side Burst', abilities: ['force-lightning', 'death-field', 'force-wave'] },
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

/* ── Entity Metadata ─────────────────────────────────────────────────────── */

function abilityCategory(a: ComboAbility): string {
  if (a.tag.startsWith('Ability.Force')) return 'Force';
  if (a.tag.startsWith('Ability.Saber')) return 'Ranged'; // thrown projectile
  if (a.tag.startsWith('Ability.Melee')) return 'Melee';
  if (a.tag === 'Ability.DashStrike') return 'Melee';
  if (a.tag === 'Ability.GroundSlam') return 'Melee';
  if (a.tag === 'Ability.Dodge') return 'Defensive';
  if (a.tag === 'Ability.WarCry') return 'Defensive';
  if (a.tag === 'Ability.Fireball') return 'Ranged';
  return 'Melee';
}

export const ABILITY_METADATA: EntityMetadata[] = COMBO_ABILITIES.map(a => ({
  id: a.id,
  name: a.name,
  category: abilityCategory(a),
  subcategory: a.damageType !== 'None' ? a.damageType : undefined,
  tags: [
    ...(a.damageType !== 'None' ? [a.damageType.toLowerCase()] : []),
    ...(a.manaCost > 0 ? ['costs-mana'] : ['free']),
    ...(a.cooldown > 5 ? ['long-cd'] : a.cooldown > 0 ? ['short-cd'] : ['no-cd']),
    ...(a.damage > 0 ? ['offensive'] : ['utility']),
  ],
  tier: a.damage >= 150 ? 'Ultimate' : a.damage >= 50 ? 'Power' : a.damage > 0 ? 'Basic' : 'Utility',
}));

/* ═══════════════════════════════════════════════════════════════════════════
 * Expanded Ability Catalog — Spellbook Scaling (100+ abilities)
 * ═══════════════════════════════════════════════════════════════════════════ */

export type AbilityCategory = 'Offensive' | 'Defensive' | 'Utility' | 'Passive' | 'Ultimate';
export type AbilityElement = 'Fire' | 'Ice' | 'Lightning' | 'Shadow' | 'Holy' | 'Physical' | 'Arcane' | 'Nature';
export type AbilityTier = 'basic' | 'advanced' | 'ultimate';

export interface SpellbookAbility {
  [key: string]: unknown;
  id: string;
  name: string;
  category: AbilityCategory;
  element: AbilityElement;
  tier: AbilityTier;
  damage: number;
  manaCost: number;
  cooldown: number;
  /** Normalized 0–1 radar stats: [Damage, Range, AoE, Speed, Efficiency] */
  radar: [number, number, number, number, number];
  description: string;
  color: string;
  tag: string;
}

export const ELEMENT_COLORS: Record<AbilityElement, string> = {
  Fire: ACCENT_RED, Ice: ACCENT_CYAN, Lightning: STATUS_WARNING,
  Shadow: ACCENT_PURPLE_BOLD, Holy: ACCENT_EMERALD_DARK, Physical: ACCENT_ORANGE,
  Arcane: MODULE_COLORS.core, Nature: ACCENT_GREEN,
};

function sa(id: string, n: string, c: AbilityCategory, e: AbilityElement, t: AbilityTier,
  d: number, m: number, cd: number, r: [number, number, number, number, number], desc: string, tag: string): SpellbookAbility {
  return { id, name: n, category: c, element: e, tier: t, damage: d, manaCost: m, cooldown: cd, radar: r, description: desc, color: ELEMENT_COLORS[e], tag };
}

export const SPELLBOOK_ABILITIES: SpellbookAbility[] = [
  // ── Offensive: Fire (5) ──
  sa('off-fire-01', 'Fireball', 'Offensive', 'Fire', 'basic', 35, 20, 3, [0.70, 0.85, 0.30, 0.50, 0.50], 'Hurl a ball of fire', 'Ability.Fire.Fireball'),
  sa('off-fire-02', 'Fire Storm', 'Offensive', 'Fire', 'advanced', 80, 45, 12, [0.80, 0.60, 0.90, 0.25, 0.20], 'Rain fire over an area', 'Ability.Fire.Storm'),
  sa('off-fire-03', 'Meteor Strike', 'Offensive', 'Fire', 'ultimate', 150, 70, 20, [0.95, 0.70, 0.85, 0.15, 0.10], 'Call down a devastating meteor', 'Ability.Fire.Meteor'),
  sa('off-fire-04', 'Blazing Slash', 'Offensive', 'Fire', 'basic', 25, 10, 1.5, [0.50, 0.20, 0.10, 0.85, 0.70], 'Fire-infused melee swing', 'Ability.Fire.BlazingSlash'),
  sa('off-fire-05', 'Flame Lance', 'Offensive', 'Fire', 'advanced', 55, 30, 6, [0.75, 0.90, 0.15, 0.40, 0.35], 'Piercing fire beam', 'Ability.Fire.Lance'),
  // ── Offensive: Ice (5) ──
  sa('off-ice-01', 'Ice Shard', 'Offensive', 'Ice', 'basic', 28, 15, 2, [0.55, 0.80, 0.10, 0.70, 0.65], 'Launch a shard of ice', 'Ability.Ice.Shard'),
  sa('off-ice-02', 'Frost Nova', 'Offensive', 'Ice', 'basic', 40, 25, 8, [0.60, 0.15, 0.80, 0.30, 0.40], 'Freeze enemies around you', 'Ability.Ice.FrostNova'),
  sa('off-ice-03', 'Blizzard', 'Offensive', 'Ice', 'advanced', 90, 50, 15, [0.85, 0.55, 0.95, 0.20, 0.15], 'Devastating ice storm', 'Ability.Ice.Blizzard'),
  sa('off-ice-04', 'Glacial Spike', 'Offensive', 'Ice', 'advanced', 65, 35, 5, [0.75, 0.75, 0.20, 0.50, 0.40], 'Giant ice spike eruption', 'Ability.Ice.GlacialSpike'),
  sa('off-ice-05', 'Frozen Orb', 'Offensive', 'Ice', 'advanced', 45, 30, 7, [0.65, 0.70, 0.60, 0.40, 0.35], 'Slow-moving orb of frost', 'Ability.Ice.FrozenOrb'),
  // ── Offensive: Lightning (4) ──
  sa('off-ltn-01', 'Lightning Bolt', 'Offensive', 'Lightning', 'basic', 30, 18, 2.5, [0.60, 0.90, 0.05, 0.90, 0.55], 'Instant bolt of lightning', 'Ability.Lightning.Bolt'),
  sa('off-ltn-02', 'Chain Lightning', 'Offensive', 'Lightning', 'advanced', 55, 35, 8, [0.65, 0.80, 0.70, 0.60, 0.30], 'Lightning chains between foes', 'Ability.Lightning.Chain'),
  sa('off-ltn-03', 'Thunderstrike', 'Offensive', 'Lightning', 'advanced', 70, 40, 10, [0.80, 0.50, 0.55, 0.45, 0.25], 'Ground-targeted lightning', 'Ability.Lightning.Thunderstrike'),
  sa('off-ltn-04', 'Storm Call', 'Offensive', 'Lightning', 'ultimate', 120, 60, 18, [0.90, 0.40, 0.85, 0.20, 0.10], 'Summon a thunderstorm', 'Ability.Lightning.StormCall'),
  // ── Offensive: Shadow (4) ──
  sa('off-shd-01', 'Shadow Strike', 'Offensive', 'Shadow', 'basic', 32, 15, 2, [0.65, 0.25, 0.05, 0.85, 0.60], 'Strike from the shadows', 'Ability.Shadow.Strike'),
  sa('off-shd-02', 'Dark Pulse', 'Offensive', 'Shadow', 'advanced', 60, 35, 7, [0.70, 0.50, 0.65, 0.40, 0.30], 'Wave of dark energy', 'Ability.Shadow.DarkPulse'),
  sa('off-shd-03', 'Soul Drain', 'Offensive', 'Shadow', 'advanced', 45, 25, 5, [0.55, 0.40, 0.10, 0.50, 0.55], 'Drain life from enemies', 'Ability.Shadow.SoulDrain'),
  sa('off-shd-04', 'Void Blast', 'Offensive', 'Shadow', 'advanced', 75, 40, 9, [0.80, 0.65, 0.45, 0.35, 0.25], 'Blast of void energy', 'Ability.Shadow.VoidBlast'),
  // ── Offensive: Physical (5) ──
  sa('off-phy-01', 'Melee Attack', 'Offensive', 'Physical', 'basic', 20, 0, 0.5, [0.40, 0.15, 0.05, 0.95, 0.90], 'Basic melee swing', 'Ability.Melee.LightAttack'),
  sa('off-phy-02', 'Heavy Attack', 'Offensive', 'Physical', 'basic', 35, 0, 0.9, [0.65, 0.20, 0.10, 0.60, 0.85], 'Powerful melee strike', 'Ability.Melee.HeavyAttack'),
  sa('off-phy-03', 'Dash Strike', 'Offensive', 'Physical', 'basic', 40, 25, 5, [0.60, 0.55, 0.05, 0.80, 0.45], 'Dash forward and strike', 'Ability.DashStrike'),
  sa('off-phy-04', 'Ground Slam', 'Offensive', 'Physical', 'advanced', 50, 30, 6, [0.70, 0.20, 0.70, 0.35, 0.40], 'Slam the ground with a shockwave', 'Ability.GroundSlam'),
  sa('off-phy-05', 'Cleave', 'Offensive', 'Physical', 'basic', 30, 10, 1, [0.55, 0.25, 0.40, 0.75, 0.70], 'Wide sweeping attack', 'Ability.Melee.Cleave'),
  // ── Offensive: Holy (3) ──
  sa('off-hly-01', 'Smite', 'Offensive', 'Holy', 'basic', 30, 20, 3, [0.60, 0.80, 0.15, 0.55, 0.50], 'Strike with divine power', 'Ability.Holy.Smite'),
  sa('off-hly-02', 'Divine Hammer', 'Offensive', 'Holy', 'advanced', 55, 35, 8, [0.75, 0.30, 0.50, 0.40, 0.35], 'Summon a hammer of light', 'Ability.Holy.DivineHammer'),
  sa('off-hly-03', 'Sacred Arrow', 'Offensive', 'Holy', 'advanced', 48, 28, 4, [0.65, 0.95, 0.05, 0.65, 0.45], 'Holy arrow seeking foes', 'Ability.Holy.SacredArrow'),
  // ── Defensive (12) ──
  sa('def-phy-01', 'Parry', 'Defensive', 'Physical', 'basic', 0, 0, 1.5, [0.00, 0.00, 0.00, 0.95, 0.90], 'Deflect incoming melee attack', 'Ability.Melee.Parry'),
  sa('def-phy-02', 'Block', 'Defensive', 'Physical', 'basic', 0, 5, 0.5, [0.00, 0.00, 0.00, 0.90, 0.80], 'Raise shield to block damage', 'Ability.Shield.Block'),
  sa('def-phy-03', 'Dodge', 'Defensive', 'Physical', 'basic', 0, 0, 1, [0.00, 0.00, 0.00, 0.95, 0.85], 'Quick evasive roll', 'Ability.Dodge'),
  sa('def-ice-01', 'Ice Shield', 'Defensive', 'Ice', 'basic', 0, 25, 15, [0.00, 0.00, 0.20, 0.30, 0.40], 'Shield of ice absorbs damage', 'Ability.Ice.Shield'),
  sa('def-ice-02', 'Frost Armor', 'Defensive', 'Ice', 'advanced', 0, 35, 20, [0.00, 0.00, 0.10, 0.25, 0.35], 'Encase yourself in frost armor', 'Ability.Ice.FrostArmor'),
  sa('def-fire-01', 'Fire Ward', 'Defensive', 'Fire', 'basic', 0, 20, 12, [0.00, 0.00, 0.15, 0.30, 0.45], 'Ward absorbing fire damage', 'Ability.Fire.Ward'),
  sa('def-fire-02', 'Flame Cloak', 'Defensive', 'Fire', 'advanced', 10, 30, 18, [0.15, 0.00, 0.30, 0.25, 0.30], 'Cloak of fire damages melee attackers', 'Ability.Fire.Cloak'),
  sa('def-shd-01', 'Shadow Cloak', 'Defensive', 'Shadow', 'basic', 0, 20, 10, [0.00, 0.00, 0.00, 0.70, 0.55], 'Become harder to hit', 'Ability.Shadow.Cloak'),
  sa('def-shd-02', 'Phase Shift', 'Defensive', 'Shadow', 'advanced', 0, 30, 15, [0.00, 0.00, 0.00, 0.80, 0.40], 'Phase through attacks briefly', 'Ability.Shadow.PhaseShift'),
  sa('def-hly-01', 'Holy Shield', 'Defensive', 'Holy', 'basic', 0, 25, 14, [0.00, 0.00, 0.20, 0.35, 0.40], 'Divine shield absorbing damage', 'Ability.Holy.Shield'),
  sa('def-hly-02', 'Sanctum', 'Defensive', 'Holy', 'advanced', 0, 40, 25, [0.00, 0.00, 0.60, 0.20, 0.25], 'Create a protective sanctuary', 'Ability.Holy.Sanctum'),
  sa('def-arc-01', 'Mana Barrier', 'Defensive', 'Arcane', 'advanced', 0, 40, 20, [0.00, 0.00, 0.15, 0.25, 0.30], 'Convert mana to absorb damage', 'Ability.Arcane.ManaBarrier'),
  // ── Utility (13) ──
  sa('utl-phy-01', 'War Cry', 'Utility', 'Physical', 'basic', 0, 15, 25, [0.00, 0.00, 0.40, 0.50, 0.55], 'Buff allies and debuff enemies', 'Ability.WarCry'),
  sa('utl-phy-02', 'Grapple', 'Utility', 'Physical', 'basic', 10, 10, 4, [0.15, 0.50, 0.00, 0.70, 0.60], 'Pull an enemy closer', 'Ability.Melee.Grapple'),
  sa('utl-arc-01', 'Blink', 'Utility', 'Arcane', 'basic', 0, 20, 5, [0.00, 0.00, 0.00, 0.95, 0.60], 'Teleport a short distance', 'Ability.Arcane.Blink'),
  sa('utl-arc-02', 'Haste', 'Utility', 'Arcane', 'basic', 0, 15, 20, [0.00, 0.00, 0.00, 0.80, 0.55], 'Increase movement and attack speed', 'Ability.Arcane.Haste'),
  sa('utl-arc-03', 'Dispel', 'Utility', 'Arcane', 'advanced', 0, 25, 8, [0.00, 0.60, 0.30, 0.60, 0.45], 'Remove magical effects', 'Ability.Arcane.Dispel'),
  sa('utl-shd-01', 'Mind Trick', 'Utility', 'Shadow', 'advanced', 0, 35, 18, [0.00, 0.60, 0.00, 0.40, 0.30], 'Confuse a target', 'Ability.Force.MindTrick'),
  sa('utl-shd-02', 'Stealth', 'Utility', 'Shadow', 'basic', 0, 20, 15, [0.00, 0.00, 0.00, 0.60, 0.55], 'Become invisible briefly', 'Ability.Shadow.Stealth'),
  sa('utl-nat-01', 'Trap', 'Utility', 'Nature', 'basic', 15, 15, 8, [0.20, 0.00, 0.20, 0.30, 0.60], 'Place a trap that snares enemies', 'Ability.Nature.Trap'),
  sa('utl-nat-02', 'Lure', 'Utility', 'Nature', 'basic', 0, 10, 6, [0.00, 0.80, 0.00, 0.50, 0.70], 'Attract enemies to a point', 'Ability.Nature.Lure'),
  sa('utl-nat-03', 'Scout Drone', 'Utility', 'Nature', 'advanced', 0, 20, 30, [0.00, 0.95, 0.00, 0.30, 0.40], 'Deploy a scouting drone', 'Ability.Nature.Scout'),
  sa('utl-ltn-01', 'Overcharge', 'Utility', 'Lightning', 'advanced', 0, 30, 20, [0.00, 0.00, 0.10, 0.50, 0.35], 'Supercharge your next ability', 'Ability.Lightning.Overcharge'),
  sa('utl-hly-01', 'Purify', 'Utility', 'Holy', 'basic', 0, 20, 10, [0.00, 0.40, 0.20, 0.50, 0.50], 'Remove debuffs from allies', 'Ability.Holy.Purify'),
  sa('utl-hly-02', 'Beacon', 'Utility', 'Holy', 'advanced', 0, 30, 25, [0.00, 0.00, 0.50, 0.20, 0.35], 'Place a healing beacon', 'Ability.Holy.Beacon'),
  // ── Passive (12) ──
  sa('pas-phy-01', 'Critical Mastery', 'Passive', 'Physical', 'basic', 0, 0, 0, [0.30, 0.00, 0.00, 0.00, 0.90], 'Increase crit chance and damage', 'Passive.CritMastery'),
  sa('pas-phy-02', 'Armor Boost', 'Passive', 'Physical', 'basic', 0, 0, 0, [0.00, 0.00, 0.00, 0.00, 0.85], 'Increase armor rating', 'Passive.ArmorBoost'),
  sa('pas-phy-03', 'Lifesteal', 'Passive', 'Physical', 'advanced', 0, 0, 0, [0.20, 0.00, 0.00, 0.00, 0.80], 'Recover HP on hit', 'Passive.Lifesteal'),
  sa('pas-arc-01', 'Mana Regen', 'Passive', 'Arcane', 'basic', 0, 0, 0, [0.00, 0.00, 0.00, 0.00, 0.95], 'Increase mana regeneration', 'Passive.ManaRegen'),
  sa('pas-arc-02', 'Spell Echo', 'Passive', 'Arcane', 'advanced', 0, 0, 0, [0.15, 0.00, 0.00, 0.20, 0.70], 'Chance to cast spells twice', 'Passive.SpellEcho'),
  sa('pas-arc-03', 'Cooldown Mastery', 'Passive', 'Arcane', 'advanced', 0, 0, 0, [0.00, 0.00, 0.00, 0.30, 0.80], 'Reduce all cooldowns', 'Passive.CooldownMastery'),
  sa('pas-nat-01', 'Health Regen', 'Passive', 'Nature', 'basic', 0, 0, 0, [0.00, 0.00, 0.00, 0.00, 0.90], 'Passive health regeneration', 'Passive.HealthRegen'),
  sa('pas-nat-02', 'Thorns', 'Passive', 'Nature', 'basic', 5, 0, 0, [0.10, 0.00, 0.00, 0.00, 0.85], 'Reflect damage to melee attackers', 'Passive.Thorns'),
  sa('pas-fire-01', 'Burning Soul', 'Passive', 'Fire', 'advanced', 0, 0, 0, [0.25, 0.00, 0.15, 0.00, 0.75], 'Fire abilities deal more damage', 'Passive.BurningSoul'),
  sa('pas-ice-01', 'Frost Aura', 'Passive', 'Ice', 'advanced', 0, 0, 0, [0.05, 0.00, 0.30, 0.00, 0.80], 'Slow nearby enemies', 'Passive.FrostAura'),
  sa('pas-shd-01', 'Shadow Step', 'Passive', 'Shadow', 'basic', 0, 0, 0, [0.00, 0.00, 0.00, 0.40, 0.85], 'Move faster while in stealth', 'Passive.ShadowStep'),
  sa('pas-hly-01', 'Healing Touch', 'Passive', 'Holy', 'basic', 0, 0, 0, [0.00, 0.00, 0.00, 0.00, 0.90], 'Increase healing received', 'Passive.HealingTouch'),
  // ── Ultimate (6) ──
  sa('ult-fire-01', 'Apocalypse', 'Ultimate', 'Fire', 'ultimate', 200, 80, 60, [1.00, 0.50, 1.00, 0.10, 0.05], 'Devastating fire apocalypse', 'Ability.Fire.Apocalypse'),
  sa('ult-ice-01', 'Absolute Zero', 'Ultimate', 'Ice', 'ultimate', 180, 75, 55, [0.95, 0.40, 0.95, 0.10, 0.05], 'Freeze everything in range', 'Ability.Ice.AbsoluteZero'),
  sa('ult-ltn-01', 'Thundergods Wrath', 'Ultimate', 'Lightning', 'ultimate', 160, 70, 50, [0.90, 1.00, 0.80, 0.15, 0.10], 'Call down divine lightning', 'Ability.Lightning.ThundergodWrath'),
  sa('ult-shd-01', 'Death Field', 'Ultimate', 'Shadow', 'ultimate', 240, 90, 65, [1.00, 0.35, 0.85, 0.05, 0.03], 'Create a field of death', 'Ability.Force.DeathField'),
  sa('ult-hly-01', 'Divine Intervention', 'Ultimate', 'Holy', 'ultimate', 0, 100, 120, [0.00, 0.00, 1.00, 0.05, 0.02], 'Heal and protect all allies', 'Ability.Holy.DivineIntervention'),
  sa('ult-arc-01', 'Time Stop', 'Ultimate', 'Arcane', 'ultimate', 0, 85, 90, [0.00, 0.00, 1.00, 0.05, 0.03], 'Freeze time for all enemies', 'Ability.Arcane.TimeStop'),
];

export const SPELLBOOK_ABILITY_MAP = new Map(SPELLBOOK_ABILITIES.map(a => [a.id, a]));

/* ── Expanded Gameplay Effects (paginated) ────────────────────────────── */

export type EffectDurationType = 'Instant' | 'Duration' | 'Periodic' | 'Infinite';

export interface GameplayEffectEntry {
  id: string;
  name: string;
  type: EffectDurationType;
  description: string;
  magnitude: number;
  duration?: number;
  period?: number;
  color: string;
  tag: string;
}

export const EXPANDED_EFFECTS: GameplayEffectEntry[] = [
  // Instant (7)
  { id: 'ge-01', name: 'GE_DirectDamage', type: 'Instant', description: 'Apply direct damage to target', magnitude: 50, color: ACCENT_RED, tag: 'GE.Damage.Direct' },
  { id: 'ge-02', name: 'GE_InstantHeal', type: 'Instant', description: 'Instantly restore health', magnitude: 40, color: ACCENT_GREEN, tag: 'GE.Heal.Instant' },
  { id: 'ge-03', name: 'GE_ManaRestore', type: 'Instant', description: 'Instantly restore mana', magnitude: 30, color: MODULE_COLORS.core, tag: 'GE.Mana.Restore' },
  { id: 'ge-04', name: 'GE_Dispel', type: 'Instant', description: 'Remove all debuffs from target', magnitude: 0, color: ACCENT_CYAN, tag: 'GE.Dispel' },
  { id: 'ge-05', name: 'GE_Execute', type: 'Instant', description: 'Execute low-health enemies', magnitude: 999, color: ACCENT_RED, tag: 'GE.Damage.Execute' },
  { id: 'ge-06', name: 'GE_Resurrect', type: 'Instant', description: 'Revive a fallen ally', magnitude: 50, color: ACCENT_EMERALD_DARK, tag: 'GE.Resurrect' },
  { id: 'ge-07', name: 'GE_Knockback', type: 'Instant', description: 'Push enemy backward', magnitude: 15, color: ACCENT_ORANGE, tag: 'GE.Force.Knockback' },
  // Duration (10)
  { id: 'ge-08', name: 'GE_AttackBuff', type: 'Duration', description: 'Increase attack power', magnitude: 25, duration: 10, color: ACCENT_RED, tag: 'GE.Buff.Attack' },
  { id: 'ge-09', name: 'GE_DefenseBuff', type: 'Duration', description: 'Increase armor rating', magnitude: 30, duration: 8, color: MODULE_COLORS.core, tag: 'GE.Buff.Defense' },
  { id: 'ge-10', name: 'GE_SpeedBuff', type: 'Duration', description: 'Increase movement speed', magnitude: 20, duration: 5, color: ACCENT_CYAN, tag: 'GE.Buff.Speed' },
  { id: 'ge-11', name: 'GE_IceShield', type: 'Duration', description: 'Absorb incoming damage', magnitude: 100, duration: 12, color: ACCENT_CYAN, tag: 'GE.Shield.Ice' },
  { id: 'ge-12', name: 'GE_Slow', type: 'Duration', description: 'Reduce enemy movement speed', magnitude: 30, duration: 4, color: ACCENT_CYAN, tag: 'GE.Debuff.Slow' },
  { id: 'ge-13', name: 'GE_Stun', type: 'Duration', description: 'Prevent all actions', magnitude: 0, duration: 2, color: STATUS_WARNING, tag: 'GE.CC.Stun' },
  { id: 'ge-14', name: 'GE_Invulnerable', type: 'Duration', description: 'Immune to all damage', magnitude: 0, duration: 3, color: ACCENT_EMERALD_DARK, tag: 'GE.Buff.Invulnerable' },
  { id: 'ge-15', name: 'GE_Silence', type: 'Duration', description: 'Prevent ability casting', magnitude: 0, duration: 3, color: ACCENT_PURPLE_BOLD, tag: 'GE.CC.Silence' },
  { id: 'ge-16', name: 'GE_Blind', type: 'Duration', description: 'Reduce accuracy', magnitude: 50, duration: 4, color: STATUS_STALE, tag: 'GE.CC.Blind' },
  { id: 'ge-17', name: 'GE_Fear', type: 'Duration', description: 'Force target to flee', magnitude: 0, duration: 3, color: ACCENT_PURPLE_BOLD, tag: 'GE.CC.Fear' },
  // Periodic (8)
  { id: 'ge-18', name: 'GE_HealthRegen', type: 'Periodic', description: 'Restore health every tick', magnitude: 5, duration: 10, period: 1, color: ACCENT_GREEN, tag: 'GE.Regen.Health' },
  { id: 'ge-19', name: 'GE_ManaRegen', type: 'Periodic', description: 'Restore mana every tick', magnitude: 3, duration: 10, period: 1, color: MODULE_COLORS.core, tag: 'GE.Regen.Mana' },
  { id: 'ge-20', name: 'GE_Burn', type: 'Periodic', description: 'Fire damage over time', magnitude: 8, duration: 6, period: 1, color: ACCENT_RED, tag: 'GE.DoT.Burn' },
  { id: 'ge-21', name: 'GE_Poison', type: 'Periodic', description: 'Nature damage over time', magnitude: 6, duration: 8, period: 2, color: ACCENT_GREEN, tag: 'GE.DoT.Poison' },
  { id: 'ge-22', name: 'GE_Bleed', type: 'Periodic', description: 'Physical damage over time', magnitude: 10, duration: 5, period: 1, color: ACCENT_RED, tag: 'GE.DoT.Bleed' },
  { id: 'ge-23', name: 'GE_Frostbite', type: 'Periodic', description: 'Ice damage + slow over time', magnitude: 4, duration: 6, period: 1.5, color: ACCENT_CYAN, tag: 'GE.DoT.Frostbite' },
  { id: 'ge-24', name: 'GE_Shock', type: 'Periodic', description: 'Shock damage each tick', magnitude: 12, duration: 4, period: 0.5, color: STATUS_WARNING, tag: 'GE.DoT.Shock' },
  { id: 'ge-25', name: 'GE_ShadowDecay', type: 'Periodic', description: 'Shadow damage over time', magnitude: 7, duration: 8, period: 2, color: ACCENT_PURPLE_BOLD, tag: 'GE.DoT.ShadowDecay' },
  // Infinite (5)
  { id: 'ge-26', name: 'GE_PassiveRegen', type: 'Infinite', description: 'Constant health regeneration', magnitude: 2, period: 1, color: ACCENT_EMERALD_DARK, tag: 'GE.Passive.Regen' },
  { id: 'ge-27', name: 'GE_ThornsAura', type: 'Infinite', description: 'Reflect melee damage', magnitude: 5, color: ACCENT_ORANGE, tag: 'GE.Passive.Thorns' },
  { id: 'ge-28', name: 'GE_DamageAura', type: 'Infinite', description: 'Nearby enemies take damage', magnitude: 3, period: 2, color: ACCENT_RED, tag: 'GE.Passive.DamageAura' },
  { id: 'ge-29', name: 'GE_ManaShield', type: 'Infinite', description: 'Convert damage to mana cost', magnitude: 30, color: MODULE_COLORS.core, tag: 'GE.Passive.ManaShield' },
  { id: 'ge-30', name: 'GE_Berserker', type: 'Infinite', description: 'Deal and take more damage', magnitude: 20, color: ACCENT_RED, tag: 'GE.Passive.Berserker' },
];

export const EFFECT_TYPE_COLORS: Record<EffectDurationType, string> = {
  Instant: ACCENT_RED, Duration: MODULE_COLORS.core, Periodic: ACCENT_GREEN, Infinite: ACCENT_PURPLE_BOLD,
};

/* ── Expanded Attributes (24 total) ───────────────────────────────────── */

export const ALL_CORE_ATTRIBUTES = [
  'Health', 'MaxHealth', 'Mana', 'MaxMana', 'Stamina',
  'Strength', 'Dexterity', 'Intelligence', 'Vitality',
  'Willpower', 'Faith', 'Luck',
];

export const ALL_DERIVED_ATTRIBUTES = [
  'Armor', 'AttackPower', 'SpellPower', 'CritChance', 'CritDamage',
  'Evasion', 'BlockChance', 'HealPower', 'CooldownReduction',
  'ManaRegen', 'HealthRegen', 'Resistance', 'MovementSpeed',
];
