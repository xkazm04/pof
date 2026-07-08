import {
  Shield, Crosshair, Target, Eye, Swords,
} from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD,
  ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import type { SquadRole } from '@/types/squad-tactics';
import type { SubTab } from '@/components/modules/core-engine/unique-tabs/_shared';
import { polarSvgLayout } from '@/components/ui/svg/polar-layout';

export const ACCENT = MODULE_COLORS.systems;

/* ── Role colors & icons ──────────────────────────────────────────────────── */

export const ROLE_COLORS: Record<SquadRole, string> = {
  aggressor: STATUS_ERROR,
  flanker: ACCENT_EMERALD,
  support: ACCENT_CYAN,
  tank: STATUS_WARNING,
  ambusher: ACCENT_VIOLET,
};

export const ROLE_ICONS: Record<SquadRole, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  aggressor: Swords,
  flanker: Crosshair,
  support: Eye,
  tank: Shield,
  ambusher: Target,
};

/* ── SVG constants ────────────────────────────────────────────────────────── */

export const { size: SVG_SIZE, center: SVG_CENTER, radius: DRAW_RADIUS } = polarSvgLayout(380, 50);

/* ── Sub-tabs ─────────────────────────────────────────────────────────────── */

export const SUB_TABS: SubTab[] = [
  { id: 'formation', label: 'Formation View' },
  { id: 'pipeline', label: 'EQS Pipeline' },
  { id: 'codegen', label: 'UE5 Code' },
];

/* ── Pipeline step colors ─────────────────────────────────────────────────── */

export const STEP_KIND_COLORS: Record<string, string> = {
  context: ACCENT_CYAN,
  generator: ACCENT_VIOLET,
  'test-score': ACCENT_EMERALD,
  'test-filter': ACCENT_ORANGE,
  director: ACCENT,
  result: STATUS_SUCCESS,
};
