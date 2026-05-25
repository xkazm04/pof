import { describe, it, expect, beforeEach } from 'vitest';
import { readShellPref, writeShellPref } from '@/lib/ecw/shell-pref';

describe('shell-pref', () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/'); });

  it('defaults to ecw', () => {
    expect(readShellPref()).toBe('ecw');
  });
  it('?legacy=1 forces legacy regardless of storage', () => {
    localStorage.setItem('pof.shell', 'ecw');
    window.history.replaceState({}, '', '/?legacy=1');
    expect(readShellPref()).toBe('legacy');
  });
  it('falls back to stored pref when no url param', () => {
    localStorage.setItem('pof.shell', 'legacy');
    expect(readShellPref()).toBe('legacy');
  });
  it('writeShellPref persists', () => {
    writeShellPref('legacy');
    expect(localStorage.getItem('pof.shell')).toBe('legacy');
  });
});
