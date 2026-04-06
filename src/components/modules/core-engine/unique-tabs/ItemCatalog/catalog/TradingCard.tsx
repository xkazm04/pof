'use client';

import { useState, useCallback, useRef, forwardRef } from 'react';
import { Package } from 'lucide-react';
import Image from 'next/image';
import { AFFIX_CATEGORY_COLORS, OVERLAY_WHITE, STATUS_SUCCESS, STATUS_ERROR,
  withOpacity, OPACITY_37, OPACITY_10, OPACITY_20, OPACITY_5, OPACITY_8, OPACITY_25, OPACITY_12, OPACITY_30,
} from '@/lib/chart-colors';
import { motion, AnimatePresence } from 'framer-motion';
import { BlueprintPanel } from '../../_design';
import type { ItemData } from '../data';
import { RARITY_COLORS, ITEM_SETS } from '../data';

/* ── Pre-compute set membership ──────────────────────────────────────── */
const ITEM_SET_MAP = new Map<string, { setName: string; color: string }>();
for (const set of ITEM_SETS) {
  for (const piece of set.pieces) {
    ITEM_SET_MAP.set(piece.name, { setName: set.name, color: set.color });
  }
}

/* ── Power score ─────────────────────────────────────────────────────── */
function computePower(item: ItemData): number {
  return item.stats.reduce((s, st) => s + (st.numericValue ?? 0), 0) + (item.affixes?.length ?? 0) * 10;
}

/* ── Slot icon map ───────────────────────────────────────────────────── */
const SLOT_ICONS: Record<string, string> = {
  Sword: '\u2694', Bow: '\uD83C\uDFF9', Staff: '\uD83E\uDE84', Dagger: '\uD83D\uDDE1',
  Axe: '\uD83E\uDE93', Mace: '\u2692', Polearm: '\u26B1', Baton: '\u26A1',
  Helm: '\uD83E\uDDE2', Chestplate: '\uD83D\uDEE1', Greaves: '\uD83E\uDDBF', Boots: '\uD83D\uDC62',
  Shield: '\uD83D\uDEE1', Ring: '\uD83D\uDC8D', Amulet: '\uD83D\uDCFF',
  Potion: '\uD83E\uDDEA', Elixir: '\u2728',
};

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
        <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to bottom right, ${withOpacity(OVERLAY_WHITE, OPACITY_5)}, transparent)` }} />
        <div className="absolute -inset-[100%] -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" style={{ background: `linear-gradient(to right, transparent, ${withOpacity(OVERLAY_WHITE, OPACITY_10)}, transparent)` }} />

        {/* Header */}
        <div className="p-4 border-b relative" style={{ borderColor: `${withOpacity(color, OPACITY_20)}`, backgroundColor: `${withOpacity(color, OPACITY_8)}` }}>
          <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none opacity-50" style={{ backgroundColor: color }} />
          <div className="relative z-10 flex justify-between items-start">
            <div className="flex items-start gap-2">
              {/* Slot icon */}
              <span className="text-lg leading-none mt-0.5 opacity-70" role="img" aria-label={item.subtype}>
                {SLOT_ICONS[item.subtype] ?? '\uD83D\uDCE6'}
              </span>
              <div>
                <h3 className="text-sm font-bold text-text leading-tight" style={{ textShadow: `0 0 12px ${withOpacity(color, OPACITY_25)}` }}>{item.name}</h3>
                <p className="text-xs font-mono uppercase tracking-[0.15em] mt-1 opacity-80" style={{ color }}>{item.rarity} {item.subtype}</p>
              </div>
            </div>
            {/* Power badge */}
            <div className="flex flex-col items-center px-2 py-1 rounded-md border text-xs font-mono font-bold"
              style={{ borderColor: withOpacity(color, OPACITY_30), backgroundColor: withOpacity(color, OPACITY_12), color }}>
              <span className="text-xs opacity-60 uppercase">PWR</span>
              <span>{computePower(item)}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col gap-3 relative z-10 bg-surface/50">
          <div className="w-full h-24 rounded-lg bg-surface-deep border flex items-center justify-center relative overflow-hidden group-hover:border-text-muted/50 transition-colors" style={{ borderColor: `${withOpacity(color, OPACITY_12)}` }}>
            {item.imagePath ? (
              <Image src={item.imagePath} width={512} height={512} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                <Package className="w-10 h-10 opacity-30" style={{ color }} />
              </motion.div>
            )}
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ backgroundImage: `radial-gradient(circle at center, ${withOpacity(color, OPACITY_12)} 1px, transparent 1px)`, backgroundSize: '10px 10px' }} />
          </div>
          <div className="flex justify-around items-center py-2 border-y border-border/40">
            {item.stats.map(s => {
              const pct = s.numericValue != null && s.maxValue ? s.numericValue / s.maxValue : 0;
              const statColor = pct >= 0.7 ? STATUS_SUCCESS : pct <= 0.3 ? STATUS_ERROR : undefined;
              return (
                <div key={s.label} className="flex flex-col items-center">
                  <span className="text-xs uppercase font-mono tracking-[0.15em] text-text-muted">{s.label}</span>
                  <span className="text-sm font-mono font-bold mt-0.5" style={{ color: statColor ?? 'var(--text)', textShadow: `0 0 12px ${withOpacity(color, OPACITY_25)}` }}>{s.value}</span>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-text-muted italic leading-relaxed text-center">&ldquo;{item.description}&rdquo;</p>
          {item.effect && (
            <div className="mt-auto p-2.5 rounded-lg border text-sm font-medium text-text bg-surface-deep shadow-inner" style={{ borderColor: `${withOpacity(color, OPACITY_20)}`, backgroundColor: `${withOpacity(color, OPACITY_5)}` }}>
              <span className="font-bold mr-1" style={{ color }}>Equip:</span>
              <span>{item.effect}</span>
            </div>
          )}
          {/* Set indicator */}
          {(() => {
            const setInfo = ITEM_SET_MAP.get(item.name);
            if (!setInfo) return null;
            return (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono"
                style={{ borderColor: withOpacity(setInfo.color, OPACITY_25), backgroundColor: withOpacity(setInfo.color, OPACITY_8) }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: setInfo.color }} />
                <span style={{ color: setInfo.color }}>Set: {setInfo.setName}</span>
              </div>
            );
          })()}
        </div>
      </BlueprintPanel>

      <AnimatePresence>
        {showTooltip && <TradingCardTooltip item={item} color={color} />}
      </AnimatePresence>
    </motion.div>
  );
});
