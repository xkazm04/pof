'use client';

import { Info } from 'lucide-react';
import {
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10,
} from '@/lib/chart-colors';
import { MOCK_OBSTACLES } from './constants';
import { coverColor } from './helpers';
import type { CoverPoint } from './types';

interface CoverSidePanelProps {
  points: CoverPoint[];
  coveredCount: number;
  elevatedCount: number;
  sampleCount: number;
  rings: number;
  minRadius: number;
  maxRadius: number;
  coverCheck: number;
  hoveredPoint: number | null;
  bestPositions: CoverPoint[];
  getScore: (pt: CoverPoint) => number;
}

export function CoverSidePanel({
  points, coveredCount, elevatedCount,
  sampleCount, rings, minRadius, maxRadius, coverCheck,
  hoveredPoint, bestPositions, getScore,
}: CoverSidePanelProps) {
  return (
    <div className="flex-1 p-4 border-t sm:border-t-0 sm:border-l border-border/40 space-y-3 min-w-0">
      {/* Stats summary */}
      <div>
        <h4 className="text-xs font-bold text-text mb-2">Coverage Analysis</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Total Points', value: points.length, color: ACCENT_VIOLET },
            { label: 'Covered', value: coveredCount, color: STATUS_SUCCESS },
            { label: 'Elevated', value: elevatedCount, color: ACCENT_ORANGE },
            { label: 'Obstacles', value: MOCK_OBSTACLES.length, color: ACCENT_CYAN },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-2xs text-text-muted">{s.label}</span>
              <span className="text-2xs font-mono font-bold" style={{ color: s.color }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Generator parameters */}
      <div>
        <h4 className="text-xs font-bold text-text mb-1.5">Generator Params</h4>
        <div className="space-y-1">
          {[
            { label: 'SampleCount', value: String(sampleCount), desc: 'Per ring' },
            { label: 'NumberOfRings', value: String(rings), desc: 'Radial layers' },
            { label: 'MinRadius', value: `${minRadius} UU`, desc: 'Inner boundary' },
            { label: 'MaxRadius', value: `${maxRadius} UU`, desc: 'Outer boundary' },
            { label: 'CoverCheckDist', value: `${coverCheck} UU`, desc: 'Geometry trace' },
          ].map((p) => (
            <div key={p.label} className="flex items-baseline gap-2">
              <span className="text-2xs font-mono shrink-0" style={{ color: ACCENT_EMERALD }}>{p.label}</span>
              <span className="text-2xs font-mono font-bold text-text">{p.value}</span>
              <span className="text-2xs text-text-muted ml-auto">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm */}
      <div>
        <h4 className="text-xs font-bold text-text mb-1.5">Cover Detection Algorithm</h4>
        <div className="text-2xs text-text-muted leading-relaxed space-y-1">
          <p className="font-mono" style={{ color: ACCENT_EMERALD }}>
            for each ring in [Min..Max]:
          </p>
          <div className="pl-3 space-y-0.5">
            <p><span className="font-mono text-text">1.</span> Generate points at ring radius</p>
            <p><span className="font-mono text-text">2.</span> Trace away from threat → detect walls</p>
            <p><span className="font-mono text-text">3.</span> If hit: place point at wall surface</p>
            <p><span className="font-mono text-text">4.</span> No hit: trace toward threat for pillars</p>
            <p><span className="font-mono text-text">5.</span> Project survivors to NavMesh</p>
          </div>
        </div>
      </div>

      {/* Scoring tests */}
      <div>
        <h4 className="text-xs font-bold text-text mb-1.5">Scoring Pipeline</h4>
        <div className="space-y-1.5">
          {[
            { test: 'LineOfSight', cost: 'High', desc: '3-height trace → exposure %', color: ACCENT_CYAN },
            { test: 'ElevationAdv', cost: 'Low', desc: 'Height diff → 0-1 bonus', color: ACCENT_ORANGE },
            { test: 'FlankAngle', cost: 'Low', desc: 'Compose with existing test', color: ACCENT_EMERALD },
            { test: 'PathExists', cost: 'High', desc: 'Nav reachability filter', color: ACCENT_VIOLET },
          ].map((t) => (
            <div key={t.test} className="flex items-center gap-2">
              <span
                className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
                style={{
                  backgroundColor: `${t.color}${OPACITY_10}`,
                  color: t.color,
                  border: `1px solid ${t.color}30`,
                }}
              >
                {t.test}
              </span>
              <span
                className="text-2xs font-mono px-1 py-0.5 rounded shrink-0"
                style={{
                  color: t.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS,
                  backgroundColor: `${(t.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS)}${OPACITY_10}`,
                }}
              >
                {t.cost}
              </span>
              <span className="text-2xs text-text-muted">{t.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div
        className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
        style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
      >
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Cover positions are generated from <strong>level geometry traces</strong>, not
          pre-placed markers. AI dynamically finds walls, pillars, and elevation changes
          in any environment.
        </span>
      </div>

      {/* Top cover positions */}
      {hoveredPoint === null && (
        <div>
          <h4 className="text-xs font-bold text-text mb-1.5">Best Positions</h4>
          <div className="space-y-1">
            {bestPositions
              .map((pt, i) => {
                const score = getScore(pt);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: coverColor(score) }}
                    />
                    <span className="text-2xs font-mono text-text-muted w-4 shrink-0">
                      #{i + 1}
                    </span>
                    <div className="flex-1 h-3 bg-surface-deep/50 rounded-sm overflow-hidden border border-border/30">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          backgroundColor: coverColor(score),
                          width: `${score * 100}%`,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span
                      className="text-2xs font-mono font-bold w-10 text-right shrink-0"
                      style={{ color: coverColor(score) }}
                    >
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
