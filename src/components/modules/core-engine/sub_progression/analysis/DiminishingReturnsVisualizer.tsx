'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { NormalizedLineChart } from '../../unique-tabs/_shared';
import { ACCENT, DR_ATTRIBUTES, type DRAttribute } from '../_shared/data';
import { safeDivide, hasPlottableSpread } from '../_shared/chartMath';
import { ChartEmptyState } from '../_shared/ChartEmptyState';

interface DiminishingReturnsVisualizerProps {
  /** Override the diminishing-returns dataset (defaults to the shipped attributes). */
  attributes?: DRAttribute[];
}

export function DiminishingReturnsVisualizer({
  attributes = DR_ATTRIBUTES,
}: DiminishingReturnsVisualizerProps) {
  const [selectedDRAttr, setSelectedDRAttr] = useState(0);

  const attr = attributes[selectedDRAttr] ?? attributes[0];
  const marginals = attr?.curve.map(c => c.marginalValue) ?? [];
  // Floor the divisor at the series max; a flat/all-zero/empty curve has no
  // spread to normalize against and falls back to an explicit empty state.
  const maxMarginal = Math.max(0, ...marginals);
  const plottable = hasPlottableSpread(marginals);

  // Lay out the SVG coordinate math once per (attribute, max) instead of
  // re-deriving each point's x/y three separate times (polyline, area polygon,
  // dot circles) on every render. The polyline string, area-polygon string and
  // dot list are all built from this single shared `points` pass.
  const geometry = useMemo(() => {
    const curve = attr?.curve ?? [];
    const points = curve.map((c) => ({
      x: (c.points / 100) * 100,
      y: 100 - safeDivide(c.marginalValue, maxMarginal) * 90,
      marginalValue: c.marginalValue,
      points: c.points,
    }));
    const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPoints =
      points.length > 0
        ? [
            ...points.map((p) => `${p.x},${p.y}`),
            `${points[points.length - 1].x},100`,
            `${points[0].x},100`,
          ].join(' ')
        : '';
    return { points, linePoints, areaPoints };
  }, [attr, maxMarginal]);

  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <SectionHeader icon={TrendingUp} label="Diminishing Returns Visualizer" color={ACCENT} />

      <div className="flex items-center gap-2 mt-2.5 mb-2.5">
        {attributes.map((a, idx) => (
          <button
            key={a.name}
            onClick={() => setSelectedDRAttr(idx)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
            style={{
              backgroundColor: selectedDRAttr === idx ? `${a.color}${OPACITY_15}` : 'transparent',
              borderColor: selectedDRAttr === idx ? `${a.color}${OPACITY_30}` : 'var(--border)',
              color: selectedDRAttr === idx ? a.color : 'var(--text-muted)',
            }}
          >
            {a.name}
          </button>
        ))}
      </div>

      {!plottable ? (
        <ChartEmptyState message="No diminishing-returns data to plot" />
      ) : (
        <NormalizedLineChart
          height="h-[200px]"
          showGrid={false}
          yLabels={[maxMarginal.toFixed(1), (maxMarginal / 2).toFixed(1), '0']}
          xLabels={['10 pts', '50 pts', '100 pts']}
          overlay={
            <div className="absolute top-2 right-4 text-xs font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border" style={{ color: attr.color, borderColor: `${attr.color}${OPACITY_20}`, backgroundColor: `${attr.color}${OPACITY_10}` }}>
              Soft Cap: {attr.softCap} pts
            </div>
          }
        >
          {(() => {
            const capX = (attr.softCap / 100) * 100;
            return (
              <>
                <line x1={capX} y1="0" x2={capX} y2="100" stroke={attr.color} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.6} />
                <text x={capX} y={8} textAnchor="middle" className="text-xs font-mono font-bold" fill={attr.color} vectorEffect="non-scaling-stroke">
                  Soft Cap
                </text>
              </>
            );
          })()}

          <motion.polyline
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}
            points={geometry.linePoints}
            fill="none" stroke={attr.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 3px ${attr.color})` }}
          />

          <motion.polygon
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            points={geometry.areaPoints}
            fill={`${attr.color}${OPACITY_10}`}
          />

          {geometry.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={attr.color} vectorEffect="non-scaling-stroke">
              <title>{p.points} points: +{p.marginalValue.toFixed(1)} value per point</title>
            </circle>
          ))}
        </NormalizedLineChart>
      )}
    </BlueprintPanel>
  );
}
