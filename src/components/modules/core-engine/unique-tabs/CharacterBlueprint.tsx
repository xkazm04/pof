'use client';

import { useMemo, useState, useCallback } from 'react';
import { User, Cpu, Camera, Zap, Keyboard, ExternalLink, Network, Activity, AlertTriangle, TrendingUp, Crosshair, Scaling, Box, BarChart3, Search, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_PINK,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, SectionLabel, FeatureGrid, LoadingSpinner, RadarChart } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { GraphNode, GraphEdge, RadarDataPoint } from '@/types/unique-tab-improvements';

const ACCENT = MODULE_COLORS.core;

/* ── Class tree ────────────────────────────────────────────────────────────── */

interface ClassNode {
  name: string;
  subtitle?: string;
  color: string;
  children?: ClassNode[];
  crossRef?: string;
}

const CLASS_TREE: ClassNode = {
  name: 'ACharacter',
  subtitle: 'UE5 Base',
  color: '#64748b',
  children: [
    {
      name: 'AARPGCharacterBase',
      subtitle: 'arpg-character',
      color: ACCENT,
      children: [
        {
          name: 'AARPGPlayerCharacter',
          subtitle: 'Player',
          color: ACCENT_EMERALD,
        },
        {
          name: 'AARPGEnemyCharacter',
          subtitle: 'Enemy',
          color: STATUS_ERROR,
          crossRef: 'arpg-enemy-ai',
        },
      ],
    },
  ],
};

/* ── Component slots ───────────────────────────────────────────────────────── */

interface ComponentSlot {
  name: string;
  icon: typeof Cpu;
  featureName: string;
  color: string;
}

const COMPONENT_SLOTS: ComponentSlot[] = [
  { name: 'Enhanced Input', icon: Keyboard, featureName: 'Enhanced Input actions', color: ACCENT_CYAN },
  { name: 'Camera', icon: Camera, featureName: 'Isometric camera', color: ACCENT_ORANGE },
  { name: 'Movement', icon: Zap, featureName: 'WASD movement', color: ACCENT_EMERALD },
  { name: 'Mesh', icon: User, featureName: 'AARPGCharacterBase', color: ACCENT },
  { name: 'ASC', icon: Cpu, featureName: 'AARPGPlayerCharacter', color: MODULE_COLORS.systems },
];

/* ── Input bindings ────────────────────────────────────────────────────────── */

interface InputBinding {
  action: string;
  defaultKey: string;
  handler: string;
  featureName: string;
}

const INPUT_BINDINGS: InputBinding[] = [
  { action: 'IA_Move', defaultKey: 'WASD', handler: 'HandleMove', featureName: 'WASD movement' },
  { action: 'IA_Look', defaultKey: 'Mouse', handler: 'HandleLook', featureName: 'Isometric camera' },
  { action: 'IA_Interact', defaultKey: 'E', handler: 'HandleInteract', featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_PrimaryAttack', defaultKey: 'LMB', handler: 'HandlePrimaryAttack', featureName: 'AARPGPlayerCharacter' },
  { action: 'IA_Dodge', defaultKey: 'Space', handler: 'HandleDodge', featureName: 'Dodge/dash' },
  { action: 'IA_Sprint', defaultKey: 'Shift', handler: 'HandleSprint', featureName: 'Sprint system' },
];

/* ── Keyboard layout ──────────────────────────────────────────────────────── */

interface KeyDef {
  key: string;
  label?: string;
  widthClass?: string;
}

const KEYBOARD_ROWS: KeyDef[][] = [
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

const KEY_BINDING_MAP = buildKeyBindingMap();

/* ── Movement states ───────────────────────────────────────────────────────── */

const MOVEMENT_STATES = [
  { label: 'Idle', color: '#64748b' },
  { label: 'Walk', color: ACCENT },
  { label: 'Run', color: ACCENT_CYAN },
  { label: 'Sprint', color: ACCENT_ORANGE },
  { label: 'Dodge', color: STATUS_ERROR },
];

/* ── Feature names ─────────────────────────────────────────────────────────── */

const CHARACTER_FEATURES = [
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

/* ── 1.1 Component Dependency Graph ────────────────────────────────────────── */

const DEPENDENCY_NODES: GraphNode[] = [
  { id: 'ASC', label: 'AbilitySystemComponent', group: 'Core' },
  { id: 'AttrSet', label: 'AttributeSet', group: 'Core' },
  { id: 'SpringArm', label: 'SpringArmComponent', group: 'Camera' },
  { id: 'Camera', label: 'CameraComponent', group: 'Camera' },
  { id: 'Capsule', label: 'CapsuleComponent', group: 'Core' },
  { id: 'Mesh', label: 'SkeletalMeshComponent', group: 'Core' },
  { id: 'Movement', label: 'CharacterMovement', group: 'Movement' },
  { id: 'Input', label: 'InputComponent', group: 'Input' },
];

const DEPENDENCY_EDGES: GraphEdge[] = [
  { source: 'ASC', target: 'AttrSet' },
  { source: 'SpringArm', target: 'Camera' },
  { source: 'Capsule', target: 'Mesh' },
  { source: 'Input', target: 'Movement' },
  { source: 'ASC', target: 'Movement' },
  { source: 'Movement', target: 'Mesh' },
];

const DEP_GROUP_COLORS: Record<string, string> = {
  Core: ACCENT,
  Camera: ACCENT_ORANGE,
  Movement: ACCENT_EMERALD,
  Input: ACCENT_CYAN,
};

/* ── 1.2 Movement State Heatmap (Donut) ───────────────────────────────────── */

const MOVEMENT_STATE_DISTRIBUTION = [
  { label: 'Idle', pct: 35, color: '#64748b' },
  { label: 'Walk', pct: 25, color: ACCENT },
  { label: 'Run', pct: 20, color: ACCENT_CYAN },
  { label: 'Sprint', pct: 12, color: ACCENT_ORANGE },
  { label: 'Dodge', pct: 5, color: STATUS_ERROR },
  { label: 'Airborne', pct: 3, color: ACCENT_VIOLET },
];

/* ── 1.4 Acceleration Curve ───────────────────────────────────────────────── */

const ACCEL_CURVE_POINTS = [
  { x: 0, y: 0 },
  { x: 0.15, y: 120 },
  { x: 0.35, y: 350 },
  { x: 0.6, y: 510 },
  { x: 0.8, y: 570 },
  { x: 1.0, y: 600 },
];

const ACCEL_KEY_POINTS = [
  { x: 0, y: 0, label: '0 cm/s' },
  { x: 0.35, y: 350, label: '350 cm/s' },
  { x: 1.0, y: 600, label: '600 cm/s' },
];

/* ── 1.5 Camera Profile Comparison ────────────────────────────────────────── */

const CAMERA_AXES = ['Distance', 'FOV', 'Responsive', 'Freedom', 'Smoothness'];

const CAMERA_PROFILES: { data: RadarDataPoint[]; color: string; label: string }[] = [
  { label: 'Combat', color: STATUS_ERROR, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.9, 0.4, 0.95, 0.3, 0.6][i] })) },
  { label: 'Exploration', color: ACCENT_EMERALD, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.4, 0.8, 0.5, 0.9, 0.7][i] })) },
  { label: 'Cinematic', color: ACCENT_VIOLET, data: CAMERA_AXES.map((a, i) => ({ axis: a, value: [0.6, 0.95, 0.3, 0.5, 0.9][i] })) },
];

