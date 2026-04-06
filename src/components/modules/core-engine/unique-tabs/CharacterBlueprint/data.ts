import {
  MODULE_COLORS, STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, STATUS_STALE,
  STATUS_SUBDUED, STATUS_NEUTRAL, STATUS_BLOCKER,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_EMERALD_DARK, ACCENT_CYAN, ACCENT_CYAN_LIGHT,
  ACCENT_VIOLET, ACCENT_PINK, ACCENT_PURPLE, ACCENT_RED, ACCENT_GREEN,
} from '@/lib/chart-colors';
import {
  User, Gamepad2, Wind, SlidersHorizontal, Sparkles, FlaskConical,
} from 'lucide-react';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import type { EntityMetadata } from '@/types/game-metadata';

export const ACCENT = MODULE_COLORS.core;

/* ── Subtab types ──────────────────────────────────────────────────────────── */

export type BlueprintSubtab = 'features' | 'overview' | 'input' | 'movement' | 'playground' | 'ai-feel' | 'simulator';

export interface BlueprintSubtabDef {
  key: BlueprintSubtab;
  label: string;
  icon: typeof User;
  narrative: string;
  subtitle: string;
}

export const SUBTABS: BlueprintSubtabDef[] = [
  { key: 'overview', label: 'Overview', icon: User, narrative: 'Define', subtitle: 'Class hierarchy, scaling & hitbox architecture' },
  { key: 'input', label: 'Input', icon: Gamepad2, narrative: 'Control', subtitle: 'Key bindings, conflicts & ability mapping' },
  { key: 'movement', label: 'Movement', icon: Wind, narrative: 'Move', subtitle: 'States, acceleration curves & dodge trajectories' },
  { key: 'playground', label: 'Playground', icon: SlidersHorizontal, narrative: 'Feel', subtitle: 'Live-tune movement curves & responsiveness' },
  { key: 'ai-feel', label: 'AI Feel', icon: Sparkles, narrative: 'Optimize', subtitle: 'Character feel presets & comparison' },
  { key: 'simulator', label: 'Simulator', icon: FlaskConical, narrative: 'Compare', subtitle: 'Cross-character stat matrix & balance radar' },
];

/* ── Class tree ────────────────────────────────────────────────────────────── */

export interface ClassNode {
  name: string;
  subtitle?: string;
  color: string;
  children?: ClassNode[];
  crossRef?: string;
  headerFile?: string;
  componentCount?: number;
}

export const CLASS_TREE: ClassNode = {
  name: 'ACharacter',
  subtitle: 'UE5 Base',
  color: STATUS_SUBDUED,
  headerFile: 'Engine/Source/Runtime/Engine/Classes/GameFramework/Character.h',
  componentCount: 5,
  children: [
    {
      name: 'AARPGCharacterBase',
      subtitle: 'arpg-character',
      color: ACCENT,
      headerFile: 'Source/PoF/Character/ARPGCharacterBase.h',
      componentCount: 12,
      children: [
        {
          name: 'AARPGPlayerCharacter',
          subtitle: 'Player',
          color: ACCENT_EMERALD,
          headerFile: 'Source/PoF/Player/ARPGPlayerCharacter.h',
          componentCount: 8,
        },
        {
          name: 'AARPGEnemyCharacter',
          subtitle: 'Enemy',
          color: STATUS_ERROR,
          crossRef: 'arpg-enemy-ai',
          headerFile: 'Source/PoF/Character/ARPGEnemyCharacter.h',
          componentCount: 6,
        },
      ],
    },
  ],
};

/* ── Input bindings ────────────────────────────────────────────────────────── */

export interface InputBinding {
  action: string;
  defaultKey: string;
  handler: string;
  featureName: string;
}

