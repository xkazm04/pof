'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { Radar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { EVALUATOR_TAB_INFO } from '@/lib/evaluator/tab-glossary';
import { type TabId } from './types';

export function TabDivider({ label }: { label?: string } = {}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0 mx-1" aria-hidden="true">
      <div className="w-px h-4 bg-border" />
      {label && (
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium whitespace-nowrap pr-0.5">
          {label}
        </span>
      )}
    </div>
  );
}

export function ScrollableTabBar({ children, tabBarRef }: { children: React.ReactNode; tabBarRef: React.RefObject<HTMLDivElement | null> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative border-b border-border">
      {/* Left fade + chevron */}
      {canScrollLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--background), transparent)' }} />
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 flex items-center px-0.5 text-text-muted hover:text-text transition-colors"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Scrollable tab container */}
      <div
        ref={(node) => {
          scrollRef.current = node;
          if (tabBarRef) {
            const mutableTabBarRef = tabBarRef as React.MutableRefObject<HTMLDivElement | null>;
            mutableTabBarRef.current = node;
          }
        }}
        role="tablist"
        aria-label="Evaluator tabs"
        className="flex items-center gap-1 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>

      {/* Right fade + chevron */}
      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, var(--background), transparent)' }} />
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 flex items-center px-0.5 text-text-muted hover:text-text transition-colors"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export function TabButton({
  tabId,
  icon: Icon,
  active,
  onClick,
  onArrowNav,
}: {
  tabId: TabId;
  icon: typeof Radar;
  active: boolean;
  onClick: () => void;
  onArrowNav?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  // Label, plain alias, and description all come from the single glossary so the
  // chip text, its tooltip, and the subtitle never drift apart.
  const info = EVALUATOR_TAB_INFO[tabId];
  return (
    <Tooltip content={`${info.plain} — ${info.description}`} multiline placement="bottom">
      <button
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        onClick={onClick}
        onKeyDown={onArrowNav}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
          active ? 'text-text' : 'text-text-muted hover:text-text'
        }`}
      >
        <Icon className="w-3 h-3" />
        {info.label}
        {active && (
          <span
            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
            style={{ backgroundColor: MODULE_COLORS.evaluator }}
          />
        )}
      </button>
    </Tooltip>
  );
}
