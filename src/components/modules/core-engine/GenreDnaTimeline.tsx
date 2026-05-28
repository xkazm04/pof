'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Dna } from 'lucide-react';
import type { GameplayPattern, TelemetrySnapshot } from '@/types/telemetry';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  STATUS_LIME, STATUS_IMPROVED,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_PURPLE, ACCENT_PINK,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_RED,
} from '@/lib/chart-colors';

/**
 * Cinematic genre-DNA timeline. Renders each detected gameplay pattern as a
 * smooth confidence-over-time strand across scan history (oldest left → newest
 * right) so creators can watch their game's genetic drift scan-by-scan.
 */
const PATTERN_COLORS: Record<GameplayPattern, string> = {
  'dodge-roll-heavy':       STATUS_ERROR,
  'gas-combo-chains':       STATUS_WARNING,
  'projectile-dominant':    STATUS_INFO,
  'ai-squad-tactics':       STATUS_SUCCESS,
  'inventory-crafting':     ACCENT_EMERALD,
  'loot-driven':            ACCENT_PURPLE,
  'exploration-heavy':      ACCENT_ORANGE,
  'dialogue-branching':     STATUS_IMPROVED,
  'permadeath-rogue':       ACCENT_PINK,
  'performance-intensive':  ACCENT_RED,
  'multiplayer-sync':       ACCENT_CYAN,
  'stealth-mechanics':      ACCENT_VIOLET,
  'procedural-generation':  STATUS_LIME,
};

const W = 720;
const H = 240;
const PAD = { top: 14, right: 118, bottom: 26, left: 22 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function formatPatternName(p: string): string {
  return p.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const tension = 0.32;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function GenreDnaTimeline({ history }: { history: TelemetrySnapshot[] }) {
  const [hovered, setHovered] = useState<GameplayPattern | null>(null);

  // History is newest-first; reverse to chronological (oldest left → newest right).
  const scans = useMemo(() => [...history].reverse(), [history]);

  // Union of every pattern that has ever been detected, sorted by *latest*
  // confidence desc so the strongest strand sits on top of the label stack.
  const patterns = useMemo<GameplayPattern[]>(() => {
    const set = new Set<GameplayPattern>();
    for (const s of scans) for (const p of s.detectedPatterns) set.add(p.pattern);
    const latest = scans[scans.length - 1]?.detectedPatterns ?? [];
    const latestMap = new Map(latest.map(p => [p.pattern, p.confidence] as const));
    return [...set].sort((a, b) => {
      const ca = latestMap.get(a) ?? 0;
      const cb = latestMap.get(b) ?? 0;
      return cb - ca || a.localeCompare(b);
    });
  }, [scans]);

  if (scans.length < 2 || patterns.length === 0) return null;

  const xFor = (i: number) => PAD.left + (i / (scans.length - 1)) * plotW;
  const yFor = (c: number) => PAD.top + plotH - (c / 100) * plotH;

  const series = patterns.map((pattern, idx) => {
    const points = scans.map((s, i) => ({
      x: xFor(i),
      y: yFor(s.detectedPatterns.find(p => p.pattern === pattern)?.confidence ?? 0),
    }));
    return {
      pattern,
      color: PATTERN_COLORS[pattern] ?? STATUS_INFO,
      points,
      path: buildSmoothPath(points),
      delay: idx * 0.05,
    };
  });

  const xTicks: number[] = scans.length <= 4
    ? scans.map((_, i) => i)
    : [0, Math.floor(scans.length / 2), scans.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: 0.18 }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Dna className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Genre DNA Timeline
        </span>
        <span className="text-2xs text-text-muted">
          {scans.length} scans &middot; {patterns.length} pattern{patterns.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-surface-deep border border-border rounded-lg p-2">
        <svg
          role="img"
          aria-label="Pattern confidence over time"
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHovered(null)}
        >
          {[0, 25, 50, 75, 100].map(c => (
            <line
              key={c}
              x1={PAD.left} x2={W - PAD.right}
              y1={yFor(c)} y2={yFor(c)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={c === 50 ? '0' : '2 3'}
              strokeOpacity={c === 0 || c === 100 ? 0.6 : 0.3}
            />
          ))}
          {[100, 50, 0].map(c => (
            <text key={c} x={PAD.left - 4} y={yFor(c) + 3} textAnchor="end"
              fill="var(--text-muted)" style={{ fontSize: 9 }}>
              {c}
            </text>
          ))}

          {series.map(({ pattern, color, path, points, delay }) => {
            const dim = hovered !== null && hovered !== pattern;
            const last = points[points.length - 1];
            const labelY = Math.max(PAD.top + 4, Math.min(H - PAD.bottom - 2, last.y + 3));
            return (
              <g
                key={pattern}
                onMouseEnter={() => setHovered(pattern)}
                style={{ cursor: 'pointer' }}
              >
                <motion.path
                  d={path} fill="none" stroke={color}
                  strokeWidth={6}
                  strokeOpacity={dim ? 0.04 : 0.16}
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay, ease: 'easeOut' }}
                />
                <motion.path
                  d={path} fill="none" stroke={color}
                  strokeWidth={1.75}
                  strokeOpacity={dim ? 0.22 : 1}
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay, ease: 'easeOut' }}
                />
                <motion.circle
                  cx={last.x} cy={last.y} r={hovered === pattern ? 4 : 3}
                  fill={color} fillOpacity={dim ? 0.3 : 1}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ duration: 0.3, delay: delay + 0.9 }}
                />
                <text
                  x={W - PAD.right + 8} y={labelY}
                  fill={color} opacity={dim ? 0.35 : 1}
                  style={{ fontSize: 9.5, fontWeight: 500 }}
                >
                  {formatPatternName(pattern)}
                </text>
                {/* Invisible wide hit-target for hover */}
                <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
              </g>
            );
          })}

          {xTicks.map(i => (
            <text
              key={scans[i].id}
              x={xFor(i)} y={H - 8}
              textAnchor={i === 0 ? 'start' : i === scans.length - 1 ? 'end' : 'middle'}
              fill="var(--text-muted)" style={{ fontSize: 9 }}
            >
              {new Date(scans[i].scannedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          ))}
        </svg>

        {hovered && (() => {
          const first = scans[0].detectedPatterns.find(p => p.pattern === hovered)?.confidence ?? 0;
          const latest = scans[scans.length - 1].detectedPatterns.find(p => p.pattern === hovered)?.confidence ?? 0;
          const delta = latest - first;
          const color = PATTERN_COLORS[hovered] ?? STATUS_INFO;
          const deltaColor = delta > 0 ? STATUS_SUCCESS : delta < 0 ? STATUS_ERROR : 'var(--text-muted)';
          return (
            <div className="flex items-center gap-3 px-2 pt-1.5 pb-0.5 text-2xs">
              <span style={{ color }} className="font-semibold">{formatPatternName(hovered)}</span>
              <span className="text-text-muted">first <span className="text-text">{first}%</span></span>
              <span className="text-text-muted">latest <span className="text-text">{latest}%</span></span>
              <span style={{ color: deltaColor }} className="font-semibold">
                {delta > 0 ? '+' : ''}{delta}
              </span>
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
}