export const INPUT_BINDINGS: InputBinding[] = [
  { action: 'IA_Move', defaultKey: 'WASD', handler: 'HandleMove', featureName: 'WASD movement' },
  { action: 'IA_Look', defaultKey: 'Mouse', handler: 'HandleLook', featureName: 'Isometric camera' },
  { action: 'IA_Interact', defaultKey: 'E', handler: 'HandleInteract', featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_PrimaryAttack', defaultKey: 'LMB', handler: 'HandlePrimaryAttack', featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_Dodge', defaultKey: 'Space', handler: 'HandleDodge', featureName: 'Dodge/dash' },
  { action: 'IA_Sprint', defaultKey: 'Shift', handler: 'HandleSprint', featureName: 'Sprint system' },
  { action: 'Force Power 1', defaultKey: '1', handler: 'UARPGAbilitySystemComponent::ActivateAbility(0)', featureName: 'Force Power Slot 1' },
  { action: 'Force Power 2', defaultKey: '2', handler: 'UARPGAbilitySystemComponent::ActivateAbility(1)', featureName: 'Force Power Slot 2' },
  { action: 'Force Power 3', defaultKey: '3', handler: 'UARPGAbilitySystemComponent::ActivateAbility(2)', featureName: 'Force Power Slot 3' },
  { action: 'Force Power 4', defaultKey: '4', handler: 'UARPGAbilitySystemComponent::ActivateAbility(3)', featureName: 'Force Power Slot 4' },
  { action: 'Force Power 5', defaultKey: '5', handler: 'UARPGAbilitySystemComponent::ActivateAbility(4)', featureName: 'Force Power Slot 5' },
  { action: 'Force Power 6', defaultKey: '6', handler: 'UARPGAbilitySystemComponent::ActivateAbility(5)', featureName: 'Force Power Slot 6' },
  { action: 'Quick Item 1', defaultKey: 'Q', handler: 'UARPGInventoryComponent::UseQuickItem(0)', featureName: 'Quick Item Slot 1' },
  { action: 'Quick Item 2', defaultKey: 'R', handler: 'UARPGInventoryComponent::UseQuickItem(1)', featureName: 'Quick Item Slot 2' },
  { action: 'Force Focus', defaultKey: 'F', handler: 'UARPGAbilitySystemComponent::ToggleForceFocus', featureName: 'Force Focus Toggle' },
  { action: 'Primary Attack', defaultKey: 'LMB', handler: 'UARPGCombatComponent::LightAttack', featureName: 'Light Saber Strike' },
  { action: 'Heavy Attack', defaultKey: 'RMB', handler: 'UARPGCombatComponent::HeavyAttack', featureName: 'Heavy Saber Strike' },
];

/* ── Keyboard layout ──────────────────────────────────────────────────────── */

export interface KeyDef {
  key: string;
  label?: string;
  widthClass?: string;
}

export const KEYBOARD_ROWS: KeyDef[][] = [
  [{ key: 'Q' }, { key: 'W' }, { key: 'E' }, { key: 'R' }, { key: 'T' }, { key: 'Y' }, { key: 'U' }, { key: 'I' }, { key: 'O' }, { key: 'P' }],
  [{ key: 'A' }, { key: 'S' }, { key: 'D' }, { key: 'F' }, { key: 'G' }, { key: 'H' }, { key: 'J' }, { key: 'K' }, { key: 'L' }],
  [{ key: 'Z' }, { key: 'X' }, { key: 'C' }, { key: 'V' }, { key: 'B' }, { key: 'N' }, { key: 'M' }],
  [{ key: 'Shift', label: 'Shift', widthClass: 'w-20' }, { key: 'Space', label: 'Space', widthClass: 'flex-1' }],
];

function buildKeyBindingMap(): Map<string, InputBinding> {
  const map = new Map<string, InputBinding>();
  for (const binding of INPUT_BINDINGS) {
    const dk = binding.defaultKey;
    if (dk === 'WASD') {
      for (const k of ['W', 'A', 'S', 'D']) {
        map.set(k, binding);
      }
    } else if (dk === 'Mouse' || dk === 'LMB' || dk === 'RMB') {
      // handled separately in mouse widget
    } else {
      map.set(dk, binding);
    }
  }
  return map;
}

export const KEY_BINDING_MAP = buildKeyBindingMap();

/* ── Key conflict detection ───────────────────────────────────────────────── */

function buildKeyConflicts(): Map<string, string[]> {
  const keyToActions = new Map<string, string[]>();
  for (const binding of INPUT_BINDINGS) {
    const dk = binding.defaultKey;
    const keys = dk === 'WASD' ? ['W', 'A', 'S', 'D'] : [dk];
    for (const k of keys) {
      const existing = keyToActions.get(k) ?? [];
      existing.push(binding.action);
      keyToActions.set(k, existing);
    }
  }
  const conflicts = new Map<string, string[]>();
  for (const [key, actions] of keyToActions) {
    if (actions.length > 1) conflicts.set(key, actions);
  }
  return conflicts;
}

export const KEY_CONFLICTS = buildKeyConflicts();

/* ── Key frequency map ────────────────────────────────────────────────────── */

function buildKeyFrequencyMap(): Map<string, number> {
  const freq = new Map<string, number>();
  freq.set('WASD', 95);
  freq.set('Mouse', 90);
  freq.set('LMB', 85);
  freq.set('E', 40);
  freq.set('Space', 60);
  freq.set('Shift', 70);
  return freq;
}

export const KEY_FREQUENCY_MAP = buildKeyFrequencyMap();

export function heatColor(pct: number): string {
  if (pct >= 80) return STATUS_ERROR;
  if (pct >= 50) return ACCENT_ORANGE;
  if (pct >= 30) return STATUS_WARNING;
  return ACCENT_EMERALD;
}

/* ── Movement states ───────────────────────────────────────────────────────── */

