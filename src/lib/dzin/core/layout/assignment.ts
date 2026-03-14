import type { PanelRegistry } from '../registry/types';
import type {
  LayoutTemplate,
  PanelDirective,
  SlotAssignment,
} from './types';
import { hungarianSolve } from './hungarian';
import { scorePanelForSlot } from './scoring';

// ---------------------------------------------------------------------------
// Panel-to-Slot Assignment
// ---------------------------------------------------------------------------

/**
 * Assign panel directives to template slots using the Hungarian algorithm
 * for optimal assignment.
 *
 * Handles mismatched counts:
 * - More panels than slots: drops lowest-priority panels (those with worst fit)
 * - More slots than panels: leaves extra slots unassigned
 *
 * @param template - Layout template with slot definitions
 * @param directives - Panel directives to place
 * @param registry - Panel registry for looking up PanelDefinitions
 * @returns Array of SlotAssignment objects, one per successfully assigned panel
 */
export function assignPanelsToSlots(
  template: LayoutTemplate,
  directives: PanelDirective[],
  registry: PanelRegistry,
): SlotAssignment[] {
  if (directives.length === 0) return [];

  const slotCount = template.slots.length;
  const panelCount = directives.length;

  // Resolve panel definitions
  const resolved = directives.map((d) => ({
    directive: d,
    def: registry.get(d.type),
  }));

  // Filter out directives with no registry entry
  const valid = resolved.filter((r) => r.def != null) as Array<{
    directive: PanelDirective;
    def: NonNullable<(typeof resolved)[0]['def']>;
  }>;

  if (valid.length === 0) return [];

  // If only one panel and one slot, skip Hungarian
  if (valid.length === 1 && slotCount >= 1) {
    const { directive, def } = valid[0];
    const role = directive.role ?? def.defaultRole;
    const density = directive.density ?? 'full';
    return [{
      slotIndex: 0,
      panelType: directive.type,
      role,
      density,
      style: template.slots[0].style,
      widthPx: 0,
      heightPx: 0,
      dataSlice: directive.dataSlice,
    }];
  }

  // Build cost matrix: panels (rows) x slots (cols)
  const n = Math.max(valid.length, slotCount);
  const DUMMY_COST = 0;
  const costMatrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i < valid.length && j < slotCount) {
        const { directive, def } = valid[i];
        const role = directive.role ?? def.defaultRole;
        row.push(scorePanelForSlot(def, role, template.slots[j]));
      } else {
        row.push(DUMMY_COST);
      }
    }
    costMatrix.push(row);
  }

  const assignment = hungarianSolve(costMatrix);

  // Build result: only include real panel-to-real-slot assignments
  const assignments: SlotAssignment[] = [];

  for (let i = 0; i < valid.length; i++) {
    const slotIdx = assignment[i];
    if (slotIdx >= slotCount) continue; // Assigned to dummy slot, skip

    const { directive, def } = valid[i];
    const role = directive.role ?? def.defaultRole;
    const density = directive.density ?? 'full';

    assignments.push({
      slotIndex: slotIdx,
      panelType: directive.type,
      role,
      density,
      style: template.slots[slotIdx].style,
      widthPx: 0,
      heightPx: 0,
      dataSlice: directive.dataSlice,
    });
  }

  // Sort by slot index for consistent ordering
  assignments.sort((a, b) => a.slotIndex - b.slotIndex);

  return assignments;
}
