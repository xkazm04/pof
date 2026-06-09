'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { DURATION, SPRING } from '@/lib/motion';

/**
 * Reusable, accessible modal shell.
 *
 * Handles the cross-cutting dialog concerns so individual modals only supply
 * their content:
 *   - AnimatePresence fade backdrop + scale-0.96→1 / opacity spring content
 *     (honours `prefers-reduced-motion` — animations collapse to instant)
 *   - role="dialog" + aria-modal + aria-labelledby (when `title` is given) /
 *     aria-label (fallback)
 *   - Tab / Shift+Tab focus trap that cycles within the dialog
 *   - moves focus to `initialFocusRef` (or the first focusable) on open
 *   - Escape to close
 *   - restores focus to the trigger element on close
 *
 * It deliberately owns the header (title + close button) for the common case;
 * pass `title`/`icon` to render it, or omit `title` and supply `label` for a
 * headerless dialog.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') !== 'true',
  );
}

export interface ModalProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the user requests close (backdrop, Escape, or close button). */
  onClose: () => void;
  /** Heading text. When provided, Modal renders a header (title + close button) and wires aria-labelledby. */
  title?: ReactNode;
  /** Optional icon rendered before the title. */
  icon?: ReactNode;
  /** Accessible name used when no `title` is rendered. */
  label?: string;
  /** Element to focus when the dialog opens. Falls back to the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Width / sizing classes for the panel (default `max-w-xl`). */
  className?: string;
  /** Close when the backdrop is clicked (default true). */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  icon,
  label,
  initialFocusRef,
  className = 'max-w-xl',
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  const prefersReduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Capture the trigger on open; restore focus to it on close.
  useEffect(() => {
    if (open) {
      triggerRef.current = (document.activeElement as HTMLElement | null) ?? null;
      return;
    }
    const trigger = triggerRef.current;
    triggerRef.current = null;
    // Only restore if the trigger is still in the document and focusable.
    if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
      trigger.focus();
    }
  }, [open]);

  // Move focus into the dialog once it has mounted/animated in.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        getFocusable(panelRef.current)[0] ??
        panelRef.current;
      target?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, initialFocusRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = getFocusable(panelRef.current);
      if (focusables.length === 0) {
        // Nothing to land on — keep focus on the panel itself.
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const within = panelRef.current?.contains(active) ?? false;

      if (e.shiftKey) {
        if (!within || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!within || active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const backdropMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: prefersReduced ? 0 : DURATION.fast },
  };

  const panelMotion = prefersReduced
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        transition: SPRING.snappy,
      };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          {...backdropMotion}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (closeOnBackdrop && e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="modal-panel"
            ref={panelRef}
            {...panelMotion}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title != null ? titleId : undefined}
            aria-label={title == null ? label : undefined}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={`relative w-full ${className} max-h-[90vh] overflow-y-auto p-5 bg-surface border border-border rounded-xl shadow-xl focus:outline-none`}
          >
            {title != null && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {icon}
                  <h2 id={titleId} className="text-sm font-semibold text-text">
                    {title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text focus-ring"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
