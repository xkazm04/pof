'use client';

import { motion } from 'framer-motion';

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
                  backgroundColor: `${color}20`,
                  borderColor: `${color}60`,
                  boxShadow: `0 0 8px ${color}20`,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