export const MOVEMENT_STATES = [
  { label: 'Idle', color: STATUS_SUBDUED },
  { label: 'Walk', color: ACCENT },
  { label: 'Run', color: ACCENT_CYAN },
  { label: 'Sprint', color: ACCENT_ORANGE },
  { label: 'Dodge', color: STATUS_ERROR },
];

/* ── Feature names ─────────────────────────────────────────────────────────── */

export const CHARACTER_FEATURES = [
  'AARPGCharacterBase',
  'AARPGPlayerCharacter',
  'AARPGPlayerController',
  'Enhanced Input actions',
  'Isometric camera',
  'WASD movement',
  'Sprint system',
  'Dodge/dash',
  'AARPGGameMode',
  'UARPGGameInstance',
];

/* ── Movement State Distribution (Donut) ───────────────────────────────────── */

export const MOVEMENT_STATE_DISTRIBUTION = [
  { label: 'Idle', pct: 35, color: STATUS_SUBDUED },
  { label: 'Walk', pct: 25, color: ACCENT },
  { label: 'Run', pct: 20, color: ACCENT_CYAN },
  { label: 'Sprint', pct: 12, color: ACCENT_ORANGE },
  { label: 'Dodge', pct: 5, color: STATUS_ERROR },
  { label: 'Airborne', pct: 3, color: ACCENT_VIOLET },
];

/* ── Acceleration Curve ───────────────────────────────────────────────────── */

export const ACCEL_CURVE_POINTS = [
  { x: 0, y: 0 },
  { x: 0.15, y: 120 },
  { x: 0.35, y: 350 },
  { x: 0.6, y: 510 },
  { x: 0.8, y: 570 },
  { x: 1.0, y: 600 },
];

export const ACCEL_KEY_POINTS = [
  { x: 0, y: 0, label: '0 cm/s' },
  { x: 0.35, y: 350, label: '350 cm/s' },
  { x: 1.0, y: 600, label: '600 cm/s' },
];

/* ── Camera Profile Comparison ────────────────────────────────────────────── */

const CAMERA_AXES = ['Distance', 'FOV', 'Responsive', 'Freedom', 'Smoothness'];

export const CAMERA_PROFILES: { data: RadarDataPoint[]; color: string; label: string }[] = [
  { label: 'Combat', color: STATUS_ERROR, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.9, 0.4, 0.95, 0.3, 0.6][i] })) },
  { label: 'Exploration', color: ACCENT_EMERALD, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.4, 0.8, 0.5, 0.9, 0.7][i] })) },
  { label: 'Cinematic', color: ACCENT_VIOLET, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.6, 0.95, 0.3, 0.5, 0.9][i] })) },
  { label: 'Stealth', color: ACCENT_CYAN, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.7, 0.3, 0.9, 0.2, 0.5][i] })) },
  { label: 'Boss Fight', color: ACCENT_ORANGE, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.8, 0.7, 0.85, 0.4, 0.55][i] })) },
  { label: 'Aerial', color: ACCENT_PINK, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.3, 0.9, 0.4, 0.95, 0.8][i] })) },
];

/* ── Dodge Trajectory ─────────────────────────────────────────────────────── */

export const DODGE_TRAJECTORIES = [
  { id: 1, path: 'M 50,80 Q 30,50 35,25', color: ACCENT_CYAN },
  { id: 2, path: 'M 50,80 Q 70,55 75,30', color: ACCENT_EMERALD },
  { id: 3, path: 'M 50,80 Q 20,65 15,45', color: ACCENT_ORANGE },
  { id: 4, path: 'M 50,80 Q 55,45 60,20', color: ACCENT_VIOLET },
  { id: 5, path: 'M 50,80 Q 80,60 85,40', color: ACCENT_PINK },
];

/* ── Character Scaling ────────────────────────────────────────────────────── */

export interface ScalingProperty {
  label: string;
  unit: string;
  min: number;
  max: number;
  color: string;
}

export const SCALING_PROPS: ScalingProperty[] = [
  { label: 'CapsuleRadius', unit: 'cm', min: 30, max: 45, color: ACCENT_CYAN },
  { label: 'MeshScale', unit: 'x', min: 1.0, max: 1.15, color: ACCENT_EMERALD },
  { label: 'MoveSpeed', unit: 'cm/s', min: 600, max: 780, color: ACCENT_ORANGE },
  { label: 'JumpHeight', unit: 'cm', min: 400, max: 520, color: ACCENT_VIOLET },
];

/* ── Hitbox Types ─────────────────────────────────────────────────────────── */

export interface HitboxZone {
  type: 'Hurtbox' | 'Hitbox' | 'Pushbox';
  color: string;
  shapes: { kind: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number }[];
}

