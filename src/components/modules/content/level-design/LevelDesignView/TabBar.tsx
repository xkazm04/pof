'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Map } from 'lucide-react';

export function ScrollableTabBar({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateOverflow();
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateOverflow]);

  // WAI-ARIA tabs: arrows / Home / End move focus AND selection (automatic activation).
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const tabs = Array.from(scrollRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const idx = tabs.indexOf((e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]') as HTMLButtonElement);
    if (idx < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : e.key === 'ArrowRight' ? (idx + 1) % tabs.length
      : (idx - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  }, []);

  return (
    <div className="relative border-b border-border">
      {/* Left fade */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-r from-surface-deep to-transparent" />
      )}
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Level design views"
        onKeyDown={onKeyDown}
        onScroll={updateOverflow}
        className="flex items-center gap-1 px-5 overflow-x-auto scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {children}
      </div>
      {/* Right fade */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-l from-surface-deep to-transparent" />
      )}
    </div>
  );
}

export function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
  accent,
  badgeCount,
  badgeColor,
}: {
  label: string;
  icon: typeof Map;
  active: boolean;
  onClick: () => void;
  accent: string;
  badgeCount?: number;
  badgeColor?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative whitespace-nowrap flex-shrink-0 ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
      style={{ scrollSnapAlign: 'start' }}
    >
      <Icon className="w-3 h-3" />
      {label}
      {badgeCount && badgeCount > 0 && badgeColor ? (
        <span
          className="ml-0.5 px-1.5 py-0.5 rounded-full text-2xs font-mono font-bold leading-none"
          style={{
            backgroundColor: `${badgeColor}20`,
            color: badgeColor,
            border: `1px solid ${badgeColor}40`,
          }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      ) : null}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: accent }}
        />
      )}
    </button>
  );
}
