'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { LabTheme } from './theme';

/** Header button that opens/closes a collapsed-shell drawer (narrow viewports). */
export function DrawerToggle({ t, label, glyph, open, controls, onClick }: {
  t: LabTheme; label: string; glyph: string; open: boolean; controls: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      className={t.fontMono}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600,
        padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
        background: open ? (t.glass ? t.accentBg : t.ink) : 'transparent',
        color: open ? (t.glass ? t.ink : t.onAccent) : t.ink,
        border: `1px solid ${t.ink}`, borderRadius: t.glass ? 6 : 0,
        transition: 'background-color 160ms ease-out, color 160ms ease-out',
      }}
    >
      <span aria-hidden="true">{glyph}</span>{label}
    </button>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Left slide-over drawer used to surface the catalog tree / pipeline columns when
 * the shell is too narrow to keep them inline. Backdrop click or Escape closes it.
 *
 * It declares `aria-modal`, so it keeps that promise itself (the shared `ui/Modal` is a
 * centred dialog, not a slide-over): focus moves in on open, Tab / Shift+Tab wrap inside the
 * panel, and focus returns to whatever opened it on close or unmount.
 */
export function LabDrawer({ t, open, onClose, id, title, width, children }: {
  t: LabTheme; open: boolean; onClose: () => void; id: string; title: string; width: number; children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
    return () => { if (opener && opener.isConnected) opener.focus(); };
  }, [open]);

  const trapTab = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panelRef.current.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) { e.preventDefault(); first.focus(); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key={`${id}-backdrop`}
            data-testid={`${id}-backdrop`}
            onClick={onClose}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
          />
          <motion.aside
            key={`${id}-panel`}
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={trapTab}
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? false : { x: '-100%' }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '-100%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 38 }}
            style={{
              position: 'fixed', top: 0, bottom: 0, left: 0, width, maxWidth: '85vw',
              display: 'flex', flexDirection: 'column', minHeight: 0, zIndex: 41,
              background: t.bg, borderRight: `1px solid ${t.line}`, boxShadow: '0 0 40px rgba(0,0,0,0.28)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px 12px 18px', borderBottom: `1px solid ${t.line}` }}>
              <span className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink }}>{title}</span>
              <button onClick={onClose} aria-label="Close drawer" className={t.fontMono}
                style={{ fontSize: 16, lineHeight: 1, padding: '4px 8px', cursor: 'pointer', background: 'transparent', color: t.muted, border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0 }}>
                ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
