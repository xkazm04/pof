'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Map as MapIcon, Compass, Anchor, Navigation, Info, ExternalLink,
  ChevronDown, ChevronRight, Lock, Unlock, Network, Flame, AlertTriangle,
  Skull, Star, Gem, ScrollText, Coins, Clock, Zap, Shield, Target,
  MapPin, ArrowRight, ArrowRightLeft, Timer, CheckCircle2, Circle,
  Gauge, Music, Swords, TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS, STATUS_INFO,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_PINK,
  OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, PipelineFlow, FeatureGrid, LoadingSpinner, SectionLabel, HeatmapGrid } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { GraphNode, GraphEdge, HeatmapCell, HeatmapConfig, BudgetBar } from '@/types/unique-tab-improvements';

const ACCENT = ACCENT_CYAN;

/* ── Zone Data ─────────────────────────────────────────────────────────────── */

interface ZoneNode {
  id: string;
  name: string;
  cx: number;
  cy: number;
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  levelRange: string;
  connections: string[]; // ids of connected zones
}

const ZONES: ZoneNode[] = [
  { id: 'z1', name: 'Sanctuary (Hub)', cx: 20, cy: 50, type: 'hub', status: 'completed', levelRange: '1', connections: ['z2', 'z3'] },
  { id: 'z2', name: 'Whispering Woods', cx: 45, cy: 30, type: 'combat', status: 'completed', levelRange: '1-3', connections: ['z4'] },
  { id: 'z3', name: 'Crystal Caves', cx: 40, cy: 75, type: 'combat', status: 'active', levelRange: '2-4', connections: ['z5'] },
  { id: 'z4', name: 'Bandit Camp', cx: 70, cy: 25, type: 'combat', status: 'locked', levelRange: '3-5', connections: ['z6'] },
  { id: 'z5', name: 'Deep Core', cx: 65, cy: 85, type: 'combat', status: 'locked', levelRange: '4-6', connections: ['z6'] },
  { id: 'z6', name: 'Ruined Keep (Boss)', cx: 85, cy: 50, type: 'boss', status: 'locked', levelRange: '5-7', connections: [] },
];

/* ── Asset list ────────────────────────────────────────────────────────────── */

const ASSET_FEATURES = [
  'Level Streaming setup',
  'World Partition grid',
  'HLOD generation',
  'Environment lighting (Lumen)',
  'Foliage instancing',
  'Water system (plugin)',
];

/* ── 10.1 Zone Topology Graph Data ─────────────────────────────────────────── */

interface TopologyEdge {
  from: string;
  to: string;
  type: 'door' | 'portal' | 'seamless';
  locked: boolean;
  criticalPath: boolean;
}

const TOPOLOGY_NODES: GraphNode[] = [
  { id: 'z1', label: 'Sanctuary', group: 'hub', color: STATUS_SUCCESS, size: 28, x: 80, y: 180 },
  { id: 'z2', label: 'Whisper Woods', group: 'combat', color: STATUS_SUCCESS, size: 22, x: 200, y: 80 },
  { id: 'z3', label: 'Crystal Caves', group: 'combat', color: STATUS_WARNING, size: 22, x: 200, y: 280 },
  { id: 'z4', label: 'Bandit Camp', group: 'combat', color: '#475569', size: 22, x: 340, y: 60 },
  { id: 'z5', label: 'Deep Core', group: 'combat', color: '#475569', size: 22, x: 340, y: 300 },
  { id: 'z6', label: 'Ruined Keep', group: 'boss', color: STATUS_ERROR, size: 30, x: 460, y: 180 },
];

const TOPOLOGY_EDGES: TopologyEdge[] = [
  { from: 'z1', to: 'z2', type: 'door', locked: false, criticalPath: true },
  { from: 'z1', to: 'z3', type: 'seamless', locked: false, criticalPath: false },
  { from: 'z2', to: 'z4', type: 'door', locked: true, criticalPath: true },
  { from: 'z3', to: 'z5', type: 'portal', locked: true, criticalPath: false },
  { from: 'z4', to: 'z6', type: 'door', locked: true, criticalPath: true },
  { from: 'z5', to: 'z6', type: 'portal', locked: true, criticalPath: true },
];

const EDGE_STYLE_MAP: Record<TopologyEdge['type'], { dash: string; label: string; color: string }> = {
  door: { dash: '0', label: 'Door', color: ACCENT_CYAN },
  portal: { dash: '4 4', label: 'Portal', color: ACCENT_VIOLET },
  seamless: { dash: '8 3', label: 'Seamless', color: ACCENT_EMERALD },
};

/* ── 10.2 Enemy Density Heatmap Data ──────────────────────────────────────── */

const ENEMY_DENSITY_CONFIG: HeatmapConfig = {
  rows: ['Sanctuary', 'Whisper Woods', 'Crystal Caves', 'Bandit Camp', 'Deep Core', 'Ruined Keep'],
  cols: ['NW', 'NE', 'Center', 'SW', 'SE'],
  cells: [
    // Sanctuary - almost none
    { row: 0, col: 0, value: 0.0, label: '0' }, { row: 0, col: 1, value: 0.0, label: '0' }, { row: 0, col: 2, value: 0.05, label: '1' }, { row: 0, col: 3, value: 0.0, label: '0' }, { row: 0, col: 4, value: 0.0, label: '0' },
    // Whispering Woods
    { row: 1, col: 0, value: 0.3, label: '6' }, { row: 1, col: 1, value: 0.45, label: '9' }, { row: 1, col: 2, value: 0.6, label: '12' }, { row: 1, col: 3, value: 0.2, label: '4' }, { row: 1, col: 4, value: 0.35, label: '7' },
    // Crystal Caves
    { row: 2, col: 0, value: 0.5, label: '10' }, { row: 2, col: 1, value: 0.4, label: '8' }, { row: 2, col: 2, value: 0.8, label: '16' }, { row: 2, col: 3, value: 0.65, label: '13' }, { row: 2, col: 4, value: 0.55, label: '11' },
    // Bandit Camp
    { row: 3, col: 0, value: 0.7, label: '14' }, { row: 3, col: 1, value: 0.85, label: '17' }, { row: 3, col: 2, value: 0.95, label: '19' }, { row: 3, col: 3, value: 0.6, label: '12' }, { row: 3, col: 4, value: 0.75, label: '15' },
    // Deep Core
    { row: 4, col: 0, value: 0.8, label: '16' }, { row: 4, col: 1, value: 0.9, label: '18' }, { row: 4, col: 2, value: 1.0, label: '20' }, { row: 4, col: 3, value: 0.85, label: '17' }, { row: 4, col: 4, value: 0.7, label: '14' },
    // Ruined Keep
    { row: 5, col: 0, value: 0.4, label: '8' }, { row: 5, col: 1, value: 0.35, label: '7' }, { row: 5, col: 2, value: 1.0, label: '20' }, { row: 5, col: 3, value: 0.4, label: '8' }, { row: 5, col: 4, value: 0.35, label: '7' },
  ],
};

