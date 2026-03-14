import type { PanelSizeClass } from '../types/panel';
import type { PanelDefinition, PanelRegistry } from '../registry/types';
import type { LayoutTemplate, PanelDirective, SlotSpec } from './types';

// ---------------------------------------------------------------------------
// Role mismatch penalties
// ---------------------------------------------------------------------------

const ROLE_MATCH_BONUS = 6;
const SIZE_MATCH_BONUS = 15;
const SIZE_MISMATCH_PENALTY = 25;
const NARROW_COMPACT_BONUS = 4;
const HIGH_COMPLEXITY_NARROW_PENALTY = 12;
const LOW_COMPLEXITY_NARROW_BONUS = 4;
const HIGH_COMPLEXITY_WIDE_BONUS = 3;

// ---------------------------------------------------------------------------
// Panel-for-Slot Scoring
// ---------------------------------------------------------------------------

/**
 * Compute a cost score for placing a panel in a specific slot.
 * Lower cost = better fit. Used to build the cost matrix for Hungarian.
 *
 * Factors:
 * - Role match (panel role vs slot preferredRole)
 * - Size compatibility (panel sizeClass in slot acceptsSizes)
 * - Narrow slot penalty for high-complexity panels
 * - Bonuses for compact panels in narrow slots, high-complexity in wide slots
 *
 * @param panel - Panel definition from registry
 * @param panelRole - Effective role (from directive override or panel default)
 * @param slot - The target slot specification
 * @returns Numeric cost (lower = better fit, can be negative for great fits)
 */
export function scorePanelForSlot(
  panel: PanelDefinition,
  panelRole: string,
  slot: SlotSpec,
): number {
  let cost = 0;

  // Size compatibility (highest weight)
  if (slot.acceptsSizes.includes(panel.sizeClass)) {
    cost -= SIZE_MATCH_BONUS; // Good: reduce cost
  } else {
    cost += SIZE_MISMATCH_PENALTY; // Bad: increase cost
  }

  // Role match
  if (panelRole === slot.preferredRole) {
    cost -= ROLE_MATCH_BONUS;
  }

  // Compact panel in narrow slot bonus
  if (panel.sizeClass === 'compact' && slot.isNarrow) {
    cost -= NARROW_COMPACT_BONUS;
  }

  // Complexity-slot compatibility
  const complexity = panel.complexity ?? 'medium';
  if (complexity === 'high' && slot.isNarrow) {
    cost += HIGH_COMPLEXITY_NARROW_PENALTY;
  }
  if (complexity === 'low' && slot.isNarrow) {
    cost -= LOW_COMPLEXITY_NARROW_BONUS;
  }
  if (complexity === 'high' && !slot.isNarrow && slot.acceptsSizes.includes('wide' as PanelSizeClass)) {
    cost -= HIGH_COMPLEXITY_WIDE_BONUS;
  }

  return cost;
}

// ---------------------------------------------------------------------------
// Template Scoring
// ---------------------------------------------------------------------------

/** Penalty per mismatch between slot count and panel count. */
const COUNT_MISMATCH_PENALTY = 10;
/** Bonus when slot count exactly matches panel count. */
const EXACT_COUNT_BONUS = 20;

/**
 * Score how well a layout template fits a set of panel directives.
 * Higher score = better fit.
 *
 * Factors:
 * - Slot count vs directive count match (exact match bonus, penalty per mismatch)
 * - Sum of best-case panel-for-slot scores (using registry for panel metadata)
 *
 * @param template - Layout template to evaluate
 * @param directives - Panel directives to place
 * @param registry - Panel registry for looking up PanelDefinitions
 * @returns Numeric score (higher = better fit)
 */
export function scoreTemplateForDirectives(
  template: LayoutTemplate,
  directives: PanelDirective[],
  registry: PanelRegistry,
): number {
  const slotCount = template.slots.length;
  const panelCount = directives.length;

  let score = 0;

  // Count fitness
  if (slotCount === panelCount) {
    score += EXACT_COUNT_BONUS;
  } else {
    const diff = Math.abs(slotCount - panelCount);
    score -= diff * COUNT_MISMATCH_PENALTY;
  }

  // Sum of best-case panel-for-slot scores
  // For each directive, find its best slot match and accumulate
  for (const directive of directives) {
    const def = registry.get(directive.type);
    if (!def) continue;

    const role = directive.role ?? def.defaultRole;

    // Find the best (lowest cost) slot for this panel
    let bestCost = Infinity;
    for (const slot of template.slots) {
      const cost = scorePanelForSlot(def, role, slot);
      if (cost < bestCost) bestCost = cost;
    }

    // Convert cost to positive score contribution (negate cost)
    if (bestCost < Infinity) {
      score -= bestCost; // Subtracting a negative cost adds to score
    }
  }

  return score;
}
