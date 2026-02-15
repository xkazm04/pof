'use client';

import { useMemo } from 'react';
import { CATEGORIES } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';
import type { CategoryId } from '@/types/modules';

// Button height (h-10 = 40px) + gap-1 (4px) = 44px stride
const BUTTON_STRIDE = 44;
// py-3 = 12px top padding, center indicator (h-5 = 20px) in button (h-10 = 40px) → offset 10px
const TOP_OFFSET = 22;

export function SidebarL1() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const setActiveCategory = useNavigationStore((s) => s.setActiveCategory);

  const activeIndex = useMemo(
    () => CATEGORIES.findIndex((c) => c.id === activeCategory),
    [activeCategory],
  );

  const activeAccent = activeIndex >= 0 ? CATEGORIES[activeIndex].accentColor : undefined;

  const handleClick = (id: CategoryId) => {
    if (activeCategory === id) {
      setActiveCategory(null);
    } else {
      setActiveCategory(id);
    }
  };

  return (
    <nav className="relative w-14 flex flex-col items-center py-3 gap-1 border-r border-border bg-background" aria-label="Module categories">
      {/* Sliding active indicator */}
      <div
        className="absolute left-0 w-[3px] h-5 rounded-r-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          transform: `translateY(${TOP_OFFSET + activeIndex * BUTTON_STRIDE}px)`,
          backgroundColor: activeAccent ?? 'transparent',
          opacity: activeIndex >= 0 ? 1 : 0,
        }}
      />

      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => handleClick(cat.id)}
            aria-label={cat.label}
            aria-pressed={isActive}
            className={`
              relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-base
              ${isActive
                ? 'bg-surface-hover'
                : 'hover:bg-surface'
              }
            `}
            title={cat.label}
          >
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
