'use client';

import {
  Crown, Trash2, ToggleLeft, ToggleRight, Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO,
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_PURPLE,
  OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_20, OPACITY_25, OPACITY_30, OPACITY_37, OPACITY_50,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, NeonBar, CornerBrackets } from '../_design';
import { ACCENT } from './constants';
import { AFFIX_POOL, RARITY_COLORS, getItemLevelScaling } from './data';
import type { CraftedAffix, ItemBase } from './data';

interface ItemPreviewCardProps {
  selectedBase: ItemBase;
  craftedAffixes: CraftedAffix[];
  fullItemName: string;
  itemLevel: number;
  dragOverItem: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemoveAffix: (tag: string) => void;
  onUpdateMagnitude: (tag: string, mag: number) => void;
  onTogglePlacement: (tag: string) => void;
  onSetPreviewTag: (tag: string | null) => void;
  maxAffixes: number;
}

export function ItemPreviewCard({
  selectedBase, craftedAffixes, fullItemName, itemLevel,
  dragOverItem, onDragOver, onDragLeave, onDrop,
  onRemoveAffix, onUpdateMagnitude, onTogglePlacement,
  onSetPreviewTag, maxAffixes,
}: ItemPreviewCardProps) {
  const rarityColor = RARITY_COLORS[selectedBase.rarity];

  return (
    <BlueprintPanel color={ACCENT} className="p-4 relative overflow-hidden"
      noBrackets>
      <CornerBrackets color={rarityColor} />

      {/* Drop zone overlay */}
      <div className="relative z-[1]"
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>

        {/* Drop highlight */}
        {dragOverItem && (
          <div className="absolute inset-0 rounded-xl border-2 border-dashed pointer-events-none z-20"
            style={{ borderColor: withOpacity(STATUS_SUCCESS, OPACITY_37), backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_5) }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]"
                style={{ color: STATUS_SUCCESS }}>Drop affix here</span>
            </div>
          </div>
        )}

        {/* Item name */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ backgroundColor: withOpacity(rarityColor, OPACITY_8), border: `1px solid ${withOpacity(rarityColor, OPACITY_25)}` }}>
            {selectedBase.rarity === 'Legendary' && (
              <Crown className="w-4 h-4" style={{ color: RARITY_COLORS.Legendary }} />
            )}
            <span className="text-sm font-bold font-mono"
              style={{ color: rarityColor, textShadow: `0 0 12px ${withOpacity(rarityColor, OPACITY_25)}` }}>
              {fullItemName}
            </span>
          </div>
          <div className="text-xs text-text-muted mt-1 font-mono uppercase tracking-[0.15em]">
            {selectedBase.type} | <span style={{ color: rarityColor }}>{selectedBase.rarity}</span> | Level {itemLevel} | Value {selectedBase.baseValue}g
          </div>
        </div>

        {/* Crafted affixes */}
        <div className="space-y-3">
          {craftedAffixes.length === 0 ? (
            <div className="text-center py-6 text-xs font-mono text-text-muted italic rounded-lg"
              style={{ border: `1px dashed ${withOpacity(ACCENT, OPACITY_15)}` }}>
              Drag affixes from the pool, click +, or use Random Roll
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {craftedAffixes.map((affix) => (
                <AffixRow key={affix.tag} affix={affix} itemLevel={itemLevel}
                  onRemove={onRemoveAffix} onUpdateMagnitude={onUpdateMagnitude}
                  onTogglePlacement={onTogglePlacement} onSetPreviewTag={onSetPreviewTag} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Single Affix Row ──────────────────────────────────────────────── */

function AffixRow({ affix, itemLevel, onRemove, onUpdateMagnitude, onTogglePlacement, onSetPreviewTag }: {
  affix: CraftedAffix; itemLevel: number;
  onRemove: (tag: string) => void;
  onUpdateMagnitude: (tag: string, mag: number) => void;
  onTogglePlacement: (tag: string) => void;
  onSetPreviewTag: (tag: string | null) => void;
}) {
  const poolEntry = AFFIX_POOL.find((a) => a.id === affix.poolEntryId);
  if (!poolEntry) return null;

  const scaledMag = affix.magnitude * getItemLevelScaling(itemLevel);
  const magPercent = ((affix.magnitude - poolEntry.minValue) / (poolEntry.maxValue - poolEntry.minValue)) * 100;
  const catColor = affix.category === 'offensive' ? STATUS_ERROR
    : affix.category === 'defensive' ? STATUS_INFO : ACCENT_EMERALD;

  return (
    <motion.div layout
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      className="rounded-lg px-3 py-2.5 relative"
      style={{
        border: `1px solid ${affix.locked ? withOpacity(ACCENT_PURPLE, OPACITY_30) : withOpacity(catColor, OPACITY_20)}`,
        backgroundColor: affix.locked ? withOpacity(ACCENT_PURPLE, OPACITY_5) : withOpacity(catColor, OPACITY_5),
      }}>
      {affix.locked && (
        <div className="absolute top-1 right-1">
          <Lock className="w-3 h-3" style={{ color: ACCENT_PURPLE, filter: `drop-shadow(0 0 3px ${withOpacity(ACCENT_PURPLE, OPACITY_50)})` }} />
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: affix.locked ? ACCENT_PURPLE : catColor }} />
        <span className="text-xs font-bold font-mono text-text"
          style={{ textShadow: `0 0 12px ${withOpacity(catColor, OPACITY_25)}` }}>{affix.displayName}</span>
        <button onClick={() => onTogglePlacement(affix.tag)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold font-mono uppercase transition-all"
          style={{
            backgroundColor: affix.bIsPrefix ? withOpacity(ACCENT_ORANGE, OPACITY_8) : withOpacity(ACCENT_CYAN, OPACITY_8),
            color: affix.bIsPrefix ? ACCENT_ORANGE : ACCENT_CYAN,
            border: `1px solid ${affix.bIsPrefix ? withOpacity(ACCENT_ORANGE, OPACITY_25) : withOpacity(ACCENT_CYAN, OPACITY_25)}`,
          }} title="Toggle prefix/suffix">
          {affix.bIsPrefix ? <><ToggleLeft className="w-2.5 h-2.5" /> PREFIX</> : <><ToggleRight className="w-2.5 h-2.5" /> SUFFIX</>}
        </button>
        <span className="ml-auto text-xs font-mono font-bold"
          style={{ color: catColor, textShadow: `0 0 12px ${withOpacity(catColor, OPACITY_25)}` }}>
          +{scaledMag.toFixed(1)} {affix.stat}
        </span>
        <button onClick={() => onRemove(affix.tag)}
          className="p-0.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Magnitude slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-text-muted w-8 text-right">{poolEntry.minValue}</span>
        <input type="range" min={poolEntry.minValue} max={poolEntry.maxValue} step={0.1}
          value={affix.magnitude}
          onChange={(e) => onUpdateMagnitude(affix.tag, Number(e.target.value))}
          onMouseDown={() => onSetPreviewTag(affix.tag)}
          onMouseUp={() => onSetPreviewTag(null)}
          onTouchStart={() => onSetPreviewTag(affix.tag)}
          onTouchEnd={() => onSetPreviewTag(null)}
          className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: catColor }} />
        <span className="text-xs font-mono text-text-muted w-8">{poolEntry.maxValue}</span>
        <span className="text-xs font-mono font-bold w-10 text-right"
          style={{ color: catColor, textShadow: `0 0 12px ${withOpacity(catColor, OPACITY_25)}` }}>
          {affix.magnitude.toFixed(1)}
        </span>
      </div>

      <div className="mt-1">
        <NeonBar pct={magPercent} color={catColor} height={4} glow />
      </div>
    </motion.div>
  );
}