export const HITBOX_ZONES: HitboxZone[] = [
  {
    type: 'Hurtbox',
    color: ACCENT_CYAN,
    shapes: [
      { kind: 'ellipse', x: 40, y: 15, w: 20, h: 18 },
      { kind: 'rect', x: 32, y: 33, w: 36, h: 40 },
      { kind: 'rect', x: 34, y: 73, w: 14, h: 35 },
      { kind: 'rect', x: 52, y: 73, w: 14, h: 35 },
    ],
  },
  {
    type: 'Hitbox',
    color: STATUS_ERROR,
    shapes: [
      { kind: 'rect', x: 68, y: 30, w: 22, h: 10 },
      { kind: 'rect', x: 10, y: 30, w: 22, h: 10 },
    ],
  },
  {
    type: 'Pushbox',
    color: ACCENT_EMERALD,
    shapes: [
      { kind: 'ellipse', x: 50, y: 55, w: 40, h: 60 },
    ],
  },
];

/* ── Character Comparison Matrix ──────────────────────────────────────────── */

export interface CharacterStat {
  stat: string;
  unit: string;
  maxVal: number;
}

export interface ComparisonCharacter {
  id: string;
  name: string;
  color: string;
  values: number[];
}

export interface SelectableCharacter extends ComparisonCharacter {
  category: string;
  subcategory: string;
  area: string;
  tier: string;
  tags: string[];
  [key: string]: unknown;
}

export const COMPARISON_STATS: CharacterStat[] = [
  { stat: 'HP', unit: '', maxVal: 1500 },
  { stat: 'Speed', unit: 'cm/s', maxVal: 800 },
  { stat: 'AttackPower', unit: '', maxVal: 200 },
  { stat: 'Range', unit: 'cm', maxVal: 1200 },
  { stat: 'Armor', unit: '', maxVal: 100 },
  { stat: 'CritChance', unit: '%', maxVal: 50 },
];

/* ── Character Database ──────────────────────────────────────────────────── */

const TIER_LEVELS: Record<string, [number, number]> = {
  common: [1, 20], elite: [15, 35], boss: [30, 45], legendary: [40, 50],
};

interface CharDef {
  id: string; name: string; cat: string; sub: string;
  area: string; tier: string; tags: string[];
  stats: number[]; color: string;
}

