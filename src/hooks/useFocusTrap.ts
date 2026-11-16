import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true',
  );
}

interface FocusTrapOptions {
  /** Move focus to the first focusable element on activation (default true). Pass false when the surface focuses its own field. */
  autoFocus?: boolean;
}

/**
 * Focus containment for an aria-modal surface that cannot use `ui/Modal`:
 * Tab / Shift+Tab cycle inside the returned container, the opener is captured
 * on activation and focused again on deactivation or unmount. Attach the ref
 * to the dialog element, which must be mounted when `active` turns true.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, { autoFocus = true }: FocusTrapOptions = {}) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const trigger = document.activeElement as HTMLElement | null;

    let raf = 0;
    if (autoFocus) {
      raf = requestAnimationFrame(() => {
        (getFocusable(container)[0] ?? container).focus();
      });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(container);
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const within = current ? container.contains(current) : false;
      if (e.shiftKey) {
        if (!within || current === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!within || current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('keydown', onKeyDown);
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [active, autoFocus]);

  return containerRef;
}
