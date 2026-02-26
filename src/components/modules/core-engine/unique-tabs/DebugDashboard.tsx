'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import {
  Wrench, Copy, Check, Terminal, Activity, Cpu, BarChart3, PieChart,
  Search, Wifi, Timer, Layers, LayoutGrid, ShieldAlert, TrendingDown,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
  OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { HeatmapGrid } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { HeatmapCell } from '@/types/unique-tab-improvements';
import { STATUS_COLORS, TabHeader, SectionLabel, FeatureCard, LoadingSpinner } from './_shared';

const ACCENT = ACCENT_ORANGE;

const INITIAL_BUDGETS = [
  { label: 'TICK_BUDGET', current: 11.2, target: 16.0, unit: 'ms' },
  { label: 'DRAW_CALLS', current: 1640, target: 2000, unit: '' },
  { label: 'VRAM_ALLOC', current: 380, target: 512, unit: 'MB' },
  { label: 'ACTIVE_ACTORS', current: 720, target: 1000, unit: '' },
];

const DEBUG_COMMANDS = [
  { syntax: 'godmode', description: 'Toggle invuln & infinite resources' },
  { syntax: 'give <id> <count>', description: 'Add item to inventory by ID' },
  { syntax: 'setlevel <n>', description: 'Set player level directly' },
  { syntax: 'spawn <type>', description: 'Spawn enemy at cursor location' },
  { syntax: 'killall', description: 'Purge all active enemies in cell' },
];

type EffortLevel = 'Small' | 'Medium' | 'Large';
type ImpactLevel = 'High' | 'Medium' | 'Low';

const OPTIMIZATIONS: { title: string; featureName: string; effort: EffortLevel; impact: ImpactLevel; description: string }[] = [
  { title: 'Object Pooling Init', featureName: 'Object pooling', effort: 'Medium', impact: 'High', description: 'Pre-allocate projectiles, VFX actors, and floating text.' },
  { title: 'Tick Optimization', featureName: 'Tick optimization', effort: 'Small', impact: 'High', description: 'Throttle tick on idle actors; move to timer delegates.' },
  { title: 'Async Asset Streaming', featureName: 'Async asset loading', effort: 'Large', impact: 'Medium', description: 'Stream level chunks to avoid main thread hitches.' },
];

const EFFORT_COLORS: Record<EffortLevel, string> = { Small: ACCENT_EMERALD, Medium: STATUS_WARNING, Large: STATUS_ERROR };
const IMPACT_COLORS: Record<ImpactLevel, string> = { High: STATUS_SUCCESS, Medium: STATUS_WARNING, Low: '#64748b' };

const FEATURE_NAMES = [
  'Structured logging', 'Debug draw helpers', 'Debug console commands',
  'Object pooling', 'Tick optimization', 'Async asset loading',
];

/* ── 12.1 System Health Matrix ──────────────────────────────────────────── */

const HEALTH_MATRIX_ROWS = ['GAS', 'AI', 'Physics', 'Rendering', 'Network', 'Audio'];
const HEALTH_MATRIX_COLS = ['Load', 'Latency', 'Errors', 'Memory'];
const HEALTH_MATRIX_CELLS: HeatmapCell[] = [
  // GAS
  { row: 0, col: 0, value: 0.35, tooltip: 'GAS Load: 35% — nominal' },
  { row: 0, col: 1, value: 0.22, tooltip: 'GAS Latency: 2.2ms — nominal' },
  { row: 0, col: 2, value: 0.05, tooltip: 'GAS Errors: 0.5% — clean' },
  { row: 0, col: 3, value: 0.40, tooltip: 'GAS Memory: 40% — nominal' },
  // AI
  { row: 1, col: 0, value: 0.72, tooltip: 'AI Load: 72% — elevated' },
  { row: 1, col: 1, value: 0.55, tooltip: 'AI Latency: 5.5ms — warning' },
  { row: 1, col: 2, value: 0.12, tooltip: 'AI Errors: 1.2% — low' },
  { row: 1, col: 3, value: 0.60, tooltip: 'AI Memory: 60% — elevated' },
  // Physics
  { row: 2, col: 0, value: 0.45, tooltip: 'Physics Load: 45% — nominal' },
  { row: 2, col: 1, value: 0.30, tooltip: 'Physics Latency: 3.0ms — nominal' },
  { row: 2, col: 2, value: 0.08, tooltip: 'Physics Errors: 0.8% — clean' },
  { row: 2, col: 3, value: 0.50, tooltip: 'Physics Memory: 50% — nominal' },
  // Rendering
  { row: 3, col: 0, value: 0.88, tooltip: 'Rendering Load: 88% — critical' },
  { row: 3, col: 1, value: 0.75, tooltip: 'Rendering Latency: 7.5ms — high' },
  { row: 3, col: 2, value: 0.15, tooltip: 'Rendering Errors: 1.5% — low' },
  { row: 3, col: 3, value: 0.82, tooltip: 'Rendering Memory: 82% — high' },
  // Network
  { row: 4, col: 0, value: 0.28, tooltip: 'Network Load: 28% — low' },
  { row: 4, col: 1, value: 0.65, tooltip: 'Network Latency: 6.5ms — elevated' },
  { row: 4, col: 2, value: 0.20, tooltip: 'Network Errors: 2.0% — moderate' },
  { row: 4, col: 3, value: 0.18, tooltip: 'Network Memory: 18% — low' },
  // Audio
  { row: 5, col: 0, value: 0.15, tooltip: 'Audio Load: 15% — idle' },
  { row: 5, col: 1, value: 0.10, tooltip: 'Audio Latency: 1.0ms — nominal' },
  { row: 5, col: 2, value: 0.02, tooltip: 'Audio Errors: 0.2% — clean' },
  { row: 5, col: 3, value: 0.25, tooltip: 'Audio Memory: 25% — low' },
];

/* ── 12.2 Frame Time Waterfall ──────────────────────────────────────────── */

const FRAME_TIME_BARS = [
  { label: 'GameThread', ms: 4.2, color: ACCENT_ORANGE },
  { label: 'RenderThread', ms: 6.1, color: STATUS_ERROR },
  { label: 'GPUTime', ms: 8.3, color: ACCENT_VIOLET },
  { label: 'Physics', ms: 1.5, color: ACCENT_CYAN },
  { label: 'Animation', ms: 2.1, color: ACCENT_EMERALD },
  { label: 'UI', ms: 0.8, color: STATUS_WARNING },
];
const FRAME_TARGET_MS = 16.67;
const FRAME_TOTAL_MS = FRAME_TIME_BARS.reduce((s, b) => s + b.ms, 0);

/* ── 12.3 Memory Allocation Tracker ─────────────────────────────────────── */

