import { useRef, useCallback, useEffect } from 'react';

/**
 * Saves and restores scrollTop per tab ID on a scrollable container.
 * Returns a ref to attach to the scroll container and a callback to
 * call BEFORE changing the active tab (captures current scroll offset).
 */
export function useScrollRestoration<T extends string>(activeTab: T) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const positions = useRef<Record<string, number>>({});
  const prevTab = useRef<T>(activeTab);

  /** Call before switching tabs to capture the outgoing tab's scroll position */
  const captureScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      positions.current[prevTab.current] = el.scrollTop;
    }
  }, []);

  // Restore scroll position when activeTab changes
  useEffect(() => {
    prevTab.current = activeTab;
    const saved = positions.current[activeTab] ?? 0;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = saved;
      }
    });
  }, [activeTab]);

  return { scrollRef, captureScroll };
}
