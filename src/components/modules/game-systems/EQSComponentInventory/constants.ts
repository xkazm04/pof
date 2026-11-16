import { Target, MapPin, Gauge } from 'lucide-react';
import { KIND_STYLE } from '@/lib/ai-director/eqs-catalog';
import type { ComponentKind } from './types';

// ── Kind styling ────────────────────────────────────────────────────────────

export const KIND_META: Record<ComponentKind, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  context: { label: 'Context', color: KIND_STYLE.context.color, icon: Target },
  generator: { label: 'Generator', color: KIND_STYLE.generator.color, icon: MapPin },
  test: { label: 'Test', color: KIND_STYLE['test-score'].color, icon: Gauge },
};
