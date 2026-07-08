import { Sun, Aperture, Eye, Circle, Move, Wind, Gauge, Sparkles, Film, Layers } from 'lucide-react';
import type { PPEffectCategory, PPResolution } from '@/types/post-process-studio';
import { ACCENT_VIOLET, STATUS_WARNING, STATUS_IMPROVED, ACCENT_EMERALD, ACCENT_PINK } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

export const ACCENT = ACCENT_VIOLET; // Violet for PP studio

export const CATEGORY_COLORS: Record<PPEffectCategory, string> = {
  lighting: STATUS_WARNING,
  color: ACCENT_VIOLET,
  blur: STATUS_IMPROVED,
  atmosphere: ACCENT_EMERALD,
  special: ACCENT_PINK,
};

export const EFFECT_ICONS: Record<string, typeof Sun> = {
  'bloom': Sun,
  'color-grading': Aperture,
  'depth-of-field': Eye,
  'ambient-occlusion': Circle,
  'motion-blur': Move,
  'vignette': Wind,
  'exposure': Gauge,
  'chromatic-aberration': Sparkles,
  'film-grain': Film,
  'fog': Layers,
};

export const RESOLUTIONS: PPResolution[] = ['720p', '1080p', '1440p', '4K'];
