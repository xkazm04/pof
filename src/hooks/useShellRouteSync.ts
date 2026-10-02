'use client';

import { useEffect } from 'react';
import { useNavigationStore } from '@/stores/navigationStore';
import { resolveVisibleModule } from '@/components/layout/ModuleRenderer/helpers';
import { SPECIAL_MODULE_IDS, isModuleDestination, parseShellRoute, shellUrl } from '@/lib/shell/shellRoute';

const SPECIAL: ReadonlySet<string> = new Set<string>(SPECIAL_MODULE_IDS);

type NavLocation = { activeCategory: string | null; activeSubModule: string | null };

/** The module the user sees (the renderer's own visibility rule), if it has an address. */
function visibleModule(s: NavLocation): string | null {
  const id = resolveVisibleModule(s.activeCategory, s.activeSubModule, !!s.activeCategory && SPECIAL.has(s.activeCategory));
  return isModuleDestination(id) ? id : null;
}

/** The module the address names. The legacy shell is mounted, so a missing flag reads as legacy. */
function addressedModule(): string | null {
  return parseShellRoute(window.location.search, 'legacy').moduleId;
}

/**
 * Keeps the legacy shell's module location and the address in step (mounted in AppShell).
 *
 * - Arrival: a validated `module` param is applied through `navigateToModule` (the one
 *   navigate door); an unknown or missing one leaves the persisted location, and the
 *   current entry is REPLACED to name it — arriving never pushes.
 * - A module-to-module move pushes one entry naming the new module.
 * - popstate re-applies the entry's module. A location that came FROM the address (popstate
 *   or deep link) is never pushed back: the push is skipped whenever the address already
 *   names the visible module, so Back/Forward cannot grow or truncate history.
 */
export function useShellRouteSync(): void {
  useEffect(() => {
    const applyAddress = () => {
      const id = addressedModule();
      if (id && id !== visibleModule(useNavigationStore.getState())) useNavigationStore.getState().navigateToModule(id);
    };

    applyAddress();
    const arrived = visibleModule(useNavigationStore.getState());
    if (arrived && arrived !== addressedModule()) {
      window.history.replaceState({}, '', shellUrl(window.location.href, 'legacy', arrived));
    }

    const unsubscribe = useNavigationStore.subscribe((s, prev) => {
      const id = visibleModule(s);
      if (!id || id === visibleModule(prev) || id === addressedModule()) return;
      window.history.pushState({}, '', shellUrl(window.location.href, 'legacy', id));
    });
    window.addEventListener('popstate', applyAddress);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', applyAddress);
    };
  }, []);
}
