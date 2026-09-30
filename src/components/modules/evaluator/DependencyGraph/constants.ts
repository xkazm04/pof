import { MODULE_COLORS as CHART_MODULE_COLORS } from '@/lib/chart-colors';
import { TOPOLOGY_COMPACT } from '@/lib/topology/moduleGraph';

// ─── Module layout config ───────────────────────────────────────────────────

export const MODULE_COLORS: Record<string, string> = {
  'arpg-character': CHART_MODULE_COLORS.core,
  'arpg-animation': CHART_MODULE_COLORS.core,
  'arpg-gas': CHART_MODULE_COLORS.core,
  'arpg-combat': CHART_MODULE_COLORS.core,
  'arpg-enemy-ai': CHART_MODULE_COLORS.core,
  'arpg-inventory': CHART_MODULE_COLORS.core,
  'arpg-loot': CHART_MODULE_COLORS.core,
  'arpg-ui': CHART_MODULE_COLORS.core,
  'arpg-progression': CHART_MODULE_COLORS.core,
  'arpg-world': CHART_MODULE_COLORS.core,
  'arpg-save': CHART_MODULE_COLORS.core,
  'arpg-polish': CHART_MODULE_COLORS.core,
};

// Node size of the compact module topology (placement lives in @/lib/topology/moduleGraph).
export const { nodeW: NODE_W, nodeH: NODE_H } = TOPOLOGY_COMPACT;
