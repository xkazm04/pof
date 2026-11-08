import { FEATURE_STATUSES } from '@/types/feature-matrix';
import { isFeatureDone } from '@/lib/feature-done';

// ---------- Constants ----------

export const MINIMAP_W = 160;
export const MINIMAP_H = 110;

/**
 * The statuses a plan node can carry: done features (implemented / improved)
 * are not plan items, so the legend lists only what the canvas can draw. Node
 * colours come from PLAN_STATUS_COLORS — the same table layout-engine paints with.
 */
export const PLAN_NODE_STATUSES = FEATURE_STATUSES.filter((s) => !isFeatureDone(s));
