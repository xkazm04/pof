'use client';

import { useState, useCallback, useRef, forwardRef } from 'react';
import { Package } from 'lucide-react';
import Image from 'next/image';
import { AFFIX_CATEGORY_COLORS } from '@/lib/chart-colors';
import { motion, AnimatePresence } from 'framer-motion';
import { BlueprintPanel } from '../_design';
import type { ItemData } from './data';
import { RARITY_COLORS } from './data';

/* ── Tooltip ───────────────────────────────────────────────────────────── */

function TradingCardTooltip({ item, color }: { item: ItemData; color: string }) {
  return (
    <motion.div
      layoutId={`tooltip-${item.id}`}
      initial={{ opacity: 0, x: 10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="absolute left-full top-0 ml-2 z-50 w-64 rounded-xl shadow-2xl border-2 overflow-hidden"
      style={{ borderColor: `${color}60`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'var(--surface-deep)' }}
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
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}15` }}>
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {item.effect && (
          <div className="p-2 rounded-lg border text-xs" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
            <span className="font-bold mr-1" style={{ color }}>Effect:</span>
            <span className="text-text">{item.effect}</span>
          </div>
        )}
        {item.affixes && item.affixes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Affixes</p>
            {item.affixes.map(a => (
              <div key={a.name} className="flex items-center gap-2 px-2 py-1 rounded-md" style={{ backgroundColor: `${AFFIX_CATEGORY_COLORS[a.category]}10` }}>
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

/* ── Trading Card ──────────────────────────────────────────────────────── */

interface TradingCardProps {
  item: ItemData;
  tabIndex?: number;
  onFocus?: () => void;
}

export const TradingCard = forwardRef<HTMLDivElement, TradingCardProps>(
function TradingCard({ item, tabIndex, onFocus: onFocusProp }, ref) {
  const color = RARITY_COLORS[item.rarity];
  const [showTooltip, setShowTooltip] = useState(false);
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setShowTooltip(true), 150);
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setShowTooltip(false);
  }, []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setShowTooltip(prev => !prev); }
    else if (e.key === 'Escape' && showTooltip) { e.preventDefault(); setShowTooltip(false); }
  }, [showTooltip]);
  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target.matches(':focus-visible')) setIsFocusVisible(true);
    onFocusProp?.();
  }, [onFocusProp]);
  const handleBlur = useCallback(() => { setIsFocusVisible(false); setShowTooltip(false); }, []);

  return (
    <motion.div ref={ref} layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }} whileHover={{ y: -5, scale: 1.02 }}
      tabIndex={tabIndex} role="gridcell" aria-label={`${item.name}, ${item.rarity} ${item.type}`}
      onKeyDown={handleKeyDown} onFocus={handleFocus} onBlur={handleBlur}
      className="group relative h-full"
      style={{ perspective: 1000, outline: isFocusVisible ? `2px solid ${color}` : 'none', outlineOffset: isFocusVisible ? '2px' : undefined }}
      onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
    >
      <BlueprintPanel color={color} className="h-full flex flex-col border-2 shadow-xl transition-all duration-300"
        noBrackets
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" />

        {/* Header */}
        <div className="p-4 border-b relative" style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}>
          <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none opacity-50" style={{ backgroundColor: color }} />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-text leading-tight" style={{ textShadow: `0 0 12px ${color}40` }}>{item.name}</h3>
              <p className="text-xs font-mono uppercase tracking-[0.15em] mt-1 opacity-80" style={{ color }}>{item.rarity} {item.subtype}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col gap-3 relative z-10 bg-surface/50">
          <div className="w-full h-24 rounded-lg bg-surface-deep border flex items-center justify-center relative overflow-hidden group-hover:border-text-muted/50 transition-colors" style={{ borderColor: `${color}20` }}>
            {item.imagePath ? (
              <Image src={item.imagePath} width={512} height={512} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                <Package className="w-10 h-10 opacity-30" style={{ color }} />
              </motion.div>
            )}
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ backgroundImage: `radial-gradient(circle at center, ${color}20 1px, transparent 1px)`, backgroundSize: '10px 10px' }} />
          </div>
          <div className="flex justify-around items-center py-2 border-y border-border/40">
            {item.stats.map(s => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="text-xs uppercase font-mono tracking-[0.15em] text-text-muted">{s.label}</span>
                <span className="text-sm font-mono font-bold text-text mt-0.5" style={{ textShadow: `0 0 12px ${color}40` }}>{s.value}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-text-muted italic leading-relaxed text-center">&ldquo;{item.description}&rdquo;</p>
          {item.effect && (
            <div className="mt-auto p-2.5 rounded-lg border text-sm font-medium text-text bg-surface-deep shadow-inner" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
              <span className="font-bold mr-1" style={{ color }}>Equip:</span>
              <span>{item.effect}</span>
            </div>
          )}
        </div>
      </BlueprintPanel>

      <AnimatePresence>
        {showTooltip && <TradingCardTooltip item={item} color={color} />}
      </AnimatePresence>
    </motion.div>
  );
});