const CHAR_DEFS: CharDef[] = [
  /* ── Force-user ── */
  { id: 'player', name: 'AARPGPlayerCharacter', cat: 'Force-user', sub: 'Guardian', area: 'Taris', tier: 'legendary', tags: ['playable', 'melee', 'force-user', 'lightsaber'], stats: [1000, 600, 150, 200, 50, 25], color: ACCENT_CYAN },
  { id: 'jedi-guardian', name: 'Jedi Guardian', cat: 'Force-user', sub: 'Guardian', area: 'Dantooine', tier: 'elite', tags: ['force-user', 'lightsaber', 'light-side', 'tank'], stats: [1300, 350, 100, 200, 85, 15], color: '#3b82f6' },
  { id: 'sith-inquisitor', name: 'Sith Inquisitor', cat: 'Force-user', sub: 'Inquisitor', area: 'Korriban', tier: 'elite', tags: ['force-user', 'lightning', 'dark-side', 'ranged'], stats: [650, 380, 170, 900, 25, 35], color: ACCENT_RED },
  { id: 'jedi-sentinel', name: 'Jedi Sentinel', cat: 'Force-user', sub: 'Sentinel', area: 'Dantooine', tier: 'elite', tags: ['force-user', 'lightsaber', 'light-side', 'balanced'], stats: [850, 500, 130, 300, 45, 28], color: '#818cf8' },
  { id: 'gray-jedi', name: 'Gray Jedi', cat: 'Force-user', sub: 'Balanced', area: 'Dantooine', tier: 'legendary', tags: ['force-user', 'balanced', 'lightsaber'], stats: [900, 520, 145, 400, 50, 30], color: ACCENT_VIOLET },
  { id: 'revan-echo', name: "Revan's Echo", cat: 'Force-user', sub: 'Revanchist', area: 'Korriban', tier: 'legendary', tags: ['force-user', 'dark-side', 'light-side', 'ancient'], stats: [1100, 550, 180, 600, 60, 35], color: '#6d28d9' },
  { id: 'padawan', name: 'Padawan', cat: 'Force-user', sub: 'Apprentice', area: 'Dantooine', tier: 'common', tags: ['force-user', 'lightsaber', 'light-side', 'trainee'], stats: [500, 420, 70, 200, 25, 15], color: '#93c5fd' },
  /* ── Warrior ── */
  { id: 'mandalorian', name: 'Mandalorian', cat: 'Warrior', sub: 'Vanguard', area: 'Dantooine', tier: 'elite', tags: ['melee', 'ranged', 'armored', 'beskar'], stats: [1100, 400, 130, 300, 75, 15], color: '#78716c' },
  { id: 'melee-grunt', name: 'Melee Grunt', cat: 'Warrior', sub: 'Infantry', area: 'Taris', tier: 'common', tags: ['melee', 'basic', 'expendable'], stats: [500, 400, 60, 150, 30, 10], color: ACCENT_ORANGE },
  { id: 'jedi-knight', name: 'Jedi Knight', cat: 'Warrior', sub: 'Saber', area: 'Dantooine', tier: 'elite', tags: ['melee', 'force-user', 'lightsaber'], stats: [1050, 480, 140, 200, 55, 20], color: ACCENT_ORANGE },
  { id: 'sith-warrior', name: 'Sith Warrior', cat: 'Warrior', sub: 'Saber', area: 'Korriban', tier: 'elite', tags: ['melee', 'force-user', 'dark-side'], stats: [1100, 460, 155, 180, 60, 18], color: '#ea580c' },
  { id: 'republic-trooper', name: 'Republic Trooper', cat: 'Warrior', sub: 'Ranged', area: 'Taris', tier: 'common', tags: ['ranged', 'republic', 'blaster'], stats: [850, 420, 110, 500, 50, 15], color: '#f59e0b' },
  { id: 'echani-duelist', name: 'Echani Duelist', cat: 'Warrior', sub: 'Melee', area: 'Manaan', tier: 'elite', tags: ['melee', 'unarmed', 'agile'], stats: [800, 550, 145, 150, 35, 28], color: '#d97706' },
  { id: 'cathar-berserker', name: 'Cathar Berserker', cat: 'Warrior', sub: 'Melee', area: 'Kashyyyk', tier: 'common', tags: ['melee', 'feral', 'fast'], stats: [900, 520, 135, 180, 40, 25], color: '#b45309' },
  { id: 'wookiee-warrior', name: 'Wookiee Warrior', cat: 'Warrior', sub: 'Melee', area: 'Kashyyyk', tier: 'elite', tags: ['melee', 'bowcaster', 'mighty'], stats: [1200, 380, 160, 300, 70, 10], color: STATUS_WARNING },
  /* ── Mage ── */
  { id: 'caster', name: 'Caster', cat: 'Mage', sub: 'Generalist', area: 'Korriban', tier: 'common', tags: ['ranged', 'force-user', 'basic'], stats: [400, 350, 120, 1000, 15, 20], color: ACCENT_VIOLET },
  { id: 'jedi-consular', name: 'Jedi Consular', cat: 'Mage', sub: 'Healer', area: 'Dantooine', tier: 'elite', tags: ['force-user', 'healer', 'light-side'], stats: [550, 380, 130, 800, 20, 22], color: STATUS_STALE },
  { id: 'sith-sorcerer', name: 'Sith Sorcerer', cat: 'Mage', sub: 'Caster', area: 'Korriban', tier: 'elite', tags: ['force-user', 'lightning', 'dark-side'], stats: [500, 370, 175, 900, 18, 30], color: '#7c3aed' },
  { id: 'dark-jedi', name: 'Dark Jedi', cat: 'Mage', sub: 'Caster', area: 'Korriban', tier: 'elite', tags: ['force-user', 'dark-side', 'corrupted'], stats: [600, 400, 160, 750, 25, 28], color: ACCENT_PURPLE },
  { id: 'nightsister', name: 'Nightsister', cat: 'Mage', sub: 'Witch', area: 'Kashyyyk', tier: 'elite', tags: ['force-user', 'dark-side', 'witch'], stats: [480, 410, 165, 850, 15, 32], color: '#e879f9' },
  { id: 'sith-alchemist', name: 'Sith Alchemist', cat: 'Mage', sub: 'Alchemist', area: 'Korriban', tier: 'boss', tags: ['force-user', 'dark-side', 'alchemy'], stats: [700, 350, 180, 950, 30, 35], color: '#d946ef' },
  { id: 'twilek-sage', name: "Twi'lek Sage", cat: 'Mage', sub: 'Sage', area: 'Dantooine', tier: 'common', tags: ['force-user', 'healer', 'light-side'], stats: [450, 390, 80, 700, 20, 15], color: '#f0abfc' },
  /* ── Rogue ── */
  { id: 'bounty-hunter', name: 'Bounty Hunter', cat: 'Rogue', sub: 'Ranged', area: 'Taris', tier: 'elite', tags: ['ranged', 'tech-user', 'tracker'], stats: [800, 550, 120, 800, 50, 30], color: STATUS_SUCCESS },
  { id: 'smuggler', name: 'Smuggler', cat: 'Rogue', sub: 'Ranged', area: 'Taris', tier: 'elite', tags: ['ranged', 'stealth', 'charming'], stats: [700, 650, 90, 400, 30, 40], color: ACCENT_EMERALD },
  { id: 'scoundrel', name: 'Scoundrel', cat: 'Rogue', sub: 'Ranged', area: 'Taris', tier: 'common', tags: ['ranged', 'blaster', 'stealth'], stats: [600, 580, 90, 500, 25, 35], color: ACCENT_GREEN },
  { id: 'shadow-assassin', name: 'Shadow Assassin', cat: 'Rogue', sub: 'Melee', area: 'Korriban', tier: 'elite', tags: ['melee', 'stealth', 'force-user', 'dark-side'], stats: [650, 620, 125, 200, 30, 42], color: '#16a34a' },
  { id: 'trandoshan-hunter', name: 'Trandoshan Hunter', cat: 'Rogue', sub: 'Ranged', area: 'Kashyyyk', tier: 'elite', tags: ['ranged', 'tracker', 'claws'], stats: [750, 560, 120, 700, 35, 38], color: '#059669' },
  { id: 'devaronian-thief', name: 'Devaronian Thief', cat: 'Rogue', sub: 'Melee', area: 'Manaan', tier: 'common', tags: ['melee', 'stealth', 'horns'], stats: [500, 650, 80, 150, 20, 40], color: ACCENT_EMERALD },
  { id: 'duros-infiltrator', name: 'Duros Infiltrator', cat: 'Rogue', sub: 'Ranged', area: 'Taris', tier: 'common', tags: ['ranged', 'tech-user', 'stealth'], stats: [520, 590, 95, 550, 22, 36], color: ACCENT_EMERALD_DARK },
  /* ── Tank ── */
  { id: 'brute', name: 'Brute', cat: 'Tank', sub: 'Heavy', area: 'Taris', tier: 'elite', tags: ['melee', 'massive', 'slow'], stats: [1500, 250, 150, 180, 80, 5], color: '#075985' },
  { id: 'republic-juggernaut', name: 'Republic Juggernaut', cat: 'Tank', sub: 'Shield', area: 'Taris', tier: 'elite', tags: ['melee', 'armored', 'republic', 'shield'], stats: [1350, 300, 75, 150, 88, 8], color: '#0284c7' },
  { id: 'mandalorian-heavy', name: 'Mandalorian Heavy', cat: 'Tank', sub: 'Heavy', area: 'Dantooine', tier: 'elite', tags: ['ranged', 'armored', 'jetpack', 'beskar'], stats: [1250, 320, 80, 250, 85, 10], color: ACCENT_CYAN },
  { id: 'gamorrean-enforcer', name: 'Gamorrean Enforcer', cat: 'Tank', sub: 'Heavy', area: 'Taris', tier: 'common', tags: ['melee', 'axe', 'brutish'], stats: [1100, 280, 70, 150, 72, 5], color: '#0891b2' },
  { id: 'wookiee-defender', name: 'Wookiee Defender', cat: 'Tank', sub: 'Shield', area: 'Kashyyyk', tier: 'elite', tags: ['melee', 'shield', 'mighty'], stats: [1400, 290, 85, 180, 90, 7], color: ACCENT_CYAN_LIGHT },
  { id: 'beskar-knight', name: 'Beskar Knight', cat: 'Tank', sub: 'Heavy', area: 'Manaan', tier: 'legendary', tags: ['melee', 'beskar', 'indestructible'], stats: [1500, 350, 90, 200, 95, 12], color: '#67e8f9' },
  { id: 'sith-juggernaut', name: 'Sith Juggernaut', cat: 'Tank', sub: 'Heavy', area: 'Korriban', tier: 'elite', tags: ['melee', 'force-user', 'dark-side', 'unstoppable'], stats: [1300, 310, 80, 200, 82, 10], color: '#0ea5e9' },
  /* ── Support ── */
  { id: 'force-sensitive', name: 'Force Sensitive', cat: 'Support', sub: 'Healer', area: 'Dantooine', tier: 'common', tags: ['force-user', 'healer', 'untrained'], stats: [550, 400, 60, 600, 25, 15], color: ACCENT_PINK },
  { id: 'jedi-healer', name: 'Jedi Healer', cat: 'Support', sub: 'Healer', area: 'Dantooine', tier: 'elite', tags: ['force-user', 'healer', 'light-side'], stats: [500, 400, 55, 600, 30, 12], color: ACCENT_PINK },
  { id: 'combat-medic', name: 'Combat Medic', cat: 'Support', sub: 'Healer', area: 'Taris', tier: 'common', tags: ['ranged', 'republic', 'medkit'], stats: [450, 380, 50, 500, 28, 10], color: '#ec4899' },
  { id: 'kolto-specialist', name: 'Kolto Specialist', cat: 'Support', sub: 'Healer', area: 'Manaan', tier: 'elite', tags: ['tech-user', 'kolto', 'aquatic'], stats: [520, 420, 45, 550, 32, 8], color: '#db2777' },
  { id: 'ithorian-herbalist', name: 'Ithorian Herbalist', cat: 'Support', sub: 'Buffer', area: 'Dantooine', tier: 'common', tags: ['pacifist', 'herbs', 'gentle'], stats: [400, 350, 40, 400, 25, 10], color: '#f9a8d4' },
  { id: 'selkath-mystic', name: 'Selkath Mystic', cat: 'Support', sub: 'Healer', area: 'Manaan', tier: 'elite', tags: ['force-user', 'aquatic', 'kolto'], stats: [480, 440, 60, 650, 28, 15], color: '#fb7185' },
  { id: 'bith-musician', name: 'Bith Musician', cat: 'Support', sub: 'Buffer', area: 'Taris', tier: 'common', tags: ['pacifist', 'sonic', 'buffs'], stats: [350, 360, 30, 500, 18, 12], color: '#fda4af' },
  /* ── Beast ── */
  { id: 'kinrath', name: 'Kinrath', cat: 'Beast', sub: 'Insectoid', area: 'Dantooine', tier: 'common', tags: ['melee', 'venomous', 'pack'], stats: [400, 500, 80, 100, 20, 15], color: STATUS_ERROR },
  { id: 'terentatek', name: 'Terentatek', cat: 'Beast', sub: 'Predator', area: 'Korriban', tier: 'boss', tags: ['melee', 'force-resistant', 'ancient'], stats: [1400, 350, 180, 200, 75, 20], color: '#dc2626' },
  { id: 'kath-hound', name: 'Kath Hound', cat: 'Beast', sub: 'Canine', area: 'Dantooine', tier: 'common', tags: ['melee', 'pack', 'fast'], stats: [350, 550, 70, 100, 15, 18], color: '#b91c1c' },
  { id: 'krayt-dragon', name: 'Krayt Dragon', cat: 'Beast', sub: 'Apex', area: 'Korriban', tier: 'legendary', tags: ['melee', 'ancient', 'devastating'], stats: [1500, 300, 200, 250, 90, 25], color: '#991b1b' },
  { id: 'rancor', name: 'Rancor', cat: 'Beast', sub: 'Predator', area: 'Taris', tier: 'boss', tags: ['melee', 'massive', 'terrifying'], stats: [1300, 320, 170, 180, 70, 15], color: ACCENT_RED },
  { id: 'tach', name: 'Tach', cat: 'Beast', sub: 'Primate', area: 'Kashyyyk', tier: 'common', tags: ['melee', 'agile', 'curious'], stats: [200, 600, 30, 80, 8, 10], color: '#fca5a5' },
  { id: 'cannok', name: 'Cannok', cat: 'Beast', sub: 'Predator', area: 'Kashyyyk', tier: 'common', tags: ['melee', 'ambush', 'pack'], stats: [450, 480, 85, 120, 22, 20], color: STATUS_BLOCKER },
  { id: 'firaxan-shark', name: 'Firaxan Shark', cat: 'Beast', sub: 'Aquatic', area: 'Manaan', tier: 'boss', tags: ['melee', 'aquatic', 'massive'], stats: [1200, 400, 160, 150, 65, 18], color: '#e11d48' },
  /* ── Droid ── */
  { id: 'hk-assassin', name: 'HK-47 Assassin', cat: 'Droid', sub: 'Combat', area: 'Taris', tier: 'elite', tags: ['ranged', 'blaster', 'protocol-override'], stats: [800, 450, 140, 800, 55, 30], color: STATUS_SUBDUED },
  { id: 'war-droid', name: 'War Droid', cat: 'Droid', sub: 'Combat', area: 'Korriban', tier: 'elite', tags: ['ranged', 'heavy-weapon', 'armored'], stats: [900, 380, 130, 600, 65, 15], color: STATUS_NEUTRAL },
  { id: 'probe-droid', name: 'Probe Droid', cat: 'Droid', sub: 'Recon', area: 'Taris', tier: 'common', tags: ['ranged', 'scanner', 'flying'], stats: [400, 550, 60, 700, 20, 12], color: '#9ca3af' },
  { id: 'battle-droid', name: 'Battle Droid', cat: 'Droid', sub: 'Infantry', area: 'Taris', tier: 'common', tags: ['ranged', 'blaster', 'expendable'], stats: [500, 400, 75, 500, 30, 10], color: '#4b5563' },
  { id: 'basilisk-droid', name: 'Basilisk War Droid', cat: 'Droid', sub: 'Siege', area: 'Dantooine', tier: 'boss', tags: ['melee', 'mounted', 'crushing'], stats: [1300, 500, 150, 200, 80, 12], color: '#d1d5db' },
  { id: 'sentry-droid', name: 'Sentry Droid', cat: 'Droid', sub: 'Guard', area: 'Manaan', tier: 'common', tags: ['ranged', 'stationary', 'alarm'], stats: [600, 200, 90, 800, 50, 8], color: '#374151' },
];

