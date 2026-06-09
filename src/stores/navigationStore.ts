'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CategoryId, SubModuleId } from '@/types/modules';
import type { SidebarMode } from '@/types/navigation';
import { getCategoryForSubModule } from '@/lib/module-registry';

// Category IDs that render as special-case modules (no sub-modules)
const SPECIAL_CATEGORY_IDS: Set<string> = new Set(['project-setup', 'evaluator', 'game-director']);

interface NavigationState {
  activeCategory: CategoryId | null;
  activeSubModule: SubModuleId | null;
  sidebarMode: SidebarMode;
  /**
   * When true, the L1 icon rail is widened to show category labels inline
   * (instead of icon-only with hover/focus flyouts). Persisted as a user pref.
   */
  l1Expanded: boolean;

  setActiveCategory: (category: CategoryId | null) => void;
  setActiveSubModule: (subModule: SubModuleId | null) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setL1Expanded: (expanded: boolean) => void;
  toggleL1Expanded: () => void;

  /**
   * Navigate to a specific module by its moduleId.
   * Resolves whether it's a special category or a sub-module
   * and sets the correct activeCategory + activeSubModule.
   * Called from bottom bar, CLI panel, etc.
   */
  navigateToModule: (moduleId: string) => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      activeCategory: null,
      activeSubModule: null,
      sidebarMode: 'full',
      l1Expanded: false,

      setActiveCategory: (category) => set({ activeCategory: category, activeSubModule: null }),
      setActiveSubModule: (subModule) => set({ activeSubModule: subModule }),
      setSidebarMode: (mode) => set({ sidebarMode: mode }),
      setL1Expanded: (expanded) => set({ l1Expanded: expanded }),
      toggleL1Expanded: () => set((s) => ({ l1Expanded: !s.l1Expanded })),

      navigateToModule: (moduleId) => {
        // Special categories like 'project-setup', 'evaluator'
        if (SPECIAL_CATEGORY_IDS.has(moduleId)) {
          set({
            activeCategory: moduleId as CategoryId,
            activeSubModule: null,
          });
          return;
        }

        // Regular sub-module — resolve its parent category
        const subModuleId = moduleId as SubModuleId;
        const category = getCategoryForSubModule(subModuleId);
        if (category) {
          set({
            activeCategory: category.id as CategoryId,
            activeSubModule: subModuleId,
          });
        }
      },
    }),
    {
      name: 'pof-navigation',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
