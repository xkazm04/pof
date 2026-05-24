'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { OPACITY_12, OPACITY_37, withOpacity } from '@/lib/chart-colors';
import type { BlueprintProperty } from '../_shared/data';
import { PropertyRow } from './PropertyRow';

interface Props {
  category: string;
  catColor: string;
  properties: BlueprintProperty[];
  isCollapsed: boolean;
  highlightedProps: Set<string>;
  onToggleCollapse: (cat: string) => void;
  onChange: (name: string, value: number) => void;
}

/** One column inside the 3-column PropertyInspector grid (Movement / Combat / Camera). */
export function PropertyColumn({
  category, catColor, properties, isCollapsed, highlightedProps, onToggleCollapse, onChange,
}: Props) {
  return (
    <div>
      <button
        onClick={() => onToggleCollapse(category)}
        className="flex items-center gap-2 mb-2 pb-1.5 border-b w-full text-left cursor-pointer group transition-colors"
        style={{ borderColor: withOpacity(catColor, OPACITY_12) }}
      >
        <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="w-3 h-3" style={{ color: catColor }} />
        </motion.div>
        <span
          className="w-1 h-3 rounded-full"
          style={{ backgroundColor: catColor, boxShadow: `0 0 6px ${withOpacity(catColor, OPACITY_37)}` }}
        />
        <span
          className="text-xs font-mono font-bold uppercase tracking-[0.2em] group-hover:brightness-125 transition-all"
          style={{ color: catColor }}
        >
          {category}
        </span>
        <span className="text-xs font-mono text-text-muted ml-auto">{properties.length} props</span>
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
              {properties.length === 0 ? (
                <p className="px-2.5 py-3 text-[11px] text-text-muted/60 italic">No matches</p>
              ) : (
                properties.map((prop, i) => (
                  <PropertyRow
                    key={prop.name}
                    prop={prop}
                    index={i}
                    isHighlighted={highlightedProps.has(prop.name)}
                    catColor={catColor}
                    onChange={onChange}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