export const COMPARISON_CHARACTERS: SelectableCharacter[] = CHAR_DEFS.map(d => ({
  id: d.id, name: d.name, color: d.color, values: d.stats,
  category: d.cat, subcategory: d.sub, area: d.area, tier: d.tier, tags: d.tags,
}));

/* ── Balance scoring ──────────────────────────────────────────────────────── */

const STAT_WEIGHTS = [1.0, 0.8, 1.2, 0.7, 1.0, 0.8];
const TOTAL_WEIGHT = STAT_WEIGHTS.reduce((a, b) => a + b, 0);

export interface BalanceResult {
  name: string;
  color: string;
  compositeScore: number;
  normalizedStats: number[];
  deviations: number[];
}

export function computeBalanceScores(characters: ComparisonCharacter[]): BalanceResult[] {
  const statCount = COMPARISON_STATS.length;
  const normalized = characters.map(ch =>
    ch.values.map((v, i) => v / COMPARISON_STATS[i].maxVal),
  );
  const means = Array.from({ length: statCount }, (_, si) =>
    normalized.reduce((acc, n) => acc + n[si], 0) / characters.length,
  );
  return characters.map((ch, ci) => {
    const norm = normalized[ci];
    const compositeScore = norm.reduce((acc, v, i) => acc + v * STAT_WEIGHTS[i], 0) / TOTAL_WEIGHT;
    const deviations = norm.map((v, i) => v - means[i]);
    return { name: ch.name, color: ch.color, compositeScore, normalizedStats: norm, deviations };
  });
}

