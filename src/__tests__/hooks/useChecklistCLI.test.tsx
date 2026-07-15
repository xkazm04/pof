import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CallbackStatus } from '@/lib/cli-task';

// Capture the onComplete the hook wires into useModuleCLI so tests can drive the
// run-completion signal (success + callbackStatus) directly.
const { execute, onCompleteRef, isRunningRef } = vi.hoisted(() => ({
  execute: vi.fn((_t: unknown) => Promise.resolve()),
  onCompleteRef: { current: null as null | ((s: boolean, cb?: CallbackStatus) => void) },
  isRunningRef: { current: false },
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (config: { onComplete?: (s: boolean, cb?: CallbackStatus) => void }) => {
    onCompleteRef.current = config.onComplete ?? null;
    return { execute, sendPrompt: vi.fn(), isRunning: isRunningRef.current };
  },
}));

const setChecklistItem = vi.fn();
vi.mock('@/stores/moduleStore', () => ({
  useModuleStore: (sel: (s: { setChecklistItem: typeof setChecklistItem }) => unknown) =>
    sel({ setChecklistItem }),
}));

import { useChecklistCLI } from '@/hooks/useChecklistCLI';

const OPTS = { moduleId: 'arpg-combat' as const, sessionKey: 'k', label: 'Combat', accentColor: '#fff' };

function drive(cbStatus: CallbackStatus | undefined, success = true) {
  act(() => onCompleteRef.current?.(success, cbStatus));
}

describe('useChecklistCLI — callback truth', () => {
  beforeEach(() => {
    execute.mockClear();
    setChecklistItem.mockClear();
    onCompleteRef.current = null;
    isRunningRef.current = false;
  });

  it('flips the item to done ONLY on a confirmed callback', () => {
    const { result } = renderHook(() => useChecklistCLI(OPTS));
    act(() => result.current.sendPrompt('item-1', 'do the thing'));
    expect(execute).toHaveBeenCalledTimes(1);

    drive('confirmed');
    expect(setChecklistItem).toHaveBeenCalledWith('arpg-combat', 'item-1', true);
    expect(result.current.unconfirmedItemId).toBeNull();
    expect(result.current.activeItemId).toBeNull();
  });

  it('lost-marker (missing): does NOT mark done, surfaces unconfirmed + retry', () => {
    const { result } = renderHook(() => useChecklistCLI(OPTS));
    act(() => result.current.sendPrompt('item-2', 'p2'));
    drive('missing');

    expect(setChecklistItem).not.toHaveBeenCalled();
    expect(result.current.unconfirmedItemId).toBe('item-2');

    // Retry re-dispatches the SAME prompt for that item.
    act(() => result.current.retryUnconfirmed());
    expect(execute).toHaveBeenCalledTimes(2);
    const task = execute.mock.calls[1][0] as { itemId: string; prompt: string };
    expect(task.itemId).toBe('item-2');
    expect(task.prompt).toBe('p2');
  });

  it('malformed/failed callback: does NOT mark done, surfaces unconfirmed', () => {
    const { result } = renderHook(() => useChecklistCLI(OPTS));
    act(() => result.current.sendPrompt('item-3', 'p3'));
    drive('failed');
    expect(setChecklistItem).not.toHaveBeenCalled();
    expect(result.current.unconfirmedItemId).toBe('item-3');
  });

  it('a failed run (success=false) neither marks done nor nags to retry', () => {
    const { result } = renderHook(() => useChecklistCLI(OPTS));
    act(() => result.current.sendPrompt('item-4', 'p4'));
    drive(undefined, false);
    expect(setChecklistItem).not.toHaveBeenCalled();
    expect(result.current.unconfirmedItemId).toBeNull();
  });

  it('re-running an unconfirmed item clears its unconfirmed flag', () => {
    const { result } = renderHook(() => useChecklistCLI(OPTS));
    act(() => result.current.sendPrompt('item-5', 'p5'));
    drive('missing');
    expect(result.current.unconfirmedItemId).toBe('item-5');

    act(() => result.current.sendPrompt('item-5', 'p5'));
    expect(result.current.unconfirmedItemId).toBeNull();
    drive('confirmed');
    expect(setChecklistItem).toHaveBeenCalledWith('arpg-combat', 'item-5', true);
  });
});
