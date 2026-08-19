'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LineChart } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_INFO, STATUS_ERROR,
} from '@/lib/chart-colors';
import { PADDING, VIEW_W } from './constants';
import type { HealthTrendChartProps } from './types';
import { computeChart, formatDate } from './helpers';
import { RegressionMarker } from './RegressionMarker';
import { DeltaBadge } from './DeltaBadge';
import { Legend } from './Legend';

export type { HealthTrendChartProps, SeriesPoint } from './types';

export function HealthTrendChart({ data, height = 200 }: HealthTrendChartProps) {
  const computed = useMemo(() => computeChart(data, height), [data, height]);

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

  // The chart's meaning was carried entirely by hover titles + line colour. The
  // svg now states its trend in one sentence, and the full series is readable as
  // a visually-hidden table (WCAG 1.1.1 / 1.4.1).
  const first = data[0];
  const last = data[data.length - 1];
  const direction = delta > 0 ? `up ${delta}` : delta < 0 ? `down ${Math.abs(delta)}` : 'unchanged';
  // Provenance leads the accessible summary. The sentence used to open "Game
  // health trend across N sessions" for a series whose every point could be
  // arithmetic over canned findings — an assertion about the game made from
  // numbers that never touched it.
  const simulatedCount = data.filter(d => d.source !== 'external').length;
  const allSimulated = simulatedCount === data.length;
  const provenanceSentence = allSimulated
    ? 'Simulated trend — every session came from the dev-fixture simulator; no build was measured.'
    : simulatedCount > 0
      ? `Partly simulated trend — ${simulatedCount} of ${data.length} sessions came from the dev-fixture simulator.`
      : 'Measured trend — every session was written by an external playtest harness.';
  const chartSummary =
    `${provenanceSentence} Score ${first.overallScore} to ${last.overallScore} out of 100 (${direction}). ` +
    `Findings ${first.findingsCount} to ${last.findingsCount}. ` +
    `${regressionMarkers.length} session${regressionMarkers.length !== 1 ? 's' : ''} with regressions.`;

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
          <span className="text-xs font-medium text-text">
            {allSimulated ? 'Game Health Trend (simulated)' : 'Game Health Trend'}
          </span>
          <span className="text-2xs text-text-muted">{data.length} sessions</span>
          {simulatedCount > 0 && (
            <span className="text-2xs italic text-text-muted">
              {allSimulated ? 'nothing measured' : `${simulatedCount} simulated`}
            </span>
          )}
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
        role="img"
        aria-label={chartSummary}
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

        {/* Findings dots — hoverable like the score dots, not a silent series */}
        {findingsPts.map((p) => (
          <g key={`f-${p.d.sessionId}`}>
            <circle cx={p.x} cy={p.y} r="2" fill={STATUS_INFO} opacity="0.75" />
            <title>
              {`${p.d.sessionName}\nFindings: ${p.d.findingsCount} (${p.d.criticalCount} critical)\n${formatDate(p.d.createdAt)}`}
            </title>
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

      {/* Text alternative: every plotted value, in reading order. The caption stays
          short — the svg's aria-label already spoke the summary. */}
      <table className="sr-only">
        <caption>Game health by session</caption>
        <thead>
          <tr>
            <th scope="col">Session</th>
            <th scope="col">Date</th>
            <th scope="col">Score</th>
            <th scope="col">Findings</th>
            <th scope="col">Critical</th>
            <th scope="col">Regressions</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={`row-${d.sessionId}`}>
              <th scope="row">{d.sessionName}</th>
              <td>{formatDate(d.createdAt)}</td>
              <td>{d.overallScore}</td>
              <td>{d.findingsCount}</td>
              <td>{d.criticalCount}</td>
              <td>{d.regressionCount}</td>
              <td>{d.source === 'external' ? 'Measured' : 'Simulated'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Legend regressionCount={regressionMarkers.length} />
    </motion.div>
  );
}
