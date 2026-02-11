'use client';

import { useNavigationStore } from '@/stores/navigationStore';

/**
 * Returns the moduleId that is currently "active" in the main content area.
 * For special categories (project-setup, evaluator) this is the category id.
 * For normal sub-modules, this is the sub-module id.
 */
export function useActiveModuleId(): string | null {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);

  // Special categories that render without sub-modules
  if (activeCategory === 'project-setup' || activeCategory === 'evaluator') {
    return activeCategory;
  }

  return activeSubModule ?? null;
}
