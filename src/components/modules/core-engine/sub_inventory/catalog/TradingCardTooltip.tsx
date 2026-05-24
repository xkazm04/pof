'use client';

import { AFFIX_CATEGORY_COLORS,
  withOpacity, OPACITY_37, OPACITY_10, OPACITY_20, OPACITY_5, OPACITY_8,
} from '@/lib/chart-colors';
import { motion } from 'framer-motion';
import type { ItemData } from '../_shared/data';

/* ── Tooltip ───────────────────────────────────────────────────────────── */

export function TradingCardTooltip({ item, color }: { item: ItemData; color: string }) {
  return (
    <motion.div
      layoutId={`tooltip-${item.id}`}
      initial={{ opacity: 0, x: 10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="absolute left-full top-0 ml-2 z-50 w-64 rounded-xl shadow-2xl border-2 overflow-hidden"
      style={{ borderColor: `${withOpacity(color, OPACITY_37)}`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'var(--surface-deep)' }}
    >
      <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="p-3.5 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-text">{item.name}</h4>
          <p className="text-xs font-mono uppercase tracking-widest mt-0.5" style={{ color }}>{item.rarity} {item.subtype}</p>
        </div>
        <p className="text-xs text-text-muted italic leading-relaxed">{item.description}</p>
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Stats</p>
          {item.stats.map(s => {
            const pct = s.numericValue != null && s.maxValue ? Math.min(100, (s.numericValue / s.maxValue) * 100) : null;
            return (
              <div key={s.label} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{s.label}</span>
                  <span className="text-xs font-mono font-bold text-text">{s.value}</span>
                </div>
                {pct != null && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${withOpacity(color, OPACITY_10)}` }}>
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {item.effect && (
          <div className="p-2 rounded-lg border text-xs" style={{ borderColor: `${withOpacity(color, OPACITY_20)}`, backgroundColor: `${withOpacity(color, OPACITY_5)}` }}>
            <span className="font-bold mr-1" style={{ color }}>Effect:</span>
            <span className="text-text">{item.effect}</span>
          </div>
        )}
        {item.affixes && item.affixes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Affixes</p>
            {item.affixes.map(a => (
              <div key={a.name} className="flex items-center gap-2 px-2 py-1 rounded-md" style={{ backgroundColor: `${withOpacity(AFFIX_CATEGORY_COLORS[a.category], OPACITY_8)}` }}>
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: AFFIX_CATEGORY_COLORS[a.category] }} />
                <span className="text-xs font-medium text-text">{a.name}</span>
                <span className="text-xs text-text-muted ml-auto font-mono">{a.stat}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
