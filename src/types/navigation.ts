import type { CategoryId, SubModuleId } from './modules';

export type SidebarMode = 'full' | 'collapsed' | 'hidden';

export interface NavigationState {
  activeCategory: CategoryId | null;
  activeSubModule: SubModuleId | null;
  sidebarMode: SidebarMode;
}