/* ── 10.3 Level Range Flow Data ────────────────────────────────────────────── */

interface LevelRangeBar {
  zone: string;
  min: number;
  max: number;
  color: string;
}

const LEVEL_RANGE_BARS: LevelRangeBar[] = [
  { zone: 'Sanctuary', min: 1, max: 1, color: STATUS_SUCCESS },
  { zone: 'Whisper Woods', min: 1, max: 3, color: STATUS_SUCCESS },
  { zone: 'Crystal Caves', min: 2, max: 4, color: STATUS_WARNING },
  { zone: 'Bandit Camp', min: 3, max: 5, color: '#475569' },
  { zone: 'Deep Core', min: 4, max: 6, color: '#475569' },
  { zone: 'Ruined Keep', min: 5, max: 7, color: STATUS_ERROR },
];

const PLAYER_LEVEL = 3;
const MAX_LEVEL = 7;

/* ── 10.4 World Streaming Budget Data ──────────────────────────────────────── */

const STREAMING_BUDGETS: BudgetBar[] = [
  { label: 'Memory', current: 380, max: 512, unit: 'MB', color: ACCENT_CYAN, threshold: { warn: 420, danger: 480 } },
  { label: 'LoadTime', current: 2.1, max: 3.0, unit: 's', color: ACCENT_EMERALD, threshold: { warn: 2.5, danger: 2.8 } },
  { label: 'CellCount', current: 12, max: 20, unit: '', color: ACCENT_VIOLET, threshold: { warn: 16, danger: 18 } },
  { label: 'TexturePool', current: 45, max: 64, unit: 'MB', color: ACCENT_ORANGE, threshold: { warn: 52, danger: 60 } },
];

/* ── 10.5 Points of Interest Data ──────────────────────────────────────────── */

type PoiType = 'vendor' | 'quest' | 'boss' | 'shrine' | 'treasure' | 'bonfire';

interface PointOfInterest {
  type: PoiType;
  count: number;
}

interface ZonePoi {
  zone: string;
  pois: PointOfInterest[];
  discoveryPct: number;
}

const POI_ICONS: Record<PoiType, { icon: typeof Coins; label: string; color: string }> = {
  vendor: { icon: Coins, label: 'Vendor', color: STATUS_WARNING },
  quest: { icon: ScrollText, label: 'Quest', color: STATUS_INFO },
  boss: { icon: Skull, label: 'Boss', color: STATUS_ERROR },
  shrine: { icon: Star, label: 'Shrine', color: ACCENT_VIOLET },
  treasure: { icon: Gem, label: 'Treasure', color: ACCENT_EMERALD },
  bonfire: { icon: Flame, label: 'Bonfire', color: ACCENT_ORANGE },
};

const ZONE_POIS: ZonePoi[] = [
  { zone: 'Sanctuary', pois: [{ type: 'vendor', count: 3 }, { type: 'bonfire', count: 1 }, { type: 'quest', count: 2 }], discoveryPct: 100 },
  { zone: 'Whisper Woods', pois: [{ type: 'quest', count: 4 }, { type: 'treasure', count: 2 }, { type: 'shrine', count: 1 }, { type: 'bonfire', count: 1 }], discoveryPct: 85 },
  { zone: 'Crystal Caves', pois: [{ type: 'quest', count: 3 }, { type: 'treasure', count: 3 }, { type: 'boss', count: 1 }, { type: 'bonfire', count: 1 }], discoveryPct: 40 },
  { zone: 'Bandit Camp', pois: [{ type: 'quest', count: 5 }, { type: 'vendor', count: 1 }, { type: 'treasure', count: 2 }, { type: 'boss', count: 1 }], discoveryPct: 0 },
  { zone: 'Deep Core', pois: [{ type: 'shrine', count: 2 }, { type: 'treasure', count: 4 }, { type: 'boss', count: 1 }, { type: 'bonfire', count: 1 }], discoveryPct: 0 },
  { zone: 'Ruined Keep', pois: [{ type: 'boss', count: 1 }, { type: 'treasure', count: 1 }, { type: 'shrine', count: 1 }], discoveryPct: 0 },
];

/* ── 10.6 Zone Connection Visualizer Data ──────────────────────────────────── */

interface ZoneConnection {
  from: string;
  to: string;
  transitionType: 'Loading' | 'Seamless' | 'Portal';
  estTime: string;
  navMeshContinuity: boolean;
}

const ZONE_CONNECTIONS: ZoneConnection[] = [
  { from: 'Sanctuary', to: 'Whisper Woods', transitionType: 'Loading', estTime: '1.2s', navMeshContinuity: false },
  { from: 'Sanctuary', to: 'Crystal Caves', transitionType: 'Seamless', estTime: '0.0s', navMeshContinuity: true },
  { from: 'Whisper Woods', to: 'Bandit Camp', transitionType: 'Loading', estTime: '1.8s', navMeshContinuity: false },
  { from: 'Crystal Caves', to: 'Deep Core', transitionType: 'Portal', estTime: '0.6s', navMeshContinuity: false },
  { from: 'Bandit Camp', to: 'Ruined Keep', transitionType: 'Loading', estTime: '2.4s', navMeshContinuity: false },
  { from: 'Deep Core', to: 'Ruined Keep', transitionType: 'Portal', estTime: '0.8s', navMeshContinuity: false },
];

