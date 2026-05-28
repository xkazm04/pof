'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LineChart, AlertOctagon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { HealthTrendPoint } from '@/lib/game-director-db';
import {
  STATUS_SUCCESS, STATUS_INFO, STATUS_ERROR, ACCENT_ORANGE,
} from '@/lib/chart-colors';

interface HealthTrendChartProps {
  data: HealthTrendPoint[];
  height?: number;
}

const PADDING = { top: 18, right: 48, bottom: 28, left: 36 };
const VIEW_W = 480;

interface SeriesPoint {
  x: number;
  y: number;
  d: HealthTrendPoint;
}

export function HealthTrendChart({ data, height = 200 }: HealthTrendChartProps) {
  const computed = useMemo(() => {
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
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="p-4 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <LineChart className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-medium text-text">Game Health Trend</span>
        </div>
        <div
          className="flex items-center justify-center text-text-muted text-xs"
          style={{ height: height - 40 }}
        >
          No completed sessions yet — run a playtest to see how your build trends.
        </div>
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="p-4 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <LineChart className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-medium text-text">Game Health Trend</span>
        </div>
        <div
          className="flex items-center justify-center text-text-muted text-xs"
          style={{ height: height - 40 }}
        >
          One session recorded — a second completed session unlocks the trend line.
        </div>
      </div>
    );
  }

  if (!computed) return null;

  const {
    scorePts, findingsPts, scorePath, findingsPath, scoreTicks, xLabels,
    regressionMarkers, findingsTop, delta, regressionRate,
  } = computed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: 0.18 }}
      className="p-4 bg-surface border border-border rounded-xl"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-medium text-text">Game Health Trend</span>
          <span className="text-2xs text-text-muted">{data.length} sessions</span>
        </div>
        <div className="flex items-center gap-3">
          <DeltaBadge delta={delta} />
          {regressionRate > 0 && (
            <span className="text-2xs font-mono text-text-muted">
              <span style={{ color: STATUS_ERROR }}>{regressionRate.toFixed(2)}</span> reg/session
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="healthScoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={STATUS_SUCCESS} stopOpacity="0.25" />
            <stop offset="100%" stopColor={STATUS_SUCCESS} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines (score scale) */}
        {scoreTicks.map(t => (
          <line
            key={`grid-${t.v}`}
            x1={PADDING.left}
            y1={t.y}
            x2={VIEW_W - PADDING.right}
            y2={t.y}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray={t.v === 0 || t.v === 100 ? '0' : '2 3'}
          />
        ))}

        {/* Regression annotation lines (drawn behind series) */}
        {regressionMarkers.map((m, i) => (
          <RegressionMarker
            key={`reg-${m.d.sessionId}-${i}`}
            x={m.x}
            top={PADDING.top}
            bottom={height - PADDING.bottom}
            count={m.d.regressionCount}
            sessionName={m.d.sessionName}
          />
        ))}

        {/* Score area fill */}
        <polygon
          points={`${scorePts[0].x},${height - PADDING.bottom} ${scorePath} ${scorePts[scorePts.length - 1].x},${height - PADDING.bottom}`}
          fill="url(#healthScoreGrad)"
        />

        {/* Findings line (secondary series) */}
        <polyline
          points={findingsPath}
          fill="none"
          stroke={STATUS_INFO}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 3"
          opacity="0.85"
        />

        {/* Score line (primary) */}
        <polyline
          points={scorePath}
          fill="none"
          stroke={STATUS_SUCCESS}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Score dots */}
        {scorePts.map((p) => (
          <g key={`s-${p.d.sessionId}`}>
            <circle cx={p.x} cy={p.y} r="3" fill={STATUS_SUCCESS} />
            <title>
              {`${p.d.sessionName}\nScore: ${p.d.overallScore}/100\nFindings: ${p.d.findingsCount} (${p.d.criticalCount} critical)\nRegressions: ${p.d.regressionCount}\n${formatDate(p.d.createdAt)}`}
            </title>
          </g>
        ))}

        {/* Findings dots */}
        {findingsPts.map((p) => (
          <g key={`f-${p.d.sessionId}`}>
            <circle cx={p.x} cy={p.y} r="2" fill={STATUS_INFO} opacity="0.75" />
          </g>
        ))}

        {/* Y-axis labels — left (score 0-100) */}
        {scoreTicks.map(t => (
          <text
            key={`yl-${t.v}`}
            x={PADDING.left - 4}
            y={t.y + 3}
            textAnchor="end"
            className="fill-text-muted"
            fontSize="9"
            fontFamily="monospace"
          >
            {t.v}
          </text>
        ))}

        {/* Y-axis labels — right (findings) */}
        <text
          x={VIEW_W - PADDING.right + 4}
          y={PADDING.top + 6}
          textAnchor="start"
          fontSize="9"
          fontFamily="monospace"
          fill={STATUS_INFO}
          opacity="0.8"
        >
          {findingsTop}
        </text>
        <text
          x={VIEW_W - PADDING.right + 4}
          y={height - PADDING.bottom + 3}
          textAnchor="start"
          fontSize="9"
          fontFamily="monospace"
          fill={STATUS_INFO}
          opacity="0.8"
        >
          0
        </text>

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={`x-${i}`}
            x={l.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-text-muted"
            fontSize="9"
            fontFamily="monospace"
          >
            {l.label}
          </text>
        ))}
      </svg>

      <Legend regressionCount={regressionMarkers.length} />
    </motion.div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RegressionMarker({
  x, top, bottom, count, sessionName,
}: {
  x: number;
  top: number;
  bottom: number;
  count: number;
  sessionName: string;
}) {
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={top}
        y2={bottom}
        stroke={ACCENT_ORANGE}
        strokeWidth="1"
        strokeDasharray="2 2"
        opacity="0.55"
      />
      <circle
        cx={x}
        cy={top + 2}
        r="3.5"
        fill={ACCENT_ORANGE}
        stroke="var(--surface)"
        strokeWidth="1"
      />
      <title>{`${sessionName}\n${count} regression alert${count !== 1 ? 's' : ''}`}</title>
    </g>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 1) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono"
        style={{ color: 'var(--text-muted)' }}
      >
        <Minus className="w-2.5 h-2.5" />
        flat
      </span>
    );
  }
  const positive = delta > 0;
  const color = positive ? STATUS_SUCCESS : STATUS_ERROR;
  const Arrow = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono"
      style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
    >
      <Arrow className="w-2.5 h-2.5" />
      {positive ? '+' : ''}{delta.toFixed(0)} pts
    </span>
  );
}

function Legend({ regressionCount }: { regressionCount: number }) {
  return (
    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-border">
      <LegendItem color={STATUS_SUCCESS} label="Overall score" />
      <LegendItem color={STATUS_INFO} label="Findings" dashed />
      {regressionCount > 0 && (
        <span className="inline-flex items-center gap-1 text-2xs text-text-muted">
          <AlertOctagon className="w-2.5 h-2.5" style={{ color: ACCENT_ORANGE }} />
          {regressionCount} regression event{regressionCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-text-muted">
      <svg width="14" height="6" aria-hidden="true">
        <line
          x1="0" y1="3" x2="14" y2="3"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? '3 2' : '0'}
        />
      </svg>
      {label}
    </span>
  );
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
