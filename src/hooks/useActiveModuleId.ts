'use client';

import { useNavigationStore } from '@/stores/navigationStore';
import { MODULE_COMPONENTS, SPECIAL_CATEGORIES } from '@/components/layout/ModuleRenderer/registry';
import { resolveVisibleModule } from '@/components/layout/ModuleRenderer/helpers';
import type { SubModuleId } from '@/types/modules';

/**
 * The moduleId a CLI session is attributed to — i.e. the module the user is
 * actually LOOKING AT in the main content area.
 *
 * ATTRIBUTION FOLLOWS VISIBILITY. This is deliberately the same derivation
 * `ModuleRenderer` uses to decide which pane to show: the registry-driven
 * special-category predicate, the "does this sub-module even have a view"
 * filter, and then `resolveVisibleModule` — the single statement of the rule
 * (a set sub-module wins over its owning special category).
 *
 * It used to implement the OPPOSITE rule off a hardcoded list
 * (`activeCategory === 'project-setup' || activeCategory === 'evaluator'`
 * wins, else the sub-module). That was wrong twice over:
 * - In the dual-set state (`navigateToModule('game-design-doc')` sets category
 *   `evaluator` AND sub-module `game-design-doc`) the user sees the sub-module
 *   pane, but the terminal was attributed to the category — so a terminal
 *   maximized for the visible module was hidden, and one belonging to a module
 *   the user is not looking at could be shown.
 * - The list was a second, independent bug source: it omitted `game-director`,
 *   which IS a special category in `SPECIAL_CATEGORIES`, so viewing Game
 *   Director attributed to `null`. Any special category added to the registry
 *   would have fallen through the same hole. Reading the registry closes the
 *   CLASS of bug — there is no list left to forget to update.
 *
 * Attribution only: nothing here touches session storage or terminal behaviour.
 */
export function useActiveModuleId(): string | null {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);

  // Registry-driven, exactly as ModuleRenderer resolves them.
  const isSpecialCategory = Boolean(activeCategory && SPECIAL_CATEGORIES[activeCategory]);
  // A stale sub-module id (navigation state is persisted, so an id from an older
  // build can rehydrate) has no pane, so it cannot be what the user sees — and
  // must not be what a terminal is attributed to either.
  const renderableSubModule =
    activeSubModule && MODULE_COMPONENTS[activeSubModule as SubModuleId] ? activeSubModule : null;

  return resolveVisibleModule(activeCategory, renderableSubModule, isSpecialCategory);
}