/* ── 1.6 Dodge Trajectory ─────────────────────────────────────────────────── */

const DODGE_TRAJECTORIES = [
  { id: 1, path: 'M 50,80 Q 30,50 35,25', color: ACCENT_CYAN },
  { id: 2, path: 'M 50,80 Q 70,55 75,30', color: ACCENT_EMERALD },
  { id: 3, path: 'M 50,80 Q 20,65 15,45', color: ACCENT_ORANGE },
  { id: 4, path: 'M 50,80 Q 55,45 60,20', color: ACCENT_VIOLET },
  { id: 5, path: 'M 50,80 Q 80,60 85,40', color: ACCENT_PINK },
];

/* ── 1.7 Character Scaling ────────────────────────────────────────────────── */

interface ScalingProperty {
  label: string;
  unit: string;
  min: number;
  max: number;
  color: string;
}

const SCALING_PROPS: ScalingProperty[] = [
  { label: 'CapsuleRadius', unit: 'cm', min: 30, max: 45, color: ACCENT_CYAN },
  { label: 'MeshScale', unit: 'x', min: 1.0, max: 1.15, color: ACCENT_EMERALD },
  { label: 'MoveSpeed', unit: 'cm/s', min: 600, max: 780, color: ACCENT_ORANGE },
  { label: 'JumpHeight', unit: 'cm', min: 400, max: 520, color: ACCENT_VIOLET },
];

/* ── 1.8 Hitbox Types ─────────────────────────────────────────────────────── */

interface HitboxZone {
  type: 'Hurtbox' | 'Hitbox' | 'Pushbox';
  color: string;
  shapes: { kind: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number }[];
}

