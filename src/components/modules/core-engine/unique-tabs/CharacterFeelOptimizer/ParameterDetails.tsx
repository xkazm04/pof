'use client';

import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FEEL_FIELD_META, getNestedValue,
  type FeelPreset,
} from '@/lib/character-feel-optimizer';
import { MOTION_CONFIG } from '@/lib/motion';
import { NeonBar } from '../_design';
import { CATEGORY_ICONS, CATEGORY_COLORS } from './constants';

/* ── Parameter Details Panel ─────────────────────────────────────────────── */

export function ParameterDetails({ preset }: { preset: FeelPreset }) {
  const [expandedCat, setExpandedCat] = useState<string | null>('Movement');

  const categories = useMemo(() => {
    const cats = new Map<string, typeof FEEL_FIELD_META>();
    for (const field of FEEL_FIELD_META) {
      const arr = cats.get(field.category) ?? [];
      arr.push(field);
      cats.set(field.category, arr);
    }
    return cats;
  }, []);

  return (
    <div className="space-y-1">
      {Array.from(categories.entries()).map(([cat, fields]) => {
        const isExpanded = expandedCat === cat;
        const catColor = CATEGORY_COLORS[cat];
        const CatIcon = CATEGORY_ICONS[cat];
        return (
          <div key={cat}>
            <button
              onClick={() => setExpandedCat(isExpanded ? null : cat)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface/30 transition-colors"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={MOTION_CONFIG.spring}
              >
                <ChevronRight className="w-3 h-3 text-text-muted" />
              </motion.div>
              {CatIcon && <CatIcon className="w-3.5 h-3.5" style={{ color: catColor }} />}
              <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: catColor }}>
                {cat}
              </span>
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted ml-auto">
                {fields.length} params
              </span>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={MOTION_CONFIG.standard}
                  className="overflow-hidden"
                >
                  <div className="pl-6 space-y-0.5 pb-1">
                    {fields.map((field) => {
                      const value = getNestedValue(preset.profile, field.key);
                      const ratKey = field.key.split('.').pop() ?? field.key;
                      const rationale = preset.rationale[ratKey] ?? preset.rationale[field.key];
                      const pct = ((value - field.min) / (field.max - field.min)) * 100;
                      const fmt = field.unit === '%' ? `${(value * 100).toFixed(0)}%`
                        : (field.unit === 'x' || field.unit === 's') ? value.toFixed(2)
                          : value % 1 !== 0 ? value.toFixed(1) : String(value);

                      return (
                        <div key={field.key} className="px-2 py-1 rounded hover:bg-surface/20 transition-colors group">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-text-muted w-28 truncate flex-shrink-0">{field.label}</span>
                            <div className="flex-1">
                              <NeonBar pct={Math.min(Math.max(pct, 2), 100)} color={preset.color} height={6} glow />
                            </div>
                            <span className="font-bold w-14 text-right" style={{ color: preset.color }}>
                              {fmt}{field.unit && field.unit !== '%' ? ` ${field.unit}` : ''}
                            </span>
                          </div>
                          {rationale && (
                            <div className="text-xs font-mono text-text-muted mt-0.5 pl-0 opacity-0 group-hover:opacity-100 transition-opacity leading-relaxed">
                              {rationale}
                            </div>
                          )}
                        </div>
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
  );
}
