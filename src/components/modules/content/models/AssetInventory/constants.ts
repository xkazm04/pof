import {
  Box, Image, Paintbrush, Film, Cpu, Volume2, Map, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ACCENT_VIOLET, ACCENT_CYAN, ACCENT_ORANGE, MODULE_COLORS } from '@/lib/chart-colors';
import type { AssetType } from '@/app/api/filesystem/scan-assets/route';

export const ACCENT = ACCENT_VIOLET;

export const TYPE_CONFIG: Record<AssetType, { label: string; icon: LucideIcon; color: string }> = {
  mesh: { label: 'Mesh', icon: Box, color: MODULE_COLORS.core },
  texture: { label: 'Texture', icon: Image, color: MODULE_COLORS.content },
  material: { label: 'Material', icon: Paintbrush, color: MODULE_COLORS.systems },
  animation: { label: 'Animation', icon: Film, color: MODULE_COLORS.evaluator },
  blueprint: { label: 'Blueprint', icon: Cpu, color: MODULE_COLORS.setup },
  sound: { label: 'Sound', icon: Volume2, color: ACCENT_CYAN },
  map: { label: 'Map', icon: Map, color: ACCENT_ORANGE },
  other: { label: 'Other', icon: HelpCircle, color: 'var(--text-muted)' },
};
