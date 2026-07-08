import { AlertTriangle, ShieldAlert, Activity } from 'lucide-react';
import type {
  EconomyMetrics,
  InflationAlert,
  SupplyDemandPoint,
  ItemCategory,
} from '@/types/economy-simulator';
import type { SweepOutput } from '@/lib/economy/sensitivity-sweep';
import { MODULE_COLORS, ACCENT_CYAN, ACCENT_EMERALD_DARK, ACCENT_PURPLE_BOLD } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

export const EMPTY_METRICS: EconomyMetrics[] = [];
export const EMPTY_ALERTS: InflationAlert[] = [];
export const EMPTY_SUPPLY: SupplyDemandPoint[] = [];

export const SEVERITY_STYLE = {
  info: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400', icon: Activity },
  warning: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400', icon: AlertTriangle },
  critical: { bg: 'bg-red-400/10', border: 'border-red-400/20', text: 'text-red-400', icon: ShieldAlert },
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  inflation: 'Inflation',
  deflation: 'Deflation',
  'price-imbalance': 'Price Imbalance',
  'wealth-inequality': 'Wealth Gap',
  'dead-zone': 'Dead Zone',
};

export const CATEGORY_COLORS: Record<ItemCategory, string> = {
  weapon: MODULE_COLORS.evaluator,
  armor: MODULE_COLORS.core,
  consumable: ACCENT_EMERALD_DARK,
  material: MODULE_COLORS.content,
  gem: ACCENT_PURPLE_BOLD,
  recipe: ACCENT_CYAN,
};

export const PHILOSOPHY_LABELS = {
  'loot-driven': 'Loot-Driven (Diablo-like)',
  'scarcity-based': 'Scarcity-Based (Souls-like)',
  balanced: 'Balanced',
} as const;

// Below this viewport width the side-by-side Gini/histogram pair squashes, so it
// stacks into a single column. Mirrors the `useViewportWidth` pattern used by the
// `/layout` Baseline shell — measured width drives the breakpoint, not a CSS media
// query, since 900px is between Tailwind's `sm` (640) and `lg` (1024) stops.
export const WEALTH_STACK_BREAKPOINT = 900;

export const SWEEP_OUTPUT_LABELS: Record<SweepOutput, string> = {
  gini: 'Endgame Gini',
  netFlow: 'Net Flow /hr',
  criticalAlerts: 'Critical Alerts',
};
