'use client';

import { useCallback } from 'react';
import { useNavigationStore } from '@/stores/navigationStore';

/**
 * The tab a module's view shows — read from the navigation model, not held
 * locally. `moduleTabs[moduleId]` is written by `navigateToModule(id, { tab })`
 * (a jump from a CLI suggestion or another panel) or by the returned setter (a
 * tab click). Each module reads only its own entry, so a jump addressed to one
 * module never moves another mounted pane, and an entry written before this
 * pane mounted is honoured on its first render.
 *
 * The stored value is validated against THIS module's tab ids: a stale or
 * foreign tab (an older persisted build, a tab another view removed) falls back
 * to `fallback`, else the first valid tab.
 */
export function useModuleTab(
  moduleId: string,
  validTabs: readonly string[],
  fallback?: string,
): [string, (tab: string) => void] {
  // Primitive selector (string | undefined) — never a fresh object per call.
  const stored = useNavigationStore((s) => s.moduleTabs?.[moduleId]);
  const setModuleTab = useNavigationStore((s) => s.setModuleTab);

  const defaultTab = fallback !== undefined && validTabs.includes(fallback) ? fallback : validTabs[0];
  const tab = stored !== undefined && validTabs.includes(stored) ? stored : defaultTab;

  const setTab = useCallback((next: string) => setModuleTab(moduleId, next), [setModuleTab, moduleId]);
  return [tab, setTab];
}