const MEMORY_SLICES = [
  { label: 'Textures', pct: 45, mb: 171, color: ACCENT_ORANGE },
  { label: 'Meshes', pct: 25, mb: 95, color: ACCENT_VIOLET },
  { label: 'Audio', pct: 10, mb: 38, color: ACCENT_CYAN },
  { label: 'Scripts', pct: 8, mb: 30.4, color: ACCENT_EMERALD },
  { label: 'Physics', pct: 7, mb: 26.6, color: STATUS_WARNING },
  { label: 'UI', pct: 5, mb: 19, color: STATUS_INFO },
];
const MEMORY_TOTAL_MB = 380;
const MEMORY_PEAK_MB = 412;
const MEMORY_BUDGET_MB = 512;

/* ── 12.4 Console Command Builder ───────────────────────────────────────── */

type CommandCategory = 'Debug' | 'Cheats' | 'World' | 'Stats';
const CONSOLE_COMMANDS: { syntax: string; description: string; category: CommandCategory; params?: string }[] = [
  { syntax: 'stat fps', description: 'Toggle FPS counter overlay', category: 'Stats' },
  { syntax: 'stat unit', description: 'Show per-thread timing breakdown', category: 'Stats' },
  { syntax: 'stat memory', description: 'Display memory allocation stats', category: 'Stats' },
  { syntax: 'show collision', description: 'Visualize collision volumes', category: 'Debug', params: '[channel]' },
  { syntax: 'show bounds', description: 'Render actor bounding boxes', category: 'Debug' },
  { syntax: 'log verbose', description: 'Set log verbosity to verbose', category: 'Debug', params: '<category>' },
  { syntax: 'god', description: 'Toggle god mode (invulnerability)', category: 'Cheats' },
  { syntax: 'fly', description: 'Toggle flying movement mode', category: 'Cheats' },
  { syntax: 'ghost', description: 'Toggle no-clip ghost mode', category: 'Cheats' },
  { syntax: 'slomo', description: 'Set time dilation factor', category: 'World', params: '<factor>' },
  { syntax: 'teleport', description: 'Teleport to coordinates', category: 'World', params: '<x> <y> <z>' },
  { syntax: 'loadlevel', description: 'Stream in a new map/level', category: 'World', params: '<map_name>' },
];
const RECENT_COMMANDS = ['stat fps', 'god', 'slomo'];
const COMMAND_CATEGORIES: CommandCategory[] = ['Debug', 'Cheats', 'World', 'Stats'];
const CATEGORY_COLORS: Record<CommandCategory, string> = {
  Debug: ACCENT_ORANGE,
  Cheats: STATUS_ERROR,
  World: ACCENT_EMERALD,
  Stats: ACCENT_CYAN,
};

/* ── 12.5 Network Replication Monitor ───────────────────────────────────── */

const NET_BANDWIDTH = { current: 2.4, max: 10, unit: 'Mbps' };
const NET_REPLICATED_ACTORS = [
  { actor: 'PlayerCharacter', count: 1, bytesPerSec: 4200, priority: 'Critical' as const },
  { actor: 'EnemyAI', count: 5, bytesPerSec: 2800, priority: 'High' as const },
  { actor: 'Projectile', count: 3, bytesPerSec: 1200, priority: 'Medium' as const },
  { actor: 'LootDrop', count: 8, bytesPerSec: 400, priority: 'Low' as const },
  { actor: 'WorldItem', count: 12, bytesPerSec: 150, priority: 'Low' as const },
];
const NET_RPC_FREQ = [
  { name: 'ServerMovement', freq: 60, color: ACCENT_ORANGE },
  { name: 'DamageEvent', freq: 24, color: STATUS_ERROR },
  { name: 'AbilityActivation', freq: 12, color: ACCENT_VIOLET },
  { name: 'InventorySync', freq: 4, color: ACCENT_CYAN },
];
const NET_SUGGESTIONS = [
  'Consider relevancy culling for WorldItem actors beyond 50m',
  'Batch projectile replication into single multicast RPC',
  'Reduce EnemyAI net update frequency from 30Hz to 15Hz when >100m',
];
const PRIORITY_COLORS: Record<string, string> = {
  Critical: STATUS_ERROR,
  High: STATUS_WARNING,
  Medium: ACCENT_CYAN,
  Low: '#64748b',
};

/* ── 12.6 GC Timeline ──────────────────────────────────────────────────── */

const GC_EVENTS = [
  { id: 'gc-1', time: 12.4, duration: 2.1, heapBefore: 340, heapAfter: 280 },
  { id: 'gc-2', time: 58.2, duration: 3.8, heapBefore: 385, heapAfter: 290 },
  { id: 'gc-3', time: 102.6, duration: 1.5, heapBefore: 350, heapAfter: 295 },
  { id: 'gc-4', time: 148.1, duration: 4.2, heapBefore: 410, heapAfter: 305 },
  { id: 'gc-5', time: 192.8, duration: 2.8, heapBefore: 380, heapAfter: 285 },
  { id: 'gc-6', time: 237.5, duration: 1.9, heapBefore: 355, heapAfter: 290 },
  { id: 'gc-7', time: 283.0, duration: 5.6, heapBefore: 440, heapAfter: 310 },
  { id: 'gc-8', time: 328.4, duration: 2.4, heapBefore: 370, heapAfter: 288 },
  { id: 'gc-9', time: 372.9, duration: 3.1, heapBefore: 395, heapAfter: 298 },
  { id: 'gc-10', time: 418.3, duration: 1.7, heapBefore: 345, heapAfter: 282 },
];
const GC_AVG_INTERVAL = 45;
const GC_WARNING_THRESHOLD_MS = 5;

/* ── 12.7 Draw Call Analyzer ────────────────────────────────────────────── */

const DRAW_CALL_CATEGORIES = [
  { category: 'StaticMesh', count: 420, color: ACCENT_ORANGE },
  { category: 'SkeletalMesh', count: 180, color: ACCENT_VIOLET },
  { category: 'Particles', count: 95, color: ACCENT_CYAN },
  { category: 'UI', count: 45, color: STATUS_WARNING },
  { category: 'Decals', count: 30, color: ACCENT_EMERALD },
  { category: 'Translucent', count: 20, color: STATUS_INFO },
];
const DRAW_CALL_TOTAL = DRAW_CALL_CATEGORIES.reduce((s, c) => s + c.count, 0);
const DRAW_CALL_BUDGET = 2000;
const EXPENSIVE_MATERIALS = [
  { name: 'M_Hero_Body', drawCalls: 42, shader: 'Complex PBR + SSS', cost: 'High' },
  { name: 'M_Water_Ocean', drawCalls: 28, shader: 'Translucent + Refraction', cost: 'High' },
  { name: 'M_Foliage_Wind', drawCalls: 65, shader: 'Two-Sided + WPO', cost: 'Medium' },
  { name: 'M_VFX_Fire', drawCalls: 38, shader: 'Additive + Distortion', cost: 'Medium' },
];

