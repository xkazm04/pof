'use client';

import { useReducedMotion, motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { LabTheme } from '../../theme';

/**
 * Shared chart primitive used by every catalog pipeline step (CLAUDE.md →
 * Shared Component Manifest). Replaces hand-rolled inline SVG with magic-number
 * scales like `28 + ((p-84)/40)*280`. Four variants today:
 *
 *  - `bars`       — horizontal budget bar list with optional highlight
 *  - `scatter`    — dashed reference curve + peer dots + accent points
 *  - `histogram`  — vertical bars at fixed positions with `near` highlight
 *  - `waveform`   — sample-driven oscilloscope strip (active/inactive)
 *
 * All variants share a tiny `scaleLinear(domain, range)` helper so axes/legends
 * stay in lockstep, and a subtle staggered mount transition (each datum delays
 * `staggerMs` ms; `useReducedMotion()` collapses to a no-op). Theme tokens are
 * read off the LabTheme passed in (`t.ink`, `t.line`, `t.muted`, `t.ok/bad`).
 */

/* ── Scale helpers ──────────────────────────────────────────────────────── */

export function scaleLinear(domain: readonly [number, number], range: readonly [number, number]) {
  const [d0, d1] = domain, [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;

/* ── Variant props ──────────────────────────────────────────────────────── */

export interface BarsRow { label: string; value: number; color?: string; highlight?: boolean; unit?: string }
export interface ScatterPoint { x: number; y: number; color?: string; size?: number; label?: string }

export type ChartPanelProps = {
  t: LabTheme;
  /** Per-datum entrance stagger (ms). Default 25; set 0 to disable. */
  staggerMs?: number;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
} & (
  | { variant: 'bars'; rows: BarsRow[]; max?: number; height?: number; labelWidth?: number }
  | { variant: 'scatter';
      reference: ScatterPoint[];
      points?: ScatterPoint[];
      xDomain: readonly [number, number]; yDomain: readonly [number, number];
      width?: number; height?: number; xLabel?: string; yLabel?: string }
  | { variant: 'histogram'; bars: { value: number; highlight?: boolean }[]; max?: number; height?: number }
  | { variant: 'waveform'; samples: number[]; active: boolean; height?: number }
);

/* ── Public component ───────────────────────────────────────────────────── */

export function ChartPanel(props: ChartPanelProps) {
  const reduce = useReducedMotion();
  const stagger = (reduce ? 0 : props.staggerMs ?? 25) / 1000;
  switch (props.variant) {
    case 'bars': return <BarsChart {...props} staggerSec={stagger} />;
    case 'scatter': return <ScatterChart {...props} staggerSec={stagger} />;
    case 'histogram': return <HistogramChart {...props} staggerSec={stagger} />;
    case 'waveform': return <WaveformChart {...props} staggerSec={stagger} />;
  }
}

/* ── Bars ───────────────────────────────────────────────────────────────── */

function BarsChart({ t, rows, max, labelWidth = 90, ariaLabel, staggerSec }: Extract<ChartPanelProps, { variant: 'bars' }> & { staggerSec: number }) {
  const domainMax = max ?? Math.max(...rows.map((r) => r.value), 1) * 1.1;
  const scale = scaleLinear([0, domainMax], [0, 100]);
  return (
    <div role="figure" aria-label={ariaLabel ?? 'budget bars'} style={{ display: 'grid', gap: 8 }}>
      {rows.map((r, i) => {
        const fill = r.color ?? (r.highlight ? t.ink : t.line);
        return (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: labelWidth, fontSize: 14, color: t.text, flexShrink: 0 }}>{r.label}</span>
            <div style={{ flex: 1, height: 16, background: t.line, opacity: 0.4 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${scale(r.value)}%` }}
                transition={{ duration: 0.55, delay: i * staggerSec, ease: 'easeOut' }}
                style={{ height: '100%', background: fill, opacity: r.highlight ? 1 : 0.85 }}
              />
            </div>
            <span className={t.fontMono} style={{ width: 44, textAlign: 'right', fontSize: 14, color: t.text }}>
              {r.value}{r.unit ? r.unit : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Scatter ────────────────────────────────────────────────────────────── */

function ScatterChart({
  t, reference, points = [], xDomain, yDomain,
  width = 320, height = 170, xLabel, yLabel, ariaLabel, staggerSec,
}: Extract<ChartPanelProps, { variant: 'scatter' }> & { staggerSec: number }) {
  const sx = scaleLinear(xDomain, [PAD_LEFT, width - PAD_RIGHT]);
  const sy = scaleLinear(yDomain, [height - PAD_BOTTOM, PAD_TOP]);
  const refPath = reference.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  return (
    <svg role="img" aria-label={ariaLabel ?? 'scatter chart'} viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ marginTop: 8 }}>
      <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={height - PAD_BOTTOM} stroke={t.line} strokeWidth={1.5} />
      <line x1={PAD_LEFT} y1={height - PAD_BOTTOM} x2={width - PAD_RIGHT} y2={height - PAD_BOTTOM} stroke={t.line} strokeWidth={1.5} />
      {xLabel && <text x={width - PAD_RIGHT} y={height - 4} fontSize={12} textAnchor="end" fill={t.muted}>{xLabel}</text>}
      {yLabel && <text x={PAD_LEFT + 4} y={PAD_TOP + 10} fontSize={12} fill={t.muted}>{yLabel}</text>}
      <motion.polyline
        initial={{ opacity: 0, pathLength: 0 }}
        animate={{ opacity: 0.6, pathLength: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        fill="none" stroke={t.ink} strokeWidth={1.5} strokeDasharray="5 3"
        points={refPath}
      />
      {reference.map((p, i) => (
        <motion.circle
          key={`ref-${i}`} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={t.muted}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: i * staggerSec }}
        />
      ))}
      {points.map((p, i) => (
        <motion.circle
          key={`pt-${i}`} cx={sx(p.x)} cy={sy(p.y)} r={p.size ?? 6.5}
          fill={p.color ?? t.ok} stroke={t.bg} strokeWidth={2}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.4 + i * staggerSec, ease: 'easeOut' }}
        >
          {p.label && <title>{p.label}</title>}
        </motion.circle>
      ))}
    </svg>
  );
}

/* ── Histogram ──────────────────────────────────────────────────────────── */

function HistogramChart({ t, bars, max, height = 130, ariaLabel, staggerSec }: Extract<ChartPanelProps, { variant: 'histogram' }> & { staggerSec: number }) {
  const width = 320;
  const domainMax = max ?? Math.max(...bars.map((b) => b.value), 1);
  const sy = scaleLinear([0, domainMax], [0, height - 20]);
  const slot = (width - 24) / Math.max(bars.length, 1);
  const barWidth = Math.max(8, slot - 8);
  return (
    <svg role="img" aria-label={ariaLabel ?? 'histogram'} viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ marginTop: 8 }}>
      {bars.map((b, i) => {
        const h = sy(b.value);
        const fill = b.highlight ? t.ink : t.line;
        return (
          <motion.rect
            key={i}
            x={14 + i * slot} y={height - 10 - h} width={barWidth} height={h}
            fill={fill} opacity={b.highlight ? 1 : 0.55}
            initial={{ scaleY: 0, transformOrigin: `center ${height - 10}px` }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.45, delay: i * staggerSec, ease: 'easeOut' }}
          />
        );
      })}
    </svg>
  );
}

/* ── Waveform ───────────────────────────────────────────────────────────── */

function WaveformChart({ t, samples, active, height = 70, ariaLabel, staggerSec }: Extract<ChartPanelProps, { variant: 'waveform' }> & { staggerSec: number }) {
  const width = 300;
  const slot = width / Math.max(samples.length, 1);
  const barWidth = Math.max(2, slot - 2);
  const sy = scaleLinear([0, 1], [4, height - 14]);
  return (
    <svg role="img" aria-label={ariaLabel ?? 'waveform'} viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ marginTop: 4 }}>
      {samples.map((v, i) => {
        const h = active ? sy(Math.max(0, Math.min(1, v))) : 2;
        return (
          <motion.rect
            key={i} x={i * slot} y={height / 2 - h / 2} width={barWidth} height={h}
            fill={active ? t.ink : t.line} opacity={active ? 0.8 : 0.4}
            initial={{ scaleY: 0, transformOrigin: `center ${height / 2}px` }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.35, delay: i * staggerSec * 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </svg>
  );
}
