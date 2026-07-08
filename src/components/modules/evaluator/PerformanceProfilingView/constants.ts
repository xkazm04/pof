import type { PerformanceFinding, OptimizationPriority } from '@/types/performance-profiling';

// ── Constants ───────────────────────────────────────────────────────────────

export const EMPTY_FINDINGS: PerformanceFinding[] = [];

export const PRIORITY_STYLE: Record<OptimizationPriority, { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-red-400/10', border: 'border-red-400/20', text: 'text-red-400' },
  high: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400' },
  medium: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400' },
  low: { bg: 'bg-text-muted/10', border: 'border-text-muted/20', text: 'text-text-muted' },
};

export const BOTTLENECK_LABELS: Record<string, string> = {
  'game-thread': 'Game Thread Bound',
  'render-thread': 'Render Thread Bound',
  gpu: 'GPU Bound',
  balanced: 'Balanced',
};

export const SCENARIO_OPTIONS = [
  { value: 'combat-heavy', label: 'Combat Heavy (50 enemies)' },
  { value: 'exploration', label: 'Exploration (open world)' },
  { value: 'menu', label: 'Menu / Inventory' },
  { value: 'loading', label: 'Level Loading' },
] as const;
