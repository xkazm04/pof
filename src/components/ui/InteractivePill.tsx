'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { OPACITY_12, OPACITY_37, withOpacity } from '@/lib/chart-colors';
import { SPRING, motionSafe } from '@/lib/motion';

/* ── InteractivePill ─────────────────────────────────────────────────────── */

export interface PillItem {
  id: string;
  label: string;
  /** Optional per-item accent — overrides the group accent when active. */
  color?: string;
}

export interface InteractivePillProps {
  items: PillItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  /** Accent color for the active pill (used when item has no color). */
  accent: string;
  /** Framer Motion layoutId prefix — must be unique per instance. */
  layoutId?: string;
}

/* ── MultiInteractivePill (multi-select toggle) ─────────────────────────── */

export interface MultiPillItem {
  id: string;
  label: string;
  /** Accent color when active. */
  color: string;
  /** Optional count badge shown beside the label. */
  count?: number;
}

export interface MultiInteractivePillProps {
  items: MultiPillItem[];
  /** Set of currently active item ids. Empty set = nothing selected. */
  activeIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

/**
 * Multi-select toggle pill row. Each pill independently toggles on/off with
 * its own accent color and optional count badge.
 */
export function MultiInteractivePill({
  items,
  activeIds,
  onToggle,
}: MultiInteractivePillProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex items-center gap-1.5">
      {items.map((item) => {
        const isActive = activeIds.has(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className="relative flex-1 text-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors focus:outline-none"
            style={{
              color: isActive ? item.color : 'var(--text-muted)',
            }}
          >
            <AnimatePresence initial={false}>
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 rounded-lg border"
                  style={{
                    backgroundColor: withOpacity(item.color, OPACITY_12),
                    borderColor: withOpacity(item.color, OPACITY_37),
                    boxShadow: `0 0 8px ${withOpacity(item.color, OPACITY_12)}`,
                  }}
                  transition={motionSafe(SPRING.snappy, prefersReduced)}
                />
              )}
            </AnimatePresence>
            <span className="relative z-10 flex items-center justify-center gap-1">
              {item.label}
              {item.count != null && (
                <span
                  className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] rounded-full text-2xs font-bold leading-none px-1"
                  style={{
                    backgroundColor: isActive
                      ? withOpacity(item.color, OPACITY_37)
                      : 'var(--surface-3, rgba(255,255,255,0.06))',
                    color: isActive ? item.color : 'var(--text-muted)',
                  }}
                >
                  {item.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── InteractivePill (single-select) ────────────────────────────────────── */

/**
 * Unified selector pill row with consistent sizing, Framer Motion animated
 * background slide, and uniform font styling across all selector groups.
 */
export function InteractivePill({
  items,
  activeIndex,
  onChange,
  accent,
  layoutId = 'pill',
}: InteractivePillProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex items-center gap-1.5">
      {items.map((item, i) => {
        const isActive = i === activeIndex;
        const color = item.color ?? accent;
        return (
          <button
            key={item.id}
            onClick={() => onChange(i)}
            className="relative flex-1 text-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors focus:outline-none"
            style={{
              color: isActive ? color : 'var(--text-muted)',
            }}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg border"
                style={{
                  backgroundColor: withOpacity(color, OPACITY_12),
                  borderColor: withOpacity(color, OPACITY_37),
                  boxShadow: `0 0 8px ${withOpacity(color, OPACITY_12)}`,
                }}
                transition={motionSafe(SPRING.snappy, prefersReduced)}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
