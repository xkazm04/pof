'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
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

/**
 * Left slide-over drawer used to surface the catalog tree / pipeline columns when
 * the shell is too narrow to keep them inline. Backdrop click or Escape closes it.
 */
export function LabDrawer({ t, open, onClose, id, title, width, children }: {
  t: LabTheme; open: boolean; onClose: () => void; id: string; title: string; width: number; children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key={`${id}-backdrop`}
            data-testid={`${id}-backdrop`}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
          />
          <motion.aside
            key={`${id}-panel`}
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
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
