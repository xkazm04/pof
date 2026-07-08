import type { SubModuleId } from '@/types/modules';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NexusNode {
  moduleId: SubModuleId;
  label: string;
  cx: number;
  cy: number;
  featureCount: number;
  implementedCount: number;
  blockedCount: number;
  // Layer 1: pattern success
  patternSuccessRate: number | null; // 0-1 or null if no patterns
  patternCount: number;
  // Layer 2: build health
  hasBuildFailure: boolean;
  // Layer 3: session activity
  sessionCount: number;
  avgDurationMs: number;
  lastTaskSuccess: boolean | null;
  // Layer 4: genre coverage
  genreItemCount: number; // how many genre priority items belong to this module
  // Checklist
  checklistTotal: number;
  checklistDone: number;
  // Health
  healthScore: number;
  healthStatus: string;
}

export interface NexusEdge {
  from: string;
  to: string;
  count: number;
  hasBlockers: boolean;
}
