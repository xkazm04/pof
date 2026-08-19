import type { HealthTrendPoint } from '@/lib/game-director-db';
import { computeVelocityForecast, type ForecastResult } from '@/lib/ecw/forecast';
import { PADDING, VIEW_W } from './constants';
import type { SeriesPoint } from './types';

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * The score at which a build counts as healthy — the top band of the app's
 * canonical score ladder (`scoreBandToken`: >=80 green). A projection needs a
 * finish line, and this is the one the rest of the UI already colours by.
 */
export const HEALTHY_SCORE = 80;

/**
 * "Days to a healthy build at the current rate", projected from the trend the
 * chart is already drawing. Maps the health series onto the shared velocity
 * forecaster: score-points-toward-80 play the role of "verified of total", and
 * the series' own timestamps play the role of history.
 *
 * Returns null — and the chart shows nothing — whenever a projection would be
 * dishonest: fewer than two sessions, an already-healthy build, a flat or
 * declining score, or unparseable timestamps.
 *
 * The clock is the LAST SESSION's timestamp, not `Date.now()`. Two reasons: a
 * wall-clock read in render is a `react-hooks/purity` error, and the honest
 * anchor for "at the current rate" is the last time anything was measured — not
 * the moment someone happened to open the tab, which would silently stretch the
 * estimate the longer a project sat idle. `now` stays injectable for tests.
 */
export function forecastHealthRecovery(
  data: HealthTrendPoint[],
  now?: number,
): ForecastResult | null {
  if (data.length < 2) return null;

  const history = data.slice(0, -1).map(d => ({
    verified: Math.max(0, Math.min(HEALTHY_SCORE, d.overallScore)),
    at: new Date(d.createdAt).getTime(),
  }));
  if (history.some(h => Number.isNaN(h.at))) return null;

  const latest = data[data.length - 1];
  const latestAt = new Date(latest.createdAt).getTime();
  if (Number.isNaN(latestAt)) return null;

  return computeVelocityForecast(
    {
      verified: Math.max(0, Math.min(HEALTHY_SCORE, latest.overallScore)),
      total: HEALTHY_SCORE,
      history,
    },
    now ?? latestAt,
  );
}

export function computeChart(data: HealthTrendPoint[], height: number) {
  if (data.length === 0) return null;

  const chartW = VIEW_W - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;
  const n = data.length;

  const xAt = (i: number) =>
    PADDING.left + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);

  // Score axis fixed 0-100 (game health is bounded).
  const yScore = (v: number) =>
    PADDING.top + chartH - (Math.max(0, Math.min(100, v)) / 100) * chartH;

  // Findings axis adaptive: 0 → max(findings) padded.
  const maxFindings = Math.max(1, ...data.map(d => d.findingsCount));
  const findingsTop = Math.ceil(maxFindings * 1.15);
  const yFindings = (v: number) =>
    PADDING.top + chartH - (Math.min(v, findingsTop) / findingsTop) * chartH;

  const scorePts: SeriesPoint[] = data.map((d, i) => ({
    x: xAt(i), y: yScore(d.overallScore), d,
  }));
  const findingsPts: SeriesPoint[] = data.map((d, i) => ({
    x: xAt(i), y: yFindings(d.findingsCount), d,
  }));

  const scorePath = scorePts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const findingsPath = findingsPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Score grid: 0/25/50/75/100
  const scoreTicks = [0, 25, 50, 75, 100].map(v => ({
    v,
    y: yScore(v),
  }));

  // X labels: first, middle, last
  const xLabelIdx = n <= 3
    ? data.map((_, i) => i)
    : [0, Math.floor(n / 2), n - 1];

  const xLabels = xLabelIdx.map(i => ({
    x: xAt(i),
    label: formatDate(data[i].createdAt),
  }));

  // Regression markers — annotation lines at sessions where alerts fired
  const regressionMarkers = data
    .map((d, i) => ({ x: xAt(i), d }))
    .filter(m => m.d.regressionCount > 0);

  // Delta — last vs first score
  const first = data[0].overallScore;
  const last = data[n - 1].overallScore;
  const delta = last - first;

  // Avg regression rate = regressions / sessions
  const totalRegressions = data.reduce((s, p) => s + p.regressionCount, 0);
  const regressionRate = totalRegressions / n;

  return {
    chartW,
    chartH,
    scorePts,
    findingsPts,
    scorePath,
    findingsPath,
    scoreTicks,
    xLabels,
    regressionMarkers,
    findingsTop,
    delta,
    regressionRate,
  };
}
