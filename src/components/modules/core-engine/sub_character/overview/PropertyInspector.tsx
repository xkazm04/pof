'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { STATUS_WARNING, OPACITY_25, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_shared/design';
import {
  ACCENT, BLUEPRINT_PROPERTIES, PROPERTY_CATEGORIES, PROPERTY_CAT_COLORS,
  type BlueprintProperty,
} from '../_shared/data';
import { PropertyColumn } from './PropertyColumn';

/**
 * 3-column property inspector — one column per category (Movement | Combat | Camera).
 * Each column independently collapsible (collapse ignored while a search is active).
 */
export function PropertyInspector() {
  const [propSearch, setPropSearch] = useState('');
  const [properties, setProperties] = useState<BlueprintProperty[]>(() =>
    BLUEPRINT_PROPERTIES.map((p) => ({ ...p })),
  );
  const [highlightedProps, setHighlightedProps] = useState<Set<string>>(new Set());
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const handlePropertyChange = useCallback((name: string, value: number) => {
    setProperties((prev) =>
      prev.map((p) => (p.name === name ? { ...p, current: value, isModified: value !== p.defaultVal } : p)),
    );
    setHighlightedProps((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
    const existing = highlightTimers.current.get(name);
    if (existing) clearTimeout(existing);
    highlightTimers.current.set(
      name,
      setTimeout(() => {
        setHighlightedProps((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
        highlightTimers.current.delete(name);
      }, 2000),
    );
  }, []);

  useEffect(
    () => () => {
      for (const t of highlightTimers.current.values()) clearTimeout(t);
    },
    [],
  );

  const filteredProperties = useMemo(() => {
    if (!propSearch) return properties;
    const q = propSearch.toLowerCase();
    return properties.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [propSearch, properties]);

  const modifiedCount = properties.filter((p) => p.isModified).length;
  const defaultCount = properties.filter((p) => !p.isModified).length;

  return (
    <BlueprintPanel className="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={SlidersHorizontal} label="Property Inspector" color={ACCENT} />
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={propSearch}
            onChange={(e) => setPropSearch(e.target.value)}
            className="text-xs font-mono pl-7 pr-3 py-1.5 rounded-md bg-surface border border-border/30 text-text placeholder:text-text-muted/40 focus:outline-none w-40 transition-colors"
            style={{ borderColor: propSearch ? withOpacity(ACCENT, OPACITY_25) : undefined }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PROPERTY_CATEGORIES.map((cat) => (
          <PropertyColumn
            key={cat}
            category={cat}
            catColor={PROPERTY_CAT_COLORS[cat]}
            properties={filteredProperties.filter((p) => p.category === cat)}
            isCollapsed={collapsedCats.has(cat) && !propSearch}
            highlightedProps={highlightedProps}
            onToggleCollapse={toggleCategory}
            onChange={handlePropertyChange}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/15">
        <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
          <span className="font-bold text-text">{properties.length}</span> properties
        </div>
        <div className="flex-1 max-w-32">
          <NeonBar pct={(modifiedCount / properties.length) * 100} color={STATUS_WARNING} height={3} />
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_WARNING }} />
            <span style={{ color: STATUS_WARNING }}>{modifiedCount}</span>
            <span className="text-text-muted">modified</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted opacity-40" />
            <span className="text-text-muted">{defaultCount} default</span>
          </span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
