'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader } from '../_design';
import { NormalizedLineChart } from '../_shared';
import { ACCENT, MULTI_CURVE_SERIES } from './data';

export function MultiCurveOverlay() {
  const [curveVisibility, setCurveVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MULTI_CURVE_SERIES.map(s => [s.id, true]))
  );

  const visibleSeries = MULTI_CURVE_SERIES.filter(s => curveVisibility[s.id]);
  const multiCurveMax = Math.max(...visibleSeries.flatMap(s => s.points.map(p => p.y)), 1);

  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <div className="flex items-center justify-between mb-2.5">
        <SectionHeader icon={Layers} label="Multi-Curve Overlay" color={ACCENT} />
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Curve visibility controls">
          {MULTI_CURVE_SERIES.map(s => (
            <label key={s.id} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={curveVisibility[s.id] ?? true}
                onChange={() => setCurveVisibility(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                className="w-3 h-3 rounded accent-amber-500"
                aria-label={`Toggle ${s.label} curve visibility`}
              />
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <NormalizedLineChart
        height="h-[260px]"
        yLabels={[multiCurveMax.toLocaleString(), Math.floor(multiCurveMax / 2).toLocaleString(), '0']}
        xLabels={['Lv 0', 'Lv 25', 'Lv 50']}
        defs={visibleSeries.map(s => (
          <linearGradient key={`grad-${s.id}`} id={`mcGrad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      >
        {visibleSeries.map(s => {
          const pathD = s.points
            .map((p, i) => {
              const x = (p.x / 50) * 100;
              const y = 100 - (p.y / multiCurveMax) * 100;
              return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
            })
            .join(' ');
          const lastPt = s.points[s.points.length - 1];
          const areaD = `${pathD} L ${(lastPt.x / 50) * 100},100 L 0,100 Z`;

          return (
            <g key={s.id}>
              <motion.path
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
                d={areaD} fill={`url(#mcGrad-${s.id})`}
              />
              <motion.path
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
                d={pathD} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </NormalizedLineChart>
    </BlueprintPanel>
  );
}
