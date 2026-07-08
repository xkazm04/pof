import type { HealthTrendPoint } from '@/lib/game-director-db';
import { PADDING, VIEW_W } from './constants';
import type { SeriesPoint } from './types';

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
