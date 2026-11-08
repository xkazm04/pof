'use client';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared behaviour of the lab header's `role="dialog"` popovers (ActivityChip, LabBridgeStrip):
 * open/close state, outside-click close, Escape scoped to the popover (so it cannot also close a
 * Modal that owns the key elsewhere), focus entry on open and focus restore to the trigger.
 *
 * Spread `wrapperProps` on the element wrapping trigger + panel, put `panelRef` and tabIndex={-1}
 * on the dialog, and mark the trigger with `aria-haspopup`.
 */
export function useHeaderPopover() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const focusTrigger = useCallback(() => {
    wrapperRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
  }, []);

  /** Close; when focus sat inside the panel (about to unmount) hand it back to the trigger. */
  const close = useCallback(() => {
    const active = document.activeElement;
    if (panelRef.current && active && panelRef.current.contains(active)) focusTrigger();
    setOpen(false);
  }, [focusTrigger]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Focus entry: first control in the panel, else the panel itself (it is tabIndex -1).
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    (panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus();
  }, [open]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    focusTrigger();
    setOpen(false);
  }, [open, focusTrigger]);

  return { open, close, toggle, wrapperRef, panelRef, wrapperProps: { ref: wrapperRef, onKeyDown } };
}
