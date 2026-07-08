import type { SubModuleId } from '@/types/modules';
import type { ResolvedDependency } from '@/lib/feature-definitions';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SelectedFeatureDetail {
  featureName: string;
  status: string;
  deps: ResolvedDependency[];
  blockers: ResolvedDependency[];
  isBlocked: boolean;
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
