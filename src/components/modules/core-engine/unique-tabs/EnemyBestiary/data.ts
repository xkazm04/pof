import { Skull, Crosshair, Shield, Swords } from 'lucide-react';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { ENEMY_ARCHETYPES } from '@/lib/combat/definitions';
import type { EnemyArchetype } from '@/types/combat-simulator';
import {
  ACCENT_RED, ACCENT_CYAN, ACCENT_PURPLE, ACCENT_EMERALD,
  STATUS_WARNING, STATUS_INFO, ACCENT_ORANGE, ACCENT_PINK,
  STATUS_SUCCESS, STATUS_NEUTRAL, STATUS_SUBDUED,
  MODULE_COLORS, ACCENT_PURPLE_BOLD,
} from '@/lib/chart-colors';

/* ── Archetype definitions ─────────────────────────────────────────────── */

export type EnemyRole = 'melee' | 'ranged' | 'tank';

export interface ArchetypeConfig {
  id: string;
  label: string;
  icon: typeof Skull;
  color: string;
  class: string;
  role: EnemyRole;
  stats: { label: string; value: number }[];
  abilities: string[];
  btSummary: Record<string, string>;
  featureName: string;
}

export type GroupBy = 'none' | 'class' | 'role';

/* ── UI metadata per combat archetype ID ─────────────────────────────── */

interface ArchetypeUIMeta {
  icon: typeof Skull;
  color: string;
  class: string;
  role: EnemyRole;
  btSummary: Record<string, string>;
  featureName: string;
}

const UI_META: Record<string, ArchetypeUIMeta> = {
  'melee-grunt': {
    icon: Skull,
    color: ACCENT_RED,
    class: 'Warrior',
    role: 'melee',
    btSummary: {
      Idle: 'Stand and look around',
      Patrol: 'Walk waypoint path',
      Chase: 'Sprint to player',
      Attack: 'Melee combo swing',
    },
    featureName: 'Enemy archetypes',
  },
  'ranged-caster': {
    icon: Crosshair,
    color: ACCENT_PURPLE_BOLD,
    class: 'Mage',
    role: 'ranged',
    btSummary: {
      Idle: 'Scan for threats',
      Patrol: 'Float between positions',
      Chase: 'Maintain safe distance',
      Attack: 'Cast ranged projectile',
    },
    featureName: 'Enemy archetypes',
  },
  'brute': {
    icon: Shield,
    color: MODULE_COLORS.content,
    class: 'Tank',
    role: 'melee',
    btSummary: {
      Idle: 'Guard assigned area',
      Patrol: 'Slow stomp circuit',
      Chase: 'Charge with knockback',
      Attack: 'Ground slam AoE',
    },
    featureName: 'Enemy archetypes',
  },
  'elite-knight': {
    icon: Swords,
    color: MODULE_COLORS.core,
    class: 'Elite',
    role: 'melee',
    btSummary: {
      Idle: 'Guard post vigilantly',
      Patrol: 'Precise patrol route',
      Chase: 'Measured pursuit',
      Attack: 'Slash and shield bash',
    },
    featureName: 'Enemy archetypes',
  },
};

/* ── Derive normalized stats & radar from combat data ────────────────── */

const maxHp = Math.max(...ENEMY_ARCHETYPES.map(a => a.baseAttributes.maxHealth));
const maxAp = Math.max(...ENEMY_ARCHETYPES.map(a => a.baseAttributes.attackPower));
const maxDex = Math.max(...ENEMY_ARCHETYPES.map(a => a.baseAttributes.dexterity));
const maxRange = Math.max(...ENEMY_ARCHETYPES.map(a => a.aggroRange));
const maxArmor = Math.max(...ENEMY_ARCHETYPES.map(a => a.baseAttributes.armor));
const maxIntel = Math.max(...ENEMY_ARCHETYPES.map(a => a.baseAttributes.intelligence));
const minInterval = Math.min(...ENEMY_ARCHETYPES.map(a => a.attackIntervalSec));

