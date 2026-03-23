import type { PillItem } from '@/components/ui/InteractivePill';
import {
  HUD_CONTEXTS,
  WIDGET_PLACEMENTS,
} from '../ScreenFlowMap/data';
import type { WidgetPlacement } from '../ScreenFlowMap/data';

export type { HudContext, WidgetPlacement } from '../ScreenFlowMap/data';
export {
  HUD_CONTEXTS,
  WIDGET_PLACEMENTS,
  WIDGET_Z_COLOR,
  Z_DEPTH_LABELS,
  Z_LAYERS,
} from '../ScreenFlowMap/data';

/* ── Constants ─────────────────────────────────────────────────────────────── */

export const VIEWPORT_ASPECT = 16 / 9;

/* ── Helpers ───────────────────────────────────────────────────────────────── */

/** Collect all widget IDs that appear in *any* context (visible or hidden) */
function allContextWidgets(): Set<string> {
  const s = new Set<string>();
  for (const ctx of HUD_CONTEXTS) {
    for (const w of ctx.visible) s.add(w);
    for (const w of ctx.hidden) s.add(w);
  }
  return s;
}

/** Build a quick-lookup: widget ID → Set of context indices where it's visible */
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

export const ALL_WIDGETS = allContextWidgets();
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
