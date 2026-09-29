/**
 * The root page's address codec: ONE parser for which shell a URL means and which module
 * it names.
 *
 * The legacy shell holds its location in Zustand (`navigationStore`, persisted to
 * localStorage). That is a legitimate architecture, but it owes the Back gesture and deep
 * links explicitly, and it paid neither:
 *
 *  - the shell was chosen by `?legacy=1`, ELSE the stored preference. "Legacy shell" in the
 *    lab stores 'legacy' and pushes `?legacy=1`, so Back to the lab URL still read 'legacy'
 *    from storage and the page did not move. An entry that names its shell (`legacy=0|1`)
 *    now wins over storage, and each switch names the entry it leaves (`switchShell`).
 *  - no module ever reached the address, so moving between modules pushed no history entry
 *    and the lab (where users land) could not open any of them. Every module now has an
 *    address, `/?legacy=1&module=<id>`, validated against the closed vocabulary below: an
 *    unknown id is dropped, never trusted.
 *
 * The location travels in the URL, not in `history.state`: Next's app-router copies its own
 * internals into plain pushState/replaceState calls, and a framework replace would silently
 * erase anything state-held.
 *
 * The destinations are DERIVED from `SUB_MODULE_IDS` + the special categories, so they add
 * no legacy chrome and disappear with that list when the legacy shell is deleted
 * (docs/catalog/LEGACY-SALVAGE.md).
 */

import { SUB_MODULE_IDS } from '@/types/modules';
import { CATEGORY_MAP, MODULE_LABELS } from '@/lib/module-registry';
import type { ShellPref } from '@/lib/ecw/shell-pref';

/** Categories the module renderer draws without sub-modules (`SPECIAL_CATEGORIES`). */
export const SPECIAL_MODULE_IDS = ['project-setup', 'evaluator', 'game-director'] as const;

export interface ShellRoute {
  shell: ShellPref;
  /** A validated module id, or `null` (none named, unknown, or not the legacy shell). */
  moduleId: string | null;
}

export interface ModuleDestination {
  id: string;
  /** The registry's own label — never a hand-kept copy. */
  label: string;
  href: string;
}

const DESTINATION_IDS: ReadonlySet<string> = new Set<string>([...SUB_MODULE_IDS, ...SPECIAL_MODULE_IDS]);

/** Is `id` a module the legacy shell can open? (The deep-link allow-list.) */
export function isModuleDestination(id: string | null | undefined): id is string {
  return !!id && DESTINATION_IDS.has(id);
}

/**
 * Which shell `search` means: an explicit `legacy=1|0` wins; else the stored preference;
 * else the lab. `module` is honoured only for the legacy shell and only when it is a known
 * destination.
 */
export function parseShellRoute(search: string, stored: string | null): ShellRoute {
  const params = new URLSearchParams(search);
  const flag = params.get('legacy');
  const shell: ShellPref =
    flag === '1' ? 'legacy' : flag === '0' ? 'ecw' : stored === 'legacy' ? 'legacy' : 'ecw';
  const raw = params.get('module');
  return { shell, moduleId: shell === 'legacy' && isModuleDestination(raw) ? raw : null };
}

/** The address that opens module `id` in the legacy shell. */
export function moduleHref(id: string): string {
  return `/?legacy=1&module=${encodeURIComponent(id)}`;
}

/**
 * `href` rewritten to name `shell` (and, for the legacy shell, `moduleId` when given).
 * Other params (per-module tab params, the hash) are kept; the lab drops `module`.
 * Returns a path + query + hash, ready for pushState/replaceState.
 */
export function shellUrl(href: string, shell: ShellPref, moduleId: string | null = null): string {
  const url = new URL(href);
  url.searchParams.set('legacy', shell === 'legacy' ? '1' : '0');
  if (shell === 'ecw') url.searchParams.delete('module');
  else if (moduleId) url.searchParams.set('module', moduleId);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** One row per module the legacy shell can open: 37 sub-modules + 3 special categories. */
export const MODULE_DESTINATIONS: readonly ModuleDestination[] = [...DESTINATION_IDS].map((id) => ({
  id,
  label: MODULE_LABELS[id] ?? CATEGORY_MAP[id]?.label ?? id,
  href: moduleHref(id),
}));