function deriveStats(arch: EnemyArchetype): { label: string; value: number }[] {
  return [
    { label: 'HP', value: Math.round(arch.baseAttributes.maxHealth / maxHp * 100) },
    { label: 'Damage', value: Math.round(arch.baseAttributes.attackPower / maxAp * 100) },
    { label: 'Speed', value: Math.round(arch.baseAttributes.dexterity / maxDex * 100) },
    { label: 'Range', value: Math.round(arch.aggroRange / maxRange * 100) },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function deriveRadar(arch: EnemyArchetype): RadarDataPoint[] {
  return [
    { axis: 'HP', value: round2(arch.baseAttributes.maxHealth / maxHp) },
    { axis: 'Damage', value: round2(arch.baseAttributes.attackPower / maxAp) },
    { axis: 'Speed', value: round2(arch.baseAttributes.dexterity / maxDex) },
    { axis: 'Range', value: round2(arch.aggroRange / maxRange) },
    { axis: 'Aggression', value: round2(minInterval / arch.attackIntervalSec) },
    { axis: 'Resilience', value: round2(arch.baseAttributes.armor / maxArmor * 0.5 + arch.baseAttributes.maxHealth / maxHp * 0.5) },
    { axis: 'Intelligence', value: round2(arch.baseAttributes.intelligence / maxIntel) },
  ];
}

/* ── Build unified ARCHETYPES from combat source ─────────────────────── */

export const ARCHETYPES: ArchetypeConfig[] = ENEMY_ARCHETYPES
  .filter(arch => UI_META[arch.id])
  .map(arch => {
    const meta = UI_META[arch.id];
    return {
      id: arch.id,
      label: arch.name,
      icon: meta.icon,
      color: meta.color,
      class: meta.class,
      role: meta.role,
      stats: deriveStats(arch),
      abilities: arch.abilities.map(a => a.name),
      btSummary: meta.btSummary,
      featureName: meta.featureName,
    };
  });

/* ── Elite Modifier System ────────────────────────────────────────────── */

export interface StatModifier {
  stat: string;
  /** Multiplicative: 1.5 = +50%, 0.8 = -20%. Additive values use flat field. */
  mult?: number;
  flat?: number;
  label: string;
}

export interface EliteModifier {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  tier: 'minor' | 'major' | 'legendary';
  statMods: StatModifier[];
  /** UE5 GameplayEffect class name */
  geClass: string;
  /** Incompatible modifier IDs */
  excludes?: string[];
}

export const ELITE_MODIFIERS: EliteModifier[] = [
  {
    id: 'enraged', name: 'Enraged', color: ACCENT_RED, icon: '\u{1F525}',
    description: 'Berserk fury — deals more damage but takes more hits', tier: 'major',
    statMods: [
      { stat: 'Damage', mult: 1.5, label: '+50% Damage' },
      { stat: 'Speed', mult: 1.2, label: '+20% Speed' },
      { stat: 'HP', mult: 0.8, label: '-20% HP' },
    ],
    geClass: 'GE_Elite_Enraged', excludes: ['pacified'],
  },
  {
    id: 'shielded', name: 'Shielded', color: ACCENT_CYAN, icon: '\u{1F6E1}\u{FE0F}',
    description: 'Absorbs all damage until shield HP is depleted', tier: 'major',
    statMods: [
      { stat: 'HP', flat: 30, label: '+30 Shield HP' },
      { stat: 'Speed', mult: 0.9, label: '-10% Speed' },
    ],
    geClass: 'GE_Elite_Shielded',
  },
  {
    id: 'vampiric', name: 'Vampiric', color: ACCENT_PURPLE, icon: '\u{1F9DB}',
    description: 'Heals on each successful hit against the player', tier: 'major',
    statMods: [
      { stat: 'HP', mult: 0.85, label: '-15% HP' },
      { stat: 'Damage', mult: 1.1, label: '+10% Damage' },
    ],
    geClass: 'GE_Elite_Vampiric',
  },
  {
    id: 'bolstered', name: 'Bolstered', color: ACCENT_EMERALD, icon: '\u{1F4AA}',
    description: 'Heavily armored — takes reduced damage from all sources', tier: 'minor',
    statMods: [
      { stat: 'HP', mult: 1.4, label: '+40% HP' },
      { stat: 'Speed', mult: 0.85, label: '-15% Speed' },
    ],
    geClass: 'GE_Elite_Bolstered',
  },
  {
    id: 'arcane', name: 'Arcane', color: STATUS_INFO, icon: '\u{2728}',
    description: 'Empowered by arcane energy — increased crit and range', tier: 'minor',
    statMods: [
      { stat: 'Range', mult: 1.3, label: '+30% Range' },
      { stat: 'Damage', mult: 1.15, label: '+15% Damage' },
    ],
    geClass: 'GE_Elite_Arcane',
  },
  {
    id: 'molten', name: 'Molten', color: ACCENT_ORANGE, icon: '\u{1F30B}',
    description: 'Leaves fire trail on death — area denial on kill', tier: 'minor',
    statMods: [
      { stat: 'HP', mult: 1.15, label: '+15% HP' },
      { stat: 'Damage', mult: 1.1, label: '+10% Damage' },
    ],
    geClass: 'GE_Elite_Molten',
  },
  {
    id: 'swift', name: 'Swift', color: STATUS_WARNING, icon: '\u{26A1}',
    description: 'Extremely fast — closes distance quickly', tier: 'minor',
    statMods: [
      { stat: 'Speed', mult: 1.5, label: '+50% Speed' },
      { stat: 'HP', mult: 0.9, label: '-10% HP' },
    ],
    geClass: 'GE_Elite_Swift',
  },
  {
    id: 'commander', name: 'Commander', color: ACCENT_PINK, icon: '\u{1F451}',
    description: 'Aura buffs nearby allies — increases pack threat level', tier: 'legendary',
    statMods: [
      { stat: 'HP', mult: 1.6, label: '+60% HP' },
      { stat: 'Damage', mult: 1.25, label: '+25% Damage' },
      { stat: 'Speed', mult: 0.8, label: '-20% Speed' },
    ],
    geClass: 'GE_Elite_Commander',
  },
];

/** Compute effective stat value after applying modifier stack */
export function applyModifiers(
  baseStat: number,
  statKey: string,
  modifiers: EliteModifier[],
): number {
  let value = baseStat;
  for (const mod of modifiers) {
    for (const sm of mod.statMods) {
      if (sm.stat !== statKey) continue;
      if (sm.mult !== undefined) value = Math.round(value * sm.mult);
      if (sm.flat !== undefined) value = Math.round(value + sm.flat);
    }
  }
  return Math.max(0, Math.min(100, value));
}

/** Tier badge colors for modifier tiers */
export const MODIFIER_TIER_COLORS: Record<EliteModifier['tier'], string> = {
  minor: STATUS_WARNING,
  major: ACCENT_RED,
  legendary: ACCENT_PINK,
};

/** Generate UE5 GameplayEffect C++ snippet for a modifier */
export function generateModifierGE(mod: EliteModifier): string {
  const lines: string[] = [
    `// ${mod.geClass}.h — Auto-generated Elite Modifier GameplayEffect`,
    `#pragma once`,
    `#include "CoreMinimal.h"`,
    `#include "GameplayEffect.h"`,
    `#include "${mod.geClass}.generated.h"`,
    ``,
    `/**`,
    ` * ${mod.name} — ${mod.description}`,
    ` * Tier: ${mod.tier}`,
    ` */`,
    `UCLASS()`,
    `class U${mod.geClass} : public UGameplayEffect`,
    `{`,
    `    GENERATED_BODY()`,
    `public:`,
    `    U${mod.geClass}();`,
    `};`,
    ``,
    `// ${mod.geClass}.cpp`,
    `#include "${mod.geClass}.h"`,
    `#include "AbilitySystemComponent.h"`,
    ``,
    `U${mod.geClass}::U${mod.geClass}()`,
    `{`,
    `    DurationPolicy = EGameplayEffectDurationType::Infinite;`,
    `    StackingType = EGameplayEffectStackingType::AggregateByTarget;`,
    `    StackLimitCount = 1;`,
    ``,
  ];

  for (const sm of mod.statMods) {
    const attrMap: Record<string, string> = {
      HP: 'Health.MaxHealth',
      Damage: 'Combat.AttackPower',
      Speed: 'Movement.MoveSpeed',
      Range: 'Combat.AttackRange',
    };
    const attr = attrMap[sm.stat] ?? `Custom.${sm.stat}`;
    if (sm.mult !== undefined) {
      lines.push(`    // ${sm.label}`);
      lines.push(`    {`);
      lines.push(`        FGameplayModifierInfo Mod;`);
      lines.push(`        Mod.Attribute = U${attr.split('.')[0]}AttributeSet::Get${attr.split('.')[1]}Attribute();`);
      lines.push(`        Mod.ModifierOp = EGameplayModOp::Multiply;`);
      lines.push(`        Mod.ModifierMagnitude = FScalableFloat(${sm.mult}f);`);
      lines.push(`        Modifiers.Add(Mod);`);
      lines.push(`    }`);
    }
    if (sm.flat !== undefined) {
      lines.push(`    // ${sm.label}`);
      lines.push(`    {`);
      lines.push(`        FGameplayModifierInfo Mod;`);
      lines.push(`        Mod.Attribute = U${attr.split('.')[0]}AttributeSet::Get${attr.split('.')[1]}Attribute();`);
      lines.push(`        Mod.ModifierOp = EGameplayModOp::Additive;`);
      lines.push(`        Mod.ModifierMagnitude = FScalableFloat(${sm.flat}.0f);`);
      lines.push(`        Modifiers.Add(Mod);`);
      lines.push(`    }`);
    }
  }

  lines.push(`}`);
  return lines.join('\n');
}

/* ── AI pipeline nodes ─────────────────────────────────────────────────── */

export const AI_PIPELINE = [
  { label: 'AIController', featureName: 'AARPGAIController' },
  { label: 'Perception', featureName: 'AI Perception' },
  { label: 'Behavior Tree', featureName: 'Behavior Tree' },
  { label: 'EQS', featureName: 'EQS queries' },
  { label: 'Actions', featureName: 'Enemy Gameplay Abilities' },
];

/* ── 5.1 Archetype Comparison Radar data (derived from combat) ───────── */

export const RADAR_AXES = ['HP', 'Damage', 'Speed', 'Range', 'Aggression', 'Resilience', 'Intelligence'];

/** Radar data for each combat archetype, keyed by archetype id */
export const RADAR_DATA: Record<string, RadarDataPoint[]> = Object.fromEntries(
  ENEMY_ARCHETYPES.filter(a => UI_META[a.id]).map(arch => [arch.id, deriveRadar(arch)]),
);

/** Player baseline radar */
export const RADAR_PLAYER: RadarDataPoint[] = [
  { axis: 'HP', value: 0.70 }, { axis: 'Damage', value: 0.75 }, { axis: 'Speed', value: 0.80 },
  { axis: 'Range', value: 0.60 }, { axis: 'Aggression', value: 0.60 }, { axis: 'Resilience', value: 0.65 },
  { axis: 'Intelligence', value: 0.70 },
];

/* ── 5.2 Behavior Tree Flowchart data ────────────────────────────────── */

export interface BtNode {
  id: string;
  label: string;
  shape: 'diamond' | 'rect' | 'rounded' | 'hexagon';
  x: number;
  y: number;
  active: boolean;
  details: string;
}

export interface BtEdge {
  from: string;
  to: string;
  active: boolean;
}

export const BT_NODES: BtNode[] = [
  { id: 'root', label: 'Root Selector', shape: 'diamond', x: 120, y: 15, active: true, details: 'Evaluates children left-to-right. Succeeds on first child success.' },
  { id: 'seq-combat', label: 'Seq:Combat', shape: 'rect', x: 51.4, y: 60, active: true, details: 'Sequence node: all children must succeed for combat engagement.' },
  { id: 'seq-patrol', label: 'Seq:Patrol', shape: 'rect', x: 188.6, y: 60, active: false, details: 'Sequence node: patrol waypoint loop with idle pauses.' },
  { id: 'dec-target', label: 'HasTarget?', shape: 'hexagon', x: 17.1, y: 105, active: true, details: 'Decorator: checks blackboard for valid target reference (not null, alive, in range).' },
  { id: 'dec-range', label: 'InRange?', shape: 'hexagon', x: 85.7, y: 105, active: true, details: 'Decorator: evaluates distance < AttackRange (500cm default). Returns success/fail.' },
  { id: 'task-attack', label: 'Attack', shape: 'rounded', x: 17.1, y: 150, active: true, details: 'Task: execute melee/ranged attack ability. Cooldown: 1.2s. Damage: based on archetype.' },
  { id: 'task-chase', label: 'Chase', shape: 'rounded', x: 85.7, y: 150, active: false, details: 'Task: move toward target using NavMesh pathfinding. Speed multiplier: 1.5x base.' },
  { id: 'task-wander', label: 'Wander', shape: 'rounded', x: 188.6, y: 105, active: false, details: 'Task: random point in 600cm radius via EQS. Idle 2-4s between moves.' },
];

export const BT_EDGES: BtEdge[] = [
  { from: 'root', to: 'seq-combat', active: true },
  { from: 'root', to: 'seq-patrol', active: false },
  { from: 'seq-combat', to: 'dec-target', active: true },
  { from: 'seq-combat', to: 'dec-range', active: true },
  { from: 'dec-target', to: 'task-attack', active: true },
  { from: 'dec-range', to: 'task-chase', active: false },
  { from: 'seq-patrol', to: 'task-wander', active: false },
];

/* ── 5.3 Perception Cone data ────────────────────────────────────────── */

export interface DetectedEntity {
  label: string;
  x: number;
  y: number;
  color: string;
  inCone: boolean;
  inHearing: boolean;
}

export const DETECTED_ENTITIES: DetectedEntity[] = [
  { label: 'Player', x: 44.7, y: 24.4, color: ACCENT_RED, inCone: true, inHearing: true },
  { label: 'NPC', x: 93.4, y: 81.3, color: STATUS_SUCCESS, inCone: false, inHearing: true },
  { label: 'Distant', x: 20.3, y: 109.7, color: STATUS_NEUTRAL, inCone: false, inHearing: false },
];

/* ── 5.4 Difficulty Curve data ───────────────────────────────────────── */

export interface DifficultyPoint { level: number; value: number; }

export const DIFFICULTY_GRUNT: DifficultyPoint[] = [
  { level: 1, value: 85 }, { level: 5, value: 75 }, { level: 10, value: 60 },
  { level: 15, value: 50 }, { level: 20, value: 40 }, { level: 25, value: 30 },
  { level: 30, value: 22 }, { level: 35, value: 15 }, { level: 40, value: 10 },
  { level: 45, value: 8 }, { level: 50, value: 5 },
];

export const DIFFICULTY_CASTER: DifficultyPoint[] = [
  { level: 1, value: 95 }, { level: 5, value: 88 }, { level: 10, value: 78 },
  { level: 15, value: 68 }, { level: 20, value: 58 }, { level: 25, value: 48 },
  { level: 30, value: 40 }, { level: 35, value: 32 }, { level: 40, value: 25 },
  { level: 45, value: 20 }, { level: 50, value: 15 },
];

export const DIFFICULTY_BRUTE: DifficultyPoint[] = [
  { level: 1, value: 100 }, { level: 5, value: 95 }, { level: 10, value: 90 },
  { level: 15, value: 82 }, { level: 20, value: 72 }, { level: 25, value: 62 },
  { level: 30, value: 55 }, { level: 35, value: 48 }, { level: 40, value: 40 },
  { level: 45, value: 32 }, { level: 50, value: 28 },
];

/* ── 5.5 Spawn Wave Choreographer data ───────────────────────────────── */

export interface SpawnPoint { id: number; x: number; y: number; order: number; }

export const SPAWN_POINTS: SpawnPoint[] = [
  { id: 1, x: 70, y: 15.6, order: 1 },
  { id: 2, x: 116.7, y: 38.9, order: 2 },
  { id: 3, x: 116.7, y: 93.3, order: 3 },
  { id: 4, x: 70, y: 120.6, order: 4 },
  { id: 5, x: 23.3, y: 93.3, order: 5 },
  { id: 6, x: 23.3, y: 38.9, order: 6 },
];

export interface WaveConfig { id: number; delay: string; count: number; archetype: string; }

export const WAVE_TIMELINE: WaveConfig[] = [
  { id: 1, delay: '0s', count: 3, archetype: 'Grunt' },
  { id: 2, delay: '60s', count: 4, archetype: 'Mixed' },
  { id: 3, delay: '120s', count: 5, archetype: 'Brute+Caster' },
];

/* ── 5.6 Archetype Builder ───────────────────────────────────────────── */

export const ABILITY_POOL = ['Slash Attack', 'Shield Bash', 'Charge', 'Fireball', 'Frost Nova', 'Teleport', 'Heavy Slam', 'Stomp AoE', 'Taunt', 'Poison Dart', 'Heal Aura', 'Berserk'];
export const BT_PRESETS = ['Aggressive', 'Defensive', 'Passive'] as const;

/* ── 5.7 Kill/Death Statistics data ──────────────────────────────────── */

export interface ArchetypeStats {
  id: string;
  label: string;
  color: string;
  timesSpawned: number;
  timesKilled: number;
  avgLifespan: string;
  totalDmgDealt: number;
  killsOnPlayer: number;
  dangerRank: number;
}

export const KILL_DEATH_STATS: ArchetypeStats[] = [
  { id: 'melee-grunt', label: 'Forest Grunt', color: ACCENT_RED, timesSpawned: 1247, timesKilled: 1198, avgLifespan: '18.3s', totalDmgDealt: 45230, killsOnPlayer: 23, dangerRank: 3 },
  { id: 'ranged-caster', label: 'Dark Mage', color: ACCENT_PURPLE_BOLD, timesSpawned: 843, timesKilled: 801, avgLifespan: '24.7s', totalDmgDealt: 67890, killsOnPlayer: 31, dangerRank: 4 },
  { id: 'brute', label: 'Stone Brute', color: MODULE_COLORS.content, timesSpawned: 412, timesKilled: 356, avgLifespan: '42.1s', totalDmgDealt: 89450, killsOnPlayer: 67, dangerRank: 1 },
  { id: 'elite-knight', label: 'Hollow Knight', color: MODULE_COLORS.core, timesSpawned: 298, timesKilled: 241, avgLifespan: '38.5s', totalDmgDealt: 72340, killsOnPlayer: 52, dangerRank: 2 },
];

export const MAX_KILLS_ON_PLAYER = Math.max(...KILL_DEATH_STATS.map(a => a.killsOnPlayer)) || 1;

export const DEATH_CAUSES = [
  { cause: 'Sword', pct: 45, color: ACCENT_RED },
  { cause: 'Fireball', pct: 30, color: MODULE_COLORS.content },
  { cause: 'Fall', pct: 15, color: MODULE_COLORS.core },
  { cause: 'Other', pct: 10, color: STATUS_NEUTRAL },
];

/* ── 5.8 AI Decision Debugger data ───────────────────────────────────── */

export interface DecisionEntry {
  tick: number;
  type: 'evaluation' | 'selection' | 'unexpected';
  summary: string;
  details: string;
}

export const DECISION_LOG: DecisionEntry[] = [
  { tick: 847, type: 'evaluation', summary: 'Evaluated Chase->Attack path', details: 'InRange=true (450cm < 500cm). Blackboard: TargetActor=BP_PlayerCharacter_C1, LastKnownPos=(1240, 830, 0). Selected: Attack_Melee with priority 0.92.' },
  { tick: 848, type: 'selection', summary: 'Selected Attack_Melee ability', details: 'Cooldown check: READY (elapsed 1.8s > 1.2s CD). Damage roll: 65 * 1.1 modifier = 71.5. Animation montage: AM_Slash_01 queued.' },
  { tick: 851, type: 'unexpected', summary: 'Target lost during attack windup', details: 'Target moved behind cover at tick 850. LOS check failed. Aborting Attack_Melee, falling back to Chase state. NavMesh recalculation triggered.' },
  { tick: 855, type: 'evaluation', summary: 'EQS query: FindFlankPosition', details: 'Scored 8 candidate positions. Best: (1340, 790, 0) score=0.87. Factors: distance_to_target=0.9, cover_value=0.85, teammate_spacing=0.8.' },
  { tick: 860, type: 'selection', summary: 'Patrol fallback after chase timeout', details: 'Chase duration exceeded MaxChaseTime (15s). Target distance: 2100cm > MaxChaseRange (1500cm). Returning to last patrol waypoint index=3.' },
];

/* ── 5.9 Aggro Table data ────────────────────────────────────────────── */

export interface AggroEntry {
  target: string;
  threat: number;
  color: string;
  breakdown: { source: string; pct: number }[];
}

export const AGGRO_TABLE: AggroEntry[] = [
  { target: 'Player', threat: 85, color: ACCENT_RED, breakdown: [{ source: 'Damage', pct: 60 }, { source: 'Proximity', pct: 25 }, { source: 'Taunt', pct: 15 }] },
  { target: 'Companion', threat: 45, color: MODULE_COLORS.content, breakdown: [{ source: 'Damage', pct: 55 }, { source: 'Proximity', pct: 35 }, { source: 'Taunt', pct: 10 }] },
  { target: 'Decoy', threat: 20, color: STATUS_WARNING, breakdown: [{ source: 'Damage', pct: 10 }, { source: 'Proximity', pct: 30 }, { source: 'Taunt', pct: 60 }] },
];

export interface AggroEvent { time: string; from: string; to: string; reason: string; }

export const AGGRO_EVENTS: AggroEvent[] = [
  { time: '00:42', from: 'Companion', to: 'Player', reason: 'Player dealt 340 burst damage' },
  { time: '01:15', from: 'Player', to: 'Decoy', reason: 'Decoy ability: Taunt (forced 3s)' },
  { time: '01:28', from: 'Decoy', to: 'Player', reason: 'Taunt expired, Player proximity closest' },
];

/* ── 5.10 Enemy Group Tactics data ───────────────────────────────────── */

export interface TacticsEnemy {
  id: number;
  x: number;
  y: number;
  role: 'attacking' | 'flanking' | 'waiting';
  label: string;
}

export const TACTICS_ENEMIES: TacticsEnemy[] = [
  { id: 1, x: 48, y: 32, role: 'attacking', label: 'ATK-1' },
  { id: 2, x: 112, y: 44, role: 'attacking', label: 'ATK-2' },
  { id: 3, x: 128, y: 96, role: 'flanking', label: 'FLK-1' },
  { id: 4, x: 24, y: 104, role: 'waiting', label: 'WAIT-1' },
  { id: 5, x: 136, y: 24, role: 'waiting', label: 'WAIT-2' },
];

export const TACTICS_ROLE_COLORS: Record<TacticsEnemy['role'], string> = {
  attacking: ACCENT_RED,
  flanking: MODULE_COLORS.content,
  waiting: STATUS_NEUTRAL,
};
