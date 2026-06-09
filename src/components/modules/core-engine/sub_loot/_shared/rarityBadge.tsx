'use client';

import type { CSSProperties, ReactNode } from 'react';
import { RARITY_COLOR_MAP } from '@/lib/economy/definitions';
import { GLOW_SM, OPACITY_15, STATUS_MUTED, withOpacity } from '@/lib/chart-colors';

/*
 * Shared rarity primitives — one source of truth for loot's most important visual
 * signal. Replaces hand-rolled tier pills/dots (each with its own radius, padding
 * and opacity) across LootFilters, the loot-table editor, the drop treemap and the
 * world-item preview. Tier colour always derives from RARITY_COLOR_MAP so a tweak
 * (or a Legendary glow) ships everywhere at once.
 */

/** Rarities that earn a subtle glow halo — the rarest, most exciting drops. */
const HIGH_TIER = new Set<string>(['Epic', 'Legendary']);

/** Normalise a rarity label to the capitalised key used by RARITY_COLOR_MAP. */
function canonicalRarity(rarity: string): string {
  if (!rarity) return '';
  return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
}

/** Tier colour for a rarity (case-insensitive), falling back to muted. */
export function rarityColor(rarity: string): string {
  const key = canonicalRarity(rarity);
  return RARITY_COLOR_MAP[key] ?? RARITY_COLOR_MAP[rarity] ?? STATUS_MUTED;
}

/** Whether a rarity is high-tier (Epic / Legendary) and gets a glow halo. */
export function isHighTierRarity(rarity: string): boolean {
  return HIGH_TIER.has(canonicalRarity(rarity));
}

interface RarityDotProps {
  rarity: string;
  /** Override the derived tier colour (rarely needed). */
  color?: string;
  /** Diameter in px (default 8). */
  size?: number;
  /** Force the glow halo. Defaults off for dots (keeps dense lists calm). */
  glow?: boolean;
  className?: string;
  title?: string;
}

/** A small round tier swatch — the dot that precedes a loot row / rarity label. */
export function RarityDot({ rarity, color, size = 8, glow = false, className = '', title }: RarityDotProps) {
  const c = color ?? rarityColor(rarity);
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${className}`}
      title={title}
      style={{
        width: size,
        height: size,
        backgroundColor: c,
        boxShadow: glow ? `${GLOW_SM} ${c}` : undefined,
      }}
    />
  );
}

interface RarityBadgeProps {
  rarity: string;
  /** Override the derived tier colour (rarely needed). */
  color?: string;
  /** Label text — defaults to the rarity name. Ignored when `children` is set. */
  label?: ReactNode;
  /** Custom contents (e.g. an affix name) coloured by the rarity tier. */
  children?: ReactNode;
  /** Force / suppress the glow halo. Defaults to auto (Epic + Legendary). */
  glow?: boolean;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

/**
 * A rounded-full tier pill — consistent radius, padding and tint everywhere.
 * Epic / Legendary earn a subtle GLOW_SM halo so the best loot reads as premium.
 */
export function RarityBadge({
  rarity, color, label, children, glow, className = '', title, style,
}: RarityBadgeProps) {
  const c = color ?? rarityColor(rarity);
  const showGlow = glow ?? isHighTierRarity(rarity);
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-mono leading-none ${className}`}
      title={title}
      style={{
        backgroundColor: withOpacity(c, OPACITY_15),
        color: c,
        boxShadow: showGlow ? `${GLOW_SM} ${c}` : undefined,
        ...style,
      }}
    >
      {children ?? label ?? rarity}
    </span>
  );
}