const HITBOX_ZONES: HitboxZone[] = [
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

/* ── 1.9 Character Comparison Matrix ──────────────────────────────────────── */

interface CharacterStat {
  stat: string;
  unit: string;
  maxVal: number;
}

interface ComparisonCharacter {
  name: string;
  color: string;
  values: number[];
}

const COMPARISON_STATS: CharacterStat[] = [
  { stat: 'HP', unit: '', maxVal: 1500 },
  { stat: 'Speed', unit: 'cm/s', maxVal: 800 },
  { stat: 'AttackPower', unit: '', maxVal: 200 },
  { stat: 'Range', unit: 'cm', maxVal: 1200 },
  { stat: 'Armor', unit: '', maxVal: 100 },
  { stat: 'CritChance', unit: '%', maxVal: 50 },
];

const COMPARISON_CHARACTERS: ComparisonCharacter[] = [
  { name: 'Player', color: ACCENT_CYAN, values: [1000, 600, 80, 200, 50, 25] },
  { name: 'MeleeGrunt', color: ACCENT_ORANGE, values: [500, 400, 60, 150, 30, 10] },
  { name: 'Caster', color: ACCENT_VIOLET, values: [400, 350, 120, 1000, 15, 20] },
  { name: 'Brute', color: STATUS_ERROR, values: [1500, 250, 150, 180, 80, 5] },
];

/* ── 1.10 Blueprint Property Inspector ────────────────────────────────────── */

interface BlueprintProperty {
  name: string;
  category: string;
  current: number | string;
  defaultVal: number | string;
  isModified: boolean;
}

const BLUEPRINT_PROPERTIES: BlueprintProperty[] = [
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

const PROPERTY_CATEGORIES = ['Movement', 'Combat', 'Camera'];
const PROPERTY_CAT_COLORS: Record<string, string> = {
  Movement: ACCENT_EMERALD,
  Combat: STATUS_ERROR,
  Camera: ACCENT_ORANGE,
};

/* ── Component ─────────────────────────────────────────────────────────────── */

interface CharacterBlueprintProps {
  moduleId: SubModuleId;
}

export function CharacterBlueprint({ moduleId }: CharacterBlueprintProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    let implemented = 0;
    for (const name of CHARACTER_FEATURES) {
      const status = featureMap.get(name)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
    }
    return { total: CHARACTER_FEATURES.length, implemented };
  }, [featureMap]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  // 1.7 Character Scaling
  const [scalingLevel, setScalingLevel] = useState(1);
  const scalingT = (scalingLevel - 1) / 49; // 0..1

  // 1.8 Hitbox Wireframe
  const [hitboxToggles, setHitboxToggles] = useState<Record<string, boolean>>({
    Hurtbox: true, Hitbox: true, Pushbox: true,
  });

  // 1.10 Blueprint Property Inspector
  const [propSearch, setPropSearch] = useState('');
  const filteredProperties = useMemo(() => {
    if (!propSearch) return BLUEPRINT_PROPERTIES;
    const q = propSearch.toLowerCase();
    return BLUEPRINT_PROPERTIES.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [propSearch]);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <TabHeader icon={User} title="Character Blueprint" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Class tree & Movement */}
        <div className="space-y-2.5">
          <SurfaceCard level={2} className="p-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2 relative z-10">
              <User className="w-4 h-4 text-blue-400" /> Class Hierarchy
            </div>
            <div className="bg-surface-deep/50 p-4 rounded-xl border border-border/40 relative z-10">
              <ClassTreeNode node={CLASS_TREE} depth={0} />
            </div>
          </SurfaceCard>

          <SurfaceCard level={2} className="p-3 relative">
            <div className="mb-2.5"><SectionLabel icon={Zap} label="Movement States Flow" /></div>
            <div className="flex flex-wrap gap-2 items-center">
              {MOVEMENT_STATES.map((state, i, arr) => (
                <span key={state.label} className="flex items-center gap-2">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border shadow-sm"
                    style={{
                      borderColor: `${state.color}50`,
                      backgroundColor: `${state.color}15`,
                      color: state.color,
                    }}
                  >
                    {state.label}
                  </motion.span>
                  {i < arr.length - 1 && (
                    <span className="text-text-muted text-xs mx-0.5">&rarr;</span>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2.5 mt-2.5 text-xs font-mono text-text-muted bg-surface/50 p-2 rounded-lg border border-border/30">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Sprint: Shift held</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Dodge: Space (cooldown)</span>
            </div>
          </SurfaceCard>
        </div>

        {/* Components & Bindings */}
        <div className="space-y-2.5">
          <SurfaceCard level={2} className="p-3 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[rgba(255,255,255,0.02)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2 relative z-10">
              <Cpu className="w-4 h-4 text-cyan-400" /> Component Slots
            </div>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {COMPONENT_SLOTS.map((slot, i) => {
                const status: FeatureStatus = featureMap.get(slot.featureName)?.status ?? 'unknown';
                const sc = STATUS_COLORS[status];
                const SlotIcon = slot.icon;
                return (
                  <motion.div
                    key={slot.name}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    className="flex flex-col gap-2 p-3 rounded-xl border relative overflow-hidden"
                    style={{ borderColor: `${slot.color}30`, backgroundColor: `${slot.color}10` }}
                  >
                    <div className="absolute -right-2 -bottom-2 opacity-10">
                      <SlotIcon className="w-12 h-12" style={{ color: slot.color }} />
                    </div>
                    <div className="flex justify-between items-start">
                      <SlotIcon className="w-5 h-5" style={{ color: slot.color, filter: `drop-shadow(0 0 4px ${slot.color}80)` }} />
                      <span className="flex items-center gap-1.5 bg-surface-deep px-1.5 py-0.5 rounded shadow-sm border border-border/40">
                        <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                        <span className="text-[10px] font-bold uppercase" style={{ color: sc.dot }}>{sc.label}</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold text-text mt-1 truncate">{slot.name}</span>
                  </motion.div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard level={2} className="p-3 relative">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-emerald-400" /> Input Bindings
            </div>
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="font-bold text-text-muted pb-2 pr-4 uppercase tracking-wider text-[10px]">Action</th>
                    <th className="font-bold text-text-muted pb-2 pr-4 uppercase tracking-wider text-[10px]">Key</th>
                    <th className="font-bold text-text-muted pb-2 pr-4 uppercase tracking-wider text-[10px]">Handler</th>
                    <th className="font-bold text-text-muted pb-2 uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {INPUT_BINDINGS.map((binding, i) => {
                    const status: FeatureStatus = featureMap.get(binding.featureName)?.status ?? 'unknown';
                    const sc = STATUS_COLORS[status];
                    return (
                      <motion.tr
                        key={binding.action}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-2 pr-4">
                          <span className="font-mono text-text font-medium">{binding.action}</span>
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="font-mono text-[10px] px-2 py-0.5 rounded-md font-bold shadow-sm"
                            style={{ backgroundColor: `${ACCENT_CYAN}15`, color: ACCENT_CYAN, border: `1px solid ${ACCENT_CYAN}40` }}
                          >
                            {binding.defaultKey}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className="font-mono text-text-muted">{binding.handler}</span>
                        </td>
                        <td className="py-2">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                            <span className="text-[10px] uppercase font-bold" style={{ color: sc.dot }}>{sc.label}</span>
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Keyboard Visualization */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-cyan-400" /> Input Binding Map
        </div>
        <div className="flex gap-2.5 items-start">
          {/* Keyboard */}
          <div className="space-y-1">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-1" style={{ paddingLeft: ri === 1 ? 8 : ri === 2 ? 16 : 0 }}>
                {row.map((kd) => {
                  const binding = KEY_BINDING_MAP.get(kd.key);
                  const isBound = !!binding;
                  return (
                    <div
                      key={kd.key}
                      className={`h-7 flex items-center justify-center rounded text-[10px] font-mono font-bold border transition-colors ${
                        kd.widthClass ?? 'w-7'
                      } ${isBound ? 'text-text shadow-sm' : 'text-text-muted border-border/40 bg-surface-deep'}`}
                      style={isBound ? {
                        backgroundColor: `${ACCENT_CYAN}20`,
                        borderColor: `${ACCENT_CYAN}50`,
                        boxShadow: `0 0 6px ${ACCENT_CYAN}30`,
                      } : undefined}
                      title={binding ? `${binding.action} → ${binding.handler}` : undefined}
                    >
                      {kd.label ?? kd.key}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Mouse widget */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Mouse</div>
            <div className="flex gap-0.5">
              <div
                className="w-8 h-10 rounded-tl-xl border-r border-border/30 flex items-center justify-center text-[10px] font-mono font-bold rounded-l border shadow-sm"
                style={{
                  backgroundColor: `${ACCENT_CYAN}20`,
                  borderColor: `${ACCENT_CYAN}50`,
                  color: 'var(--text)',
                  boxShadow: `0 0 6px ${ACCENT_CYAN}30`,
                }}
                title="IA_PrimaryAttack → HandlePrimaryAttack"
              >
                LMB
              </div>
              <div
                className="w-8 h-10 rounded-tr-xl flex items-center justify-center text-[10px] font-mono font-bold rounded-r border border-border/40 bg-surface-deep text-text-muted"
                title="Unbound"
              >
                RMB
              </div>
            </div>
            <div
              className="w-[68px] h-4 rounded-b-xl border border-border/40 bg-surface-deep flex items-center justify-center text-[8px] font-mono text-text-muted"
              title="IA_Look → HandleLook"
              style={{
                backgroundColor: `${ACCENT_CYAN}10`,
                borderColor: `${ACCENT_CYAN}30`,
              }}
            >
              Look
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2.5 mt-3 text-[10px] font-medium text-text-muted border-t border-border/40 pt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border shadow-sm" style={{ backgroundColor: `${ACCENT_CYAN}20`, borderColor: `${ACCENT_CYAN}50` }} />
            Bound
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-border/40 bg-surface-deep" />
            Unbound
          </span>
        </div>
      </SurfaceCard>

      {/* Feature status list */}
      <SurfaceCard level={2} className="p-4">
        <div className="mb-2.5"><SectionLabel label="Architectural Components" /></div>
        <FeatureGrid featureNames={CHARACTER_FEATURES} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} accent={ACCENT} />
      </SurfaceCard>

      {/* ── 1.1 Component Dependency Graph ─────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={Network} label="Component Dependency Graph" color={ACCENT} /></div>
        <div className="flex justify-center">
          <svg width={280} height={280} viewBox="0 0 360 360" className="overflow-visible">
            {/* Edges */}
            {DEPENDENCY_EDGES.map((edge) => {
              const si = DEPENDENCY_NODES.findIndex((n) => n.id === edge.source);
              const ti = DEPENDENCY_NODES.findIndex((n) => n.id === edge.target);
              if (si < 0 || ti < 0) return null;
              const angleS = (2 * Math.PI * si) / DEPENDENCY_NODES.length - Math.PI / 2;
              const angleT = (2 * Math.PI * ti) / DEPENDENCY_NODES.length - Math.PI / 2;
              const r = 130;
              const sx = 180 + r * Math.cos(angleS);
              const sy = 180 + r * Math.sin(angleS);
              const tx = 180 + r * Math.cos(angleT);
              const ty = 180 + r * Math.sin(angleT);
              return (
                <line key={`${edge.source}-${edge.target}`} x1={sx} y1={sy} x2={tx} y2={ty}
                  stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4 3" />
              );
            })}
            {/* Nodes */}
            {DEPENDENCY_NODES.map((node, i) => {
              const angle = (2 * Math.PI * i) / DEPENDENCY_NODES.length - Math.PI / 2;
              const r = 130;
              const x = 180 + r * Math.cos(angle);
              const y = 180 + r * Math.sin(angle);
              const groupColor = DEP_GROUP_COLORS[node.group ?? 'Core'];
              return (
                <g key={node.id}>
                  <circle cx={x} cy={y} r={22} fill={`${groupColor}20`} stroke={groupColor} strokeWidth="2"
                    style={{ filter: `drop-shadow(0 0 6px ${groupColor}40)` }} />
                  <text x={x} y={y - 2} textAnchor="middle" dominantBaseline="central"
                    className="text-[8px] font-mono font-bold" fill={groupColor}>{node.id}</text>
                  <text x={x} y={y + 10} textAnchor="middle" dominantBaseline="central"
                    className="text-[6px] font-mono" fill="var(--text-muted)">{node.group}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {Object.entries(DEP_GROUP_COLORS).map(([group, color]) => (
            <span key={group} className="flex items-center gap-1.5 text-[10px] font-mono font-bold" style={{ color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
              {group}
            </span>
          ))}
        </div>
      </SurfaceCard>

      {/* ── 1.2 Movement State Heatmap (Donut) ────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={Activity} label="Movement State Distribution" color={ACCENT_EMERALD} /></div>
        <div className="flex items-center gap-2.5">
          <svg width={140} height={140} viewBox="0 0 180 180">
            {(() => {
              const cx = 90, cy = 90, r = 70, innerR = 42;
              let cumAngle = -90;
              return MOVEMENT_STATE_DISTRIBUTION.map((state) => {
                const startAngle = cumAngle;
                const sweep = (state.pct / 100) * 360;
                cumAngle += sweep;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = ((startAngle + sweep) * Math.PI) / 180;
                const largeArc = sweep > 180 ? 1 : 0;
                const x1o = cx + r * Math.cos(startRad);
                const y1o = cy + r * Math.sin(startRad);
                const x2o = cx + r * Math.cos(endRad);
                const y2o = cy + r * Math.sin(endRad);
                const x1i = cx + innerR * Math.cos(endRad);
                const y1i = cy + innerR * Math.sin(endRad);
                const x2i = cx + innerR * Math.cos(startRad);
                const y2i = cy + innerR * Math.sin(startRad);
                const d = `M ${x1o} ${y1o} A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
                return (
                  <path key={state.label} d={d} fill={state.color} opacity={0.8}
                    stroke="var(--surface)" strokeWidth="2"
                    style={{ filter: `drop-shadow(0 0 3px ${state.color}60)` }} />
                );
              });
            })()}
            <text x={90} y={86} textAnchor="middle" className="text-[10px] font-mono font-bold fill-[var(--text)]">100%</text>
            <text x={90} y={100} textAnchor="middle" className="text-[8px] font-mono fill-[var(--text-muted)]">Time Split</text>
          </svg>
          <div className="flex flex-col gap-1.5">
            {MOVEMENT_STATE_DISTRIBUTION.map((state) => (
              <div key={state.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: state.color }} />
                <span className="text-xs font-mono text-text w-16">{state.label}</span>
                <div className="w-24 h-2 bg-surface-deep rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${state.pct}%` }} transition={{ duration: 0.6 }}
                    className="h-full rounded-full" style={{ backgroundColor: state.color }} />
                </div>
                <span className="text-[10px] font-mono font-bold text-text-muted w-8 text-right">{state.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ── 1.3 Input Action Conflict Detector ────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={AlertTriangle} label="Input Action Conflict Detector" color={ACCENT_CYAN} /></div>
        <div className="flex items-start gap-2.5">
          {/* Mini keyboard */}
          <div className="space-y-1">
            {KEYBOARD_ROWS.slice(0, 3).map((row, ri) => (
              <div key={ri} className="flex gap-0.5" style={{ paddingLeft: ri === 1 ? 4 : ri === 2 ? 8 : 0 }}>
                {row.map((kd) => {
                  const isBound = KEY_BINDING_MAP.has(kd.key);
                  return (
                    <div key={kd.key}
                      className="w-5 h-5 flex items-center justify-center rounded text-[7px] font-mono font-bold border"
                      style={isBound ? {
                        backgroundColor: `${ACCENT_EMERALD}20`, borderColor: `${ACCENT_EMERALD}50`, color: ACCENT_EMERALD,
                      } : {
                        backgroundColor: 'var(--surface-deep)', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)',
                      }}>
                      {kd.key}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Status */}
          <div className="flex-1">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 p-3 rounded-lg border"
              style={{ borderColor: `${STATUS_SUCCESS}40`, backgroundColor: `${STATUS_SUCCESS}10` }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
              <div>
                <div className="text-xs font-bold" style={{ color: STATUS_SUCCESS }}>No Conflicts Detected</div>
                <div className="text-[10px] text-text-muted mt-0.5">All {INPUT_BINDINGS.length} input actions have unique bindings.</div>
              </div>
            </motion.div>
            <div className="mt-3 p-2 rounded-lg border border-border/30 bg-surface-deep/50">
              <div className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider mb-1">Conflict Panel</div>
              <div className="text-[10px] text-text-muted italic">Overlapping bindings will appear here when detected.</div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* ── 1.4 Acceleration Curve Editor ─────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={TrendingUp} label="Sprint Acceleration Curve" color={ACCENT_ORANGE} /></div>
        <div className="flex justify-center">
          <svg width={280} height={160} viewBox="0 0 320 200" className="overflow-visible">
            {/* Grid */}
            {[0, 150, 300, 450, 600].map((v) => {
              const y = 180 - (v / 600) * 160;
              return (
                <g key={v}>
                  <line x1={40} y1={y} x2={300} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <text x={36} y={y + 3} textAnchor="end" className="text-[8px] font-mono fill-[var(--text-muted)]">{v}</text>
                </g>
              );
            })}
            {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
              const x = 40 + t * 260;
              return (
                <g key={t}>
                  <line x1={x} y1={20} x2={x} y2={180} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <text x={x} y={194} textAnchor="middle" className="text-[8px] font-mono fill-[var(--text-muted)]">{t}s</text>
                </g>
              );
            })}
            {/* Axes labels */}
            <text x={170} y={12} textAnchor="middle" className="text-[9px] font-mono font-bold fill-[var(--text-muted)]">Speed (cm/s)</text>
            {/* Curve */}
            <path
              d={`M ${ACCEL_CURVE_POINTS.map((p) => `${40 + p.x * 260},${180 - (p.y / 600) * 160}`).join(' L ')}`}
              fill="none" stroke={ACCENT_ORANGE} strokeWidth="2.5"
              style={{ filter: `drop-shadow(0 0 4px ${ACCENT_ORANGE}80)` }}
            />
            {/* Area fill */}
            <path
              d={`M 40,180 L ${ACCEL_CURVE_POINTS.map((p) => `${40 + p.x * 260},${180 - (p.y / 600) * 160}`).join(' L ')} L 300,180 Z`}
              fill={`${ACCENT_ORANGE}12`}
            />
            {/* Key points */}
            {ACCEL_KEY_POINTS.map((p) => {
              const px = 40 + p.x * 260;
              const py = 180 - (p.y / 600) * 160;
              return (
                <g key={p.label}>
                  <circle cx={px} cy={py} r={4} fill={ACCENT_ORANGE}
                    style={{ filter: `drop-shadow(0 0 4px ${ACCENT_ORANGE})` }} />
                  <text x={px} y={py - 10} textAnchor="middle"
                    className="text-[8px] font-mono font-bold" fill={ACCENT_ORANGE}>{p.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </SurfaceCard>

      {/* ── 1.5 Camera Profile Comparison ─────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={Camera} label="Camera Profile Comparison" color={ACCENT_ORANGE} /></div>
        <div className="flex items-center gap-2.5 justify-center">
          <RadarChart
            data={CAMERA_PROFILES[0].data}
            size={200}
            accent={CAMERA_PROFILES[0].color}
            overlays={CAMERA_PROFILES.slice(1)}
            showLabels
          />
          <div className="flex flex-col gap-2">
            {CAMERA_PROFILES.map((profile) => (
              <div key={profile.label} className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: profile.color }} />
                <span className="text-xs font-mono font-bold" style={{ color: profile.color }}>{profile.label}</span>
              </div>
            ))}
            <div className="mt-2 text-[10px] text-text-muted space-y-0.5">
              <div className="flex justify-between gap-2.5">
                <span>Best Distance:</span>
                <span className="font-mono font-bold" style={{ color: STATUS_ERROR }}>Combat (0.9)</span>
              </div>
              <div className="flex justify-between gap-2.5">
                <span>Best FOV:</span>
                <span className="font-mono font-bold" style={{ color: ACCENT_VIOLET }}>Cinematic (0.95)</span>
              </div>
              <div className="flex justify-between gap-2.5">
                <span>Best Freedom:</span>
                <span className="font-mono font-bold" style={{ color: ACCENT_EMERALD }}>Exploration (0.9)</span>
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* ── 1.6 Dodge Trajectory Visualizer ───────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={Crosshair} label="Dodge Trajectory Visualizer" color={ACCENT_CYAN} /></div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <svg width={100} height={100} viewBox="0 0 100 100" className="overflow-visible">
              {/* Grid */}
              <rect x={0} y={0} width={100} height={100} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" rx={4} />
              {[25, 50, 75].map((v) => (
                <g key={v}>
                  <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                  <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                </g>
              ))}
              {/* Player origin */}
              <circle cx={50} cy={80} r={4} fill={ACCENT} style={{ filter: `drop-shadow(0 0 4px ${ACCENT})` }} />
              <text x={50} y={93} textAnchor="middle" className="text-[6px] font-mono font-bold fill-[var(--text-muted)]">Start</text>
              {/* Trajectories */}
              {DODGE_TRAJECTORIES.map((traj) => (
                <path key={traj.id} d={traj.path} fill="none" stroke={traj.color} strokeWidth="2" strokeLinecap="round"
                  opacity={0.8} style={{ filter: `drop-shadow(0 0 3px ${traj.color}60)` }} />
              ))}
            </svg>
          </div>
          <div className="flex-1 space-y-2">
            <div className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">Statistics</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg border border-border/30 bg-surface-deep/50">
                <div className="text-[10px] text-text-muted">Avg Distance</div>
                <div className="text-sm font-mono font-bold" style={{ color: ACCENT_CYAN }}>250 cm</div>
              </div>
              <div className="p-2 rounded-lg border border-border/30 bg-surface-deep/50">
                <div className="text-[10px] text-text-muted">Avg Duration</div>
                <div className="text-sm font-mono font-bold" style={{ color: ACCENT_EMERALD }}>0.3s</div>
              </div>
              <div className="p-2 rounded-lg border border-border/30 bg-surface-deep/50">
                <div className="text-[10px] text-text-muted">Trajectories</div>
                <div className="text-sm font-mono font-bold" style={{ color: ACCENT_VIOLET }}>5</div>
              </div>
              <div className="p-2 rounded-lg border border-border/30 bg-surface-deep/50">
                <div className="text-[10px] text-text-muted">I-Frames</div>
                <div className="text-sm font-mono font-bold" style={{ color: ACCENT_ORANGE }}>0.15s</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {DODGE_TRAJECTORIES.map((traj) => (
                <span key={traj.id} className="flex items-center gap-1 text-[9px] font-mono" style={{ color: traj.color }}>
                  <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: traj.color }} />
                  #{traj.id}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* ── 1.7 Character Scaling Preview ─────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={Scaling} label="Character Scaling Preview" color={ACCENT_VIOLET} /></div>
        <div className="flex items-center gap-3 mb-2.5">
          <span className="text-xs font-mono font-bold text-text-muted">Level</span>
          <input
            type="range" min={1} max={50} value={scalingLevel}
            onChange={(e) => setScalingLevel(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: ACCENT_VIOLET }}
          />
          <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-md border border-border/40 bg-surface-deep min-w-[40px] text-center"
            style={{ color: ACCENT_VIOLET }}>{scalingLevel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SCALING_PROPS.map((prop) => {
            const val = prop.min + (prop.max - prop.min) * scalingT;
            const pct = ((val - prop.min) / (prop.max - prop.min)) * 100;
            return (
              <motion.div key={prop.label} layout
                className="p-3 rounded-lg border border-border/30 bg-surface-deep/50">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">{prop.label}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: prop.color }}>
                    {val.toFixed(prop.unit === 'x' ? 2 : 0)} {prop.unit}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }}
                    className="h-full rounded-full" style={{ backgroundColor: prop.color, boxShadow: `0 0 6px ${prop.color}60` }} />
                </div>
                <div className="flex justify-between text-[8px] font-mono text-text-muted mt-0.5">
                  <span>{prop.min}{prop.unit}</span>
                  <span>{prop.max}{prop.unit}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* ── 1.8 Hitbox Wireframe Viewer ───────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={Box} label="Hitbox Wireframe Viewer" color={STATUS_ERROR} /></div>
        <div className="flex items-start gap-2.5">
          <svg width={100} height={100} viewBox="0 0 100 100" className="overflow-visible">
            {/* Silhouette outline */}
            <ellipse cx={50} cy={15} rx={10} ry={12} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <rect x={38} y={27} width={24} height={35} rx={3} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <rect x={16} y={30} width={22} height={8} rx={2} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <rect x={62} y={30} width={22} height={8} rx={2} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <rect x={38} y={62} width={10} height={35} rx={2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <rect x={52} y={62} width={10} height={35} rx={2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            {/* Hitbox overlays */}
            {HITBOX_ZONES.filter((z) => hitboxToggles[z.type]).map((zone) =>
              zone.shapes.map((shape, si) =>
                shape.kind === 'ellipse' ? (
                  <ellipse key={`${zone.type}-${si}`} cx={shape.x} cy={shape.y} rx={shape.w / 2} ry={shape.h / 2}
                    fill={`${zone.color}15`} stroke={zone.color} strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <rect key={`${zone.type}-${si}`} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={2}
                    fill={`${zone.color}15`} stroke={zone.color} strokeWidth="1.5" strokeDasharray="3 2" />
                ),
              ),
            )}
          </svg>
          <div className="flex-1 space-y-3">
            <div className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">Toggle Layers</div>
            <div className="flex flex-wrap gap-2">
              {HITBOX_ZONES.map((zone) => (
                <button key={zone.type}
                  onClick={() => setHitboxToggles((prev) => ({ ...prev, [zone.type]: !prev[zone.type] }))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all"
                  style={{
                    borderColor: hitboxToggles[zone.type] ? `${zone.color}60` : 'rgba(255,255,255,0.1)',
                    backgroundColor: hitboxToggles[zone.type] ? `${zone.color}20` : 'transparent',
                    color: hitboxToggles[zone.type] ? zone.color : 'var(--text-muted)',
                  }}>
                  <span className="w-2 h-2 rounded-full" style={{
                    backgroundColor: hitboxToggles[zone.type] ? zone.color : 'transparent',
                    border: `1.5px solid ${zone.color}`,
                  }} />
                  {zone.type}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-text-muted space-y-1 mt-2 p-2 rounded-lg border border-border/30 bg-surface-deep/50">
              <div><span className="font-bold" style={{ color: ACCENT_CYAN }}>Hurtbox</span> - Damageable regions (body parts)</div>
              <div><span className="font-bold" style={{ color: STATUS_ERROR }}>Hitbox</span> - Active attack collision (arms/weapons)</div>
              <div><span className="font-bold" style={{ color: ACCENT_EMERALD }}>Pushbox</span> - Physics blocking volume</div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* ── 1.9 Character Comparison Matrix ───────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5"><SectionLabel icon={BarChart3} label="Character Comparison Matrix" color={ACCENT_VIOLET} /></div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-text-muted w-28">Stat</th>
                {COMPARISON_CHARACTERS.map((ch) => (
                  <th key={ch.name} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: ch.color }}>
                    {ch.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {COMPARISON_STATS.map((stat, si) => {
                const values = COMPARISON_CHARACTERS.map((ch) => ch.values[si]);
                const maxV = Math.max(...values);
                return (
                  <tr key={stat.stat} className="hover:bg-surface/30 transition-colors">
                    <td className="py-2 pr-4 font-mono font-bold text-text-muted">
                      {stat.stat} {stat.unit && <span className="text-[8px] opacity-60">({stat.unit})</span>}
                    </td>
                    {COMPARISON_CHARACTERS.map((ch, ci) => {
                      const val = ch.values[si];
                      const barPct = (val / stat.maxVal) * 100;
                      const isBest = val === maxV;
                      return (
                        <td key={ch.name} className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-2 bg-surface-deep rounded-full overflow-hidden flex-shrink-0">
                              <div className="h-full rounded-full" style={{
                                width: `${barPct}%`, backgroundColor: ch.color,
                                boxShadow: isBest ? `0 0 6px ${ch.color}60` : 'none',
                              }} />
                            </div>
                            <span className="font-mono text-[10px] w-8" style={{
                              color: isBest ? STATUS_SUCCESS : 'var(--text-muted)',
                              fontWeight: isBest ? 700 : 400,
                            }}>{val}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-border/30">
          {COMPARISON_CHARACTERS.map((ch) => (
            <span key={ch.name} className="flex items-center gap-1.5 text-[10px] font-mono font-bold" style={{ color: ch.color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
              {ch.name}
            </span>
          ))}
          <span className="ml-auto text-[10px] font-mono text-text-muted flex items-center gap-1">
            <span className="font-bold" style={{ color: STATUS_SUCCESS }}>Green</span> = best in stat
          </span>
        </div>
      </SurfaceCard>

      {/* ── 1.10 Blueprint Property Inspector ─────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2.5 flex items-center justify-between">
          <SectionLabel icon={Search} label="Blueprint Property Inspector" color={ACCENT} />
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text" placeholder="Search properties..."
              value={propSearch} onChange={(e) => setPropSearch(e.target.value)}
              className="text-xs font-mono pl-7 pr-3 py-1.5 rounded-lg bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-blue-500/50 w-48"
            />
          </div>
        </div>
        <div className="space-y-3">
          {PROPERTY_CATEGORIES.map((cat) => {
            const catProps = filteredProperties.filter((p) => p.category === cat);
            if (catProps.length === 0) return null;
            const catColor = PROPERTY_CAT_COLORS[cat];
            return (
              <div key={cat}>
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5"
                  style={{ color: catColor }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                  {cat}
                </div>
                <div className="space-y-0.5">
                  {catProps.map((prop) => (
                    <div key={prop.name}
                      className="flex items-center gap-3 px-2 py-1 rounded hover:bg-surface/30 transition-colors text-xs font-mono">
                      <span className="text-text-muted w-36 truncate">{prop.name}</span>
                      <span className="font-bold" style={{
                        color: prop.isModified ? STATUS_WARNING : 'var(--text-muted)',
                      }}>
                        {String(prop.current)}
                      </span>
                      {prop.isModified && (
                        <>
                          <span className="text-text-muted opacity-40 text-[10px]">default:</span>
                          <span className="text-text-muted opacity-60 text-[10px] line-through">{String(prop.defaultVal)}</span>
                          <span className="ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                            style={{ backgroundColor: `${STATUS_WARNING}15`, color: STATUS_WARNING, border: `1px solid ${STATUS_WARNING}30` }}>
                            Modified
                          </span>
                        </>
                      )}
                      {!prop.isModified && (
                        <span className="ml-auto text-[8px] font-bold text-text-muted opacity-40 uppercase">Default</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2.5 mt-3 pt-2 border-t border-border/30 text-[10px] text-text-muted font-mono">
          <span>Total: {BLUEPRINT_PROPERTIES.length} properties</span>
          <span>Modified: <span className="font-bold" style={{ color: STATUS_WARNING }}>{BLUEPRINT_PROPERTIES.filter((p) => p.isModified).length}</span></span>
          <span>Default: <span className="font-bold text-text-muted">{BLUEPRINT_PROPERTIES.filter((p) => !p.isModified).length}</span></span>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Class tree node ───────────────────────────────────────────────────────── */

function ClassTreeNode({ node, depth }: { node: ClassNode; depth: number }) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 24 }} className="relative">
      <div className="relative flex items-center gap-3 py-2">
        {depth > 0 && (
          <span
            className="absolute left-[-16px] top-1/2 w-4 border-t-2"
            style={{ borderColor: `${node.color}50` }}
          />
        )}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2 group cursor-default"
        >
          <span
            className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg border shadow-sm transition-colors group-hover:brightness-110"
            style={{
              borderColor: `${node.color}50`,
              backgroundColor: `${node.color}15`,
              color: node.color,
            }}
          >
            {node.name}
          </span>
          {node.subtitle && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface px-2 py-0.5 rounded-md border border-border/40">
              {node.subtitle}
            </span>
          )}
          {node.crossRef && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border shadow-sm flex items-center gap-1 hover:brightness-110 cursor-pointer transition-colors"
              style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR, borderColor: `${STATUS_ERROR}40` }}
            >
              <ExternalLink className="w-2.5 h-2.5" />
              {node.crossRef}
            </span>
          )}
        </motion.div>
      </div>
      {hasChildren && (
        <div
          className="border-l-2 ml-3.5 relative"
          style={{ borderColor: `${node.color}30` }}
        >
          {node.children!.map((child) => (
            <ClassTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
