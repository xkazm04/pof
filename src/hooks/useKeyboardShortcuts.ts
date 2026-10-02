'use client';

import { useHotkey } from '@/hooks/useHotkey';
import { useNavigationStore } from '@/stores/navigationStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { CATEGORIES } from '@/lib/module-registry';

const CATEGORY_CHORDS = ['ctrl+1', 'ctrl+2', 'ctrl+3', 'ctrl+4', 'ctrl+5'] as const;

export function useKeyboardShortcuts() {
  const setSidebarMode = useNavigationStore((s) => s.setSidebarMode);
  const sidebarMode = useNavigationStore((s) => s.sidebarMode);
  const setActiveCategory = useNavigationStore((s) => s.setActiveCategory);
  const maximizedTabId = useCLIPanelStore((s) => s.maximizedTabId);
  const activeTabId = useCLIPanelStore((s) => s.activeTabId);
  const maximizeTab = useCLIPanelStore((s) => s.maximizeTab);
  const minimizeTab = useCLIPanelStore((s) => s.minimizeTab);

  // Shell-scope chords on the keyboard door (`@/lib/hotkeys/hotkeyRegistry`),
  // which preventDefaults whatever it handles. They fire from text fields too
  // (allowInInput), as the raw listener they replaced did.

  // Ctrl+B: Toggle sidebar
  useHotkey('ctrl+b', () => {
    setSidebarMode(sidebarMode === 'full' ? 'collapsed' : 'full');
  }, { allowInInput: true, id: 'shell.sidebar-toggle' });

  // Ctrl+J: Toggle maximized terminal
  useHotkey('ctrl+j', () => {
    if (maximizedTabId) {
      minimizeTab();
    } else if (activeTabId) {
      maximizeTab(activeTabId);
    }
  }, { allowInInput: true, id: 'shell.terminal-maximize' });

  // Ctrl+1-5: Quick category switch
  useHotkey(CATEGORY_CHORDS, (e) => {
    const index = parseInt(e.key) - 1;
    if (CATEGORIES[index]) {
      setActiveCategory(CATEGORIES[index].id);
    }
  }, { allowInInput: true, id: 'shell.category-switch' });
}
