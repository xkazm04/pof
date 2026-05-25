'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CATEGORIES } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';
import type { CategoryId } from '@/types/modules';

const ACTIVE_INDICATOR_ID = 'sidebar-l1-active-indicator';

export function SidebarL1() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const setActiveCategory = useNavigationStore((s) => s.setActiveCategory);
  const prefersReduced = useReducedMotion();

  const handleClick = (id: CategoryId) => {
    if (activeCategory === id) {
      setActiveCategory(null);
    } else {
      setActiveCategory(id);
    }
  };

  return (
    <nav className="relative w-14 flex flex-col items-center py-3 gap-1 border-r border-border bg-background" aria-label="Module categories" style={{ ['--focus-accent' as string]: 'var(--setup)' }}>
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            data-testid={`pof-sidebar-nav-item-${cat.id}`}
            onClick={() => handleClick(cat.id)}
            aria-label={cat.label}
            aria-pressed={isActive}
            className={`
              relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-base
              focus-ring
              ${isActive
                ? 'bg-surface-hover'
                : 'hover:bg-surface'
              }
            `}
            title={cat.label}
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
              className="w-5 h-5 transition-colors duration-base"
              style={{ color: isActive ? cat.accentColor : 'var(--text-muted)' }}
            />
          </button>
        );
      })}
    </nav>
  );
}
