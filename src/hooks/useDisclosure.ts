'use client';

import { useId, useState, useCallback } from 'react';

export interface DisclosureA11y {
  /** Spread onto the trigger button (a collapsed/expanded toggle). */
  buttonProps: { 'aria-expanded': boolean; 'aria-controls': string };
  /** Spread onto the collapsible panel element the button controls. */
  panelProps: { id: string };
}

/**
 * Build the matched ARIA disclosure props (`aria-expanded` / `aria-controls` /
 * panel `id`) for a trigger + panel pair whose open state is owned elsewhere
 * (e.g. by a parent via a prop). Pair with a stable id (see {@link useDisclosure}
 * for the local-state variant which generates one for you).
 *
 * This is the shared disclosure pattern for the app: every icon-only expand/collapse
 * toggle should announce its state and the region it controls.
 */
export function disclosureA11y(open: boolean, panelId: string): DisclosureA11y {
  return {
    buttonProps: { 'aria-expanded': open, 'aria-controls': panelId },
    panelProps: { id: panelId },
  };
}

export interface UseDisclosure extends DisclosureA11y {
  open: boolean;
  toggle: () => void;
  setOpen: (value: boolean) => void;
}

/**
 * Local-state disclosure: owns `open`/`toggle` and exposes the matched ARIA props
 * plus a stable, collision-free panel id (via {@link useId}). Drop-in replacement
 * for a hand-rolled `const [open, setOpen] = useState(...)` toggle that also makes
 * the control accessible.
 */
export function useDisclosure(initialOpen = false): UseDisclosure {
  const panelId = `disclosure-${useId()}`;
  const [open, setOpen] = useState(initialOpen);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return { open, toggle, setOpen, ...disclosureA11y(open, panelId) };
}
