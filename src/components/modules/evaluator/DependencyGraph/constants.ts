import { MODULE_COLORS as CHART_MODULE_COLORS } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { TOPOLOGY_COMPACT, getNodeCenter as getCenter } from '@/components/modules/evaluator/_shared/moduleTopology';

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

// Layout (positions + node sizes) shared with NexusView via _shared/moduleTopology.
export const { colWidth: COL_WIDTH, rowHeight: ROW_HEIGHT, nodeW: NODE_W, nodeH: NODE_H, padX: PAD_X, padY: PAD_Y } = TOPOLOGY_COMPACT;

export function getNodeCenter(moduleId: SubModuleId) {
  return getCenter(moduleId, TOPOLOGY_COMPACT);
}
