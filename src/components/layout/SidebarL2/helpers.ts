import type { CLISessionState } from '@/components/cli/store/cliPanelStore';
import type { SubModuleId } from '@/types/modules';
import { STORAGE_KEY, SIDEBAR_DEFAULT } from './constants';

export function getSavedWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWidth(category: string, width: number) {
  try {
    const widths = getSavedWidths();
    widths[category] = width;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch { /* noop */ }
}

export function getWidthForCategory(category: string | null): number {
  if (!category) return SIDEBAR_DEFAULT;
  const widths = getSavedWidths();
  return widths[category] ?? SIDEBAR_DEFAULT;
}

/**
 * Derive the badge status for a single module from the sessions map.
 * Returns a primitive ('failed' | 'running' | null) so the per-badge Zustand
 * subscription below settles under the default Object.is equality: a streamed
 * token that only bumps lastActivityAt on one session no longer invalidates
 * every badge — a badge re-renders only when its own module's status flips.
 * (Selecting a primitive, not a fresh object, also sidesteps the
 * "new object every render" selector trap.)
 */
export function deriveStatusForModule(
  sessions: Record<string, CLISessionState>,
  moduleId: SubModuleId,
): 'failed' | 'running' | null {
  let hasRunning = false;
  for (const session of Object.values(sessions)) {
    if (session.moduleId !== moduleId) continue;
    // Failed takes priority over running — return as soon as we see one.
    if (session.lastTaskSuccess === false) return 'failed';
    if (session.isRunning) hasRunning = true;
  }
  return hasRunning ? 'running' : null;
}
