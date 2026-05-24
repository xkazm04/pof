import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';

/* ── Haptic Effect ──────────────────────────────────────────────────────── */

export type HapticEffect = { type: 'dodge' | 'hit'; id: string } | null;

/* ── Rating helpers ─────────────────────────────────────────────────────── */

export type Rating = 'generous' | 'tight' | 'punishing';

export const RATING_STYLES: Record<Rating, { color: string; label: string }> = {
  generous: { color: STATUS_SUCCESS, label: 'Generous' },
  tight: { color: STATUS_WARNING, label: 'Tight' },
  punishing: { color: STATUS_ERROR, label: 'Punishing' },
};

export function rateForgivenessRatio(pct: number): Rating {
  if (pct >= 50) return 'generous';
  if (pct >= 30) return 'tight';
  return 'punishing';
}

export function rateResponsiveness(pct: number): Rating {
  if (pct >= 40) return 'generous';
  if (pct >= 20) return 'tight';
  return 'punishing';
}

export function rateStaminaEfficiency(dodgesPerBar: number): Rating {
  if (dodgesPerBar >= 4) return 'generous';
  if (dodgesPerBar >= 3) return 'tight';
  return 'punishing';
}

/* ── Computed stats interface ───────────────────────────────────────────── */

export interface PlayheadStats {
  speed: number;
  dist: number;
  inMovement: boolean;
  inInvuln: boolean;
  inCancel: boolean;
  inCooldown: boolean;
  dodgedHits: number;
  totalHits: number;
}
