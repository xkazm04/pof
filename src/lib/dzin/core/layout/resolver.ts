import type { PanelRegistry } from '../registry/types';
import type {
  LayoutTemplateId,
  PanelDirective,
  ResolvedLayout,
} from './types';
import { LAYOUT_TEMPLATES, getTemplate } from './templates';
import { scoreTemplateForDirectives } from './scoring';
import { assignPanelsToSlots } from './assignment';
import { estimateSlotDimensions } from './spatial';
import { assignSlotDensity } from './density';
import { getAllowedLayouts, clampLayoutToViewport } from './viewport';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for resolveLayout. */
export interface ResolveLayoutOptions {
  /** If provided and allowed by viewport, use this template instead of scoring. */
  preferredTemplate?: LayoutTemplateId;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Orchestrate the full layout resolution pipeline:
 *
 * 1. Filter templates by viewport breakpoints
 * 2. Score remaining templates against directives (or use preferredTemplate)
 * 3. Assign panels to slots via Hungarian algorithm
 * 4. Compute pixel dimensions per slot
 * 5. Assign density per slot (auto or LLM-explicit)
 * 6. Return complete ResolvedLayout
 *
 * @param directives - Panel directives to place
 * @param registry - Panel registry for looking up PanelDefinitions
 * @param viewport - Current viewport dimensions { width, height }
 * @param options - Optional: preferredTemplate
 * @returns Fully resolved layout with template, grid strings, and assignments
 */
export function resolveLayout(
  directives: PanelDirective[],
  registry: PanelRegistry,
  viewport: { width: number; height: number },
  options?: ResolveLayoutOptions,
): ResolvedLayout {
  // Handle empty directives
  if (directives.length === 0) {
    const single = getTemplate('single')!;
    return {
      template: 'single',
      gridTemplateRows: single.gridTemplateRows,
      gridTemplateColumns: single.gridTemplateColumns,
      assignments: [],
    };
  }

  // Step 1: Get allowed templates for this viewport
  const allowedIds = getAllowedLayouts(viewport.width);

  // Step 2: Choose template
  let chosenId: LayoutTemplateId;

  if (options?.preferredTemplate) {
    // Use preferred if allowed, otherwise clamp to best available
    chosenId = clampLayoutToViewport(options.preferredTemplate, viewport.width);
  } else {
    // Score all allowed templates (exclude stack from scoring -- mobile fallback only)
    const scorableIds = allowedIds.filter((id) => id !== 'stack');
    const scorableTemplates = scorableIds
      .map((id) => getTemplate(id))
      .filter((t) => t != null);

    if (scorableTemplates.length === 0) {
      chosenId = 'single';
    } else {
      let bestScore = -Infinity;
      let bestId: LayoutTemplateId = 'single';

      for (const template of scorableTemplates) {
        const score = scoreTemplateForDirectives(template, directives, registry);
        if (score > bestScore) {
          bestScore = score;
          bestId = template.id;
        }
      }
      chosenId = bestId;
    }
  }

  const template = getTemplate(chosenId)!;

  // Step 3: Assign panels to slots
  const assignments = assignPanelsToSlots(template, directives, registry);

  // Step 4: Compute slot pixel dimensions
  const slotDims = estimateSlotDimensions(template, viewport.width, viewport.height);

  // Step 5: Enrich assignments with pixel dimensions and density
  for (const assignment of assignments) {
    const dims = slotDims[assignment.slotIndex];
    if (dims) {
      assignment.widthPx = dims.width;
      assignment.heightPx = dims.height;
    }

    // Find directive for this assignment to check for explicit density
    const directive = directives.find((d) => d.type === assignment.panelType);
    const panelDef = registry.get(assignment.panelType);

    if (panelDef) {
      assignment.density = assignSlotDensity(
        panelDef,
        assignment.widthPx,
        assignment.heightPx,
        directive?.density,
      );
    }
  }

  // Step 6: Return resolved layout
  return {
    template: chosenId,
    gridTemplateRows: template.gridTemplateRows,
    gridTemplateColumns: template.gridTemplateColumns,
    assignments,
  };
}
