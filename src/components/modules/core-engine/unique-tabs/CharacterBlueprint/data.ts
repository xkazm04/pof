import {
  MODULE_COLORS, STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING,
  STATUS_SUBDUED,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_PINK,
} from '@/lib/chart-colors';
import {
  User, Gamepad2, Wind, SlidersHorizontal, Sparkles, FlaskConical,
} from 'lucide-react';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

export const ACCENT = MODULE_COLORS.core;

/* ── Subtab types ──────────────────────────────────────────────────────────── */

export type BlueprintSubtab = 'overview' | 'input' | 'movement' | 'playground' | 'ai-feel' | 'simulator';

export const SUBTABS: { key: BlueprintSubtab; label: string; icon: typeof User }[] = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'input', label: 'Input', icon: Gamepad2 },
  { key: 'movement', label: 'Movement', icon: Wind },
  { key: 'playground', label: 'Playground', icon: SlidersHorizontal },
  { key: 'ai-feel', label: 'AI Feel', icon: Sparkles },
  { key: 'simulator', label: 'Simulator', icon: FlaskConical },
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
  name: string;
  color: string;
  values: number[];
}

export const COMPARISON_STATS: CharacterStat[] = [
  { stat: 'HP', unit: '', maxVal: 1500 },
  { stat: 'Speed', unit: 'cm/s', maxVal: 800 },
  { stat: 'AttackPower', unit: '', maxVal: 200 },
  { stat: 'Range', unit: 'cm', maxVal: 1200 },
  { stat: 'Armor', unit: '', maxVal: 100 },
  { stat: 'CritChance', unit: '%', maxVal: 50 },
];

export const COMPARISON_CHARACTERS: ComparisonCharacter[] = [
  { name: 'Player', color: ACCENT_CYAN, values: [1000, 600, 80, 200, 50, 25] },
  { name: 'MeleeGrunt', color: ACCENT_ORANGE, values: [500, 400, 60, 150, 30, 10] },
  { name: 'Caster', color: ACCENT_VIOLET, values: [400, 350, 120, 1000, 15, 20] },
  { name: 'Brute', color: STATUS_ERROR, values: [1500, 250, 150, 180, 80, 5] },
];

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
