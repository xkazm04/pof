'use client';

import { useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  OPACITY_20, OPACITY_30, OPACITY_37,
  withOpacity,
} from '@/lib/chart-colors';

/* ── TabButtonGroup ──────────────────────────────────────────────────────── */

export interface TabButtonGroupItem {
  value: string;
  label: string;
  /** Per-item accent color; when set, unselected items show muted text */
  color?: string;
}

export interface TabButtonGroupProps {
  items: TabButtonGroupItem[];
  selected: string | null;
  onSelect: (value: string) => void;
  accent: string;
  ariaLabel: string;
  className?: string;
}

export function TabButtonGroup({ items, selected, onSelect, accent, ariaLabel, className }: TabButtonGroupProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = items.length - 1;
    if (nextIndex !== null) {
      e.preventDefault();
      buttonsRef.current[nextIndex]?.focus();
      onSelect(items[nextIndex].value);
    }
  }, [items, onSelect]);

  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex gap-1${className ? ` ${className}` : ''}`}>
      {items.map((item, i) => {
        const isSelected = selected === item.value;
        const itemColor = item.color ?? accent;

        return (
          <button
            key={item.value}
            ref={el => { buttonsRef.current[i] = el; }}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected || (selected === null && i === 0) ? 0 : -1}
            onClick={() => onSelect(item.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
            style={{
              borderColor: isSelected
                ? (item.color ? withOpacity(itemColor, OPACITY_37) : withOpacity(accent, OPACITY_30))
                : (item.color ? 'var(--border)' : withOpacity(accent, OPACITY_30)),
              backgroundColor: isSelected ? withOpacity(itemColor, OPACITY_20) : 'transparent',
              color: item.color ? (isSelected ? itemColor : 'var(--text-muted)') : accent,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── SubTabNavigation ────────────────────────────────────────────────────── */

export interface SubTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export interface SubTabNavigationProps {
  tabs: SubTab[];
  activeTabId: string;
  onChange: (id: string) => void;
  accent: string;
  /** Accessible name for the tablist. Defaults to "Sub-tab navigation". */
  ariaLabel?: string;
}

export function SubTabNavigation({ tabs, activeTabId, onChange, accent, ariaLabel = 'Sub-tab navigation' }: SubTabNavigationProps) {
  const prefersReduced = useReducedMotion();
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const hasActive = tabs.some(t => t.id === activeTabId);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex !== null) {
      e.preventDefault();
      buttonsRef.current[nextIndex]?.focus();
      onChange(tabs[nextIndex].id);
    }
  }, [tabs, onChange]);

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 mb-2 border-b border-border/40 pb-1.5 overflow-x-auto custom-scrollbar">
      {tabs.map((tab, i) => {
        const isActive = activeTabId === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            ref={el => { buttonsRef.current[i] = el; }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive || (!hasActive && i === 0) ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`
              relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold
              transition-all duration-300 focus:outline-none whitespace-nowrap
              ${isActive ? 'text-white' : 'text-text-muted hover:text-text hover:bg-surface/50'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeSubTabBg"
                className="absolute inset-0 rounded-lg opacity-20"
                style={{ backgroundColor: accent }}
                transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }}
              />
            )}
            {Icon && (
              <Icon
                className="w-3.5 h-3.5 relative z-10 transition-colors duration-300"
                style={{ color: isActive ? accent : 'currentColor' }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
