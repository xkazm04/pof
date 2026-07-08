import type { VariantStyle } from '@/types/prompt-evolution';
import {
  MODULE_COLORS, STATUS_NEUTRAL, ACCENT_EMERALD_DARK,
} from '@/lib/chart-colors';

export const ACCENT = ACCENT_EMERALD_DARK;

export const STYLE_COLOR: Record<VariantStyle, string> = {
  imperative: MODULE_COLORS.evaluator,
  descriptive: MODULE_COLORS.core,
  'step-by-step': MODULE_COLORS.content,
  holistic: MODULE_COLORS.systems,
  'example-rich': ACCENT_EMERALD_DARK,
  minimal: STATUS_NEUTRAL,
};
