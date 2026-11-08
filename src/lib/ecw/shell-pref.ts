import { parseShellRoute, shellUrl } from '@/lib/shell/shellRoute';

export type ShellPref = 'ecw' | 'legacy';
const KEY = 'pof.shell';

/**
 * Which shell to render. A URL that names its shell (`?legacy=1` / `?legacy=0`) wins
 * (shareable, and what Back lands on); else the stored preference; else ECW (the default).
 * SSR-safe — returns 'ecw' with no window. Single source of truth shared by `page.tsx`'s
 * gate and both shell switches; the parsing itself is `parseShellRoute`.
 */
/** The stored preference, or null when storage is unavailable (blocked site data throws). */
function readStored(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function readShellPref(): ShellPref {
  if (typeof window === 'undefined') return 'ecw';
  return parseShellRoute(window.location.search, readStored()).shell;
}

export function writeShellPref(pref: ShellPref): void {
  if (typeof window === 'undefined') return;
  // Blocked site data makes setItem throw (SecurityError) — and quota can too.
  // The preference is a convenience; the URL `switchShell` pushes still names the shell.
  try { localStorage.setItem(KEY, pref); } catch { /* storage unavailable */ }
}

/**
 * Flip the root shell live. The CURRENT entry is first rewritten to name the shell it
 * shows (so Back returns to it, whatever the stored preference says), then the preference
 * is stored, the target entry pushed, and popstate fired so `page.tsx`'s gate swaps.
 */
export function switchShell(to: ShellPref): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, '', shellUrl(window.location.href, to === 'legacy' ? 'ecw' : 'legacy'));
  writeShellPref(to);
  window.history.pushState({}, '', shellUrl(window.location.href, to));
  window.dispatchEvent(new PopStateEvent('popstate'));
}
