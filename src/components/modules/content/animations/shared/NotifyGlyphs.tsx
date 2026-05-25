'use client';

import {
  Swords, Zap, Sparkles, Wind, Volume2, HelpCircle,
  Footprints, Shield, Layers,
  type LucideIcon,
} from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_INFO, ACCENT_CYAN, ACCENT_EMERALD,
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_ORANGE,
} from '@/lib/chart-colors';

/**
 * Canonical notify vocabulary shared between the FrameScrubberPanel and the
 * AIComboChoreographer MontageTimeline. Each notify is encoded redundantly by
 * color + icon + abbreviated label so the timeline stays legible without a
 * legend lookup and remains accessible to colorblind users.
 */
export interface NotifyGlyph {
  /** Lucide icon component rendered inside the bar. */
  icon: LucideIcon;
  /** Short label rendered next to the icon (<= 5 chars to fit narrow bars). */
  abbrev: string;
  /** Full display name used in legends and tooltips. */
  name: string;
  /** Canonical color used to fill the bar / swatch. */
  color: string;
}

export const NOTIFY_GLYPHS: Record<string, NotifyGlyph> = {
  HitDetection: { icon: Swords,   abbrev: 'Hit',   name: 'HitDetection', color: STATUS_ERROR },
  ComboWindow:  { icon: Zap,      abbrev: 'Combo', name: 'ComboWindow',  color: ACCENT_CYAN },
  SpawnVFX:     { icon: Sparkles, abbrev: 'VFX',   name: 'SpawnVFX',     color: STATUS_WARNING },
  VFX:          { icon: Sparkles, abbrev: 'VFX',   name: 'SpawnVFX',     color: STATUS_WARNING },
  MotionWarp:   { icon: Wind,     abbrev: 'Warp',  name: 'MotionWarp',   color: ACCENT_EMERALD },
  Sound:        { icon: Volume2,  abbrev: 'Snd',   name: 'Sound',        color: STATUS_INFO },
};

const FALLBACK: NotifyGlyph = { icon: HelpCircle, abbrev: '?', name: 'Notify', color: STATUS_INFO };

/** Resolve a notify name (e.g. "HitDetection") to its glyph; falls back gracefully. */
export function getNotifyGlyph(name: string): NotifyGlyph {
  return NOTIFY_GLYPHS[name] ?? FALLBACK;
}

/** Canonical legend order for notify chips (most-important first). */
export const NOTIFY_LEGEND_ORDER = ['HitDetection', 'ComboWindow', 'SpawnVFX', 'MotionWarp', 'Sound'] as const;

/**
 * Inline icon + abbreviated label that overlays a notify bar. Designed to stay
 * legible at small bar widths: icon renders first, label is hidden when the
 * caller passes `compact` for very narrow bars.
 */
export function NotifyBarLabel({
  glyph,
  compact = false,
  className = '',
}: {
  glyph: NotifyGlyph;
  compact?: boolean;
  className?: string;
}) {
  const Icon = glyph.icon;
  return (
    <span
      className={`flex items-center gap-0.5 px-0.5 leading-none whitespace-nowrap ${className}`}
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
    >
      <Icon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
      {!compact && (
        <span className="text-[10px] font-mono font-bold tracking-tight">{glyph.abbrev}</span>
      )}
    </span>
  );
}

/**
 * Legend chip combining a color swatch, glyph icon and full name. Used by the
 * scrubber, montage timeline, and state-machine type legends so every notify /
 * type uses the same visual vocabulary.
 */
export function NotifyLegendChip({
  color,
  icon: Icon,
  name,
  abbrev,
  size = 'sm',
}: {
  color: string;
  icon: LucideIcon;
  name: string;
  abbrev?: string;
  size?: 'xs' | 'sm';
}) {
  const swatch = size === 'xs' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const iconCls = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const text = size === 'xs' ? 'text-[10px]' : 'text-2xs';
  return (
    <span className="inline-flex items-center gap-1 text-text-muted">
      <span className={`${swatch} rounded-sm flex-shrink-0`} style={{ backgroundColor: color, opacity: 0.7 }} />
      <Icon className={iconCls} style={{ color }} aria-hidden="true" />
      <span className={`${text} font-mono`}>
        {name}
        {abbrev && abbrev !== name ? <span className="text-text-muted/60"> ({abbrev})</span> : null}
      </span>
    </span>
  );
}

// ── State Machine type legend (used by StateMachineEditor) ───────────────────

export interface StateTypeGlyph {
  icon: LucideIcon;
  name: string;
  color: string;
}

export const STATE_TYPE_GLYPHS: Record<string, StateTypeGlyph> = {
  locomotion: { icon: Footprints, name: 'locomotion', color: MODULE_COLORS.core },
  combat:     { icon: Swords,     name: 'combat',     color: MODULE_COLORS.evaluator },
  reaction:   { icon: Shield,     name: 'reaction',   color: ACCENT_ORANGE },
  other:      { icon: Layers,     name: 'other',      color: ACCENT_VIOLET },
};
