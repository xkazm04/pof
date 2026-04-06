'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, RotateCcw, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_WARNING, OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_15, OPACITY_25, OPACITY_37, GLOW_MD, withOpacity } from '@/lib/chart-colors';
import { MOTION_CONFIG } from '@/lib/motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../design';
import {
  ACCENT, BLUEPRINT_PROPERTIES, PROPERTY_CATEGORIES, PROPERTY_CAT_COLORS,
  type BlueprintProperty,
} from '../data';

export function PropertyInspector() {
  const [propSearch, setPropSearch] = useState('');
  const [properties, setProperties] = useState<BlueprintProperty[]>(() => BLUEPRINT_PROPERTIES.map(p => ({ ...p })));
  const [highlightedProps, setHighlightedProps] = useState<Set<string>>(new Set());
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const handlePropertyChange = useCallback((name: string, value: number) => {
    setProperties(prev => prev.map(p => {
      if (p.name !== name) return p;
      const isModified = value !== p.defaultVal;
      return { ...p, current: value, isModified };
    }));
    setHighlightedProps(prev => { const next = new Set(prev); next.add(name); return next; });
    const existing = highlightTimers.current.get(name);
    if (existing) clearTimeout(existing);
    highlightTimers.current.set(name, setTimeout(() => {
      setHighlightedProps(prev => { const next = new Set(prev); next.delete(name); return next; });
      highlightTimers.current.delete(name);
    }, 2000));
  }, []);

  useEffect(() => () => {
    for (const t of highlightTimers.current.values()) clearTimeout(t);
  }, []);

  const filteredProperties = useMemo(() => {
    if (!propSearch) return properties;
    const q = propSearch.toLowerCase();
    return properties.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [propSearch, properties]);

  const modifiedCount = properties.filter(p => p.isModified).length;
  const defaultCount = properties.filter(p => !p.isModified).length;

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

      <div className="space-y-4">
        {PROPERTY_CATEGORIES.map((cat) => {
          const catProps = filteredProperties.filter((p) => p.category === cat);
          if (catProps.length === 0) return null;
          const catColor = PROPERTY_CAT_COLORS[cat];
          const isCollapsed = collapsedCats.has(cat) && !propSearch;
          return (
            <div key={cat}>
              {/* Category header with accent line — clickable to collapse */}
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-2 mb-2 pb-1.5 border-b w-full text-left cursor-pointer group transition-colors"
                style={{ borderColor: withOpacity(catColor, OPACITY_12) }}
              >
                <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
                  <ChevronRight className="w-3 h-3" style={{ color: catColor }} />
                </motion.div>
                <span className="w-1 h-3 rounded-full" style={{ backgroundColor: catColor, boxShadow: `0 0 6px ${withOpacity(catColor, OPACITY_37)}` }} />
                <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] group-hover:brightness-125 transition-all" style={{ color: catColor }}>{cat}</span>
                <span className="text-xs font-mono text-text-muted ml-auto">{catProps.length} props</span>
              </button>

              <AnimatePresence initial={false}>
              {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
              <div className="space-y-px">
                {catProps.map((prop, i) => {
                  const isHighlighted = highlightedProps.has(prop.name);
                  const isNumeric = typeof prop.current === 'number' && typeof prop.defaultVal === 'number';
                  return (
                    <motion.div
                      key={prop.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * MOTION_CONFIG.stagger, ...MOTION_CONFIG.standard }}
                      className="flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs font-mono transition-all group"
                      style={{
                        backgroundColor: isHighlighted ? withOpacity(STATUS_WARNING, OPACITY_5) : 'transparent',
                        boxShadow: isHighlighted
                          ? `0 0 12px ${withOpacity(STATUS_WARNING, OPACITY_8)}, inset 0 0 12px ${withOpacity(STATUS_WARNING, OPACITY_5)}`
                          : 'none',
                      }}
                    >
                      {/* Property name */}
                      <span className="text-text-muted w-28 truncate flex-shrink-0 group-hover:text-text transition-colors">
                        {prop.name}
                      </span>

                      {/* Slider */}
                      {isNumeric && (
                        <div className="w-20 flex-shrink-0">
                          <input
                            type="range"
                            min={0}
                            max={Math.max(Number(prop.defaultVal) * 3, Number(prop.current) * 1.5)}
                            step={Number(prop.defaultVal) < 10 ? 0.05 : 1}
                            value={Number(prop.current)}
                            onChange={(e) => handlePropertyChange(prop.name, Number(e.target.value))}
                            className="w-full h-1 rounded-full appearance-none cursor-pointer"
                            style={{ accentColor: isHighlighted ? STATUS_WARNING : catColor }}
                          />
                        </div>
                      )}

                      {/* Value */}
                      <span className="font-bold min-w-[48px] tabular-nums" style={{
                        color: prop.isModified ? STATUS_WARNING : 'var(--text-muted)',
                        textShadow: isHighlighted ? `${GLOW_MD} ${withOpacity(STATUS_WARNING, OPACITY_25)}` : 'none',
                      }}>
                        {typeof prop.current === 'number' ? prop.current.toFixed(prop.current % 1 ? 2 : 0) : String(prop.current)}
                      </span>

                      {/* Default / Modified indicator */}
                      {prop.isModified ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-text-muted opacity-40 flex items-center gap-1">
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span className="line-through">{String(prop.defaultVal)}</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${withOpacity(STATUS_WARNING, OPACITY_8)}`,
                              color: STATUS_WARNING,
                              border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_15)}`,
                            }}>
                            Mod
                          </span>
                        </div>
                      ) : (
                        <span className="ml-auto text-[9px] font-bold text-text-muted opacity-30 uppercase tracking-wider">
                          Default
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              </motion.div>
              )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ── Summary Bar ──────────────────────────────────────────────────── */}
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
