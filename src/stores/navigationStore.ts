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

  setActiveCategory: (category: CategoryId | null) => void;
  setActiveSubModule: (subModule: SubModuleId | null) => void;
  setSidebarMode: (mode: SidebarMode) => void;

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

      setActiveCategory: (category) => set({ activeCategory: category, activeSubModule: null }),
      setActiveSubModule: (subModule) => set({ activeSubModule: subModule }),
      setSidebarMode: (mode) => set({ sidebarMode: mode }),

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
