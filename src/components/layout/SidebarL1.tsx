'use client';

import { CATEGORIES } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';
import type { CategoryId } from '@/types/modules';

export function SidebarL1() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const setActiveCategory = useNavigationStore((s) => s.setActiveCategory);

  const handleClick = (id: CategoryId) => {
    if (activeCategory === id) {
      setActiveCategory(null);
    } else {
      setActiveCategory(id);
    }
  };

  return (
    <div className="w-14 flex flex-col items-center py-3 gap-1 border-r border-border bg-background">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => handleClick(cat.id)}
            className={`
              relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200
              ${isActive
                ? 'bg-surface-hover'
                : 'hover:bg-surface'
              }
            `}
            title={cat.label}
          >
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                style={{ backgroundColor: cat.accentColor }}
              />
            )}
            <Icon
              className="w-5 h-5 transition-colors duration-200"
              style={{ color: isActive ? cat.accentColor : 'var(--text-muted)' }}
            />
          </button>
        );
      })}
    </div>
  );
}
