'use client';
import { useState, useCallback, type KeyboardEvent } from 'react';

/** Roving-tabindex keyboard nav for a vertical list. ArrowUp/Down (+ j/k) move the
 *  active index; Enter/Space select. One tab-stop (the active item). */
export function useRovingFocus(count: number, initial: number, onSelect: (i: number) => void) {
  const [active, setActive] = useState(initial);
  const clamp = (i: number) => Math.max(0, Math.min(count - 1, i));

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (count === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setActive((a) => clamp(a + 1)); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setActive((a) => clamp(a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(count - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(active); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, active, onSelect]);

  return {
    active,
    setActive,
    containerProps: { onKeyDown },
    itemProps: (i: number) => ({ tabIndex: i === active ? 0 : -1, 'data-roving-active': i === active || undefined }),
  };
}
