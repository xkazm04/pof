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
   * The location INSIDE each module: the tab its view last showed, keyed by
   * moduleId. Part of the navigation model (persisted with it) so a tab jump is
   * addressed to ONE module and lands even when that module's pane mounts later.
   * Read through `useModuleTab` (validated against the module's own tab ids).
   */
  moduleTabs: Record<string, string>;
  /** Point `moduleId`'s view at `tab` without changing the active module. */
  setModuleTab: (moduleId: string, tab: string) => void;

  /**
   * Navigate to a specific module by its moduleId — the one navigate door.
   * Resolves whether it's a special category or a sub-module
   * and sets the correct activeCategory + activeSubModule, plus
   * `moduleTabs[moduleId]` when `opts.tab` is given — all in ONE `set`, so no
   * subscriber sees the module without its tab. An unknown id is dropped.
   * Called from bottom bar, CLI panel, etc.
   */
  navigateToModule: (moduleId: string, opts?: { tab?: string }) => void;
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

      moduleTabs: {},
      setModuleTab: (moduleId, tab) =>
        set((s) => (s.moduleTabs[moduleId] === tab ? s : { moduleTabs: { ...s.moduleTabs, [moduleId]: tab } })),

      navigateToModule: (moduleId, opts) => {
        const withTab = (s: NavigationState) =>
          opts?.tab ? { moduleTabs: { ...s.moduleTabs, [moduleId]: opts.tab } } : {};

        // Special categories like 'project-setup', 'evaluator'
        if (SPECIAL_CATEGORY_IDS.has(moduleId)) {
          set((s) => ({
            activeCategory: moduleId as CategoryId,
            activeSubModule: null,
            ...withTab(s),
          }));
          return;
        }

        // Regular sub-module — resolve its parent category
        const subModuleId = moduleId as SubModuleId;
        const category = getCategoryForSubModule(subModuleId);
        if (category) {
          set((s) => ({
            activeCategory: category.id as CategoryId,
            activeSubModule: subModuleId,
            ...withTab(s),
          }));
        }
      },
    }),
    {
      name: 'pof-navigation',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
