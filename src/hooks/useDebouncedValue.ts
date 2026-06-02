'use client';

import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of no
 * further changes. Use to keep an expensive derivation (e.g. a synchronous sim)
 * off the critical path while a slider is being dragged: the raw value drives
 * the control's visual position immediately, while the debounced value drives
 * the heavy recompute only once the user pauses.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
