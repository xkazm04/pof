'use client';

import { forwardRef, useCallback, useRef, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { OVERLAY_WHITE } from '@/lib/chart-colors';

/**
 * Underline-style tab bar — one reusable primitive for the bottom-border tab
 * pattern (active text + a framer-motion sliding underline) that previously
 * lived as three near-identical hand-rolled copies in the Game Director module
 * (`TabButton`, `SubTab`, and the inline regression sub-tabs). Distinct from the
 * filled-pill `SubTabNavigation` in `core-engine/unique-tabs/_shared`.
 *
 * Renders an accessible `role="tablist"` with roving tabindex and arrow / Home /
 * End keyboard navigation, so styling, motion, and focus handling stay
 * consistent across every bar that adopts it.
 */

export interface TabBadge {
  /** Count to display. The pill is hidden when `count` is ≤ 0. */
  count: number;
  /**
   * Pill color. When set, renders a filled "alert" pill with white text (e.g.
   * open criticals, active regression alerts). When omitted, renders a neutral
   * count chip (`bg-border` / `text-text-muted`).
   */
  color?: string;
  /** Accessible label + tooltip for the pill. Strongly recommended when `color` is set. */
  label?: string;
}

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  /** Optional leading icon. */
  icon?: LucideIcon;
  /** Optional trailing count pill. */
  badge?: TabBadge;
}

export interface TabBarProps<T extends string = string> {
  tabs: ReadonlyArray<TabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  /**
   * Unique framer-motion `layoutId` for the sliding underline. Must differ
   * between independent TabBars rendered on the same screen, otherwise the
   * underline animates across them.
   */
  layoutId: string;
  /** Underline + active-tab accent color. */
  accent: string;
  /** Vertical padding density. `'comfortable'` = `py-2` (default), `'compact'` = `py-1.5`. */
  density?: 'comfortable' | 'compact';
  /** Accessible name for the tablist. Defaults to "Tab navigation". */
  ariaLabel?: string;
  /** Extra classes appended to the tablist container. */
  className?: string;
}

export function TabBar<T extends string = string>({
  tabs,
  activeId,
  onChange,
  layoutId,
  accent,
  density = 'comfortable',
  ariaLabel = 'Tab navigation',
  className,
}: TabBarProps<T>) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const hasActive = tabs.some((t) => t.id === activeId);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, index: number) => {
      let next: number | null = null;
      if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next !== null) {
        e.preventDefault();
        buttonsRef.current[next]?.focus();
        onChange(tabs[next].id);
      }
    },
    [tabs, onChange],
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 border-b border-border${className ? ` ${className}` : ''}`}
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab.id}
          ref={(el) => {
            buttonsRef.current[i] = el;
          }}
          tab={tab}
          active={activeId === tab.id}
          accent={accent}
          layoutId={layoutId}
          density={density}
          // Roving tabindex: only the active tab (or the first when none is
          // active) participates in the tab order.
          tabIndex={activeId === tab.id || (!hasActive && i === 0) ? 0 : -1}
          onSelect={() => onChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        />
      ))}
    </div>
  );
}

interface TabProps {
  tab: TabItem;
  active: boolean;
  accent: string;
  layoutId: string;
  density: 'comfortable' | 'compact';
  tabIndex: number;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { tab, active, accent, layoutId, density, tabIndex, onSelect, onKeyDown },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const Icon = tab.icon;
  const badge = tab.badge;
  const pad = density === 'compact' ? 'py-1.5' : 'py-2';

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={active}
      tabIndex={tabIndex}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`focus-ring rounded-sm inline-flex items-center gap-1.5 px-3 ${pad} text-sm font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {tab.label}
      {badge && badge.count > 0 && <TabBadgePill badge={badge} />}
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: accent }}
          transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
    </button>
  );
});

function TabBadgePill({ badge }: { badge: TabBadge }) {
  if (badge.color) {
    return (
      <span
        className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-bold"
        style={{ backgroundColor: badge.color, color: OVERLAY_WHITE }}
        aria-label={badge.label}
        title={badge.label}
      >
        {badge.count}
      </span>
    );
  }
  return (
    <span className="text-xs px-1 py-0.5 rounded bg-border text-text-muted">{badge.count}</span>
  );
}
