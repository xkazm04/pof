import type { KeyboardEvent } from 'react';

const ROVING_KEYS = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

/**
 * Arrow/Home/End roving focus over a `role="tablist"` strip (WAI-ARIA tabs pattern,
 * automatic activation). Reads the rendered `[role="tab"]` buttons so the DOM stays
 * the single source of tab order. Attach as `onKeyDown` on the tablist element.
 */
export function handleRovingTabKeyDown(e: KeyboardEvent<HTMLElement>): void {
  if (!ROVING_KEYS.includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const current = tabs.findIndex((t) => t === document.activeElement);
  if (current === -1) return;
  e.preventDefault();
  const next =
    e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
        : e.key === 'ArrowRight' ? (current + 1) % tabs.length
          : (current - 1 + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