/* ── 12.8 Stat Command Dashboard ────────────────────────────────────────── */

interface StatEntry { label: string; value: string; sparkline: number[]; unit?: string }
interface StatGroup { group: string; stats: StatEntry[] }

const STAT_GROUPS: StatGroup[] = [
  {
    group: 'FPS Stats',
    stats: [
      { label: 'FPS', value: '62.4', sparkline: [58, 60, 61, 59, 63, 62, 64, 61, 60, 62], unit: 'fps' },
      { label: 'Frame Time', value: '16.02', sparkline: [17.2, 16.6, 16.4, 16.9, 15.8, 16.1, 15.6, 16.4, 16.6, 16.0], unit: 'ms' },
      { label: '1% Low', value: '45.2', sparkline: [42, 44, 43, 46, 45, 44, 47, 45, 44, 45], unit: 'fps' },
    ],
  },
  {
    group: 'Game Thread',
    stats: [
      { label: 'Tick Time', value: '4.2', sparkline: [4.5, 4.3, 4.1, 4.4, 4.2, 4.0, 4.3, 4.1, 4.2, 4.2], unit: 'ms' },
      { label: 'Actor Count', value: '720', sparkline: [710, 715, 718, 722, 720, 725, 718, 720, 722, 720] },
      { label: 'Blueprint Time', value: '1.8', sparkline: [2.0, 1.9, 1.7, 1.8, 2.1, 1.8, 1.7, 1.9, 1.8, 1.8], unit: 'ms' },
    ],
  },
  {
    group: 'Render Thread',
    stats: [
      { label: 'Draw Calls', value: '790', sparkline: [780, 785, 792, 788, 790, 795, 782, 790, 788, 790] },
      { label: 'Triangles', value: '1.2M', sparkline: [1.1, 1.15, 1.2, 1.18, 1.22, 1.2, 1.19, 1.21, 1.2, 1.2] },
      { label: 'Render Time', value: '6.1', sparkline: [6.3, 6.0, 6.2, 6.1, 5.9, 6.1, 6.3, 6.0, 6.1, 6.1], unit: 'ms' },
    ],
  },
  {
    group: 'GPU',
    stats: [
      { label: 'GPU Time', value: '8.3', sparkline: [8.5, 8.2, 8.4, 8.3, 8.1, 8.3, 8.5, 8.2, 8.3, 8.3], unit: 'ms' },
      { label: 'VRAM Used', value: '380', sparkline: [375, 378, 380, 382, 380, 379, 381, 380, 380, 380], unit: 'MB' },
      { label: 'GPU Util', value: '78', sparkline: [75, 77, 79, 78, 76, 78, 80, 77, 78, 78], unit: '%' },
    ],
  },
  {
    group: 'Memory',
    stats: [
      { label: 'Physical', value: '2.1', sparkline: [2.0, 2.05, 2.1, 2.08, 2.1, 2.12, 2.1, 2.09, 2.1, 2.1], unit: 'GB' },
      { label: 'Virtual', value: '4.8', sparkline: [4.7, 4.75, 4.8, 4.78, 4.8, 4.82, 4.8, 4.79, 4.8, 4.8], unit: 'GB' },
      { label: 'Pool Allocs', value: '12.4K', sparkline: [12.1, 12.2, 12.3, 12.4, 12.3, 12.4, 12.5, 12.3, 12.4, 12.4] },
    ],
  },
];

/* ── 12.9 Crash Prediction Engine ───────────────────────────────────────── */

type RiskLevel = 'GREEN' | 'AMBER' | 'RED';
const RISK_COLORS: Record<RiskLevel, string> = { GREEN: STATUS_SUCCESS, AMBER: STATUS_WARNING, RED: STATUS_ERROR };

const CRASH_RISK_OVERALL = 'LOW' as const;
const CRASH_RISK_FACTORS: { factor: string; risk: RiskLevel; detail: string }[] = [
  { factor: 'Memory Headroom', risk: 'GREEN', detail: '132MB free of 512MB budget' },
  { factor: 'GC Frequency', risk: 'GREEN', detail: 'Stable ~45s interval, no spikes' },
  { factor: 'Frame Time Trend', risk: 'AMBER', detail: 'Slight upward trend +0.3ms over 5min' },
  { factor: 'Null Access Checks', risk: 'GREEN', detail: '0 null access warnings in last hour' },
  { factor: 'Thread Contention', risk: 'GREEN', detail: 'No deadlocks detected, mutex waits <0.1ms' },
  { factor: 'Asset Load Failures', risk: 'GREEN', detail: '0 failed async loads in session' },
];
const CRASH_RECOMMENDATIONS = [
  'Monitor frame time trend — investigate if delta exceeds +1ms over 10min',
  'Consider pre-warming object pools before high-intensity zones',
  'Enable crash reporter telemetry for automated regression tracking',
];

/* ── 12.10 Performance Regression Detector ──────────────────────────────── */

