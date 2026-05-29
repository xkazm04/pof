import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useLabPrefs } from '@/components/layout-lab/hooks/useLabPrefs';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('useLabPrefs', () => {
  it('defaults to light + comfortable when storage is empty', () => {
    const { result } = renderHook(() => useLabPrefs());
    expect(result.current.prefs.themeId).toBe('light');
    expect(result.current.prefs.density).toBe('comfortable');
  });
  it('persists + reflects an update', () => {
    const { result } = renderHook(() => useLabPrefs());
    act(() => result.current.setPrefs({ themeId: 'dark', density: 'compact' }));
    expect(result.current.prefs.themeId).toBe('dark');
    expect(JSON.parse(localStorage.getItem('pof-lab-prefs')!).themeId).toBe('dark');
  });
  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('pof-lab-prefs', '{not json');
    const { result } = renderHook(() => useLabPrefs());
    expect(result.current.prefs.themeId).toBe('light');
  });
  it('exposes a hydrated flag', () => {
    const { result } = renderHook(() => useLabPrefs());
    expect(typeof result.current.hydrated).toBe('boolean');
  });
  it('adopts pre-populated storage after hydration', () => {
    localStorage.setItem('pof-lab-prefs', JSON.stringify({ themeId: 'dark', density: 'compact', lastCatalogId: 'spellbook', lastEntityId: 'e1' }));
    const { result } = renderHook(() => useLabPrefs());
    expect(result.current.prefs.themeId).toBe('dark');
    expect(result.current.prefs.density).toBe('compact');
    expect(result.current.prefs.lastCatalogId).toBe('spellbook');
    expect(result.current.prefs.lastEntityId).toBe('e1');
  });
  it('adopts storage that differs only by lastEntityId', () => {
    localStorage.setItem('pof-lab-prefs', JSON.stringify({ themeId: 'light', density: 'comfortable', lastEntityId: 'only-entity' }));
    const { result } = renderHook(() => useLabPrefs());
    expect(result.current.prefs.lastEntityId).toBe('only-entity');
  });
});