export function deviationColor(dev: number): string {
  const abs = Math.abs(dev);
  if (abs < 0.1) return STATUS_SUCCESS;
  if (abs < 0.25) return STATUS_WARNING;
  return STATUS_ERROR;
}

/* ── Blueprint Property Inspector ────────────────────────────────────────── */

export interface BlueprintProperty {
  name: string;
  category: string;
  current: number | string;
  defaultVal: number | string;
  isModified: boolean;
}

export const BLUEPRINT_PROPERTIES: BlueprintProperty[] = [
  { name: 'MaxWalkSpeed', category: 'Movement', current: 400, defaultVal: 600, isModified: true },
  { name: 'MaxSprintSpeed', category: 'Movement', current: 780, defaultVal: 600, isModified: true },
  { name: 'JumpZVelocity', category: 'Movement', current: 520, defaultVal: 420, isModified: true },
  { name: 'GravityScale', category: 'Movement', current: 1.0, defaultVal: 1.0, isModified: false },
  { name: 'AirControl', category: 'Movement', current: 0.35, defaultVal: 0.2, isModified: true },
  { name: 'BaseDamage', category: 'Combat', current: 25, defaultVal: 10, isModified: true },
  { name: 'CritMultiplier', category: 'Combat', current: 2.0, defaultVal: 1.5, isModified: true },
  { name: 'AttackSpeed', category: 'Combat', current: 1.2, defaultVal: 1.0, isModified: true },
  { name: 'BlockReduction', category: 'Combat', current: 0.5, defaultVal: 0.5, isModified: false },
  { name: 'HitStunDuration', category: 'Combat', current: 0.3, defaultVal: 0.25, isModified: true },
  { name: 'ArmLength', category: 'Camera', current: 800, defaultVal: 400, isModified: true },
  { name: 'FOV', category: 'Camera', current: 90, defaultVal: 90, isModified: false },
  { name: 'LagSpeed', category: 'Camera', current: 10, defaultVal: 15, isModified: true },
  { name: 'CameraOffset', category: 'Camera', current: '0,60,0', defaultVal: '0,0,0', isModified: true },
  { name: 'RotationLag', category: 'Camera', current: 8, defaultVal: 10, isModified: true },
];

export const PROPERTY_CATEGORIES = ['Movement', 'Combat', 'Camera'];

export const PROPERTY_CAT_COLORS: Record<string, string> = {
  Movement: ACCENT_EMERALD,
  Combat: STATUS_ERROR,
  Camera: ACCENT_ORANGE,
};

/* ── Entity Metadata ─────────────────────────────────────────────────────── */

export const CHARACTER_METADATA: EntityMetadata[] = CHAR_DEFS.map(d => ({
  id: d.id, name: d.name, category: d.cat, subcategory: d.sub,
  tags: d.tags, area: d.area, tier: d.tier,
  level: TIER_LEVELS[d.tier]?.[0] ?? 1,
  levelMax: TIER_LEVELS[d.tier]?.[1] ?? 50,
}));
