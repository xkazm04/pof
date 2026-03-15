'use client';

import { useMemo, useState, useCallback } from 'react';
import { Skull, Crosshair, Shield, ChevronDown, ChevronRight, Zap, Eye, Brain, Target, TrendingUp, Users, Wrench, BarChart3, Bug, Swords, Map as MapIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, LoadingSpinner, RadarChart, SubTabNavigation, SubTab } from './_shared';

const ACCENT = MODULE_COLORS.core;

/* ── Archetype definitions ─────────────────────────────────────────────── */

type EnemyRole = 'melee' | 'ranged' | 'tank';

interface ArchetypeConfig {
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

type GroupBy = 'none' | 'class' | 'role';

const ARCHETYPES: ArchetypeConfig[] = [
  {
    id: 'grunt',
    label: 'Melee Grunt',
    icon: Skull,
    color: '#ef4444',
    class: 'Warrior',
    role: 'melee',
    stats: [
      { label: 'HP', value: 80 },
      { label: 'Damage', value: 65 },
      { label: 'Speed', value: 70 },
      { label: 'Range', value: 20 },
    ],
    abilities: ['Slash Attack', 'Shield Bash', 'Charge'],
    btSummary: {
      Idle: 'Stand and look around',
      Patrol: 'Walk waypoint path',
      Chase: 'Sprint to player',
      Attack: 'Melee combo swing',
    },
    featureName: 'Enemy archetypes',
  },
  {
    id: 'caster',
    label: 'Ranged Caster',
    icon: Crosshair,
    color: '#a855f7',
    class: 'Mage',
    role: 'ranged',
    stats: [
      { label: 'HP', value: 45 },
      { label: 'Damage', value: 90 },
      { label: 'Speed', value: 40 },
      { label: 'Range', value: 95 },
    ],
    abilities: ['Fireball', 'Frost Nova', 'Teleport'],
    btSummary: {
      Idle: 'Scan for threats',
      Patrol: 'Float between positions',
      Chase: 'Maintain safe distance',
      Attack: 'Cast ranged projectile',
    },
    featureName: 'Enemy archetypes',
  },
  {
    id: 'brute',
    label: 'Brute',
    icon: Shield,
    color: '#f59e0b',
    class: 'Tank',
    role: 'melee',
    stats: [
      { label: 'HP', value: 100 },
      { label: 'Damage', value: 85 },
      { label: 'Speed', value: 30 },
      { label: 'Range', value: 35 },
    ],
    abilities: ['Heavy Slam', 'Stomp AoE', 'Taunt'],
    btSummary: {
      Idle: 'Guard assigned area',
      Patrol: 'Slow stomp circuit',
      Chase: 'Charge with knockback',
      Attack: 'Ground slam AoE',
    },
    featureName: 'Enemy archetypes',
  },
];

/* ── AI pipeline nodes ─────────────────────────────────────────────────── */

const AI_PIPELINE = [
  { label: 'AIController', featureName: 'AARPGAIController' },
  { label: 'Perception', featureName: 'AI Perception' },
  { label: 'Behavior Tree', featureName: 'Behavior Tree' },
  { label: 'EQS', featureName: 'EQS queries' },
  { label: 'Actions', featureName: 'Enemy Gameplay Abilities' },
];

/* ── 5.1 Archetype Comparison Radar data ─────────────────────────────── */

const RADAR_AXES = ['HP', 'Damage', 'Speed', 'Range', 'Aggression', 'Resilience', 'Intelligence'];

const RADAR_GRUNT: RadarDataPoint[] = [
  { axis: 'HP', value: 0.80 }, { axis: 'Damage', value: 0.65 }, { axis: 'Speed', value: 0.70 },
  { axis: 'Range', value: 0.20 }, { axis: 'Aggression', value: 0.85 }, { axis: 'Resilience', value: 0.55 },
  { axis: 'Intelligence', value: 0.30 },
];

const RADAR_CASTER: RadarDataPoint[] = [
  { axis: 'HP', value: 0.45 }, { axis: 'Damage', value: 0.90 }, { axis: 'Speed', value: 0.40 },
  { axis: 'Range', value: 0.95 }, { axis: 'Aggression', value: 0.50 }, { axis: 'Resilience', value: 0.25 },
  { axis: 'Intelligence', value: 0.90 },
];

const RADAR_BRUTE: RadarDataPoint[] = [
  { axis: 'HP', value: 1.00 }, { axis: 'Damage', value: 0.85 }, { axis: 'Speed', value: 0.30 },
  { axis: 'Range', value: 0.35 }, { axis: 'Aggression', value: 0.70 }, { axis: 'Resilience', value: 0.95 },
  { axis: 'Intelligence', value: 0.20 },
];

const RADAR_PLAYER: RadarDataPoint[] = [
  { axis: 'HP', value: 0.70 }, { axis: 'Damage', value: 0.75 }, { axis: 'Speed', value: 0.80 },
  { axis: 'Range', value: 0.60 }, { axis: 'Aggression', value: 0.60 }, { axis: 'Resilience', value: 0.65 },
  { axis: 'Intelligence', value: 0.70 },
];

/* ── 5.2 Behavior Tree Flowchart data ────────────────────────────────── */

interface BtNode {
  id: string;
  label: string;
  shape: 'diamond' | 'rect' | 'rounded' | 'hexagon';
  x: number;
  y: number;
  active: boolean;
  details: string;
}

interface BtEdge {
  from: string;
  to: string;
  active: boolean;
}

const BT_NODES: BtNode[] = [
  { id: 'root', label: 'Root Selector', shape: 'diamond', x: 120, y: 15, active: true, details: 'Evaluates children left-to-right. Succeeds on first child success.' },
  { id: 'seq-combat', label: 'Seq:Combat', shape: 'rect', x: 51.4, y: 60, active: true, details: 'Sequence node: all children must succeed for combat engagement.' },
  { id: 'seq-patrol', label: 'Seq:Patrol', shape: 'rect', x: 188.6, y: 60, active: false, details: 'Sequence node: patrol waypoint loop with idle pauses.' },
  { id: 'dec-target', label: 'HasTarget?', shape: 'hexagon', x: 17.1, y: 105, active: true, details: 'Decorator: checks blackboard for valid target reference (not null, alive, in range).' },
  { id: 'dec-range', label: 'InRange?', shape: 'hexagon', x: 85.7, y: 105, active: true, details: 'Decorator: evaluates distance < AttackRange (500cm default). Returns success/fail.' },
  { id: 'task-attack', label: 'Attack', shape: 'rounded', x: 17.1, y: 150, active: true, details: 'Task: execute melee/ranged attack ability. Cooldown: 1.2s. Damage: based on archetype.' },
  { id: 'task-chase', label: 'Chase', shape: 'rounded', x: 85.7, y: 150, active: false, details: 'Task: move toward target using NavMesh pathfinding. Speed multiplier: 1.5x base.' },
  { id: 'task-wander', label: 'Wander', shape: 'rounded', x: 188.6, y: 105, active: false, details: 'Task: random point in 600cm radius via EQS. Idle 2-4s between moves.' },
];

const BT_EDGES: BtEdge[] = [
  { from: 'root', to: 'seq-combat', active: true },
  { from: 'root', to: 'seq-patrol', active: false },
  { from: 'seq-combat', to: 'dec-target', active: true },
  { from: 'seq-combat', to: 'dec-range', active: true },
  { from: 'dec-target', to: 'task-attack', active: true },
  { from: 'dec-range', to: 'task-chase', active: false },
  { from: 'seq-patrol', to: 'task-wander', active: false },
];

/* ── 5.3 Perception Cone data ────────────────────────────────────────── */

interface DetectedEntity {
  label: string;
  x: number;
  y: number;
  color: string;
  inCone: boolean;
  inHearing: boolean;
}

const DETECTED_ENTITIES: DetectedEntity[] = [
  { label: 'Player', x: 44.7, y: 24.4, color: '#ef4444', inCone: true, inHearing: true },
  { label: 'NPC', x: 93.4, y: 81.3, color: '#4ade80', inCone: false, inHearing: true },
  { label: 'Distant', x: 20.3, y: 109.7, color: '#6b7280', inCone: false, inHearing: false },
];

/* ── 5.4 Difficulty Curve data ───────────────────────────────────────── */

interface DifficultyPoint { level: number; value: number; }

const DIFFICULTY_GRUNT: DifficultyPoint[] = [
  { level: 1, value: 85 }, { level: 5, value: 75 }, { level: 10, value: 60 },
  { level: 15, value: 50 }, { level: 20, value: 40 }, { level: 25, value: 30 },
  { level: 30, value: 22 }, { level: 35, value: 15 }, { level: 40, value: 10 },
  { level: 45, value: 8 }, { level: 50, value: 5 },
];

const DIFFICULTY_CASTER: DifficultyPoint[] = [
  { level: 1, value: 95 }, { level: 5, value: 88 }, { level: 10, value: 78 },
  { level: 15, value: 68 }, { level: 20, value: 58 }, { level: 25, value: 48 },
  { level: 30, value: 40 }, { level: 35, value: 32 }, { level: 40, value: 25 },
  { level: 45, value: 20 }, { level: 50, value: 15 },
];

const DIFFICULTY_BRUTE: DifficultyPoint[] = [
  { level: 1, value: 100 }, { level: 5, value: 95 }, { level: 10, value: 90 },
  { level: 15, value: 82 }, { level: 20, value: 72 }, { level: 25, value: 62 },
  { level: 30, value: 55 }, { level: 35, value: 48 }, { level: 40, value: 40 },
  { level: 45, value: 32 }, { level: 50, value: 28 },
];

/* ── 5.5 Spawn Wave Choreographer data ───────────────────────────────── */

interface SpawnPoint { id: number; x: number; y: number; order: number; }

const SPAWN_POINTS: SpawnPoint[] = [
  { id: 1, x: 70, y: 15.6, order: 1 },
  { id: 2, x: 116.7, y: 38.9, order: 2 },
  { id: 3, x: 116.7, y: 93.3, order: 3 },
  { id: 4, x: 70, y: 120.6, order: 4 },
  { id: 5, x: 23.3, y: 93.3, order: 5 },
  { id: 6, x: 23.3, y: 38.9, order: 6 },
];

interface WaveConfig { id: number; delay: string; count: number; archetype: string; }

const WAVE_TIMELINE: WaveConfig[] = [
  { id: 1, delay: '0s', count: 3, archetype: 'Grunt' },
  { id: 2, delay: '60s', count: 4, archetype: 'Mixed' },
  { id: 3, delay: '120s', count: 5, archetype: 'Brute+Caster' },
];

/* ── 5.6 Archetype Builder ───────────────────────────────────────────── */

const ABILITY_POOL = ['Slash Attack', 'Shield Bash', 'Charge', 'Fireball', 'Frost Nova', 'Teleport', 'Heavy Slam', 'Stomp AoE', 'Taunt', 'Poison Dart', 'Heal Aura', 'Berserk'];
const BT_PRESETS = ['Aggressive', 'Defensive', 'Passive'] as const;

/* ── 5.7 Kill/Death Statistics data ──────────────────────────────────── */

interface ArchetypeStats {
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

const KILL_DEATH_STATS: ArchetypeStats[] = [
  { id: 'grunt', label: 'Melee Grunt', color: '#ef4444', timesSpawned: 1247, timesKilled: 1198, avgLifespan: '18.3s', totalDmgDealt: 45230, killsOnPlayer: 23, dangerRank: 2 },
  { id: 'caster', label: 'Ranged Caster', color: '#a855f7', timesSpawned: 843, timesKilled: 801, avgLifespan: '24.7s', totalDmgDealt: 67890, killsOnPlayer: 31, dangerRank: 3 },
  { id: 'brute', label: 'Brute', color: '#f59e0b', timesSpawned: 412, timesKilled: 356, avgLifespan: '42.1s', totalDmgDealt: 89450, killsOnPlayer: 67, dangerRank: 1 },
];

const DEATH_CAUSES = [
  { cause: 'Sword', pct: 45, color: '#ef4444' },
  { cause: 'Fireball', pct: 30, color: '#f59e0b' },
  { cause: 'Fall', pct: 15, color: '#3b82f6' },
  { cause: 'Other', pct: 10, color: '#6b7280' },
];

/* ── 5.8 AI Decision Debugger data ───────────────────────────────────── */

interface DecisionEntry {
  tick: number;
  type: 'evaluation' | 'selection' | 'unexpected';
  summary: string;
  details: string;
}

const DECISION_LOG: DecisionEntry[] = [
  { tick: 847, type: 'evaluation', summary: 'Evaluated Chase->Attack path', details: 'InRange=true (450cm < 500cm). Blackboard: TargetActor=BP_PlayerCharacter_C1, LastKnownPos=(1240, 830, 0). Selected: Attack_Melee with priority 0.92.' },
  { tick: 848, type: 'selection', summary: 'Selected Attack_Melee ability', details: 'Cooldown check: READY (elapsed 1.8s > 1.2s CD). Damage roll: 65 * 1.1 modifier = 71.5. Animation montage: AM_Slash_01 queued.' },
  { tick: 851, type: 'unexpected', summary: 'Target lost during attack windup', details: 'Target moved behind cover at tick 850. LOS check failed. Aborting Attack_Melee, falling back to Chase state. NavMesh recalculation triggered.' },
  { tick: 855, type: 'evaluation', summary: 'EQS query: FindFlankPosition', details: 'Scored 8 candidate positions. Best: (1340, 790, 0) score=0.87. Factors: distance_to_target=0.9, cover_value=0.85, teammate_spacing=0.8.' },
  { tick: 860, type: 'selection', summary: 'Patrol fallback after chase timeout', details: 'Chase duration exceeded MaxChaseTime (15s). Target distance: 2100cm > MaxChaseRange (1500cm). Returning to last patrol waypoint index=3.' },
];

/* ── 5.9 Aggro Table data ────────────────────────────────────────────── */

interface AggroEntry {
  target: string;
  threat: number;
  color: string;
  breakdown: { source: string; pct: number }[];
}

const AGGRO_TABLE: AggroEntry[] = [
  { target: 'Player', threat: 85, color: '#ef4444', breakdown: [{ source: 'Damage', pct: 60 }, { source: 'Proximity', pct: 25 }, { source: 'Taunt', pct: 15 }] },
  { target: 'Companion', threat: 45, color: '#f59e0b', breakdown: [{ source: 'Damage', pct: 55 }, { source: 'Proximity', pct: 35 }, { source: 'Taunt', pct: 10 }] },
  { target: 'Decoy', threat: 20, color: '#fbbf24', breakdown: [{ source: 'Damage', pct: 10 }, { source: 'Proximity', pct: 30 }, { source: 'Taunt', pct: 60 }] },
];

interface AggroEvent { time: string; from: string; to: string; reason: string; }

const AGGRO_EVENTS: AggroEvent[] = [
  { time: '00:42', from: 'Companion', to: 'Player', reason: 'Player dealt 340 burst damage' },
  { time: '01:15', from: 'Player', to: 'Decoy', reason: 'Decoy ability: Taunt (forced 3s)' },
  { time: '01:28', from: 'Decoy', to: 'Player', reason: 'Taunt expired, Player proximity closest' },
];

/* ── 5.10 Enemy Group Tactics data ───────────────────────────────────── */

interface TacticsEnemy {
  id: number;
  x: number;
  y: number;
  role: 'attacking' | 'flanking' | 'waiting';
  label: string;
}

const TACTICS_ENEMIES: TacticsEnemy[] = [
  { id: 1, x: 48, y: 32, role: 'attacking', label: 'ATK-1' },
  { id: 2, x: 112, y: 44, role: 'attacking', label: 'ATK-2' },
  { id: 3, x: 128, y: 96, role: 'flanking', label: 'FLK-1' },
  { id: 4, x: 24, y: 104, role: 'waiting', label: 'WAIT-1' },
  { id: 5, x: 136, y: 24, role: 'waiting', label: 'WAIT-2' },
];

const TACTICS_ROLE_COLORS: Record<TacticsEnemy['role'], string> = {
  attacking: '#ef4444',
  flanking: '#f59e0b',
  waiting: '#6b7280',
};

/* ── Component ─────────────────────────────────────────────────────────── */

interface EnemyBestiaryProps {
  moduleId: SubModuleId;
}

export function EnemyBestiary({ moduleId }: EnemyBestiaryProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedArchetype, setExpandedArchetype] = useState<string | null>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  /* 5.1 Radar overlay toggles */
  const [activeTab, setActiveTab] = useState('archetypes');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'archetypes', label: 'Archetypes & Stats', icon: Skull },
    { id: 'ai-logic', label: 'AI Logic & Senses', icon: Brain },
    { id: 'encounters', label: 'Encounters', icon: Swords },
  ], []);

  const [radarOverlays, setRadarOverlays] = useState<Record<string, boolean>>({ grunt: true, caster: true, brute: true, player: true });

  /* 5.2 BT expanded node */
  const [btExpandedNode, setBtExpandedNode] = useState<string | null>(null);

  /* 5.4 Difficulty hover */
  const [diffHoverLevel, setDiffHoverLevel] = useState<number | null>(null);

  /* 5.6 Archetype Builder state */
  const [builderName, setBuilderName] = useState('Custom Enemy');
  const [builderStats, setBuilderStats] = useState({ HP: 50, Damage: 50, Speed: 50, Range: 50 });
  const [builderAbilities, setBuilderAbilities] = useState<string[]>([]);
  const [builderBT, setBuilderBT] = useState<typeof BT_PRESETS[number]>('Aggressive');

  /* 5.8 Decision debugger filter */
  const [debugFilter, setDebugFilter] = useState<DecisionEntry['type'] | 'all'>('all');
  const [debugExpanded, setDebugExpanded] = useState<number | null>(null);

  /* 5.5 Spawn formation */
  const [spawnFormation, setSpawnFormation] = useState<'Circle' | 'Line' | 'Ambush'>('Circle');

  const groupedArchetypes = useMemo(() => {
    if (groupBy === 'none') return [{ header: null, items: ARCHETYPES }];
    const groups = new Map<string, ArchetypeConfig[]>();
    for (const a of ARCHETYPES) {
      const key = groupBy === 'class' ? a.class : a.role;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return Array.from(groups.entries()).map(([header, items]) => ({ header, items }));
  }, [groupBy]);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0, missing = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
      else if (status === 'missing') missing++;
    }
    return { total, implemented, partial, missing };
  }, [defs, featureMap]);

  const toggleArchetype = useCallback((id: string) => {
    setExpandedArchetype((prev) => (prev === id ? null : id));
  }, []);

  /* 5.1 Build active overlays */
  const activeOverlays = useMemo(() => {
    const overlays: { data: RadarDataPoint[]; color: string; label: string }[] = [];
    if (radarOverlays.grunt) overlays.push({ data: RADAR_GRUNT, color: '#ef4444', label: 'Grunt' });
    if (radarOverlays.caster) overlays.push({ data: RADAR_CASTER, color: '#a855f7', label: 'Caster' });
    if (radarOverlays.brute) overlays.push({ data: RADAR_BRUTE, color: '#f59e0b', label: 'Brute' });
    return overlays;
  }, [radarOverlays]);

  /* 5.8 Filtered decision log */
  const filteredDecisions = useMemo(() => {
    if (debugFilter === 'all') return DECISION_LOG;
    return DECISION_LOG.filter(d => d.type === debugFilter);
  }, [debugFilter]);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  /* 5.4 Difficulty chart helpers */
  const chartW = 280, chartH = 120, chartPadL = 30, chartPadB = 20;
  const plotW = chartW - chartPadL - 10, plotH = chartH - chartPadB - 10;
  const toChartX = (level: number) => chartPadL + ((level - 1) / 49) * plotW;
  const toChartY = (value: number) => 10 + plotH * (1 - value / 100);
  const polyline = (pts: DifficultyPoint[]) => pts.map(p => `${toChartX(p.level)},${toChartY(p.value)}`).join(' ');

  return (
    <div className="space-y-2.5">
      {/* Header with stats */}
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Skull} title="Enemy Bestiary" implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>


      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'archetypes' && (
            <motion.div
              key="archetypes"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              {/* Group filter bar */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted font-medium">Group by:</span>
                {(['none', 'class', 'role'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${groupBy === g ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text hover:bg-surface-hover/50'
                      }`}
                  >
                    {g === 'none' ? 'None' : g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>

              {/* Archetype cards */}
              {groupedArchetypes.map((group) => (
                <div key={group.header ?? 'all'}>
                  {group.header && (
                    <div className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2 mt-2">{group.header}</div>
                  )}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {group.items.map((archetype, i) => (
                      <motion.div key={archetype.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                        <ArchetypeCard
                          archetype={archetype}
                          featureMap={featureMap}
                          expanded={expandedArchetype === archetype.id}
                          onToggle={toggleArchetype}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}


              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* ══════════════════════════════════════════════════════════════════════
          5.1 Archetype Comparison Radar
         ══════════════════════════════════════════════════════════════════════ */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
                  <SectionLabel icon={Target} label="Archetype Comparison Radar" color={ACCENT} />
                  <div className="mt-3 flex flex-col md:flex-row items-start gap-2.5">
                    <div className="flex-shrink-0">
                      <RadarChart
                        data={radarOverlays.player ? RADAR_PLAYER : RADAR_AXES.map(a => ({ axis: a, value: 0 }))}
                        size={200}
                        accent={radarOverlays.player ? '#3b82f6' : 'transparent'}
                        overlays={activeOverlays}
                        showLabels
                      />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Toggle Overlays</div>
                      {[
                        { key: 'grunt', label: 'Grunt', color: '#ef4444' },
                        { key: 'caster', label: 'Caster', color: '#a855f7' },
                        { key: 'brute', label: 'Brute', color: '#f59e0b' },
                        { key: 'player', label: 'Player (base)', color: '#3b82f6' },
                      ].map(item => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer text-xs group">
                          <input
                            type="checkbox"
                            checked={radarOverlays[item.key]}
                            onChange={() => setRadarOverlays(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                            className="rounded border-border accent-blue-500"
                          />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-text-muted group-hover:text-text transition-colors font-medium">{item.label}</span>
                          {item.key === 'player' && <span className="text-[10px] text-text-muted opacity-60 ml-1">(dashed)</span>}
                        </label>
                      ))}
                      <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                        7-axis comparison: HP, Damage, Speed, Range, Aggression, Resilience, Intelligence. Values normalized 0-1.
                      </p>
                    </div>
                  </div>
                </SurfaceCard>


                {/* ══════════════════════════════════════════════════════════════════════
          5.7 Kill/Death Statistics per Archetype
         ══════════════════════════════════════════════════════════════════════ */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
                  <SectionLabel icon={BarChart3} label="Kill/Death Statistics" color="#f87171" />
                  <div className="mt-3 space-y-2.5">
                    {/* Stats cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {KILL_DEATH_STATS.map(arch => (
                        <motion.div
                          key={arch.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-surface-deep rounded-lg border p-3 space-y-2 relative overflow-hidden"
                          style={{ borderColor: `${arch.color}30` }}
                        >
                          <div className="absolute top-0 right-0 w-16 h-16 blur-2xl rounded-full pointer-events-none" style={{ backgroundColor: `${arch.color}10` }} />
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-text">{arch.label}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                              style={{ backgroundColor: `${arch.color}15`, borderColor: `${arch.color}40`, color: arch.color }}>
                              #{arch.dangerRank}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                            <div className="flex justify-between"><span className="text-text-muted">Spawned</span><span className="font-mono font-bold text-text">{arch.timesSpawned.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Killed</span><span className="font-mono font-bold text-text">{arch.timesKilled.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Avg Life</span><span className="font-mono font-bold text-text">{arch.avgLifespan}</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Player Kills</span><span className="font-mono font-bold" style={{ color: arch.color }}>{arch.killsOnPlayer}</span></div>
                            <div className="col-span-2 flex justify-between"><span className="text-text-muted">Total Dmg</span><span className="font-mono font-bold text-text">{arch.totalDmgDealt.toLocaleString()}</span></div>
                          </div>
                          {/* Mini bar */}
                          <div className="h-1 rounded-full bg-surface overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(arch.killsOnPlayer / 67) * 100}%`, backgroundColor: arch.color }} />
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Death causes pie chart + bar comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {/* Pie chart of death causes */}
                      <div className="bg-surface-deep rounded-lg border border-border/30 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Death Causes</div>
                        <div className="flex items-center gap-3">
                          <svg width={64} height={64} viewBox="0 0 64 64" className="flex-shrink-0">
                            {(() => {
                              let cumAngle = 0;
                              return DEATH_CAUSES.map(dc => {
                                const startAngle = cumAngle;
                                const sliceAngle = (dc.pct / 100) * 360;
                                cumAngle += sliceAngle;
                                const startRad = (startAngle - 90) * (Math.PI / 180);
                                const endRad = (startAngle + sliceAngle - 90) * (Math.PI / 180);
                                const largeArc = sliceAngle > 180 ? 1 : 0;
                                const x1 = 32 + 28 * Math.cos(startRad);
                                const y1 = 32 + 28 * Math.sin(startRad);
                                const x2 = 32 + 28 * Math.cos(endRad);
                                const y2 = 32 + 28 * Math.sin(endRad);
                                return (
                                  <path
                                    key={dc.cause}
                                    d={`M 32 32 L ${x1} ${y1} A 28 28 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                    fill={dc.color} opacity={0.8}
                                  />
                                );
                              });
                            })()}
                          </svg>
                          <div className="space-y-1">
                            {DEATH_CAUSES.map(dc => (
                              <div key={dc.cause} className="flex items-center gap-1.5 text-[10px]">
                                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: dc.color }} />
                                <span className="text-text-muted font-medium">{dc.cause}</span>
                                <span className="font-mono font-bold text-text ml-auto">{dc.pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Danger ranking bar comparison */}
                      <div className="bg-surface-deep rounded-lg border border-border/30 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Danger Ranking (Player Kills)</div>
                        <div className="space-y-2">
                          {[...KILL_DEATH_STATS].sort((a, b) => a.dangerRank - b.dangerRank).map(arch => (
                            <div key={arch.id} className="space-y-0.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-medium text-text">{arch.label}</span>
                                <span className="font-mono font-bold" style={{ color: arch.color }}>{arch.killsOnPlayer} kills</span>
                              </div>
                              <div className="h-2 rounded-full bg-surface overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: arch.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(arch.killsOnPlayer / 67) * 100}%` }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </SurfaceCard>


              </div>
            </motion.div>
          )}
          {activeTab === 'ai-logic' && (
            <motion.div
              key="ai-logic"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {/* AI Infrastructure pipeline */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent pointer-events-none" />
                  <SectionLabel icon={Zap} label="AI Infrastructure Pipeline" />
                  <div className="mt-2.5 relative z-10">
                    <PipelineFlow
                      steps={AI_PIPELINE.map(n => ({ label: n.label, status: (featureMap.get(n.featureName)?.status ?? 'unknown') as FeatureStatus }))}
                      accent={MODULE_COLORS.core}
                      showStatus
                    />
                  </div>
                </SurfaceCard>

                {/* Spawn config collapsible */}
                <SurfaceCard level={2} className="p-0 overflow-hidden relative group border-border/60 hover:border-text-muted/40 transition-colors h-fit">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
                  <button
                    onClick={() => setSpawnOpen((v) => !v)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/30 transition-colors text-left relative z-10 focus:outline-none"
                  >
                    <motion.div animate={{ rotate: spawnOpen ? 90 : 0 }}>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text transition-colors" />
                    </motion.div>
                    <span className="text-sm font-bold text-text">Wave Spawner Configurator</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ml-auto border shadow-sm"
                      style={{
                        backgroundColor: STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].bg,
                        color: STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].dot,
                        borderColor: `${STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].dot}40`
                      }}>
                      {STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'].label}
                    </span>
                  </button>
                  <AnimatePresence>
                    {spawnOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden relative z-10"
                      >
                        <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-3 bg-surface/30">
                          <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface-deep p-3 rounded-lg border border-border/40">
                            Wave-based spawner drives enemy density. Each wave config specifies archetype pool, count range, spawn radius, and inter-spawn delay.
                          </p>
                          <div className="flex gap-3 mt-1">
                            {[{ label: 'Wave Inter', value: '60s' }, { label: 'Max Active', value: '12' }, { label: 'Spawn Radius', value: '800cm' }].map((item) => (
                              <div key={item.label} className="flex-1 flex flex-col items-center py-2 px-3 rounded-xl text-center border shadow-sm"
                                style={{ backgroundColor: `${ACCENT}10`, borderColor: `${ACCENT}30` }}>
                                <span className="text-sm font-mono font-bold text-text">{item.value}</span>
                                <span className="text-[10px] uppercase font-bold text-text-muted mt-1 tracking-wider">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SurfaceCard>
              </div>


              {/* ══════════════════════════════════════════════════════════════════════
          5.3 Perception Cone Visualizer
         ══════════════════════════════════════════════════════════════════════ */}
              <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
                <SectionLabel icon={Eye} label="Perception Cone Visualizer" color="#06b6d4" />
                <div className="mt-3 flex items-center gap-2.5">
                  <svg width={130} height={130} viewBox="0 0 130 130" className="flex-shrink-0">
                    {/* Background grid */}
                    {[32.5, 65, 97.5].map(r => (
                      <circle key={r} cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    ))}
                    {/* Hearing circle (800cm radius - scaled) */}
                    <circle cx={65} cy={65} r={44.7} fill="none" stroke="rgba(6,182,212,0.25)" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* Sight cone: 60 degrees, pointing up-left */}
                    <path
                      d={`M 65 65 L ${65 + 56.9 * Math.cos(-Math.PI / 2 - Math.PI / 6)} ${65 + 56.9 * Math.sin(-Math.PI / 2 - Math.PI / 6)} A 56.9 56.9 0 0 1 ${65 + 56.9 * Math.cos(-Math.PI / 2 + Math.PI / 6)} ${65 + 56.9 * Math.sin(-Math.PI / 2 + Math.PI / 6)} Z`}
                      fill="rgba(6,182,212,0.12)" stroke="rgba(6,182,212,0.5)" strokeWidth="1.5"
                    />
                    {/* AI center */}
                    <circle cx={65} cy={65} r={5} fill="#06b6d4" style={{ filter: 'drop-shadow(0 0 6px #06b6d4)' }} />
                    <text x={65} y={77.2} textAnchor="middle" className="text-[8px] font-mono font-bold fill-[#06b6d4]">AI</text>
                    {/* Detected entities */}
                    {DETECTED_ENTITIES.map(e => (
                      <g key={e.label}>
                        <circle cx={e.x} cy={e.y} r={4} fill={e.color} style={{ filter: `drop-shadow(0 0 4px ${e.color})` }} />
                        <text x={e.x} y={e.y - 8} textAnchor="middle" className="text-[7px] font-mono font-bold" fill={e.color}>{e.label}</text>
                      </g>
                    ))}
                    {/* Range labels */}
                    <text x={65} y={17.9} textAnchor="middle" className="text-[7px] font-mono fill-[rgba(255,255,255,0.3)]">1500cm</text>
                    <text x={111.3} y={65} textAnchor="middle" className="text-[7px] font-mono fill-[rgba(255,255,255,0.3)]">800cm</text>
                  </svg>
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Sense Legend</div>
                    {[
                      { label: 'Sight Cone', desc: '60 deg, 1500cm', color: 'rgba(6,182,212,0.5)', style: 'solid' },
                      { label: 'Hearing Range', desc: '800cm radius', color: 'rgba(6,182,212,0.25)', style: 'dashed' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2 text-xs">
                        <div className="w-5 h-[2px] flex-shrink-0" style={{ backgroundColor: s.color, borderTop: s.style === 'dashed' ? `2px dashed ${s.color}` : undefined }} />
                        <span className="font-medium text-text">{s.label}</span>
                        <span className="text-text-muted text-[10px]">{s.desc}</span>
                      </div>
                    ))}
                    <div className="border-t border-border/30 pt-2 space-y-1.5 mt-2">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Detected</div>
                      {DETECTED_ENTITIES.map(e => (
                        <div key={e.label} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                          <span className="font-medium text-text">{e.label}</span>
                          <span className="text-[10px] text-text-muted">
                            {e.inCone ? 'In sight' : e.inHearing ? 'Heard' : 'Undetected'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SurfaceCard>


              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* ══════════════════════════════════════════════════════════════════════
          5.2 Behavior Tree Flowchart
         ══════════════════════════════════════════════════════════════════════ */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
                  <SectionLabel icon={Brain} label="Behavior Tree Flowchart" color="#4ade80" />
                  <div className="mt-3 flex flex-col md:flex-row gap-2.5">
                    <svg width={240} height={180} viewBox="0 0 240 180" className="flex-shrink-0">
                      {/* Edges */}
                      {BT_EDGES.map(edge => {
                        const from = BT_NODES.find(n => n.id === edge.from)!;
                        const to = BT_NODES.find(n => n.id === edge.to)!;
                        return (
                          <line
                            key={`${edge.from}-${edge.to}`}
                            x1={from.x + 30} y1={from.y + 20}
                            x2={to.x + 30} y2={to.y}
                            stroke={edge.active ? '#4ade80' : 'rgba(255,255,255,0.15)'}
                            strokeWidth={edge.active ? 2 : 1}
                            strokeDasharray={edge.active ? undefined : '4 4'}
                          />
                        );
                      })}
                      {/* Nodes */}
                      {BT_NODES.map(node => {
                        const isSelected = btExpandedNode === node.id;
                        const fillColor = node.active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)';
                        const strokeColor = isSelected ? '#60a5fa' : node.active ? '#4ade80' : 'rgba(255,255,255,0.2)';
                        const w = 60, h = 28;
                        return (
                          <g key={node.id} onClick={() => setBtExpandedNode(prev => prev === node.id ? null : node.id)} className="cursor-pointer">
                            {node.shape === 'diamond' && (
                              <polygon
                                points={`${node.x + w / 2},${node.y} ${node.x + w},${node.y + h / 2} ${node.x + w / 2},${node.y + h} ${node.x},${node.y + h / 2}`}
                                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5}
                              />
                            )}
                            {node.shape === 'rect' && (
                              <rect x={node.x} y={node.y} width={w} height={h} rx={3}
                                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5}
                              />
                            )}
                            {node.shape === 'rounded' && (
                              <rect x={node.x} y={node.y} width={w} height={h} rx={14}
                                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5}
                              />
                            )}
                            {node.shape === 'hexagon' && (
                              <polygon
                                points={`${node.x + 10},${node.y} ${node.x + w - 10},${node.y} ${node.x + w},${node.y + h / 2} ${node.x + w - 10},${node.y + h} ${node.x + 10},${node.y + h} ${node.x},${node.y + h / 2}`}
                                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5}
                              />
                            )}
                            <text
                              x={node.x + w / 2} y={node.y + h / 2 + 1}
                              textAnchor="middle" dominantBaseline="central"
                              className="text-[8px] font-mono font-bold pointer-events-none"
                              fill={node.active ? '#4ade80' : 'rgba(255,255,255,0.5)'}
                            >
                              {node.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {/* Expanded node details panel */}
                    <div className="flex-1 min-w-0">
                      <AnimatePresence mode="sync">
                        {btExpandedNode ? (
                          <motion.div
                            key={btExpandedNode}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="bg-surface-deep p-3 rounded-lg border border-border/40 space-y-2"
                          >
                            <div className="text-xs font-bold text-text">{BT_NODES.find(n => n.id === btExpandedNode)?.label}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Shape:</span>
                              <span className="text-[10px] font-mono text-text">{BT_NODES.find(n => n.id === btExpandedNode)?.shape}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${BT_NODES.find(n => n.id === btExpandedNode)?.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {BT_NODES.find(n => n.id === btExpandedNode)?.active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed">{BT_NODES.find(n => n.id === btExpandedNode)?.details}</p>
                          </motion.div>
                        ) : (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-text-muted italic mt-2">
                            Click a node to view details. Green path shows current execution flow.
                          </motion.p>
                        )}
                      </AnimatePresence>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {[
                          { shape: 'diamond', label: 'Selector' },
                          { shape: 'rect', label: 'Sequence' },
                          { shape: 'rounded', label: 'Task' },
                          { shape: 'hexagon', label: 'Decorator' },
                        ].map(l => (
                          <span key={l.shape} className="text-[9px] font-mono text-text-muted flex items-center gap-1">
                            <span className="w-2 h-2 border border-text-muted/40 flex-shrink-0" style={{
                              borderRadius: l.shape === 'rounded' ? '50%' : l.shape === 'diamond' ? '0' : '2px',
                              transform: l.shape === 'diamond' ? 'rotate(45deg) scale(0.8)' : undefined,
                            }} />
                            {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </SurfaceCard>


                {/* ══════════════════════════════════════════════════════════════════════
          5.8 AI Decision Debugger
         ══════════════════════════════════════════════════════════════════════ */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
                  <SectionLabel icon={Bug} label="AI Decision Debugger" color="#fbbf24" />
                  <div className="mt-3 space-y-2">
                    {/* Filter buttons */}
                    <div className="flex gap-1.5 mb-2">
                      {(['all', 'evaluation', 'selection', 'unexpected'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setDebugFilter(f)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${debugFilter === f
                              ? f === 'unexpected' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-surface-hover text-text border border-border/50'
                              : 'text-text-muted hover:text-text bg-surface border border-border/30'
                            }`}
                        >
                          {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                    {/* Decision log */}
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-1.5">
                      {filteredDecisions.map(entry => {
                        const isExpanded = debugExpanded === entry.tick;
                        const isUnexpected = entry.type === 'unexpected';
                        return (
                          <motion.div
                            key={entry.tick}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`rounded border transition-colors ${isUnexpected ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/30 bg-surface-deep'
                              }`}
                          >
                            <button
                              onClick={() => setDebugExpanded(prev => prev === entry.tick ? null : entry.tick)}
                              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-hover/30 transition-colors focus:outline-none"
                            >
                              <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${isUnexpected ? 'text-amber-400' : 'text-text-muted'}`}>
                                #{entry.tick}
                              </span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${entry.type === 'evaluation' ? 'bg-blue-500/15 text-blue-400' :
                                  entry.type === 'selection' ? 'bg-emerald-500/15 text-emerald-400' :
                                    'bg-amber-500/15 text-amber-400'
                                }`}>
                                {entry.type}
                              </span>
                              <span className="text-xs text-text truncate">{entry.summary}</span>
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="ml-auto flex-shrink-0">
                                <ChevronDown className="w-3 h-3 text-text-muted" />
                              </motion.div>
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-2 border-t border-border/20">
                                    <p className="text-[10px] text-text-muted leading-relaxed mt-1.5 font-mono">{entry.details}</p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </SurfaceCard>


              </div>
            </motion.div>
          )}
          {activeTab === 'encounters' && (
            <motion.div
              key="encounters"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* ══════════════════════════════════════════════════════════════════════
            5.4 Enemy Difficulty Curve
           ══════════════════════════════════════════════════════════════════════ */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
                  <SectionLabel icon={TrendingUp} label="Enemy Difficulty Curve" color="#f87171" />
                  <div className="mt-3">
                    <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-[280px]"
                      onMouseLeave={() => setDiffHoverLevel(null)}
                    >
                      {/* Zones */}
                      <rect x={chartPadL} y={toChartY(100)} width={plotW} height={toChartY(70) - toChartY(100)} fill="rgba(239,68,68,0.08)" />
                      <rect x={chartPadL} y={toChartY(70)} width={plotW} height={toChartY(40) - toChartY(70)} fill="rgba(74,222,128,0.08)" />
                      <rect x={chartPadL} y={toChartY(40)} width={plotW} height={toChartY(0) - toChartY(40)} fill="rgba(107,114,128,0.06)" />
                      {/* Zone labels */}
                      <text x={chartPadL + 3} y={toChartY(88)} className="text-[7px] font-mono fill-[rgba(239,68,68,0.5)]">DANGER</text>
                      <text x={chartPadL + 3} y={toChartY(55)} className="text-[7px] font-mono fill-[rgba(74,222,128,0.5)]">SWEET SPOT</text>
                      <text x={chartPadL + 3} y={toChartY(20)} className="text-[7px] font-mono fill-[rgba(107,114,128,0.4)]">TRIVIAL</text>
                      {/* Grid lines */}
                      {[0, 25, 50, 75, 100].map(v => (
                        <line key={v} x1={chartPadL} y1={toChartY(v)} x2={chartPadL + plotW} y2={toChartY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                      ))}
                      {/* X axis labels */}
                      {[1, 10, 20, 30, 40, 50].map(l => (
                        <text key={l} x={toChartX(l)} y={chartH - 3} textAnchor="middle" className="text-[7px] font-mono fill-[var(--text-muted)]">Lv{l}</text>
                      ))}
                      {/* Lines */}
                      <polyline points={polyline(DIFFICULTY_GRUNT)} fill="none" stroke="#ef4444" strokeWidth="1.5" />
                      <polyline points={polyline(DIFFICULTY_CASTER)} fill="none" stroke="#a855f7" strokeWidth="1.5" />
                      <polyline points={polyline(DIFFICULTY_BRUTE)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                      {/* Hover line + floating tooltip */}
                      {diffHoverLevel !== null && (() => {
                        const hx = toChartX(diffHoverLevel);
                        const nearest = (pts: DifficultyPoint[]) => pts.reduce((a, b) => Math.abs(b.level - diffHoverLevel) < Math.abs(a.level - diffHoverLevel) ? b : a).value;
                        const archetypes = [
                          { label: 'Grunt', value: nearest(DIFFICULTY_GRUNT), color: '#ef4444' },
                          { label: 'Caster', value: nearest(DIFFICULTY_CASTER), color: '#a855f7' },
                          { label: 'Brute', value: nearest(DIFFICULTY_BRUTE), color: '#f59e0b' },
                        ];
                        const getZone = (v: number) => v >= 70 ? { label: 'DANGER', color: '#ef4444' } : v >= 40 ? { label: 'SWEET SPOT', color: '#4ade80' } : { label: 'TRIVIAL', color: '#6b7280' };
                        const tooltipW = 90;
                        const flipLeft = hx + tooltipW + 6 > chartW - 10;
                        const tx = flipLeft ? hx - tooltipW - 6 : hx + 6;
                        return (
                          <g>
                            <line x1={hx} y1={10} x2={hx} y2={chartH - chartPadB} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3" />
                            {archetypes.map(a => (
                              <circle key={a.label} cx={hx} cy={toChartY(a.value)} r={2.5} fill={a.color} />
                            ))}
                            <foreignObject x={tx} y={12} width={tooltipW} height={plotH - 4} style={{ pointerEvents: 'none', overflow: 'visible' }}>
                              <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 6px', fontSize: 9, lineHeight: 1.5 }}>
                                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>Lv {diffHoverLevel}</div>
                                {archetypes.map(a => {
                                  const zone = getZone(a.value);
                                  return (
                                    <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                      <span style={{ background: `${a.color}25`, color: a.color, borderRadius: 3, padding: '0 4px', fontFamily: 'monospace', fontWeight: 600, fontSize: 9, whiteSpace: 'nowrap' }}>
                                        {a.label}: {a.value}
                                      </span>
                                      <span style={{ color: zone.color, fontSize: 7, fontFamily: 'monospace', opacity: 0.8 }}>{zone.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </foreignObject>
                          </g>
                        );
                      })()}
                      {/* Invisible hover rects for interaction */}
                      {Array.from({ length: 50 }, (_, i) => i + 1).map(level => (
                        <rect
                          key={level}
                          x={toChartX(level) - (plotW / 49) / 2}
                          y={10}
                          width={plotW / 49}
                          height={plotH}
                          fill="transparent"
                          onMouseEnter={() => setDiffHoverLevel(level)}
                        />
                      ))}
                    </svg>
                    <div className="flex gap-3 mt-2">
                      {[{ label: 'Grunt', color: '#ef4444' }, { label: 'Caster', color: '#a855f7' }, { label: 'Brute', color: '#f59e0b' }].map(l => (
                        <span key={l.label} className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
                          <span className="w-3 h-[2px] flex-shrink-0" style={{ backgroundColor: l.color }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </SurfaceCard>
              </div>


              {/* ══════════════════════════════════════════════════════════════════════
          5.10 Enemy Group Tactics Planner
         ══════════════════════════════════════════════════════════════════════ */}
              <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
                <SectionLabel icon={MapIcon} label="Enemy Group Tactics Planner" color={ACCENT} />
                <div className="mt-3 flex flex-col md:flex-row gap-2.5">
                  {/* Tactical overview SVG */}
                  <svg width={160} height={120} viewBox="0 0 160 120" className="flex-shrink-0">
                    {/* Arena bounds */}
                    <rect x={4} y={4} width={152} height={112} rx={4} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
                    {/* Grid */}
                    {[40, 80, 120].map(x => <line key={`vg${x}`} x1={x} y1={4} x2={x} y2={116} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
                    {[30, 60, 90].map(y => <line key={`hg${y}`} x1={4} y1={y} x2={156} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
                    {/* Player at center */}
                    <circle cx={80} cy={60} r={8} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.5" />
                    <text x={80} y={60} textAnchor="middle" dominantBaseline="central" className="text-[7px] font-mono font-bold fill-[#3b82f6]">P</text>
                    {/* Enemies */}
                    {TACTICS_ENEMIES.map(enemy => {
                      const roleColor = TACTICS_ROLE_COLORS[enemy.role];
                      return (
                        <g key={enemy.id}>
                          <circle cx={enemy.x} cy={enemy.y} r={7}
                            fill={`${roleColor}20`} stroke={roleColor} strokeWidth="1.5"
                          />
                          <text x={enemy.x} y={enemy.y} textAnchor="middle" dominantBaseline="central"
                            className="text-[6px] font-mono font-bold pointer-events-none" fill={roleColor}>
                            {enemy.id}
                          </text>
                          {/* Label */}
                          <text x={enemy.x} y={enemy.y + 14} textAnchor="middle"
                            className="text-[6px] font-mono fill-[rgba(255,255,255,0.4)]">
                            {enemy.label}
                          </text>
                          {/* Attack line to player for attackers */}
                          {enemy.role === 'attacking' && (
                            <line x1={enemy.x} y1={enemy.y} x2={80} y2={60}
                              stroke={`${roleColor}40`} strokeWidth="1" strokeDasharray="3 3" />
                          )}
                          {/* Flanking arc */}
                          {enemy.role === 'flanking' && (
                            <path
                              d={`M ${enemy.x} ${enemy.y} Q ${enemy.x + 16} ${enemy.y - 24} ${80} ${60}`}
                              fill="none" stroke={`${roleColor}50`} strokeWidth="1" strokeDasharray="3 2"
                            />
                          )}
                        </g>
                      );
                    })}
                    {/* Attack slot rotation arrow */}
                    <path d="M 36 24 C 28 12, 56 8, 60 20" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="1" markerEnd="url(#arrowhead)" />
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill="rgba(239,68,68,0.4)" />
                      </marker>
                    </defs>
                  </svg>

                  <div className="flex-1 space-y-3 min-w-0">
                    {/* Config */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Tactics Config</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'MaxSimultaneous', value: '2' },
                          { label: 'FlankingEnabled', value: 'true' },
                        ].map(c => (
                          <div key={c.label} className="bg-surface-deep rounded border border-border/30 px-2 py-1.5 text-center">
                            <div className="text-xs font-mono font-bold text-text">{c.value}</div>
                            <div className="text-[8px] uppercase font-bold text-text-muted tracking-wider">{c.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Role legend */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Role Status</div>
                      <div className="space-y-1">
                        {TACTICS_ENEMIES.map(e => (
                          <div key={e.id} className="flex items-center gap-2 text-[10px]">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TACTICS_ROLE_COLORS[e.role] }} />
                            <span className="font-mono font-bold text-text w-12">{e.label}</span>
                            <span className="font-medium capitalize" style={{ color: TACTICS_ROLE_COLORS[e.role] }}>{e.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted leading-relaxed">
                      Attack slot rotation ensures only MaxSimultaneous enemies engage at once. Flankers circle around to rear. Waiting enemies hold positions until a slot opens.
                    </p>
                  </div>
                </div>
              </SurfaceCard>

              {/* ══════════════════════════════════════════════════════════════════════
          5.5 Spawn Wave Choreographer
         ══════════════════════════════════════════════════════════════════════ */}
              <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
                <SectionLabel icon={Users} label="Spawn Wave Choreographer" color="#f59e0b" />
                <div className="mt-3 flex flex-col md:flex-row gap-2.5">
                  {/* Top-down spawn positions */}
                  <svg width={140} height={140} viewBox="0 0 140 140" className="flex-shrink-0">
                    {/* Arena circle */}
                    <circle cx={70} cy={70} r={58.3} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                    <circle cx={70} cy={70} r={4} fill="rgba(255,255,255,0.3)" />
                    <text x={70} y={77.8} textAnchor="middle" className="text-[7px] font-mono fill-[rgba(255,255,255,0.4)]">CENTER</text>
                    {/* Spawn points */}
                    {SPAWN_POINTS.map(sp => (
                      <g key={sp.id}>
                        <motion.circle
                          cx={sp.x} cy={sp.y} r={10}
                          fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5"
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ delay: sp.order * 0.15, type: 'spring' }}
                        />
                        <text x={sp.x} y={sp.y + 1} textAnchor="middle" dominantBaseline="central"
                          className="text-[9px] font-mono font-bold fill-[#f59e0b] pointer-events-none">
                          {sp.order}
                        </text>
                        {/* Connection line to center */}
                        <line x1={70} y1={70} x2={sp.x} y2={sp.y} stroke="rgba(245,158,11,0.15)" strokeWidth="1" strokeDasharray="2 3" />
                      </g>
                    ))}
                  </svg>

                  <div className="flex-1 space-y-3 min-w-0">
                    {/* Formation selector */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Formation</div>
                      <div className="flex gap-1.5">
                        {(['Circle', 'Line', 'Ambush'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setSpawnFormation(f)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${spawnFormation === f ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-text-muted hover:text-text bg-surface border border-border/40'
                              }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Config values */}
                    <div className="flex gap-2">
                      {[{ label: 'WaveDelay', value: '60s' }, { label: 'MaxActive', value: '12' }].map(c => (
                        <div key={c.label} className="flex-1 py-1.5 px-2 rounded-lg bg-surface-deep border border-border/40 text-center">
                          <div className="text-xs font-mono font-bold text-text">{c.value}</div>
                          <div className="text-[9px] uppercase font-bold text-text-muted tracking-wider">{c.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Wave timeline */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Wave Timeline</div>
                      <div className="space-y-1.5">
                        {WAVE_TIMELINE.map(wave => (
                          <motion.div
                            key={wave.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: wave.id * 0.1 }}
                            className="flex items-center gap-2 text-xs bg-surface-deep px-2 py-1.5 rounded border border-border/30"
                          >
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[9px] font-mono font-bold text-amber-400 flex-shrink-0">
                              {wave.id}
                            </span>
                            <span className="font-mono text-text-muted text-[10px] w-8">{wave.delay}</span>
                            <span className="text-text font-medium">{wave.archetype}</span>
                            <span className="ml-auto text-text-muted font-mono text-[10px]">x{wave.count}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </SurfaceCard>


              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                {/* ══════════════════════════════════════════════════════════════════════
          5.6 Archetype Builder (Custom Enemy Form)
         ══════════════════════════════════════════════════════════════════════ */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
                  <SectionLabel icon={Wrench} label="Archetype Builder" color="#a855f7" />
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* Form */}
                    <div className="space-y-3">
                      {/* Name input */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Name</label>
                        <input
                          type="text"
                          value={builderName}
                          onChange={e => setBuilderName(e.target.value)}
                          className="w-full bg-surface-deep border border-border/40 rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                        />
                      </div>
                      {/* Stat sliders */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1.5">Stats</label>
                        <div className="space-y-2">
                          {(Object.keys(builderStats) as (keyof typeof builderStats)[]).map(stat => (
                            <div key={stat} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-12 text-right flex-shrink-0">{stat}</span>
                              <input
                                type="range"
                                min={0} max={100}
                                value={builderStats[stat]}
                                onChange={e => setBuilderStats(prev => ({ ...prev, [stat]: parseInt(e.target.value) }))}
                                className="flex-1 h-1.5 accent-purple-500"
                              />
                              <span className="text-[10px] font-mono font-bold text-text w-6 text-right">{builderStats[stat]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Abilities checkboxes */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1.5">Abilities</label>
                        <div className="flex flex-wrap gap-1.5">
                          {ABILITY_POOL.map(ab => (
                            <label key={ab} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={builderAbilities.includes(ab)}
                                onChange={() => setBuilderAbilities(prev =>
                                  prev.includes(ab) ? prev.filter(a => a !== ab) : [...prev, ab]
                                )}
                                className="rounded border-border accent-purple-500 w-3 h-3"
                              />
                              <span className="text-[10px] text-text-muted font-medium">{ab}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* BT Dropdown */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Behavior Tree</label>
                        <select
                          value={builderBT}
                          onChange={e => setBuilderBT(e.target.value as typeof BT_PRESETS[number])}
                          className="w-full bg-surface-deep border border-border/40 rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                        >
                          {BT_PRESETS.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Preview card */}
                    <div className="bg-surface-deep rounded-xl border-2 border-purple-500/30 p-4 space-y-3 relative overflow-hidden"
                      style={{ boxShadow: '0 0 20px -5px rgba(168,85,247,0.3), inset 0 0 20px -10px rgba(168,85,247,0.15)' }}>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full pointer-events-none" />
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Preview</div>
                      <div className="text-sm font-bold text-text">{builderName || 'Unnamed'}</div>
                      <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">BT: {builderBT}</div>
                      {/* Stat bars */}
                      <div className="space-y-1.5">
                        {(Object.entries(builderStats) as [string, number][]).map(([stat, value]) => (
                          <div key={stat} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-10 flex-shrink-0 text-right">{stat}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-purple-500"
                                animate={{ width: `${value}%` }}
                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                              />
                            </div>
                            <span className="text-2xs font-mono font-bold text-text w-6 text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                      {/* Selected abilities */}
                      {builderAbilities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {builderAbilities.map(ab => (
                            <span key={ab} className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-surface text-text"
                              style={{ borderColor: 'rgba(168,85,247,0.4)' }}>
                              {ab}
                            </span>
                          ))}
                        </div>
                      )}
                      {builderAbilities.length === 0 && (
                        <p className="text-[10px] text-text-muted italic">No abilities selected</p>
                      )}
                    </div>
                  </div>
                </SurfaceCard>


                {/* ══════════════════════════════════════════════════════════════════════
          5.9 Aggro Table Visualization
         ══════════════════════════════════════════════════════════════════════ */}
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
                  <SectionLabel icon={Swords} label="Aggro Table" color="#ef4444" />
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* Threat bars */}
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Threat Values</div>
                      {AGGRO_TABLE.map(entry => (
                        <div key={entry.target} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-text">{entry.target}</span>
                            <span className="text-xs font-mono font-bold" style={{ color: entry.color }}>{entry.threat}</span>
                          </div>
                          {/* Threat bar */}
                          <div className="h-3 rounded-full bg-surface-deep overflow-hidden border border-border/20">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: entry.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${entry.threat}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                          {/* Source breakdown */}
                          <div className="flex gap-2">
                            {entry.breakdown.map(b => (
                              <span key={b.source} className="text-[9px] font-mono text-text-muted">
                                {b.source}={b.pct}%
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Aggro switch events */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Aggro Switch Log</div>
                      <div className="space-y-1.5">
                        {AGGRO_EVENTS.map((evt, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-surface-deep rounded border border-border/30 px-3 py-2 space-y-1"
                          >
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-text-muted text-[10px]">{evt.time}</span>
                              <span className="font-bold text-red-400">{evt.from}</span>
                              <span className="text-text-muted">&rarr;</span>
                              <span className="font-bold text-emerald-400">{evt.to}</span>
                            </div>
                            <p className="text-[10px] text-text-muted leading-relaxed">{evt.reason}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SurfaceCard>


              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Archetype card ── Trading Card Aesthetic ──────────────────────────── */

function ArchetypeCard({
  archetype,
  featureMap,
  expanded,
  onToggle,
}: {
  archetype: ArchetypeConfig;
  featureMap: Map<string, FeatureRow>;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const ArchIcon = archetype.icon;
  const row = featureMap.get(archetype.featureName);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      whileHover={{ y: expanded ? 0 : -5, scale: expanded ? 1 : 1.02 }}
      className="h-full relative group"
      style={{ perspective: 1000 }}
    >
      <SurfaceCard
        level={3}
        className="overflow-hidden h-full flex flex-col relative transition-all duration-300 shadow-xl border-2"
        style={{
          borderColor: expanded ? `${archetype.color}80` : `${archetype.color}40`,
          boxShadow: expanded ? `0 0 30px -5px ${archetype.color}60, inset 0 0 30px -10px ${archetype.color}30` : `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 0 20px -10px ${archetype.color}30`,
        }}
      >
        {/* Glow Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" />
        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full pointer-events-none transition-opacity duration-300"
          style={{ backgroundColor: `${archetype.color}15`, opacity: expanded ? 1 : 0.5 }} />

        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" style={{ backgroundImage: `radial-gradient(circle at center, ${archetype.color}20 1px, transparent 1px)`, backgroundSize: '12px 12px' }} />

        <button
          onClick={() => onToggle(archetype.id)}
          className="w-full text-left p-3 hover:bg-surface-hover/20 transition-colors relative z-10 focus:outline-none flex-1 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border shadow-inner overflow-hidden relative"
                style={{ backgroundColor: `${archetype.color}20`, borderColor: `${archetype.color}40` }}
              >
                <ArchIcon className="w-4 h-4" style={{ color: archetype.color }} />
              </div>
              <div>
                <div className="text-xs font-bold text-text leading-tight">{archetype.label}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest opacity-80" style={{ color: archetype.color }}>{archetype.class} / {archetype.role}</div>
              </div>
            </div>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="p-0.5">
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </motion.div>
          </div>

          {/* Stat bars */}
          <div className="space-y-1.5 mt-auto">
            {archetype.stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 group/stat relative">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-10 flex-shrink-0 text-right">{stat.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-deep overflow-visible shadow-inner relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full relative"
                    style={{ backgroundColor: archetype.color }}
                  >
                    {/* Hover tooltip badge at bar endpoint */}
                    <div
                      className="absolute right-0 -top-7 translate-x-1/2 opacity-0 group-hover/stat:opacity-100 transition-opacity duration-150 ease-in-out pointer-events-none z-30"
                    >
                      <div className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap shadow-lg"
                        style={{ backgroundColor: archetype.color, color: '#000' }}>
                        {stat.value}/100
                      </div>
                      <div className="w-0 h-0 mx-auto border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px]"
                        style={{ borderTopColor: archetype.color }} />
                    </div>
                  </motion.div>
                </div>
                <span className="text-2xs font-mono font-bold text-text w-6 text-right">{stat.value}</span>
              </div>
            ))}
          </div>
        </button>

        {/* Expanded Details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="relative z-10"
            >
              <div className="px-4 pb-4 border-t border-[rgba(255,255,255,0.05)] pt-3 bg-surface/30 space-y-2.5 backdrop-blur-sm">
                {/* Abilities */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Signature Abilities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {archetype.abilities.map((ab) => (
                      <span
                        key={ab}
                        className="text-[10px] font-bold px-2 py-1 rounded-md border shadow-sm cursor-default bg-surface text-text"
                        style={{ borderColor: `${archetype.color}40`, boxShadow: `inset 0 0 10px ${archetype.color}10` }}
                      >
                        {ab}
                      </span>
                    ))}
                  </div>
                </div>

                {/* BT States */}
                <div className="bg-surface-deep p-3 rounded-xl border" style={{ borderColor: `${archetype.color}30` }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Behavior Tree Matrix</div>
                  <div className="space-y-1.5">
                    {Object.entries(archetype.btSummary).map(([state, desc]) => (
                      <div key={state} className="flex items-center gap-3 text-xs">
                        <span
                          className="font-mono font-bold flex-shrink-0 w-16 text-right"
                          style={{ color: archetype.color }}
                        >
                          {state}
                        </span>
                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: `${archetype.color}50` }} />
                        <span className="text-text-muted truncate font-medium" title={desc}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Footer */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Dev Status</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded uppercase font-bold border shadow-sm flex items-center gap-1.5 bg-surface"
                    style={{ color: sc.dot, borderColor: `${sc.dot}40` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                    {sc.label}
                  </span>
                </div>
                {row?.nextSteps && (
                  <p className="text-xs p-2 bg-surface border-l-2 rounded font-medium shadow-inner" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}10` }}>Next: {row.nextSteps}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SurfaceCard>
    </motion.div>
  );
}
