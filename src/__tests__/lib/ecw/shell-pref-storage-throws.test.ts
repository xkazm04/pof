/**
 * The root page's shell gate (`page.tsx` -> `useSyncExternalStore(readShellPref)`)
 * must render when storage is unavailable. A browser that blocks site data makes
 * `localStorage.getItem` / `setItem` throw a SecurityError; an unguarded read
 * threw out of the snapshot and took the whole app down, and an unguarded write
 * aborted `switchShell` before it pushed the new entry.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readShellPref, writeShellPref, switchShell } from '@/lib/ecw/shell-pref';

function blockStorage() {
  const denied = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
}

describe('shell-pref with storage blocked', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/'); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('readShellPref falls back to the default instead of throwing', () => {
    blockStorage();
    expect(() => readShellPref()).not.toThrow();
    expect(readShellPref()).toBe('ecw');
  });

  it('readShellPref still honours a URL that names its shell', () => {
    blockStorage();
    window.history.replaceState({}, '', '/?legacy=1');
    expect(readShellPref()).toBe('legacy');
  });

  it('writeShellPref is a no-op instead of throwing', () => {
    blockStorage();
    expect(() => writeShellPref('legacy')).not.toThrow();
  });

  it('switchShell still flips the shell through the URL', () => {
    blockStorage();
    expect(() => switchShell('legacy')).not.toThrow();
    expect(window.location.search).toContain('legacy=1');
    expect(readShellPref()).toBe('legacy');
  });
});