const TRANSITION_COLORS: Record<ZoneConnection['transitionType'], string> = {
  Loading: STATUS_WARNING,
  Seamless: ACCENT_EMERALD,
  Portal: ACCENT_VIOLET,
};

/* ── 10.7 Boss Arena Details Data ──────────────────────────────────────────── */

interface BossArena {
  bossName: string;
  zone: string;
  phases: number;
  arenaSize: string;
  hazards: string[];
  recommendedLevel: number;
  musicTheme: string;
}

const BOSS_ARENAS: BossArena[] = [
  {
    bossName: 'Crystal Golem',
    zone: 'Crystal Caves',
    phases: 2,
    arenaSize: '40x40m',
    hazards: ['Crystal Shards', 'Cave-in'],
    recommendedLevel: 4,
    musicTheme: 'Echoes of Stone',
  },
  {
    bossName: 'Bandit Warlord',
    zone: 'Bandit Camp',
    phases: 3,
    arenaSize: '50x30m',
    hazards: ['Fire Barrels', 'Spike Traps'],
    recommendedLevel: 5,
    musicTheme: 'Clash of Blades',
  },
  {
    bossName: 'Abyssal Crawler',
    zone: 'Deep Core',
    phases: 2,
    arenaSize: '35x35m',
    hazards: ['Lava Vents', 'Falling Rocks'],
    recommendedLevel: 6,
    musicTheme: 'Descent Into Dark',
  },
  {
    bossName: 'The Hollow King',
    zone: 'Ruined Keep',
    phases: 4,
    arenaSize: '60x60m',
    hazards: ['Cursed Ground', 'Spirit Pillars', 'Collapse'],
    recommendedLevel: 7,
    musicTheme: 'Requiem of Ruin',
  },
];

/* ── 10.8 Environmental Hazard Map Data ────────────────────────────────────── */

