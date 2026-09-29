import type { PillItem } from '@/components/ui/InteractivePill';
import { HUD_CONTEXTS } from '../_shared/data';
import type { WidgetPlacement } from '../_shared/data';

export type { HudContext, WidgetPlacement } from '../_shared/data';
export {
  HUD_CONTEXTS,
  WIDGET_PLACEMENTS,
  WIDGET_Z_COLOR,
  Z_DEPTH_LABELS,
  Z_LAYERS,
} from '../_shared/data';

/* ── Constants ─────────────────────────────────────────────────────────────── */

export const VIEWPORT_ASPECT = 16 / 9;

/* ── Helpers ───────────────────────────────────────────────────────────────── */

/** Widget id → context indices where it is visible (HUD_CONTEXTS carries registry ids, so keys match placement ids) */
function buildVisibilityMap(): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>();
  HUD_CONTEXTS.forEach((ctx, ci) => {
    for (const w of ctx.visible) {
      if (!m.has(w)) m.set(w, new Set());
      m.get(w)!.add(ci);
    }
  });
  return m;
}

export const VISIBILITY_MAP = buildVisibilityMap();

export const CONTEXT_PILLS: PillItem[] = HUD_CONTEXTS.map(c => ({
  id: c.name,
  label: c.name,
  color: c.color,
}));

/** Check if a widget changes visibility between two contexts */
export function widgetChangedBetween(widgetId: string, fromIdx: number, toIdx: number): boolean {
  const wasVisible = VISIBILITY_MAP.get(widgetId)?.has(fromIdx) ?? false;
  const isVisible = VISIBILITY_MAP.get(widgetId)?.has(toIdx) ?? false;
  return wasVisible !== isVisible;
}

/* ── WidgetRect types ──────────────────────────────────────────────────────── */

export interface WidgetRectProps {
  placement: WidgetPlacement;
  visible: boolean;
  changed: boolean;
  showZLayer: boolean;
  contextColor: string;
}
