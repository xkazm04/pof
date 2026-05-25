export type ShellPref = 'ecw' | 'legacy';
const KEY = 'pof.shell';

/**
 * Which shell to render. URL `?legacy=1` wins (shareable); else the stored
 * preference; else ECW (the default). SSR-safe — returns 'ecw' with no window.
 * Single source of truth shared by `page.tsx`'s gate and the ShellSwitcher.
 */
export function readShellPref(): ShellPref {
  if (typeof window === 'undefined') return 'ecw';
  if (new URLSearchParams(window.location.search).get('legacy') === '1') return 'legacy';
  return localStorage.getItem(KEY) === 'legacy' ? 'legacy' : 'ecw';
}

export function writeShellPref(pref: ShellPref): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, pref);
}