interface EnvHazard {
  zone: string;
  type: 'Lava' | 'Poison' | 'Trap' | 'Falling';
  damagePerSec: number;
  affectedArea: string;
  warningLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

const ENV_HAZARDS: EnvHazard[] = [
  { zone: 'Crystal Caves', type: 'Falling', damagePerSec: 15, affectedArea: '12%', warningLevel: 'Medium' },
  { zone: 'Crystal Caves', type: 'Trap', damagePerSec: 25, affectedArea: '5%', warningLevel: 'High' },
  { zone: 'Bandit Camp', type: 'Trap', damagePerSec: 30, affectedArea: '8%', warningLevel: 'High' },
  { zone: 'Deep Core', type: 'Lava', damagePerSec: 40, affectedArea: '20%', warningLevel: 'Critical' },
  { zone: 'Deep Core', type: 'Poison', damagePerSec: 10, affectedArea: '15%', warningLevel: 'Medium' },
  { zone: 'Ruined Keep', type: 'Trap', damagePerSec: 35, affectedArea: '10%', warningLevel: 'High' },
  { zone: 'Ruined Keep', type: 'Falling', damagePerSec: 50, affectedArea: '18%', warningLevel: 'Critical' },
];

const HAZARD_TYPE_COLORS: Record<EnvHazard['type'], string> = {
  Lava: STATUS_ERROR,
  Poison: ACCENT_EMERALD,
  Trap: STATUS_WARNING,
  Falling: ACCENT_VIOLET,
};

const HAZARD_WARNING_COLORS: Record<EnvHazard['warningLevel'], string> = {
  Low: STATUS_SUCCESS,
  Medium: STATUS_WARNING,
  High: ACCENT_ORANGE,
  Critical: STATUS_ERROR,
};

// Danger score per zone: sum of (dps * area%)
const ZONE_DANGER_SCORES: { zone: string; score: number }[] = [
  { zone: 'Sanctuary', score: 0 },
  { zone: 'Whisper Woods', score: 5 },
  { zone: 'Crystal Caves', score: 42 },
  { zone: 'Bandit Camp', score: 55 },
  { zone: 'Deep Core', score: 78 },
  { zone: 'Ruined Keep', score: 92 },
];

/* ── 10.9 Fast Travel Network Data ─────────────────────────────────────────── */

interface FastTravelNode {
  name: string;
  zone: string;
  discovered: boolean;
  travelTimes: { to: string; seconds: number }[];
}

const FAST_TRAVEL_NODES: FastTravelNode[] = [
  { name: 'Sanctuary Waypoint', zone: 'Sanctuary', discovered: true, travelTimes: [{ to: 'Woods Gate', seconds: 8 }, { to: 'Cave Entrance', seconds: 12 }] },
  { name: 'Woods Gate', zone: 'Whisper Woods', discovered: true, travelTimes: [{ to: 'Sanctuary Waypoint', seconds: 8 }, { to: 'Camp Outskirts', seconds: 15 }] },
  { name: 'Cave Entrance', zone: 'Crystal Caves', discovered: true, travelTimes: [{ to: 'Sanctuary Waypoint', seconds: 12 }, { to: 'Core Rift', seconds: 18 }] },
  { name: 'Camp Outskirts', zone: 'Bandit Camp', discovered: false, travelTimes: [{ to: 'Woods Gate', seconds: 15 }, { to: 'Keep Gates', seconds: 20 }] },
  { name: 'Core Rift', zone: 'Deep Core', discovered: false, travelTimes: [{ to: 'Cave Entrance', seconds: 18 }, { to: 'Keep Gates', seconds: 22 }] },
  { name: 'Keep Gates', zone: 'Ruined Keep', discovered: false, travelTimes: [{ to: 'Camp Outskirts', seconds: 20 }, { to: 'Core Rift', seconds: 22 }] },
];

const FAST_TRAVEL_COVERAGE: { zone: string; pct: number }[] = [
  { zone: 'Sanctuary', pct: 100 },
  { zone: 'Whisper Woods', pct: 100 },
  { zone: 'Crystal Caves', pct: 100 },
  { zone: 'Bandit Camp', pct: 0 },
  { zone: 'Deep Core', pct: 0 },
  { zone: 'Ruined Keep', pct: 0 },
];

/* ── 10.10 Zone Progression Timeline Data ──────────────────────────────────── */

interface ZoneProgressionBar {
  zone: string;
  firstVisitDay: number;
  completionDay: number | null; // null = not yet completed
  completionPct: number;
  color: string;
}

const ZONE_PROGRESSION: ZoneProgressionBar[] = [
  { zone: 'Sanctuary', firstVisitDay: 0, completionDay: 1, completionPct: 100, color: STATUS_SUCCESS },
  { zone: 'Whisper Woods', firstVisitDay: 1, completionDay: 4, completionPct: 100, color: STATUS_SUCCESS },
  { zone: 'Crystal Caves', firstVisitDay: 3, completionDay: null, completionPct: 40, color: STATUS_WARNING },
  { zone: 'Bandit Camp', firstVisitDay: -1, completionDay: null, completionPct: 0, color: '#475569' },
  { zone: 'Deep Core', firstVisitDay: -1, completionDay: null, completionPct: 0, color: '#475569' },
  { zone: 'Ruined Keep', firstVisitDay: -1, completionDay: null, completionPct: 0, color: '#475569' },
];

const TOTAL_ESTIMATED_DAYS = 14;
const CURRENT_DAY = 5;

/* ── Component ─────────────────────────────────────────────────────────────── */

interface ZoneMapProps {
  moduleId: SubModuleId;
}

export function ZoneMap({ moduleId }: ZoneMapProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneNode>(ZONES[0]);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0;
    for (const d of defs) {
      const s = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (s === 'implemented' || s === 'improved') implemented++;
      else if (s === 'partial') partial++;
    }
    return { total, implemented, partial };
  }, [defs, featureMap]);

  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-2.5">
      <TabHeader icon={MapIcon} title="Zone & Level Architecture" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        {/* Map Canvas - takes up more space */}
        <div className="lg:col-span-2 space-y-2.5">
          <SurfaceCard level={2} className="p-3 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-1000" />

            <div className="flex justify-between items-center mb-2.5 relative z-10">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" /> World Map Preview
              </div>
              <div className="flex gap-2.5 text-[10px] font-mono text-text-muted bg-surface-deep px-3 py-1.5 rounded-full border border-border/40">
                <span className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-help">
                  <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: STATUS_SUCCESS, color: STATUS_SUCCESS }} /> Completed
                </span>
                <span className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-help">
                  <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: STATUS_WARNING, color: STATUS_WARNING }} /> Active
                </span>
                <span className="flex items-center gap-1.5 hover:text-red-400 transition-colors cursor-help">
                  <span className="w-2 h-2 rounded bg-border text-border" /> Locked
                </span>
              </div>
            </div>

            <div className="w-full aspect-video bg-surface-deep/80 rounded-xl relative overflow-hidden border border-border/60 shadow-inner">
              {/* Grid background */}
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `linear-gradient(${ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT} 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }}
              />

              <ZoneMapCanvas
                zones={ZONES}
                selectedZone={selectedZone}
                onSelectZone={setSelectedZone}
              />

              {/* Coordinates display overlay */}
              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-cyan-500/50">
                WRLD.X: {Math.round(selectedZone.cx * 100)} / Y: {Math.round(selectedZone.cy * 100)}
              </div>
            </div>
          </SurfaceCard>

          {/* Level Streaming Pipeline */}
          <SurfaceCard level={2} className="p-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-cyan-400" /> World Partition Flow
            </div>
            <PipelineFlow steps={['Persistent Level', 'Grid Cells', 'HLODs', 'Data Layers', 'Streaming Bounds']} accent={ACCENT} />
          </SurfaceCard>
        </div>

        {/* Details Panel */}
        <div className="space-y-2.5">
          <SurfaceCard level={2} className="p-4 h-full relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" /> Region Details
            </div>

            <AnimatePresence mode="sync">
              <motion.div
                key={selectedZone.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5"
              >
                <div className="bg-surface-deep p-4 rounded-xl border border-border/50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-20">
                    {selectedZone.type === 'hub' ? <Anchor className="w-12 h-12" /> :
                      selectedZone.type === 'boss' ? <MapIcon className="w-12 h-12 text-red-500" /> :
                        <Navigation className="w-12 h-12" />}
                  </div>

                  <div className="flex items-center gap-2 mb-1.5 relative z-10">
                    <span className="text-lg font-bold text-text">{selectedZone.name}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-text-muted font-mono mb-2.5 relative z-10">
                    <span className="bg-surface px-2 py-0.5 rounded border border-border/40 text-cyan-400">
                      LVL {selectedZone.levelRange}
                    </span>
                    <span className={`px-2 py-0.5 rounded flex items-center gap-1 border ${selectedZone.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        selectedZone.status === 'active' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          'bg-surface text-text-muted border-border/40'
                      }`}>
                      {selectedZone.status === 'completed' ? <Unlock className="w-3 h-3" /> :
                        selectedZone.status === 'active' ? <MapIcon className="w-3 h-3" /> :
                          <Lock className="w-3 h-3" />}
                      {selectedZone.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2.5 relative z-10">
                    <div className="text-2xs uppercase tracking-wider text-text-muted font-bold">Connections</div>
                    {selectedZone.connections.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedZone.connections.map(connId => {
                          const connZone = ZONES.find(z => z.id === connId);
                          return (
                            <span key={connId} className="text-xs bg-surface-hover px-2 py-1 rounded text-text-muted flex items-center gap-1 border border-border/40">
                              <ChevronRight className="w-3 h-3 opacity-50" />
                              {connZone?.name}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted italic opacity-70">End of current path</div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <div className="text-2xs uppercase tracking-wider text-text-muted font-bold mb-3">Feature State</div>
                  <div className="space-y-2">
                    {/* Render a specific feature card based on zone type as an example */}
                    {selectedZone.type === 'hub' && (
                      <FeatureList itemNames={['Game instance', 'Base PlayerController']} featureMap={featureMap} />
                    )}
                    {selectedZone.type === 'combat' && (
                      <FeatureList itemNames={['Spawn point system', 'Enemy AI controller']} featureMap={featureMap} />
                    )}
                    {selectedZone.type === 'boss' && (
                      <FeatureList itemNames={['Death flow', 'Combat feedback']} featureMap={featureMap} />
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </SurfaceCard>
        </div>
      </div>

      {/* Environment Assets */}
      <SurfaceCard level={2} className="p-3 relative">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-cyan-400" /> Environment Tech
        </div>
        <FeatureGrid
          featureNames={ASSET_FEATURES}
          featureMap={featureMap}
          defs={defs}
          expanded={expandedAsset}
          onToggle={toggleAsset}
          accent={ACCENT}
        />
      </SurfaceCard>

      {/* ── 10.1 Zone Topology Graph ──────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={Network} label="Zone Topology Graph" color={ACCENT} /></div>
        <div className="flex justify-center">
          <svg width={460} height={300} viewBox="0 0 460 300" className="overflow-visible">
            {/* Edges */}
            {TOPOLOGY_EDGES.map((edge) => {
              const src = TOPOLOGY_NODES.find(n => n.id === edge.from);
              const tgt = TOPOLOGY_NODES.find(n => n.id === edge.to);
              if (!src || !tgt) return null;
              const style = EDGE_STYLE_MAP[edge.type];
              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <line
                    x1={src.x!} y1={src.y!} x2={tgt.x!} y2={tgt.y!}
                    stroke={edge.criticalPath ? STATUS_WARNING : style.color}
                    strokeWidth={edge.criticalPath ? 3 : 1.5}
                    strokeDasharray={style.dash}
                    opacity={0.7}
                    style={edge.criticalPath ? { filter: `drop-shadow(0 0 4px ${STATUS_WARNING}60)` } : undefined}
                  />
                  {/* Lock icon on locked edges */}
                  {edge.locked && (
                    <text
                      x={(src.x! + tgt.x!) / 2}
                      y={(src.y! + tgt.y!) / 2 - 8}
                      textAnchor="middle"
                      className="text-[10px] fill-red-400"
                    >
                      &#x1F512;
                    </text>
                  )}
                </g>
              );
            })}
            {/* Nodes */}
            {TOPOLOGY_NODES.map((node) => {
              const sz = node.size ?? 22;
              return (
                <g key={node.id}>
                  <circle
                    cx={node.x!} cy={node.y!} r={sz / 2}
                    fill={`${node.color}25`} stroke={node.color} strokeWidth="2"
                    style={{ filter: `drop-shadow(0 0 6px ${node.color}40)` }}
                  />
                  <text x={node.x!} y={node.y! - 2} textAnchor="middle" dominantBaseline="central"
                    className="text-[9px] font-mono font-bold" fill={node.color}>{node.label}</text>
                  <text x={node.x!} y={node.y! + 10} textAnchor="middle" dominantBaseline="central"
                    className="text-[7px] font-mono" fill="var(--text-muted)">{node.group}</text>
                </g>
              );
            })}
          </svg>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-2 border-t border-border/40">
          {Object.entries(EDGE_STYLE_MAP).map(([type, s]) => (
            <span key={type} className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
              <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash === '0' ? 'none' : s.dash} /></svg>
              {s.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
            <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke={STATUS_WARNING} strokeWidth="3" /></svg>
            Critical Path
          </span>
        </div>
      </SurfaceCard>

      {/* ── 10.2 Enemy Density Heatmap ────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={Target} label="Enemy Density Heatmap" color={STATUS_ERROR} /></div>
        <HeatmapGrid
          rows={ENEMY_DENSITY_CONFIG.rows}
          cols={ENEMY_DENSITY_CONFIG.cols}
          cells={ENEMY_DENSITY_CONFIG.cells}
          lowColor="#1e3a5f"
          highColor={STATUS_ERROR}
          accent={STATUS_ERROR}
        />
        <div className="flex items-center gap-2.5 mt-3 pt-2 border-t border-border/40 text-[10px] font-mono text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#1e3a5f' }} /> Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> High
          </span>
          <span className="ml-auto opacity-70">Values = enemy count per sector</span>
        </div>
      </SurfaceCard>

      {/* ── 10.3 Level Range Flow ─────────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-48 h-48 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={TrendingUp} label="Level Range Flow" color={ACCENT} /></div>
        <div className="relative">
          {/* Player level indicator */}
          <div
            className="absolute top-0 bottom-0 w-[2px] z-10"
            style={{
              left: `${((PLAYER_LEVEL - 0.5) / MAX_LEVEL) * 100}%`,
              backgroundColor: ACCENT_PINK,
              boxShadow: `0 0 8px ${ACCENT_PINK}80`,
            }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${ACCENT_PINK}20`, color: ACCENT_PINK, border: `1px solid ${ACCENT_PINK}40` }}>
              Player Lvl {PLAYER_LEVEL}
            </div>
          </div>

          <div className="space-y-2 pt-6">
            {LEVEL_RANGE_BARS.map((bar) => {
              const leftPct = ((bar.min - 0.5) / MAX_LEVEL) * 100;
              const widthPct = ((bar.max - bar.min + 1) / MAX_LEVEL) * 100;
              return (
                <div key={bar.zone} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-text-muted w-28 truncate text-right flex-shrink-0">{bar.zone}</span>
                  <div className="relative flex-1 h-6 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.6 }}
                      className="absolute top-0 bottom-0 rounded-md"
                      style={{
                        left: `${leftPct}%`,
                        backgroundColor: `${bar.color}40`,
                        border: `1px solid ${bar.color}60`,
                      }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold" style={{ color: bar.color }}>
                        {bar.min === bar.max ? `Lv${bar.min}` : `Lv${bar.min}-${bar.max}`}
                      </span>
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Level axis */}
          <div className="flex items-center gap-3 mt-2">
            <span className="w-28 flex-shrink-0" />
            <div className="flex-1 flex justify-between text-[9px] font-mono text-text-muted px-1">
              {Array.from({ length: MAX_LEVEL }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* ── 10.4 World Streaming Budget ───────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={Gauge} label="World Streaming Budget" color={ACCENT_VIOLET} /></div>
        <div className="space-y-3">
          {STREAMING_BUDGETS.map((budget) => {
            const pct = (budget.current / budget.max) * 100;
            const warnPct = budget.threshold ? (budget.threshold.warn / budget.max) * 100 : 80;
            const dangerPct = budget.threshold ? (budget.threshold.danger / budget.max) * 100 : 90;
            const barColor = pct >= dangerPct ? STATUS_ERROR : pct >= warnPct ? STATUS_WARNING : (budget.color ?? ACCENT);
            return (
              <div key={budget.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-text-muted uppercase tracking-wider">{budget.label}</span>
                  <span className="font-bold" style={{ color: barColor }}>
                    {budget.current}{budget.unit} <span className="text-text-muted opacity-60">/ {budget.max}{budget.unit}</span>
                  </span>
                </div>
                <div className="relative h-5 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                  {/* Warning threshold marker */}
                  {budget.threshold && (
                    <>
                      <div className="absolute top-0 bottom-0 w-[1px] opacity-40" style={{ left: `${warnPct}%`, backgroundColor: STATUS_WARNING }} />
                      <div className="absolute top-0 bottom-0 w-[1px] opacity-40" style={{ left: `${dangerPct}%`, backgroundColor: STATUS_ERROR }} />
                    </>
                  )}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 0.8 }}
                    className="absolute top-0 bottom-0 rounded-md"
                    style={{ backgroundColor: `${barColor}50`, borderRight: `2px solid ${barColor}` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-text">
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* ── 10.5 Points of Interest Layer ─────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={MapPin} label="Points of Interest Layer" color={ACCENT_EMERALD} /></div>

        {/* POI type legend */}
        <div className="flex flex-wrap gap-3 mb-2.5 pb-3 border-b border-border/40">
          {Object.entries(POI_ICONS).map(([type, cfg]) => {
            const IconComp = cfg.icon;
            return (
              <span key={type} className="flex items-center gap-1 text-[10px] font-mono font-bold" style={{ color: cfg.color }}>
                <IconComp className="w-3 h-3" /> {cfg.label}
              </span>
            );
          })}
        </div>

        <div className="space-y-3">
          {ZONE_POIS.map((zp) => {
            const totalPois = zp.pois.reduce((acc, p) => acc + p.count, 0);
            return (
              <div key={zp.zone} className="bg-surface-deep rounded-lg p-3 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-text">{zp.zone}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-muted">{totalPois} POIs</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: zp.discoveryPct === 100 ? STATUS_SUCCESS : zp.discoveryPct > 0 ? STATUS_WARNING : '#475569',
                        backgroundColor: zp.discoveryPct === 100 ? `${STATUS_SUCCESS}15` : zp.discoveryPct > 0 ? `${STATUS_WARNING}15` : 'transparent',
                        border: `1px solid ${zp.discoveryPct === 100 ? STATUS_SUCCESS : zp.discoveryPct > 0 ? STATUS_WARNING : '#475569'}30`,
                      }}>
                      {zp.discoveryPct}% discovered
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {zp.pois.map((poi) => {
                    const cfg = POI_ICONS[poi.type];
                    const IconComp = cfg.icon;
                    return (
                      <span key={poi.type} className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                        <IconComp className="w-3 h-3" /> x{poi.count}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* ── 10.6 Zone Connection Visualizer ───────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={ArrowRightLeft} label="Zone Connection Visualizer" color={ACCENT_VIOLET} /></div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">From</th>
                <th className="text-center py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]" />
                <th className="text-left py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">To</th>
                <th className="text-center py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">Type</th>
                <th className="text-center py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">Est. Time</th>
                <th className="text-center py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">NavMesh</th>
              </tr>
            </thead>
            <tbody>
              {ZONE_CONNECTIONS.map((conn, i) => {
                const typeColor = TRANSITION_COLORS[conn.transitionType];
                return (
                  <tr key={i} className="border-b border-border/20 hover:bg-surface-hover/20 transition-colors">
                    <td className="py-2 px-2 text-text">{conn.from}</td>
                    <td className="py-2 px-2 text-center">
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted inline-block" />
                    </td>
                    <td className="py-2 px-2 text-text">{conn.to}</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                        {conn.transitionType}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-text-muted">{conn.estTime}</td>
                    <td className="py-2 px-2 text-center">
                      {conn.navMeshContinuity ? (
                        <CheckCircle2 className="w-3.5 h-3.5 inline-block" style={{ color: STATUS_SUCCESS }} />
                      ) : (
                        <Circle className="w-3.5 h-3.5 inline-block text-text-muted opacity-40" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* ── 10.7 Boss Arena Details ───────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={Skull} label="Boss Arena Details" color={STATUS_ERROR} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BOSS_ARENAS.map((boss) => (
            <motion.div
              key={boss.bossName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-surface-deep rounded-xl p-4 border border-border/40 overflow-hidden group"
            >
              {/* Glowing background effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${STATUS_ERROR}10 0%, transparent 70%)` }} />
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${STATUS_ERROR}60, transparent)` }} />

              <div className="flex items-start justify-between mb-3 relative z-10">
                <div>
                  <div className="text-sm font-bold text-text flex items-center gap-1.5">
                    <Skull className="w-4 h-4" style={{ color: STATUS_ERROR, filter: `drop-shadow(0 0 4px ${STATUS_ERROR}60)` }} />
                    {boss.bossName}
                  </div>
                  <div className="text-[10px] font-mono text-text-muted mt-0.5">{boss.zone}</div>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}30` }}>
                  Rec. Lv{boss.recommendedLevel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono relative z-10">
                <div className="bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                  <span className="text-text-muted">Phases</span>
                  <div className="font-bold text-text">{boss.phases}</div>
                </div>
                <div className="bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                  <span className="text-text-muted">Arena</span>
                  <div className="font-bold text-text">{boss.arenaSize}</div>
                </div>
                <div className="col-span-2 bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                  <span className="text-text-muted">Hazards</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {boss.hazards.map((h) => (
                      <span key={h} className="px-1 py-0.5 rounded text-[9px] font-bold"
                        style={{ backgroundColor: `${STATUS_WARNING}15`, color: STATUS_WARNING, border: `1px solid ${STATUS_WARNING}25` }}>
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-text-muted">
                  <Music className="w-3 h-3" style={{ color: ACCENT_VIOLET }} />
                  <span className="italic">{boss.musicTheme}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* ── 10.8 Environmental Hazard Map ─────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={AlertTriangle} label="Environmental Hazard Map" color={ACCENT_ORANGE} /></div>

        {/* Danger Score Summary */}
        <div className="flex flex-wrap gap-2 mb-2.5 pb-3 border-b border-border/40">
          {ZONE_DANGER_SCORES.map((zds) => {
            const dangerColor = zds.score >= 80 ? STATUS_ERROR : zds.score >= 50 ? ACCENT_ORANGE : zds.score >= 20 ? STATUS_WARNING : STATUS_SUCCESS;
            return (
              <div key={zds.zone} className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="text-text-muted">{zds.zone}:</span>
                <span className="font-bold px-1 py-0.5 rounded" style={{ color: dangerColor, backgroundColor: `${dangerColor}15` }}>
                  {zds.score}
                </span>
              </div>
            );
          })}
        </div>

        {/* Hazard Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">Zone</th>
                <th className="text-left py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">Type</th>
                <th className="text-right py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">DPS</th>
                <th className="text-right py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">Area</th>
                <th className="text-center py-2 px-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">Warning</th>
              </tr>
            </thead>
            <tbody>
              {ENV_HAZARDS.map((hazard, i) => {
                const typeColor = HAZARD_TYPE_COLORS[hazard.type];
                const warnColor = HAZARD_WARNING_COLORS[hazard.warningLevel];
                return (
                  <tr key={i} className="border-b border-border/20 hover:bg-surface-hover/20 transition-colors">
                    <td className="py-2 px-2 text-text">{hazard.zone}</td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                        {hazard.type}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color: hazard.damagePerSec >= 35 ? STATUS_ERROR : STATUS_WARNING }}>
                      {hazard.damagePerSec}
                    </td>
                    <td className="py-2 px-2 text-right text-text-muted">{hazard.affectedArea}</td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${warnColor}15`, color: warnColor, border: `1px solid ${warnColor}30` }}>
                        {hazard.warningLevel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* ── 10.9 Fast Travel Network ──────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={Zap} label="Fast Travel Network" color={ACCENT} /></div>

        {/* Coverage Summary */}
        <div className="flex flex-wrap gap-2 mb-2.5 pb-3 border-b border-border/40">
          {FAST_TRAVEL_COVERAGE.map((ftc) => (
            <div key={ftc.zone} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-text-muted">{ftc.zone}:</span>
              <span className="font-bold" style={{ color: ftc.pct === 100 ? STATUS_SUCCESS : ftc.pct > 0 ? STATUS_WARNING : '#475569' }}>
                {ftc.pct}%
              </span>
            </div>
          ))}
        </div>

        {/* Travel Nodes */}
        <div className="space-y-2">
          {FAST_TRAVEL_NODES.map((node) => (
            <div key={node.name} className="bg-surface-deep rounded-lg p-3 border border-border/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" style={{ color: node.discovered ? ACCENT : '#475569' }} />
                  <span className="text-xs font-bold text-text">{node.name}</span>
                  <span className="text-[10px] font-mono text-text-muted">({node.zone})</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: node.discovered ? STATUS_SUCCESS : '#475569',
                    backgroundColor: node.discovered ? `${STATUS_SUCCESS}15` : 'transparent',
                    border: `1px solid ${node.discovered ? STATUS_SUCCESS : '#475569'}30`,
                  }}>
                  {node.discovered ? 'Discovered' : 'Undiscovered'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {node.travelTimes.map((tt) => (
                  <span key={tt.to} className="flex items-center gap-1 text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface/50 border border-border/30">
                    <ArrowRight className="w-2.5 h-2.5" />
                    {tt.to}
                    <Timer className="w-2.5 h-2.5 ml-1 opacity-50" />
                    <span className="font-bold" style={{ color: ACCENT }}>{tt.seconds}s</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* ── 10.10 Zone Progression Timeline ───────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="mb-2.5"><SectionLabel icon={Clock} label="Zone Progression Timeline" color={ACCENT_EMERALD} /></div>

        {/* Current day indicator label */}
        <div className="text-[10px] font-mono text-text-muted mb-2">
          Day <span className="font-bold" style={{ color: ACCENT_PINK }}>{CURRENT_DAY}</span> / {TOTAL_ESTIMATED_DAYS} estimated
        </div>

        <div className="relative">
          {/* Current day vertical line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] z-10"
            style={{
              left: `${(CURRENT_DAY / TOTAL_ESTIMATED_DAYS) * 100}%`,
              backgroundColor: ACCENT_PINK,
              boxShadow: `0 0 6px ${ACCENT_PINK}60`,
            }}
          />

          <div className="space-y-2">
            {ZONE_PROGRESSION.map((zp) => {
              const started = zp.firstVisitDay >= 0;
              const startPct = started ? (zp.firstVisitDay / TOTAL_ESTIMATED_DAYS) * 100 : 0;
              const endDay = zp.completionDay ?? CURRENT_DAY;
              const widthPct = started ? ((endDay - zp.firstVisitDay) / TOTAL_ESTIMATED_DAYS) * 100 : 0;
              // Gradient: red at start -> green at 100%
              const gradientColor = zp.completionPct === 100 ? STATUS_SUCCESS
                : zp.completionPct >= 50 ? STATUS_WARNING
                  : zp.completionPct > 0 ? ACCENT_ORANGE : '#475569';

              return (
                <div key={zp.zone} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-text-muted w-28 truncate text-right flex-shrink-0">{zp.zone}</span>
                  <div className="relative flex-1 h-6 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                    {started ? (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.6 }}
                        className="absolute top-0 bottom-0 rounded-md flex items-center justify-center"
                        style={{
                          left: `${startPct}%`,
                          backgroundColor: `${gradientColor}35`,
                          border: `1px solid ${gradientColor}60`,
                        }}
                      >
                        <span className="text-[9px] font-mono font-bold" style={{ color: gradientColor }}>
                          {zp.completionPct}%
                        </span>
                      </motion.div>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-text-muted opacity-40">
                        Not visited
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day axis */}
          <div className="flex items-center gap-3 mt-2">
            <span className="w-28 flex-shrink-0" />
            <div className="flex-1 flex justify-between text-[9px] font-mono text-text-muted px-1">
              {Array.from({ length: Math.ceil(TOTAL_ESTIMATED_DAYS / 2) + 1 }, (_, i) => (
                <span key={i}>{i * 2}d</span>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Specific Zone Feature List Component ────────────────────────────────── */
function FeatureList({ itemNames, featureMap }: { itemNames: string[], featureMap: Map<string, FeatureRow> }) {
  return (
    <>
      {itemNames.map(name => {
        const status = featureMap.get(name)?.status ?? 'unknown';
        const sc = STATUS_COLORS[status];
        return (
          <div key={name} className="flex items-center justify-between text-xs bg-surface/50 p-2 rounded-lg border border-border/50">
            <span className="text-text font-medium">{name}</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface shadow-sm border border-border/40">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot, boxShadow: `0 0 5px ${sc.dot}80` }} />
              <span style={{ color: sc.dot }}>{sc.label}</span>
            </span>
          </div>
        )
      })}
    </>
  );
}

/* ── Map Canvas SVG ────────────────────────────────────────────────────────── */

function ZoneMapCanvas({
  zones, selectedZone, onSelectZone
}: {
  zones: ZoneNode[];
  selectedZone: ZoneNode;
  onSelectZone: (z: ZoneNode) => void;
}) {
  const getZoneColor = (z: ZoneNode) => {
    switch (z.status) {
      case 'completed': return STATUS_SUCCESS;
      case 'active': return STATUS_WARNING;
      case 'locked': return '#475569'; // slate-600
    }
  };

  const getStrokeColor = (z: ZoneNode) => {
    switch (z.status) {
      case 'completed': return `${STATUS_SUCCESS}80`;
      case 'active': return `${STATUS_WARNING}80`;
      case 'locked': return '#334155'; // slate-700
    }
  };

  return (
    <svg className="w-full h-full absolute inset-0 text-text cursor-crosshair">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.8" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Draw connections first so they're behind nodes */}
      {zones.map((zone) =>
        zone.connections.map((connId) => {
          const target = zones.find((z) => z.id === connId);
          if (!target) return null;
          return (
            <motion.line
              key={`${zone.id}-${connId}`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              x1={`${zone.cx}%`}
              y1={`${zone.cy}%`}
              x2={`${target.cx}%`}
              y2={`${target.cy}%`}
              stroke={`url(#lineGrad)`}
              strokeWidth="2"
              strokeDasharray="4 4"
              className="opacity-50"
            />
          );
        })
      )}

      {/* Draw nodes */}
      {zones.map((zone, i) => {
        const isSelected = zone.id === selectedZone.id;
        const color = getZoneColor(zone);
        const strokeColor = getStrokeColor(zone);
        const isBoss = zone.type === 'boss';
        const isHub = zone.type === 'hub';

        return (
          <g
            key={zone.id}
            onClick={() => onSelectZone(zone)}
            className="cursor-pointer group"
          >
            {/* Hover ring */}
            <motion.circle
              initial={{ r: 0 }}
              animate={{ r: isSelected ? 24 : 18 }}
              cx={`${zone.cx}%`}
              cy={`${zone.cy}%`}
              fill="transparent"
              stroke={isSelected ? color : 'transparent'}
              strokeWidth={1}
              className="opacity-50 group-hover:stroke-text-muted transition-colors duration-300"
              style={{ filter: isSelected ? 'url(#glow)' : 'none' }}
            />

            {/* Pulsing ring for active zone */}
            {zone.status === 'active' && (
              <motion.circle
                cx={`${zone.cx}%`}
                cy={`${zone.cy}%`}
                r="12"
                fill="transparent"
                stroke={color}
                strokeWidth="1.5"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            {/* Base shape based on type */}
            {isBoss ? (
              <motion.polygon
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                points={`${zone.cx},${zone.cy - 12} ${zone.cx + 12},${zone.cy} ${zone.cx},${zone.cy + 12} ${zone.cx - 12},${zone.cy}`}
                fill={color}
                stroke={isSelected ? '#fff' : strokeColor}
                strokeWidth="2"
                style={{ transformOrigin: `${zone.cx}% ${zone.cy}%` }}
              />
            ) : isHub ? (
              <motion.rect
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                x={`${zone.cx}%`} y={`${zone.cy}%`} width="20" height="20"
                transform={`translate(-10, -10)`}
                fill={color}
                stroke={isSelected ? '#fff' : strokeColor}
                strokeWidth="2"
                rx="4"
              />
            ) : (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                cx={`${zone.cx}%`}
                cy={`${zone.cy}%`}
                r={isSelected ? "10" : "8"}
                fill={color}
                stroke={isSelected ? '#fff' : strokeColor}
                strokeWidth="2"
                style={{ filter: zone.status !== 'locked' ? 'url(#glow)' : 'none' }}
              />
            )}

            {/* Selected Indicator */}
            {isSelected && (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                cx={`${zone.cx}%`}
                cy={`${zone.cy}%`}
                r="3"
                fill={isBoss ? '#fff' : '#000'}
              />
            )}

            {/* Label - visible on hover or if selected */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: isSelected ? 1 : 0.6 }}
              className="pointer-events-none transition-opacity duration-300 group-hover:opacity-100"
            >
              <rect
                x={`${zone.cx}%`}
                y={`${zone.cy + 5}%`}
                transform={`translate(-${(zone.name.length * 6) / 2}, 16)`}
                width={zone.name.length * 6 + 10}
                height="18"
                rx="4"
                fill="var(--surface-deep)"
                stroke="var(--border)"
                strokeWidth="1"
                className="opacity-90"
              />
              <text
                x={`${zone.cx}%`}
                y={`${zone.cy + 5}%`}
                transform={`translate(0, 29)`}
                textAnchor="middle"
                fontSize="10"
                fontFamily="monaco, monospace"
                fill="var(--text)"
                className="font-semibold"
              >
                {zone.name}
              </text>
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}
