import { scoreBandToken, withOpacity, OPACITY_10 } from '@/lib/chart-colors';

// ─── Score coloring ──────────────────────────────────────────────────────────
// Both read the one `SCORE_BANDS` table through `scoreBandToken` (the private
// 70/45/25 ladder is retired), so a combined score reads the same band here as
// on every other evaluator surface.

export function healthColor(score: number): string {
  return scoreBandToken(score).color;
}

export function healthBg(score: number): string {
  return withOpacity(scoreBandToken(score).color, OPACITY_10);
}
