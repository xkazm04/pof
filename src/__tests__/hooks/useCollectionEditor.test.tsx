import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCollectionEditor } from '@/hooks/useCollectionEditor';

afterEach(cleanup);

interface Item { id: string; label: string }
const factory = (): Item => ({ id: 'new', label: 'fresh' });
const seed: Item[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];

function setup(items: Item[] = seed) {
  const onChange = vi.fn();
  const hook = renderHook(() => useCollectionEditor(items, onChange, factory));
  return { onChange, hook };
}

describe('useCollectionEditor', () => {
  it('add appends the factory item and returns it', () => {
    const { onChange, hook } = setup();
    let created: Item | undefined;
    act(() => { created = hook.result.current.add(); });
    expect(created).toEqual(factory());
    expect(onChange).toHaveBeenCalledWith([...seed, factory()]);
  });

  it('remove drops only the matching id', () => {
    const { onChange, hook } = setup();
    act(() => hook.result.current.remove('a'));
    expect(onChange).toHaveBeenCalledWith([seed[1]]);
  });

  it('update merges the patch into the matching item only', () => {
    const { onChange, hook } = setup();
    act(() => hook.result.current.update('b', { label: 'B2' }));
    expect(onChange).toHaveBeenCalledWith([seed[0], { id: 'b', label: 'B2' }]);
  });

  it('operations are built from the items of their own render: a same-tick pair loses the first edit', () => {
    // Characterisation: no consumer batches today (each handler makes one call), so this pins the
    // contract callers rely on - one operation per render, not a queue.
    const { onChange, hook } = setup();
    act(() => {
      hook.result.current.add();
      hook.result.current.update('a', { label: 'A2' });
    });
    expect(onChange).toHaveBeenNthCalledWith(1, [...seed, factory()]);
    expect(onChange).toHaveBeenNthCalledWith(2, [{ id: 'a', label: 'A2' }, seed[1]]);
  });
});
