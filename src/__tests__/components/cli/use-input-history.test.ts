import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInputHistory } from '@/components/cli/useInputHistory';

// scan-sweep night 2026-11-08 cli-terminal-shell — ArrowDown past the newest entry
// must return to an empty prompt (shell convention). The old code clamped the index
// with Math.min(len - 1, …) and then tested `=== len`, which could never be true.

describe('useInputHistory', () => {
  it('ArrowDown past the newest entry returns to an empty prompt', () => {
    const { result } = renderHook(() => useInputHistory());
    act(() => { result.current.pushHistory('first'); });
    act(() => { result.current.pushHistory('second'); });

    let v: string | null = null;
    act(() => { v = result.current.navigateHistory('up'); });
    expect(v).toBe('second');
    act(() => { v = result.current.navigateHistory('up'); });
    expect(v).toBe('first');
    act(() => { v = result.current.navigateHistory('down'); });
    expect(v).toBe('second');
    act(() => { v = result.current.navigateHistory('down'); });
    expect(v).toBe('');
    // Back at the empty prompt, Up starts again from the newest entry.
    act(() => { v = result.current.navigateHistory('up'); });
    expect(v).toBe('second');
  });
});
