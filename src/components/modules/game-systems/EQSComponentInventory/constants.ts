import { Target, MapPin, Gauge } from 'lucide-react';
import { ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD } from '@/lib/chart-colors';
import type { ComponentKind } from './types';

// ── Kind styling ────────────────────────────────────────────────────────────

export const KIND_META: Record<ComponentKind, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  context: { label: 'Context', color: ACCENT_CYAN, icon: Target },
  generator: { label: 'Generator', color: ACCENT_VIOLET, icon: MapPin },
  test: { label: 'Test', color: ACCENT_EMERALD, icon: Gauge },
};
