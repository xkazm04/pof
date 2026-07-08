import {
  Activity, Layers, Shield, Swords, Compass, Package,
  Skull, Crosshair, Zap,
} from 'lucide-react';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_PURPLE, ACCENT_PINK,
} from '@/lib/chart-colors';
import type { SubGenreId } from '@/types/telemetry';

export const ACCENT = MODULE_COLORS.core;

export const SUB_GENRE_STYLES: Record<SubGenreId, { color: string; icon: typeof Swords }> = {
  'souls-like':       { color: STATUS_ERROR, icon: Skull },
  'character-action': { color: STATUS_WARNING, icon: Zap },
  'diablo-like':      { color: ACCENT_PURPLE, icon: Package },
  'arpg-shooter':     { color: STATUS_INFO, icon: Crosshair },
  'tactical-arpg':    { color: STATUS_SUCCESS, icon: Shield },
  'open-world-arpg':  { color: ACCENT_ORANGE, icon: Compass },
  'roguelite-arpg':   { color: ACCENT_PINK, icon: Layers },
  'survival-arpg':    { color: ACCENT_EMERALD, icon: Activity },
};
