import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

export const ALL_MODULE_IDS = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];

// ─── Color helpers ──────────────────────────────────────────────────────────────
// Quality → cell/accent color mapping lives in `@/lib/chart-colors`
// (`qualityCellColor` / `qualityAccentColor`) so the hex interpolation is shared
// and unit-tested rather than hand-rolled here.

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
