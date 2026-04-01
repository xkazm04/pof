'use client';

import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_CYAN, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import type { FeelPreset, FeelComparison } from '@/lib/character-feel-optimizer';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ComparisonRow } from './ComparisonRow';
import { CATEGORY_COLORS } from './constants';

/* ── A/B Comparison Panel ────────────────────────────────────────────────── */

interface ComparisonPanelProps {
  selectedPreset: FeelPreset;
  comparePreset: FeelPreset;
  comparison: FeelComparison[];
  comparisonByCategory: Map<string, FeelComparison[]>;
  showComparison: boolean;
  onToggle: () => void;
}

export function ComparisonPanel({
  selectedPreset,
  comparePreset,
  comparison,
  comparisonByCategory,
  showComparison,
  onToggle,
}: ComparisonPanelProps) {
  return (
    <BlueprintPanel color={ACCENT_CYAN} className="p-3">
      <button onClick={onToggle} className="w-full flex items-center gap-2 mb-2">
        <SectionHeader icon={ArrowLeftRight} label="A/B Comparison" color={ACCENT_CYAN} />
        <motion.div animate={{ rotate: showComparison ? 180 : 0 }} className="ml-auto">
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </motion.div>
      </button>

      <AnimatePresence>
        {showComparison && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 text-xs font-mono uppercase tracking-[0.15em] font-bold">
              <span className="w-28 flex-shrink-0 text-text-muted">Parameter</span>
              <div className="flex-1 flex items-center gap-1">
                <span className="w-12 text-right" style={{ color: selectedPreset.color }}>
                  {selectedPreset.name.split(' ')[0]}
                </span>
                <span className="flex-1 text-center text-text-muted">Range</span>
                <span className="w-12" style={{ color: comparePreset.color }}>
                  {comparePreset.name.split(' ')[0]}
                </span>
              </div>
              <span className="w-14 text-right text-text-muted flex-shrink-0">Delta</span>
            </div>

            {/* Category groups */}
            {Array.from(comparisonByCategory.entries()).map(([cat, items]) => {
              const catColor = CATEGORY_COLORS[cat];
              return (
                <div key={cat} className="mb-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] px-2 py-1" style={{ color: catColor }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ backgroundColor: catColor }} />
                    {cat}
                  </div>
                  {items.map((item) => (
                    <ComparisonRow key={item.field} item={item} colorA={selectedPreset.color} colorB={comparePreset.color} />
                  ))}
                </div>
              );
            })}

            {/* Summary stats */}
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/30 px-2 text-xs font-mono text-text-muted">
              <span>
                Faster: <span className="font-bold" style={{ color: STATUS_SUCCESS }}>
                  {comparison.filter((c) => c.category === 'Movement' && c.delta > 0).length}
                </span> params
              </span>
              <span>
                Slower: <span className="font-bold" style={{ color: STATUS_ERROR }}>
                  {comparison.filter((c) => c.category === 'Movement' && c.delta < 0).length}
                </span> params
              </span>
              <span>
                Total changes: <span className="font-bold" style={{ color: STATUS_WARNING }}>
                  {comparison.filter((c) => c.delta !== 0).length}
                </span>/{comparison.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BlueprintPanel>
  );
}
