'use client';

import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AFFIX_CATEGORY_COLORS, STATUS_SUBDUED,
  withOpacity, OPACITY_30, OPACITY_25, OPACITY_8, OPACITY_20, OPACITY_5,
} from '@/lib/chart-colors';
import { BlueprintPanel, NeonBar } from '../../_design';
import type { ItemData } from '../data';
import { RARITY_COLORS } from '../data';

interface ItemDetailDrawerProps {
  item: ItemData | null;
  onClose: () => void;
}

export function ItemDetailDrawer({ item, onClose }: ItemDetailDrawerProps) {
  const color = item ? (RARITY_COLORS[item.rarity] ?? STATUS_SUBDUED) : STATUS_SUBDUED;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <BlueprintPanel color={color} className="p-4 border-2 space-y-3" noBrackets={false}>
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] z-10"
              style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-text"
                  style={{ textShadow: `0 0 14px ${withOpacity(color, OPACITY_30)}` }}>{item.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded border"
                    style={{ color, borderColor: `${withOpacity(color, OPACITY_25)}`, backgroundColor: `${withOpacity(color, OPACITY_8)}` }}>
                    {item.rarity}
                  </span>
                  <span className="text-xs font-mono text-text-muted">{item.type}</span>
                  <span className="text-xs font-mono text-text-muted/60">{item.subtype}</span>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close detail"
                className="p-1.5 rounded-lg border border-border/40 text-text-muted hover:text-text hover:bg-surface-hover transition-colors flex-shrink-0 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stat bars */}
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Stats</p>
              {item.stats.map(s => {
                const pct = s.numericValue != null && s.maxValue
                  ? Math.min(100, (s.numericValue / s.maxValue) * 100) : null;
                return (
                  <div key={s.label} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">{s.label}</span>
                      <span className="text-xs font-mono font-bold text-text">{s.value}</span>
                    </div>
                    {pct != null && <NeonBar pct={pct} color={color} height={5} />}
                  </div>
                );
              })}
            </div>

            {/* Description */}
            <p className="text-sm text-text-muted italic leading-relaxed">
              &ldquo;{item.description}&rdquo;
            </p>

            {/* Effect */}
            {item.effect && (
              <div className="p-2.5 rounded-lg border text-sm" style={{ borderColor: `${withOpacity(color, OPACITY_20)}`, backgroundColor: `${withOpacity(color, OPACITY_5)}` }}>
                <span className="font-bold mr-1" style={{ color }}>Effect:</span>
                <span className="text-text">{item.effect}</span>
              </div>
            )}

            {/* Affixes */}
            {item.affixes && item.affixes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Affixes</p>
                {item.affixes.map(a => (
                  <div key={a.name} className="flex items-center gap-2 px-2 py-1 rounded-md"
                    style={{ backgroundColor: `${withOpacity(AFFIX_CATEGORY_COLORS[a.category], OPACITY_8)}` }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: AFFIX_CATEGORY_COLORS[a.category] }} />
                    <span className="text-xs font-medium text-text">{a.name}</span>
                    <span className="text-xs text-text-muted ml-auto font-mono">{a.stat}</span>
                  </div>
                ))}
              </div>
            )}
          </BlueprintPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
