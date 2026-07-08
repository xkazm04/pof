import { Box, ListChecks, Layers, AlertTriangle, Package } from 'lucide-react';
import { MODULE_COLORS, STATUS_INFO, ACCENT_VIOLET } from '@/lib/chart-colors';

// ── Type icons ───────────────────────────────────────────────────────────────

export const TYPE_META: Record<string, { icon: typeof Box; label: string; color: string }> = {
  checklist: { icon: ListChecks, label: 'Checklist', color: MODULE_COLORS.setup },
  feature:   { icon: Box, label: 'Feature', color: STATUS_INFO },
  module:    { icon: Layers, label: 'Module', color: ACCENT_VIOLET },
  category:  { icon: Layers, label: 'Category', color: MODULE_COLORS.content },
  finding:   { icon: AlertTriangle, label: 'Finding', color: MODULE_COLORS.evaluator },
  build:     { icon: Package, label: 'Build', color: '#94a3b8' },
};