type RegressionStatus = 'PASS' | 'AMBER' | 'FAIL';
const REGRESSION_STATUS_COLORS: Record<RegressionStatus, string> = {
  PASS: STATUS_SUCCESS,
  AMBER: STATUS_WARNING,
  FAIL: STATUS_ERROR,
};
const REGRESSION_METRICS: { metric: string; status: RegressionStatus; detail: string; delta?: string }[] = [
  { metric: 'FPS (Avg)', status: 'PASS', detail: '62.4 fps vs 63.1 baseline', delta: '-1.1%' },
  { metric: 'Frame Time (P99)', status: 'PASS', detail: '18.2ms vs 18.0ms baseline', delta: '+1.1%' },
  { metric: 'Memory (Peak)', status: 'AMBER', detail: '412MB vs 381MB baseline', delta: '+8.1%' },
  { metric: 'Draw Calls', status: 'PASS', detail: '790 vs 785 baseline', delta: '+0.6%' },
  { metric: 'Load Time', status: 'PASS', detail: '3.2s vs 3.1s baseline', delta: '+3.2%' },
  { metric: 'GC Pause (Max)', status: 'PASS', detail: '5.6ms vs 5.2ms baseline', delta: '+7.7%' },
];
const REGRESSION_BUILDS = [
  { build: 'v0.8.1', fps: 65, memory: 360, drawCalls: 750 },
  { build: 'v0.8.2', fps: 64, memory: 368, drawCalls: 770 },
  { build: 'v0.8.3', fps: 63, memory: 375, drawCalls: 780 },
  { build: 'v0.9.0', fps: 63, memory: 381, drawCalls: 785 },
  { build: 'v0.9.1', fps: 62, memory: 412, drawCalls: 790 },
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function CircularGauge({ label, current, target, unit }: { label: string; current: number; target: number; unit: string }) {
  const pct = Math.min(current / target, 1);
  const r = 20;
  const circ = 2 * Math.PI * r;
  const color = pct < 0.75 ? STATUS_SUCCESS : pct < 0.95 ? STATUS_WARNING : STATUS_ERROR;
  const statusLabel = pct < 0.75 ? 'NOMINAL' : pct < 0.95 ? 'WARNING' : 'CRITICAL';

  return (
    <SurfaceCard level={2} className="flex flex-col items-center px-2 py-3 gap-2 relative overflow-hidden border-orange-900/40 bg-orange-950/10 hover:border-orange-500/30 transition-colors">
      <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

      <div className="relative">
        <svg width="48" height="48" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
          <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round" transform="rotate(-90 30 30)"
            style={{ transition: 'stroke-dashoffset 0.3s ease-out', filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
          <span className="text-[10px] font-mono font-bold" style={{ color }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>

      <div className="text-center w-full z-10">
        <div className="text-[10px] font-mono font-bold text-orange-400/80 mb-0.5 truncate tracking-widest">{label}</div>
        <div className="text-sm font-mono text-orange-100" style={{ textShadow: '0 0 8px rgba(251,146,60,0.5)' }}>
          {current.toFixed(unit === 'ms' ? 1 : 0)}<span className="text-[10px] text-orange-500/50">{unit}</span>
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-[8px] px-1.5 py-[2px] rounded font-mono uppercase tracking-widest border" style={{ backgroundColor: `${color}${OPACITY_10}`, color, borderColor: `${color}${OPACITY_30}` }}>
            {statusLabel}
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded transition-all border shrink-0"
      style={{
        backgroundColor: copied ? `${STATUS_SUCCESS}${OPACITY_20}` : `${ACCENT}${OPACITY_10}`,
        color: copied ? STATUS_SUCCESS : ACCENT,
        borderColor: copied ? STATUS_SUCCESS : `${ACCENT}${OPACITY_30}`,
        boxShadow: copied ? `0 0 10px ${STATUS_SUCCESS}40` : 'none'
      }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'COPIED' : 'EXEC'}
    </button>
  );
}

/** Inline sparkline mini-chart for stat dashboard */
function Sparkline({ data, color, width = 60, height = 16 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
    </svg>
  );
}

interface DebugDashboardProps { moduleId: SubModuleId }

export function DebugDashboard({ moduleId }: DebugDashboardProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Real-time telemetry simulation
  const [budgets, setBudgets] = useState(INITIAL_BUDGETS);

  // 12.4 Console Command Builder search state
  const [cmdSearch, setCmdSearch] = useState('');
  const [cmdCategoryFilter, setCmdCategoryFilter] = useState<CommandCategory | 'All'>('All');

  // 12.8 Stat groups collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useSuspendableEffect(() => {
    const updateInterval = setInterval(() => {
      setBudgets(prev => prev.map(b => {
        // slight randomization logic
        const variance = (Math.random() - 0.5) * (b.current * 0.05);
        let nextVal = b.current + variance;
        if (nextVal < b.target * 0.1) nextVal = b.target * 0.1;
        if (nextVal > b.target * 1.5) nextVal = b.target * 1.5;
        return { ...b, current: nextVal };
      }));
    }, 800);

    return () => clearInterval(updateInterval);
  }, []);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  const stats = useMemo(() => {
    const implemented = FEATURE_NAMES.filter((n) => {
      const st = featureMap.get(n)?.status ?? 'unknown';
      return st === 'implemented' || st === 'improved';
    }).length;
    return { total: FEATURE_NAMES.length, implemented };
  }, [featureMap]);

  // 12.4 Filtered commands
  const filteredCommands = useMemo(() => {
    return CONSOLE_COMMANDS.filter(cmd => {
      const matchesSearch = !cmdSearch || cmd.syntax.toLowerCase().includes(cmdSearch.toLowerCase()) || cmd.description.toLowerCase().includes(cmdSearch.toLowerCase());
      const matchesCat = cmdCategoryFilter === 'All' || cmd.category === cmdCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [cmdSearch, cmdCategoryFilter]);

  // 12.8 Group toggle
  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-2.5">
      {/* Terminal Interface Header */}
      <div className="flex items-center justify-between pb-3 border-b border-orange-900/40 relative">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded grid place-items-center bg-orange-950/50 border border-orange-800/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-orange-500/20 animate-pulse pointer-events-none" style={{ animationDuration: '1.5s' }} />
            <Activity className="w-5 h-5 relative z-10 text-orange-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-orange-100 font-mono tracking-widest uppercase" style={{ textShadow: '0 0 8px rgba(251,146,60,0.4)' }}>
              CORE_TELEMETRY.exe
            </span>
            <span className="text-xs text-orange-700 font-mono uppercase tracking-widest mt-0.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE STREAM ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Budget gauges */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">SYSTEM_RESOURCES</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {budgets.map((g) => <CircularGauge key={g.label} {...g} />)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Features list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
            <Wrench className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">DEBUG_SUBSYSTEMS // {stats.implemented}/{stats.total}</span>
          </div>
          <div className="space-y-1.5">
            {FEATURE_NAMES.map((name) => (
              <FeatureCard
                key={name}
                name={name}
                featureMap={featureMap}
                defs={defs}
                expanded={expandedFeature}
                onToggle={toggleFeature}
                accent={ACCENT}
              />
            ))}
          </div>
        </div>

        {/* Console Commands */}
        <div className="space-y-2 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
            <Terminal className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">DEV_CONSOLE_CMDS</span>
          </div>
          <SurfaceCard level={2} className="p-0 border-orange-900/30 bg-[#0a0500] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex-1 flex flex-col overflow-hidden relative font-mono">
            <div className="p-3 space-y-2 relative z-10 flex-1 overflow-y-auto">
              {DEBUG_COMMANDS.map((cmd) => (
                <div key={cmd.syntax} className="border border-orange-900/40 bg-orange-950/10 p-2 relative group hover:border-orange-500/50 transition-colors">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <div className="flex flex-col gap-1.5 pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-orange-300 tracking-wide mt-1">&gt; {cmd.syntax}</span>
                      <CopyButton text={cmd.syntax} />
                    </div>
                    <p className="text-[10px] text-orange-700/80 leading-relaxed uppercase">{cmd.description}</p>
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-orange-700/50 mt-2 animate-pulse">&gt; _</div>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Optimization queue */}
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <Activity className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">PERF_OPTIMIZATION_QUEUE</span>
        </div>
        <div className="space-y-2 mt-2">
          {OPTIMIZATIONS.map((opt, i) => {
            const status: FeatureStatus = featureMap.get(opt.featureName)?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            return (
              <SurfaceCard key={opt.title} level={2} className="px-3 py-3 border-orange-900/20 bg-orange-950/5 relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono border"
                      style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT, borderColor: `${ACCENT}${OPACITY_30}` }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-bold text-orange-100 font-mono tracking-widest">{opt.title}</span>
                  </div>
                  <div className="sm:ml-auto flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
                    <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-[2px] rounded border" style={{ backgroundColor: `${EFFORT_COLORS[opt.effort]}${OPACITY_10}`, color: EFFORT_COLORS[opt.effort], borderColor: `${EFFORT_COLORS[opt.effort]}${OPACITY_30}` }}>{opt.effort} EFFORT</span>
                    <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-[2px] rounded border" style={{ backgroundColor: `${IMPACT_COLORS[opt.impact]}${OPACITY_10}`, color: IMPACT_COLORS[opt.impact], borderColor: `${IMPACT_COLORS[opt.impact]}${OPACITY_30}` }}>{opt.impact} IMPACT</span>
                    <span className="flex items-center gap-1.5 px-2 py-[2px] rounded border bg-surface" style={{ borderColor: `${sc.dot}40` }}>
                      <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: sc.dot }}>{sc.label}</span>
                    </span>
                  </div>
                </div>
                <p className="text-xs text-orange-200/50 leading-relaxed pl-9 font-mono border-l border-orange-900/40 ml-[11px] mt-1 tracking-wide">{opt.description}</p>
              </SurfaceCard>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.1 — System Health Matrix
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <Cpu className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">SYSTEM_HEALTH_MATRIX</span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          <HeatmapGrid
            rows={HEALTH_MATRIX_ROWS}
            cols={HEALTH_MATRIX_COLS}
            cells={HEALTH_MATRIX_CELLS}
            lowColor="#0c2d1a"
            highColor={STATUS_ERROR}
            accent={ACCENT}
          />
          <div className="flex items-center gap-2.5 mt-3 text-[9px] font-mono text-orange-500/60 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#0c2d1a' }} /> HEALTHY
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_WARNING }} /> WARNING
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> CRITICAL
            </span>
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.2 — Frame Time Waterfall
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <BarChart3 className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">FRAME_TIME_WATERFALL</span>
          <span className="ml-auto text-[9px] font-mono text-orange-500/50">
            TOTAL: {FRAME_TOTAL_MS.toFixed(1)}ms / {FRAME_TARGET_MS.toFixed(2)}ms TARGET
          </span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          <div className="space-y-2">
            {FRAME_TIME_BARS.map((bar) => {
              const pct = (bar.ms / FRAME_TARGET_MS) * 100;
              return (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-orange-400/80 w-24 text-right uppercase tracking-widest">{bar.label}</span>
                  <div className="flex-1 h-5 bg-black/40 rounded-sm relative overflow-hidden">
                    <div
                      className="h-full rounded-sm relative"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: `${bar.color}40`,
                        borderRight: `2px solid ${bar.color}`,
                        boxShadow: `inset 0 0 10px ${bar.color}20`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold w-14 text-right" style={{ color: bar.color }}>
                    {bar.ms.toFixed(1)}ms
                  </span>
                </div>
              );
            })}
          </div>
          {/* Stacked summary bar */}
          <div className="mt-2.5 relative">
            <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1">STACKED FRAME BUDGET</div>
            <div className="h-6 bg-black/40 rounded-sm flex overflow-hidden relative">
              {FRAME_TIME_BARS.map((bar) => (
                <div
                  key={bar.label}
                  className="h-full relative group"
                  style={{
                    width: `${(bar.ms / FRAME_TARGET_MS) * 100}%`,
                    backgroundColor: `${bar.color}50`,
                    borderRight: '1px solid rgba(0,0,0,0.5)',
                  }}
                  title={`${bar.label}: ${bar.ms}ms`}
                />
              ))}
              {/* Target line */}
              <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-orange-500/80" style={{ left: '100%' }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] font-mono text-orange-500/40">0ms</span>
              <span className="text-[8px] font-mono text-orange-500/80">{FRAME_TARGET_MS.toFixed(2)}ms (60fps)</span>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.3 — Memory Allocation Tracker
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <PieChart className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">MEMORY_ALLOCATION_TRACKER</span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* Donut chart */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <svg width="110" height="110" viewBox="0 0 140 140">
                  {(() => {
                    let cumulative = 0;
                    const r = 52;
                    const circ = 2 * Math.PI * r;
                    return MEMORY_SLICES.map((slice) => {
                      const offset = cumulative;
                      cumulative += slice.pct;
                      return (
                        <circle
                          key={slice.label}
                          cx="70" cy="70" r={r}
                          fill="none" stroke={slice.color} strokeWidth="14"
                          strokeDasharray={`${(slice.pct / 100) * circ} ${circ}`}
                          strokeDashoffset={-(offset / 100) * circ}
                          transform="rotate(-90 70 70)"
                          style={{ filter: `drop-shadow(0 0 3px ${slice.color}40)` }}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-lg font-mono font-bold text-orange-100">{MEMORY_TOTAL_MB}</span>
                  <span className="text-[9px] font-mono text-orange-500/60 uppercase">MB TOTAL</span>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                {MEMORY_SLICES.map((slice) => (
                  <div key={slice.label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="text-[9px] font-mono text-orange-400/70 uppercase tracking-widest">{slice.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Stats panel */}
            <div className="space-y-3">
              {MEMORY_SLICES.map((slice) => (
                <div key={slice.label} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-orange-400/80 w-16 text-right uppercase">{slice.label}</span>
                  <div className="flex-1 h-3 bg-black/40 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${slice.pct}%`, backgroundColor: `${slice.color}60` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold w-16 text-right" style={{ color: slice.color }}>
                    {slice.mb.toFixed(0)}MB <span className="text-orange-500/40">({slice.pct}%)</span>
                  </span>
                </div>
              ))}
              <div className="border-t border-orange-900/30 pt-2 mt-2 space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-orange-500/60 uppercase tracking-widest">Peak</span>
                  <span className="text-orange-300 font-bold">{MEMORY_PEAK_MB}MB</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-orange-500/60 uppercase tracking-widest">Budget Remaining</span>
                  <span className="font-bold" style={{ color: STATUS_SUCCESS }}>{MEMORY_BUDGET_MB - MEMORY_TOTAL_MB}MB</span>
                </div>
                {/* Budget gauge */}
                <div className="h-3 bg-black/40 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(MEMORY_TOTAL_MB / MEMORY_BUDGET_MB) * 100}%`, backgroundColor: `${ACCENT}40`, borderRight: `2px solid ${ACCENT}` }} />
                </div>
                <div className="flex justify-between text-[8px] font-mono text-orange-500/40">
                  <span>0MB</span>
                  <span>{MEMORY_BUDGET_MB}MB BUDGET</span>
                </div>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.4 — Console Command Builder
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <Search className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">CONSOLE_COMMAND_BUILDER</span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          {/* Search + Category filter */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-orange-500/50" />
              <input
                type="text"
                placeholder="Search commands..."
                value={cmdSearch}
                onChange={(e) => setCmdSearch(e.target.value)}
                className="w-full text-[10px] font-mono bg-black/40 border border-orange-900/40 rounded pl-7 pr-2 py-1.5 text-orange-200 placeholder:text-orange-700/50 focus:outline-none focus:border-orange-500/50 uppercase tracking-widest"
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCmdCategoryFilter('All')}
                className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded border transition-colors"
                style={{
                  backgroundColor: cmdCategoryFilter === 'All' ? `${ACCENT}${OPACITY_20}` : 'transparent',
                  color: cmdCategoryFilter === 'All' ? ACCENT : `${ACCENT}60`,
                  borderColor: cmdCategoryFilter === 'All' ? `${ACCENT}${OPACITY_30}` : 'rgba(249,115,22,0.15)',
                }}
              >
                ALL
              </button>
              {COMMAND_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCmdCategoryFilter(cat)}
                  className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded border transition-colors"
                  style={{
                    backgroundColor: cmdCategoryFilter === cat ? `${CATEGORY_COLORS[cat]}${OPACITY_20}` : 'transparent',
                    color: cmdCategoryFilter === cat ? CATEGORY_COLORS[cat] : `${CATEGORY_COLORS[cat]}60`,
                    borderColor: cmdCategoryFilter === cat ? `${CATEGORY_COLORS[cat]}${OPACITY_30}` : `${CATEGORY_COLORS[cat]}20`,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Recently used */}
          <div className="mb-3">
            <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">RECENTLY USED</div>
            <div className="flex gap-1.5 flex-wrap">
              {RECENT_COMMANDS.map((cmd) => (
                <span key={cmd} className="text-[10px] font-mono px-2 py-0.5 rounded border border-orange-900/40 bg-orange-950/20 text-orange-300 hover:border-orange-500/40 transition-colors cursor-default">
                  &gt; {cmd}
                </span>
              ))}
            </div>
          </div>

          {/* Command list */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {filteredCommands.map((cmd) => (
              <div key={cmd.syntax} className="flex items-start gap-3 p-2 border border-orange-900/30 bg-black/20 rounded hover:border-orange-500/30 transition-colors group">
                <span className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-[1px] rounded border flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: `${CATEGORY_COLORS[cmd.category]}${OPACITY_10}`,
                    color: CATEGORY_COLORS[cmd.category],
                    borderColor: `${CATEGORY_COLORS[cmd.category]}${OPACITY_30}`,
                  }}
                >
                  {cmd.category}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono font-bold text-orange-300">
                    &gt; {cmd.syntax}{cmd.params ? <span className="text-orange-500/50"> {cmd.params}</span> : null}
                  </div>
                  <div className="text-[9px] font-mono text-orange-700/70 uppercase mt-0.5">{cmd.description}</div>
                </div>
                <CopyButton text={cmd.syntax} />
              </div>
            ))}
            {filteredCommands.length === 0 && (
              <div className="text-[10px] font-mono text-orange-700/50 text-center py-4 uppercase tracking-widest">
                NO COMMANDS MATCH FILTER
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.5 — Network Replication Monitor
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <Wifi className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">NETWORK_REPLICATION_MONITOR</span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {/* Left: Bandwidth + Actor table */}
            <div className="space-y-3">
              {/* Bandwidth gauge */}
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-orange-500/60 uppercase tracking-widest">BANDWIDTH</span>
                  <span className="text-orange-300 font-bold">{NET_BANDWIDTH.current}/{NET_BANDWIDTH.max} {NET_BANDWIDTH.unit}</span>
                </div>
                <div className="h-4 bg-black/40 rounded-sm overflow-hidden relative">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${(NET_BANDWIDTH.current / NET_BANDWIDTH.max) * 100}%`,
                      backgroundColor: `${ACCENT_CYAN}50`,
                      borderRight: `2px solid ${ACCENT_CYAN}`,
                    }}
                  />
                </div>
              </div>
              {/* Top replicated actors table */}
              <div>
                <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">TOP REPLICATED ACTORS</div>
                <div className="space-y-1">
                  <div className="grid grid-cols-4 gap-2 text-[8px] font-mono text-orange-500/40 uppercase tracking-widest pb-1 border-b border-orange-900/20">
                    <span>Actor</span><span className="text-center">Count</span><span className="text-center">B/s</span><span className="text-right">Priority</span>
                  </div>
                  {NET_REPLICATED_ACTORS.map((a) => (
                    <div key={a.actor} className="grid grid-cols-4 gap-2 text-[10px] font-mono py-0.5 hover:bg-orange-950/20 transition-colors">
                      <span className="text-orange-300 truncate">{a.actor}</span>
                      <span className="text-center text-orange-400/70">{a.count}</span>
                      <span className="text-center text-orange-400/70">{(a.bytesPerSec / 1000).toFixed(1)}K</span>
                      <span className="text-right">
                        <span className="px-1 py-[1px] rounded text-[8px] uppercase" style={{ color: PRIORITY_COLORS[a.priority], backgroundColor: `${PRIORITY_COLORS[a.priority]}${OPACITY_10}` }}>
                          {a.priority}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Right: RPC frequency + Suggestions */}
            <div className="space-y-3">
              {/* RPC frequency */}
              <div>
                <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">RPC FREQUENCY (calls/sec)</div>
                <div className="space-y-1.5">
                  {NET_RPC_FREQ.map((rpc) => {
                    const maxFreq = Math.max(...NET_RPC_FREQ.map(r => r.freq));
                    return (
                      <div key={rpc.name} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-orange-400/70 w-28 text-right truncate">{rpc.name}</span>
                        <div className="flex-1 h-3 bg-black/40 rounded-sm overflow-hidden">
                          <div className="h-full rounded-sm" style={{ width: `${(rpc.freq / maxFreq) * 100}%`, backgroundColor: `${rpc.color}50` }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color: rpc.color }}>{rpc.freq}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Optimization suggestions */}
              <div>
                <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">OPTIMIZATION SUGGESTIONS</div>
                <div className="space-y-1.5">
                  {NET_SUGGESTIONS.map((sug, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] font-mono text-orange-400/60 leading-relaxed">
                      <Zap className="w-3 h-3 text-orange-500/50 flex-shrink-0 mt-0.5" />
                      <span>{sug}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.6 — GC Timeline
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <Timer className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">GC_TIMELINE</span>
          <span className="ml-auto text-[9px] font-mono text-orange-500/50">
            AVG INTERVAL: {GC_AVG_INTERVAL}s // WARN THRESHOLD: {GC_WARNING_THRESHOLD_MS}ms
          </span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          {/* Timeline visualization */}
          <div className="relative h-32 bg-black/30 rounded-sm overflow-hidden mb-3">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between py-1 text-[8px] font-mono text-orange-500/40 text-right pr-1">
              <span>8ms</span>
              <span>4ms</span>
              <span>0ms</span>
            </div>
            {/* Warning threshold line */}
            <div
              className="absolute left-10 right-0 h-[1px] border-t border-dashed border-orange-500/30"
              style={{ top: `${100 - (GC_WARNING_THRESHOLD_MS / 8) * 100}%` }}
            >
              <span className="absolute right-0 -top-3 text-[7px] font-mono text-orange-500/40">WARN {GC_WARNING_THRESHOLD_MS}ms</span>
            </div>
            {/* GC event bars */}
            <div className="absolute left-10 right-0 top-0 bottom-0 flex items-end">
              {GC_EVENTS.map((evt) => {
                const maxTime = Math.max(...GC_EVENTS.map(e => e.time));
                const leftPct = (evt.time / maxTime) * 100;
                const heightPct = (evt.duration / 8) * 100;
                const isWarning = evt.duration >= GC_WARNING_THRESHOLD_MS;
                const barColor = isWarning ? STATUS_ERROR : ACCENT_ORANGE;
                return (
                  <div
                    key={evt.id}
                    className="absolute bottom-0"
                    style={{ left: `${leftPct}%`, width: '6px' }}
                    title={`GC @ ${evt.time}s: ${evt.duration}ms (${evt.heapBefore}MB -> ${evt.heapAfter}MB)`}
                  >
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${Math.min(heightPct, 100)}%`,
                        backgroundColor: `${barColor}80`,
                        boxShadow: isWarning ? `0 0 6px ${STATUS_ERROR}60` : `0 0 4px ${ACCENT_ORANGE}30`,
                        minHeight: '2px',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          {/* Last 10 GC events table */}
          <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">LAST 10 GC EVENTS</div>
          <div className="grid grid-cols-5 gap-2 text-[8px] font-mono text-orange-500/40 uppercase tracking-widest pb-1 border-b border-orange-900/20">
            <span>Time</span><span className="text-center">Duration</span><span className="text-center">Heap Before</span><span className="text-center">Heap After</span><span className="text-right">Status</span>
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
            {GC_EVENTS.map((evt) => {
              const isWarning = evt.duration >= GC_WARNING_THRESHOLD_MS;
              return (
                <div key={evt.id} className="grid grid-cols-5 gap-2 text-[10px] font-mono py-0.5 hover:bg-orange-950/20 transition-colors">
                  <span className="text-orange-400/70">{evt.time.toFixed(1)}s</span>
                  <span className="text-center font-bold" style={{ color: isWarning ? STATUS_ERROR : ACCENT_ORANGE }}>{evt.duration.toFixed(1)}ms</span>
                  <span className="text-center text-orange-400/60">{evt.heapBefore}MB</span>
                  <span className="text-center text-orange-400/60">{evt.heapAfter}MB</span>
                  <span className="text-right">
                    {isWarning ? (
                      <span className="text-[8px] px-1 py-[1px] rounded" style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_10}` }}>WARN</span>
                    ) : (
                      <span className="text-[8px] px-1 py-[1px] rounded" style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}>OK</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.7 — Draw Call Analyzer
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <Layers className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">DRAW_CALL_ANALYZER</span>
          <span className="ml-auto text-[9px] font-mono text-orange-500/50">
            TOTAL: {DRAW_CALL_TOTAL} / {DRAW_CALL_BUDGET} BUDGET
          </span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {/* Bar chart */}
            <div className="space-y-2">
              <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">BY CATEGORY</div>
              {DRAW_CALL_CATEGORIES.map((cat) => {
                const maxCount = Math.max(...DRAW_CALL_CATEGORIES.map(c => c.count));
                return (
                  <div key={cat.category} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-orange-400/80 w-24 text-right uppercase">{cat.category}</span>
                    <div className="flex-1 h-4 bg-black/40 rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm" style={{ width: `${(cat.count / maxCount) * 100}%`, backgroundColor: `${cat.color}50`, borderRight: `2px solid ${cat.color}` }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold w-10 text-right" style={{ color: cat.color }}>{cat.count}</span>
                  </div>
                );
              })}
              {/* Budget bar */}
              <div className="mt-3 pt-2 border-t border-orange-900/20">
                <div className="flex justify-between text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1">
                  <span>BUDGET USAGE</span>
                  <span>{((DRAW_CALL_TOTAL / DRAW_CALL_BUDGET) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-black/40 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(DRAW_CALL_TOTAL / DRAW_CALL_BUDGET) * 100}%`, backgroundColor: `${ACCENT}40`, borderRight: `2px solid ${ACCENT}` }} />
                </div>
              </div>
            </div>
            {/* Expensive materials table */}
            <div>
              <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">TOP EXPENSIVE MATERIALS</div>
              <div className="grid grid-cols-4 gap-2 text-[8px] font-mono text-orange-500/40 uppercase tracking-widest pb-1 border-b border-orange-900/20">
                <span>Material</span><span className="text-center">Draws</span><span>Shader</span><span className="text-right">Cost</span>
              </div>
              <div className="space-y-0.5">
                {EXPENSIVE_MATERIALS.map((mat) => {
                  const costColor = mat.cost === 'High' ? STATUS_ERROR : STATUS_WARNING;
                  return (
                    <div key={mat.name} className="grid grid-cols-4 gap-2 text-[10px] font-mono py-1 hover:bg-orange-950/20 transition-colors">
                      <span className="text-orange-300 truncate">{mat.name}</span>
                      <span className="text-center text-orange-400/70">{mat.drawCalls}</span>
                      <span className="text-orange-500/50 truncate text-[9px]">{mat.shader}</span>
                      <span className="text-right">
                        <span className="text-[8px] px-1 py-[1px] rounded uppercase" style={{ color: costColor, backgroundColor: `${costColor}${OPACITY_10}` }}>{mat.cost}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.8 — Stat Command Dashboard
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <LayoutGrid className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">STAT_COMMAND_DASHBOARD</span>
        </div>
        <div className="space-y-2">
          {STAT_GROUPS.map((sg) => {
            const isCollapsed = collapsedGroups.has(sg.group);
            return (
              <SurfaceCard key={sg.group} level={2} className="border-orange-900/30 bg-orange-950/5 overflow-hidden">
                <button
                  onClick={() => toggleGroup(sg.group)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-950/20 transition-colors"
                >
                  <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
                    <ChevronRight className="w-3 h-3 text-orange-500/60" />
                  </motion.div>
                  <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest font-bold">{sg.group}</span>
                  <span className="ml-auto text-[9px] font-mono text-orange-500/40">{sg.stats.length} stats</span>
                </button>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-2 space-y-1 border-t border-orange-900/20">
                        {sg.stats.map((stat) => (
                          <div key={stat.label} className="flex items-center gap-3 py-1 hover:bg-orange-950/10 transition-colors rounded px-1">
                            <span className="text-[10px] font-mono text-orange-400/70 w-24 uppercase tracking-widest">{stat.label}</span>
                            <Sparkline data={stat.sparkline} color={ACCENT} width={60} height={14} />
                            <span className="text-[11px] font-mono font-bold text-orange-200 ml-auto">
                              {stat.value}<span className="text-orange-500/40 text-[9px] ml-0.5">{stat.unit ?? ''}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SurfaceCard>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.9 — Crash Prediction Engine
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">CRASH_PREDICTION_ENGINE</span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          {/* Overall risk */}
          <div className="flex items-center gap-3 mb-2.5 p-3 rounded bg-black/30 border border-orange-900/30">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: STATUS_SUCCESS }} />
              <span className="text-[10px] font-mono text-orange-500/60 uppercase tracking-widest">OVERALL RISK</span>
            </div>
            <span className="text-lg font-mono font-bold ml-auto px-3 py-0.5 rounded border"
              style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, borderColor: `${STATUS_SUCCESS}${OPACITY_30}` }}>
              {CRASH_RISK_OVERALL}
            </span>
          </div>
          {/* Risk factors */}
          <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-2">RISK FACTORS</div>
          <div className="space-y-1.5 mb-2.5">
            {CRASH_RISK_FACTORS.map((rf) => (
              <div key={rf.factor} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-orange-950/20 transition-colors border border-transparent hover:border-orange-900/20">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_COLORS[rf.risk], boxShadow: `0 0 4px ${RISK_COLORS[rf.risk]}60` }} />
                <span className="text-[10px] font-mono text-orange-300 w-36 uppercase tracking-widest">{rf.factor}</span>
                <span className="text-[9px] font-mono px-1.5 py-[1px] rounded border flex-shrink-0"
                  style={{
                    color: RISK_COLORS[rf.risk],
                    backgroundColor: `${RISK_COLORS[rf.risk]}${OPACITY_10}`,
                    borderColor: `${RISK_COLORS[rf.risk]}${OPACITY_30}`,
                  }}
                >
                  {rf.risk}
                </span>
                <span className="text-[9px] font-mono text-orange-500/50 ml-2 truncate">{rf.detail}</span>
              </div>
            ))}
          </div>
          {/* Recommendations */}
          <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-1.5">RECOMMENDED ACTIONS</div>
          <div className="space-y-1.5">
            {CRASH_RECOMMENDATIONS.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] font-mono text-orange-400/60 leading-relaxed">
                <AlertTriangle className="w-3 h-3 text-orange-500/50 flex-shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         12.10 — Performance Regression Detector
         ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-orange-900/30 pb-2">
          <TrendingDown className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">PERF_REGRESSION_DETECTOR</span>
        </div>
        <SurfaceCard level={2} className="p-3 border-orange-900/30 bg-orange-950/5">
          {/* Regression report */}
          <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-2">REGRESSION REPORT — LATEST BUILD</div>
          <div className="space-y-1 mb-2.5">
            {REGRESSION_METRICS.map((rm) => (
              <div key={rm.metric} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-orange-950/20 transition-colors">
                {rm.status === 'PASS' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
                ) : rm.status === 'AMBER' ? (
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                )}
                <span className="text-[10px] font-mono text-orange-300 w-28 uppercase tracking-widest">{rm.metric}</span>
                <span className="text-[9px] font-mono px-1.5 py-[1px] rounded border flex-shrink-0"
                  style={{
                    color: REGRESSION_STATUS_COLORS[rm.status],
                    backgroundColor: `${REGRESSION_STATUS_COLORS[rm.status]}${OPACITY_10}`,
                    borderColor: `${REGRESSION_STATUS_COLORS[rm.status]}${OPACITY_30}`,
                  }}
                >
                  {rm.status}
                </span>
                <span className="text-[9px] font-mono text-orange-500/50 truncate flex-1">{rm.detail}</span>
                {rm.delta && (
                  <span className="text-[9px] font-mono font-bold flex-shrink-0"
                    style={{ color: rm.status === 'PASS' ? STATUS_SUCCESS : rm.status === 'AMBER' ? STATUS_WARNING : STATUS_ERROR }}
                  >
                    {rm.delta}
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Historical build chart */}
          <div className="text-[9px] font-mono text-orange-500/50 uppercase tracking-widest mb-2">HISTORICAL TREND ACROSS BUILDS</div>
          <div className="relative h-28 bg-black/30 rounded-sm overflow-hidden mb-2">
            {/* Y-axis guide lines */}
            {[25, 50, 75].map((pct) => (
              <div key={pct} className="absolute left-0 right-0 border-t border-orange-900/15" style={{ top: `${100 - pct}%` }} />
            ))}
            {/* FPS line */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={REGRESSION_BUILDS.map((b, i) => {
                  const x = (i / (REGRESSION_BUILDS.length - 1)) * 100;
                  const y = 100 - ((b.fps - 50) / 30) * 100; // normalize 50-80 range
                  return `${x},${y}`;
                }).join(' ')}
                fill="none" stroke={STATUS_SUCCESS} strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={REGRESSION_BUILDS.map((b, i) => {
                  const x = (i / (REGRESSION_BUILDS.length - 1)) * 100;
                  const y = 100 - ((b.memory - 300) / 200) * 100; // normalize 300-500 range
                  return `${x},${y}`;
                }).join(' ')}
                fill="none" stroke={STATUS_WARNING} strokeWidth="1.5" strokeDasharray="4 2"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={REGRESSION_BUILDS.map((b, i) => {
                  const x = (i / (REGRESSION_BUILDS.length - 1)) * 100;
                  const y = 100 - ((b.drawCalls - 600) / 400) * 100; // normalize 600-1000 range
                  return `${x},${y}`;
                }).join(' ')}
                fill="none" stroke={ACCENT_CYAN} strokeWidth="1.5" strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          {/* Build labels */}
          <div className="flex justify-between text-[8px] font-mono text-orange-500/40 mb-2">
            {REGRESSION_BUILDS.map((b) => (
              <span key={b.build}>{b.build}</span>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2.5 text-[9px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded" style={{ backgroundColor: STATUS_SUCCESS }} /> <span className="text-orange-500/50 uppercase tracking-widest">FPS</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded border-t border-dashed" style={{ borderColor: STATUS_WARNING }} /> <span className="text-orange-500/50 uppercase tracking-widest">Memory</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded border-t border-dotted" style={{ borderColor: ACCENT_CYAN }} /> <span className="text-orange-500/50 uppercase tracking-widest">Draw Calls</span>
            </span>
          </div>
          {/* Bisect suggestion */}
          <div className="mt-3 p-2 rounded bg-black/30 border border-orange-900/20 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500/60 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-mono text-orange-400/80 uppercase tracking-widest font-bold">BISECT SUGGESTION</div>
              <div className="text-[9px] font-mono text-orange-500/50 mt-0.5">
                Memory regression detected between v0.9.0 and v0.9.1 (+8.1%). Consider running
                <span className="text-orange-300 mx-1">git bisect</span>
                on commits between these builds to isolate the allocation change.
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
