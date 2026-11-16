import { Box, ListChecks, Layers, AlertTriangle, Package, Zap } from 'lucide-react';
import { MODULE_COLORS, STATUS_INFO, STATUS_MUTED, ACCENT_VIOLET } from '@/lib/chart-colors';

/** Fired by the topbar Search button: opens global search regardless of who owns mod+k. */
export const OPEN_GLOBAL_SEARCH_EVENT = 'pof:open-global-search';

// ── Type icons ───────────────────────────────────────────────────────────────

export const TYPE_META: Record<string, { icon: typeof Box; label: string; color: string }> = {
  checklist: { icon: ListChecks, label: 'Checklist', color: MODULE_COLORS.setup },
  action:    { icon: Zap, label: 'Action', color: MODULE_COLORS.core },
  feature:   { icon: Box, label: 'Feature', color: STATUS_INFO },
  module:    { icon: Layers, label: 'Module', color: ACCENT_VIOLET },
  category:  { icon: Layers, label: 'Category', color: MODULE_COLORS.content },
  finding:   { icon: AlertTriangle, label: 'Finding', color: MODULE_COLORS.evaluator },
  build:     { icon: Package, label: 'Build', color: STATUS_MUTED },
};
