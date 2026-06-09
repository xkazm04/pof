'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { CATEGORIES } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';
import type { CategoryId } from '@/types/modules';

const ACTIVE_INDICATOR_ID = 'sidebar-l1-active-indicator';
const COLLAPSED_WIDTH = 56; // icon-only rail (matches the previous w-14)
const EXPANDED_WIDTH = 180; // widened rail with inline labels
const TOGGLE_FLYOUT_ID = '__toggle__';
const FLYOUT_MS = 0.12; // 120ms flyout slide-in

export function SidebarL1() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const setActiveCategory = useNavigationStore((s) => s.setActiveCategory);
  const expanded = useNavigationStore((s) => s.l1Expanded);
  const toggleExpanded = useNavigationStore((s) => s.toggleL1Expanded);
  const prefersReduced = useReducedMotion();

  // Which rail item currently shows its hover/focus flyout (collapsed mode only).
  const [flyout, setFlyout] = useState<string | null>(null);

  const handleClick = (id: CategoryId) => {
    if (activeCategory === id) {
      setActiveCategory(null);
    } else {
      setActiveCategory(id);
    }
  };

  // A flyout label is rendered next to a rail item on hover/keyboard-focus while
  // the rail is collapsed. It slides in (x: -4 → 0 over 120ms) and is purely
  // decorative — the accessible name already lives on the button's aria-label.
  const renderFlyout = (id: string, label: string, accentColor: string) => {
    if (expanded) return null;
    return (
      <AnimatePresence>
        {flyout === id && (
          <motion.span
            aria-hidden
            className="absolute left-full ml-2 top-1/2 z-50 pointer-events-none whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium shadow-lg"
            style={{ color: accentColor }}
            initial={prefersReduced ? { opacity: 1, x: 0, y: '-50%' } : { opacity: 0, x: -4, y: '-50%' }}
            animate={{ opacity: 1, x: 0, y: '-50%' }}
            exit={prefersReduced ? { opacity: 0, y: '-50%' } : { opacity: 0, x: -4, y: '-50%' }}
            transition={{ duration: prefersReduced ? 0 : FLYOUT_MS, ease: 'easeOut' }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    );
  };

  return (
    <motion.nav
      className="relative flex flex-col items-center py-3 px-2 gap-1 border-r border-border bg-background"
      aria-label="Module categories"
      style={{ ['--focus-accent' as string]: 'var(--setup)' }}
      initial={false}
      animate={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            data-testid={`pof-sidebar-nav-item-${cat.id}`}
            onClick={() => handleClick(cat.id)}
            onMouseEnter={() => setFlyout(cat.id)}
            onMouseLeave={() => setFlyout((f) => (f === cat.id ? null : f))}
            onFocus={() => setFlyout(cat.id)}
            onBlur={() => setFlyout((f) => (f === cat.id ? null : f))}
            aria-label={cat.label}
            aria-pressed={isActive}
            className={`
              relative h-10 flex items-center rounded-lg transition-colors duration-base
              focus-ring
              ${expanded ? 'w-full justify-start gap-3 px-2' : 'w-10 justify-center'}
              ${isActive ? 'bg-surface-hover' : 'hover:bg-surface'}
            `}
          >
            {/* Sliding active indicator — Framer layoutId animates across siblings,
                so positioning is derived from the live DOM rather than magic numbers. */}
            {isActive && (
              <motion.span
                layoutId={ACTIVE_INDICATOR_ID}
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                style={{ backgroundColor: cat.accentColor }}
                transition={
                  prefersReduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 40 }
                }
                aria-hidden
              />
            )}
            <Icon
              className="w-5 h-5 flex-shrink-0 transition-colors duration-base"
              style={{ color: isActive ? cat.accentColor : 'var(--text-muted)' }}
            />
            {expanded && (
              <span
                className="text-xs font-medium truncate"
                style={{ color: isActive ? cat.accentColor : 'var(--text-muted)' }}
              >
                {cat.label}
              </span>
            )}
            {renderFlyout(cat.id, cat.label, cat.accentColor)}
          </button>
        );
      })}

      {/* Expand / collapse toggle — pinned to the bottom of the rail. */}
      <button
        data-testid="pof-sidebar-l1-toggle"
        onClick={toggleExpanded}
        onMouseEnter={() => setFlyout(TOGGLE_FLYOUT_ID)}
        onMouseLeave={() => setFlyout((f) => (f === TOGGLE_FLYOUT_ID ? null : f))}
        onFocus={() => setFlyout(TOGGLE_FLYOUT_ID)}
        onBlur={() => setFlyout((f) => (f === TOGGLE_FLYOUT_ID ? null : f))}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={expanded}
        className={`
          relative mt-auto h-10 flex items-center rounded-lg transition-colors duration-base
          focus-ring text-text-muted hover:bg-surface hover:text-text
          ${expanded ? 'w-full justify-start gap-3 px-2' : 'w-10 justify-center'}
        `}
      >
        {expanded ? (
          <PanelLeftClose className="w-5 h-5 flex-shrink-0" />
        ) : (
          <PanelLeftOpen className="w-5 h-5 flex-shrink-0" />
        )}
        {expanded && <span className="text-xs font-medium truncate">Collapse</span>}
        {renderFlyout(TOGGLE_FLYOUT_ID, 'Expand sidebar', 'var(--text)')}
      </button>
    </motion.nav>
  );
}
