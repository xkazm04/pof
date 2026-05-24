'use client';

import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  STATUS_SUBDUED,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { HeatmapCell } from '@/types/unique-tab-improvements';

export const ACCENT = ACCENT_ORANGE;

/* -- Budget Gauges --------------------------------------------------------- */

export const INITIAL_BUDGETS = [
  { label: 'TICK_BUDGET', current: 11.2, target: 16.0, unit: 'ms' },
  { label: 'DRAW_CALLS', current: 1640, target: 2000, unit: '' },
  { label: 'VRAM_ALLOC', current: 380, target: 512, unit: 'MB' },
  { label: 'ACTIVE_ACTORS', current: 720, target: 1000, unit: '' },
];

/* -- Debug Commands (legacy compact list) ---------------------------------- */

export const DEBUG_COMMANDS = [
  { syntax: 'godmode', description: 'Toggle invuln & infinite resources' },
  { syntax: 'give <id> <count>', description: 'Add item to inventory by ID' },
  { syntax: 'setlevel <n>', description: 'Set player level directly' },
  { syntax: 'spawn <type>', description: 'Spawn enemy at cursor location' },
  { syntax: 'killall', description: 'Purge all active enemies in cell' },
];

/* -- Optimizations --------------------------------------------------------- */

export type EffortLevel = 'Small' | 'Medium' | 'Large';
export type ImpactLevel = 'High' | 'Medium' | 'Low';

export const OPTIMIZATIONS: { title: string; featureName: string; effort: EffortLevel; impact: ImpactLevel; description: string }[] = [
  { title: 'Object Pooling Init', featureName: 'Object pooling', effort: 'Medium', impact: 'High', description: 'Pre-allocate projectiles, VFX actors, and floating text.' },
  { title: 'Tick Optimization', featureName: 'Tick optimization', effort: 'Small', impact: 'High', description: 'Throttle tick on idle actors; move to timer delegates.' },
  { title: 'Async Asset Streaming', featureName: 'Async asset loading', effort: 'Large', impact: 'Medium', description: 'Stream level chunks to avoid main thread hitches.' },
];

export const EFFORT_COLORS: Record<EffortLevel, string> = { Small: ACCENT_EMERALD, Medium: STATUS_WARNING, Large: STATUS_ERROR };
export const IMPACT_COLORS: Record<ImpactLevel, string> = { High: STATUS_SUCCESS, Medium: STATUS_WARNING, Low: STATUS_SUBDUED };

export const FEATURE_NAMES = [
  'Structured logging', 'Debug draw helpers', 'Debug console commands',
  'Object pooling', 'Tick optimization', 'Async asset loading',
];

/* -- 12.1 System Health Matrix --------------------------------------------- */

export const HEALTH_MATRIX_ROWS = ['GAS', 'AI', 'Physics', 'Rendering', 'Network', 'Audio'];
export const HEALTH_MATRIX_COLS = ['Load', 'Latency', 'Errors', 'Memory'];
export const HEALTH_MATRIX_CELLS: HeatmapCell[] = [
  { row: 0, col: 0, value: 0.35, tooltip: 'GAS Load: 35% — nominal' },
  { row: 0, col: 1, value: 0.22, tooltip: 'GAS Latency: 2.2ms — nominal' },
  { row: 0, col: 2, value: 0.05, tooltip: 'GAS Errors: 0.5% — clean' },
  { row: 0, col: 3, value: 0.40, tooltip: 'GAS Memory: 40% — nominal' },
  { row: 1, col: 0, value: 0.72, tooltip: 'AI Load: 72% — elevated' },
  { row: 1, col: 1, value: 0.55, tooltip: 'AI Latency: 5.5ms — warning' },
  { row: 1, col: 2, value: 0.12, tooltip: 'AI Errors: 1.2% — low' },
  { row: 1, col: 3, value: 0.60, tooltip: 'AI Memory: 60% — elevated' },
  { row: 2, col: 0, value: 0.45, tooltip: 'Physics Load: 45% — nominal' },
  { row: 2, col: 1, value: 0.30, tooltip: 'Physics Latency: 3.0ms — nominal' },
  { row: 2, col: 2, value: 0.08, tooltip: 'Physics Errors: 0.8% — clean' },
  { row: 2, col: 3, value: 0.50, tooltip: 'Physics Memory: 50% — nominal' },
  { row: 3, col: 0, value: 0.88, tooltip: 'Rendering Load: 88% — critical' },
  { row: 3, col: 1, value: 0.75, tooltip: 'Rendering Latency: 7.5ms — high' },
  { row: 3, col: 2, value: 0.15, tooltip: 'Rendering Errors: 1.5% — low' },
  { row: 3, col: 3, value: 0.82, tooltip: 'Rendering Memory: 82% — high' },
  { row: 4, col: 0, value: 0.28, tooltip: 'Network Load: 28% — low' },
  { row: 4, col: 1, value: 0.65, tooltip: 'Network Latency: 6.5ms — elevated' },
  { row: 4, col: 2, value: 0.20, tooltip: 'Network Errors: 2.0% — moderate' },
  { row: 4, col: 3, value: 0.18, tooltip: 'Network Memory: 18% — low' },
  { row: 5, col: 0, value: 0.15, tooltip: 'Audio Load: 15% — idle' },
  { row: 5, col: 1, value: 0.10, tooltip: 'Audio Latency: 1.0ms — nominal' },
  { row: 5, col: 2, value: 0.02, tooltip: 'Audio Errors: 0.2% — clean' },
  { row: 5, col: 3, value: 0.25, tooltip: 'Audio Memory: 25% — low' },
];

