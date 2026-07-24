'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { SidebarL1 } from './SidebarL1';
import { SidebarL2 } from './SidebarL2';

interface SidebarProps {
  /** Narrow viewports: render the rails as an overlay drawer instead of inline. */
  overlay?: boolean;
  /** Drawer visibility (overlay mode only). */
  open?: boolean;
  /** Dismiss the drawer (backdrop / Escape / navigation). */
  onClose?: () => void;
}

export function Sidebar({ overlay = false, open = false, onClose }: SidebarProps) {
  const sidebarMode = useNavigationStore((s) => s.sidebarMode);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);
  const prefersReduced = useReducedMotion();

  // Auto-dismiss the drawer once the user actually navigates to a sub-module, so
  // picking a destination on a phone returns focus to the work canvas. Guarded on
  // a real transition to a non-null sub-module (selecting a category nulls it and
  // must NOT close the drawer — the user still needs L2 to pick a destination).
  const prevSub = useRef(activeSubModule);
  useEffect(() => {
    if (overlay && open && activeSubModule && activeSubModule !== prevSub.current) {
      onClose?.();
    }
    prevSub.current = activeSubModule;
  }, [activeSubModule, overlay, open, onClose]);

  // Escape closes the drawer (parity with the search palette / lab drawers).
  useEffect(() => {
    if (!overlay || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, open, onClose]);

  const rails = (
    <div className="flex h-full">
      <SidebarL1 />
      {sidebarMode === 'full' && <SidebarL2 />}
    </div>
  );

  if (!overlay) return rails;

  const fade = prefersReduced ? 0 : DURATION.base;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sidebar-backdrop"
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: fade, ease: EASE_OUT }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex h-dvh shadow-2xl"
            initial={prefersReduced ? { opacity: 0 } : { x: '-100%' }}
            animate={prefersReduced ? { opacity: 1 } : { x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { x: '-100%' }}
            transition={{ duration: fade, ease: EASE_OUT }}
          >
            {rails}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
