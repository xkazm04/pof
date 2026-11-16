'use client';
import { useState, useCallback, type KeyboardEvent } from 'react';

/** Roving-tabindex keyboard nav for a vertical list. `initial` is the selected index: the
 *  cursor starts there and follows any later change to it. ArrowUp/Down (+ j/k) move the
 *  active index; Enter/Space select. One tab-stop (the active item).
 *
 *  The list can shrink under the cursor (a tree group collapses, the rail switches to a
 *  shorter pipeline), so the active index is CLAMPED to the current count in render rather
 *  than trusted as stored — otherwise no item is the tab-stop and the list leaves the Tab
 *  order. Clamping is a derivation, so growing the list back restores nothing stale. */
export function useRovingFocus(count: number, initial: number, onSelect: (i: number) => void) {
  const [stored, setActive] = useState(initial);
  // The cursor FOLLOWS the externally selected index: when `initial` changes the stored cursor is
  // resynced in render (a prev-value bail-out, not an effect), so no consumer repeats this rule.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setActive(initial);
  }
  const clamp = useCallback((i: number) => Math.max(0, Math.min(count - 1, i)), [count]);
  const active = count === 0 ? 0 : clamp(stored);
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (count === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setActive((a) => clamp(clamp(a) + 1)); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setActive((a) => clamp(clamp(a) - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(count - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(active); }
  }, [count, clamp, active, onSelect]);

  return {
    active,
    setActive,
    containerProps: { onKeyDown },
    itemProps: (i: number) => ({ tabIndex: i === active ? 0 : -1, 'data-roving-active': i === active || undefined }),
  };
}
