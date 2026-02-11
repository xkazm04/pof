'use client';

import { useEffect } from 'react';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { CATEGORIES } from '@/lib/module-registry';

export function useKeyboardShortcuts() {
  const setSidebarMode = useNavigationStore((s) => s.setSidebarMode);
  const sidebarMode = useNavigationStore((s) => s.sidebarMode);
  const setActiveCategory = useNavigationStore((s) => s.setActiveCategory);
  const maximizedTabId = useCLIPanelStore((s) => s.maximizedTabId);
  const activeTabId = useCLIPanelStore((s) => s.activeTabId);
  const maximizeTab = useCLIPanelStore((s) => s.maximizeTab);
  const minimizeTab = useCLIPanelStore((s) => s.minimizeTab);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+B: Toggle sidebar
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setSidebarMode(sidebarMode === 'full' ? 'collapsed' : 'full');
      }

      // Ctrl+J: Toggle maximized terminal
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault();
        if (maximizedTabId) {
          minimizeTab();
        } else if (activeTabId) {
          maximizeTab(activeTabId);
        }
      }

      // Ctrl+1-5: Quick category switch
      if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (CATEGORIES[index]) {
          setActiveCategory(CATEGORIES[index].id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarMode, setSidebarMode, maximizedTabId, activeTabId, maximizeTab, minimizeTab, setActiveCategory]);
}
