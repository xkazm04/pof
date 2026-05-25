/**
 * Velocity-based completion forecast. Pure function — given a current
 * verified/total count and a history of past verified-counts with timestamps,
 * returns a projected days-remaining + confidence interval, or null when the
 * project is already complete / has insufficient data / is stalled.
 *
 * Phase 11-OBS / Mission Control forecaster foundation (ideas 8a45533b,
 * 925151c6, ae20a945). The MissionControl ForecastCard uses this once the
 * lifecycle history persistence lands in Phase 10-MC.
 */

export interface ForecastInput {
  verified: number;
  total: number;
  /** Past snapshots of {verified count, timestamp} — should be sorted oldest → newest. */
  history: Array<{ verified: number; at: number }>;
}

export interface ForecastResult {
  daysRemaining: number;
  velocityPerDay: number;
  /** 0..1 — higher when more history points support the trend. */
  confidence: number;
}

const MS_PER_DAY = 86_400_000;

export function computeVelocityForecast(input: ForecastInput): ForecastResult | null {
  const { verified, total, history } = input;

  if (verified >= total) return null;
  if (history.length === 0) return null;

  // Use the oldest history point vs current to compute average velocity.
  // Could be smarter (linear regression) but the simple delta works for the
  // foundation; Phase 10-MC enhances with weighted regression if needed.
  const oldest = history[0];
  const elapsedMs = Date.now() - oldest.at;
  if (elapsedMs <= 0) return null;

  const elapsedDays = elapsedMs / MS_PER_DAY;
  const verifiedDelta = verified - oldest.verified;
  const velocityPerDay = verifiedDelta / elapsedDays;

  if (velocityPerDay <= 0) return null; // stalled

  const remaining = total - verified;
  const daysRemaining = Math.ceil(remaining / velocityPerDay);

  // Confidence scales with history depth, capped at 1.0. 1 point → 0.4,
  // 5 points → 0.8, 10+ points → 1.0.
  const confidence = Math.min(1, 0.3 + 0.1 * history.length);

  return {
    daysRemaining,
    velocityPerDay: Math.round(velocityPerDay * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
  };
}
