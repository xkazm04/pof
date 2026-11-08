/**
 * Reading the Feature Map visibility does not write it.
 *
 * Every `VisibleSection` mounts its own `useFeatureVisibility(moduleId)`, and the
 * hook's persist effect ran on mount too — so each section of every tab switch wrote
 * back the snapshot it had just read. Besides the wasted writes, a section mounted
 * from a stale read rewrote that stale snapshot over a newer one.
 *
 * RED before the fix: mounting 3 readers issued 3 setItem writes.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';

const KEY = 'pof-feature-vis-arpg-combat';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const writesTo = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter((c) => c[0] === KEY).length;

describe('useFeatureVisibility — persistence writes', () => {
  it('mounting readers writes nothing; a toggle writes once', () => {
    localStorage.setItem(KEY, JSON.stringify({ dps: false }));
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    renderHook(() => useFeatureVisibility('arpg-combat'));
    renderHook(() => useFeatureVisibility('arpg-combat'));
    const { result } = renderHook(() => useFeatureVisibility('arpg-combat'));
    expect(writesTo(spy)).toBe(0);
    expect(result.current.isVisible('dps')).toBe(false);

    act(() => { result.current.toggle('dps'); });
    expect(writesTo(spy)).toBe(1);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ dps: true });
  });

  it('switching module reads the new module and writes nothing for either', () => {
    localStorage.setItem('pof-feature-vis-arpg-loot', JSON.stringify({ affixes: false }));
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const { result, rerender } = renderHook(({ m }) => useFeatureVisibility(m), { initialProps: { m: 'arpg-combat' } });
    rerender({ m: 'arpg-loot' });
    expect(result.current.isVisible('affixes')).toBe(false);
    expect(spy.mock.calls.length).toBe(0);

    act(() => { result.current.setMany(['affixes'], true); });
    expect(JSON.parse(localStorage.getItem('pof-feature-vis-arpg-loot')!)).toEqual({ affixes: true });
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
