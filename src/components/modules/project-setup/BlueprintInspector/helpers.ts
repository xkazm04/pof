import type { BlueprintEntry } from '@/types/pof-bridge';

// ── Helpers ────────────────────────────────────────────────────────────────

export function sectionCount(bp: BlueprintEntry, id: string): number | null {
  switch (id) {
    case 'overriddenFunctions': return bp.overriddenFunctions.length;
    case 'addedComponents': return bp.addedComponents.length;
    case 'variables': return bp.variables.length;
    case 'eventGraphEntryPoints': return bp.eventGraphEntryPoints.length;
    case 'interfaces': return bp.interfaces.length;
    default: return null;
  }
}

export function isSectionEmpty(bp: BlueprintEntry, id: string): boolean {
  const count = sectionCount(bp, id);
  return count !== null && count === 0;
}
