import { scoreBandToken } from '@/lib/chart-colors';

/** Compliance score → shared score-band color (green / amber / orange / red). */
export function scoreColor(score: number): string {
  return scoreBandToken(score).color;
}