/* -- 12.2 Frame Time Waterfall --------------------------------------------- */

export const FRAME_TIME_BARS = [
  { label: 'GameThread', ms: 4.2, color: ACCENT_ORANGE },
  { label: 'RenderThread', ms: 6.1, color: STATUS_ERROR },
  { label: 'GPUTime', ms: 8.3, color: ACCENT_VIOLET },
  { label: 'Physics', ms: 1.5, color: ACCENT_CYAN },
  { label: 'Animation', ms: 2.1, color: ACCENT_EMERALD },
  { label: 'UI', ms: 0.8, color: STATUS_WARNING },
];
export const FRAME_TARGET_MS = 16.67;
export const FRAME_TOTAL_MS = FRAME_TIME_BARS.reduce((s, b) => s + b.ms, 0);

/* -- 12.3 Memory Allocation Tracker ---------------------------------------- */

export const MEMORY_SLICES = [
  { label: 'Textures', pct: 45, mb: 171, color: ACCENT_ORANGE },
  { label: 'Meshes', pct: 25, mb: 95, color: ACCENT_VIOLET },
  { label: 'Audio', pct: 10, mb: 38, color: ACCENT_CYAN },
  { label: 'Scripts', pct: 8, mb: 30.4, color: ACCENT_EMERALD },
  { label: 'Physics', pct: 7, mb: 26.6, color: STATUS_WARNING },
  { label: 'UI', pct: 5, mb: 19, color: STATUS_INFO },
];
export const MEMORY_TOTAL_MB = 380;
export const MEMORY_PEAK_MB = 412;
export const MEMORY_BUDGET_MB = 512;

/* -- 12.4 Console Command Builder ------------------------------------------ */

export type CommandCategory = 'Debug' | 'Cheats' | 'World' | 'Stats';

export const CONSOLE_COMMANDS: { syntax: string; description: string; category: CommandCategory; params?: string }[] = [
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

export const COMMAND_CATEGORIES: CommandCategory[] = ['Debug', 'Cheats', 'World', 'Stats'];
export const CATEGORY_COLORS: Record<CommandCategory, string> = {
  Debug: ACCENT_ORANGE,
  Cheats: STATUS_ERROR,
  World: ACCENT_EMERALD,
  Stats: ACCENT_CYAN,
};

export interface ConsoleHistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  output?: string;
}

/* -- 12.5 Network Replication Monitor -------------------------------------- */

export const NET_BANDWIDTH = { current: 2.4, max: 10, unit: 'Mbps' };
export const NET_REPLICATED_ACTORS = [
  { actor: 'PlayerCharacter', count: 1, bytesPerSec: 4200, priority: 'Critical' as const },
  { actor: 'EnemyAI', count: 5, bytesPerSec: 2800, priority: 'High' as const },
  { actor: 'Projectile', count: 3, bytesPerSec: 1200, priority: 'Medium' as const },
  { actor: 'LootDrop', count: 8, bytesPerSec: 400, priority: 'Low' as const },
  { actor: 'WorldItem', count: 12, bytesPerSec: 150, priority: 'Low' as const },
];
export const NET_RPC_FREQ = [
  { name: 'ServerMovement', freq: 60, color: ACCENT_ORANGE },
  { name: 'DamageEvent', freq: 24, color: STATUS_ERROR },
  { name: 'AbilityActivation', freq: 12, color: ACCENT_VIOLET },
  { name: 'InventorySync', freq: 4, color: ACCENT_CYAN },
];
export const NET_SUGGESTIONS = [
  'Consider relevancy culling for WorldItem actors beyond 50m',
  'Batch projectile replication into single multicast RPC',
  'Reduce EnemyAI net update frequency from 30Hz to 15Hz when >100m',
];
export const PRIORITY_COLORS: Record<string, string> = {
  Critical: STATUS_ERROR,
  High: STATUS_WARNING,
  Medium: ACCENT_CYAN,
  Low: STATUS_SUBDUED,
};
