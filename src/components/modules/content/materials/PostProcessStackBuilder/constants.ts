import {
  Sun, Eye, Wind, Circle, Move, Aperture, Layers as LayersIcon,
  Gauge, Sparkles, Film,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  STATUS_WARNING, ACCENT_VIOLET, STATUS_IMPROVED, ACCENT_EMERALD, ACCENT_PINK,
} from '@/lib/chart-colors';
import type { PPEffectCategory, PPResolution } from '@/types/post-process-studio';

// ── Presentation maps (shared shape with PostProcessStudioView) ──

export const CATEGORY_COLORS: Record<PPEffectCategory, string> = {
  lighting: STATUS_WARNING,
  color: ACCENT_VIOLET,
  blur: STATUS_IMPROVED,
  atmosphere: ACCENT_EMERALD,
  special: ACCENT_PINK,
};

export const EFFECT_ICONS: Record<string, LucideIcon> = {
  'bloom': Sun,
  'color-grading': Aperture,
  'depth-of-field': Eye,
  'ambient-occlusion': Circle,
  'motion-blur': Move,
  'vignette': Wind,
  'exposure': Gauge,
  'chromatic-aberration': Sparkles,
  'film-grain': Film,
  'fog': LayersIcon,
};

// Materials tab evaluates GPU budget against a fixed target resolution.
export const TARGET_RESOLUTION: PPResolution = '1080p';
