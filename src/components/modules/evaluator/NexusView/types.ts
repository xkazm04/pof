import type { SubModuleId } from '@/types/modules';
import type { NexusSignal } from '@/lib/evaluator/nexus-signals';

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * One module on the map: topology placement + counts, checklist progress, genre
 * coverage, and the durable overlay signals from `projectNexusSignals`
 * (`null` = not measurable / source not ready — never drawn as 0).
 */
export interface NexusNode extends NexusSignal {
  moduleId: SubModuleId;
  label: string;
  cx: number;
  cy: number;
  featureCount: number;
  implementedCount: number;
  blockedCount: number;
  // Layer 4: genre coverage
  genreItemCount: number; // how many genre priority items belong to this module
  // Checklist
  checklistTotal: number;
  checklistDone: number;
}

export interface NexusEdge {
  from: string;
  to: string;
  count: number;
  hasBlockers: boolean;
}
