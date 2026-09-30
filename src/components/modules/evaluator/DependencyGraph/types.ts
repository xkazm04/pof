import type { SubModuleId } from '@/types/modules';
import type { ResolvedDependency } from '@/lib/feature-definitions';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SelectedFeatureDetail {
  featureName: string;
  status: string;
  deps: ResolvedDependency[];
  blockers: ResolvedDependency[];
  isBlocked: boolean;
  /** Build frontier (`unblockFrontier`) of a blocked feature — what to build first; [] otherwise. */
  frontier: BuildTarget[];
}

/** A buildable feature offered by the Dependencies tab, with what building it clears. */
export interface BuildTarget {
  key: string;
  moduleId: SubModuleId;
  featureName: string;
  /** Features that become ready once this one is built (`previewUnblock().newlyReady`). */
  newlyReady: string[];
  /** Distinct modules among `newlyReady`. */
  moduleCount: number;
}

export interface ModuleNode {
  moduleId: SubModuleId;
  label: string;
  color: string;
  featureCount: number;
  blockedCount: number;
  implementedCount: number;
  cx: number;
  cy: number;
}

export interface Edge {
  from: string;
  to: string;
  count: number; // number of cross-module deps
  hasBlockers: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export interface DependencyGraphProps {
  onNavigateTab?: (tab: string) => void;
}
