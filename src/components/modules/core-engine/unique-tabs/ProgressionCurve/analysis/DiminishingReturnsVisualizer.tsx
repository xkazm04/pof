'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { NormalizedLineChart } from '../../_shared';
import { ACCENT, DR_ATTRIBUTES } from '../data';

export function DiminishingReturnsVisualizer() {
  const [selectedDRAttr, setSelectedDRAttr] = useState(0);

  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <SectionHeader icon={TrendingUp} label="Diminishing Returns Visualizer" color={ACCENT} />

      <div className="flex items-center gap-2 mt-2.5 mb-2.5">
        {DR_ATTRIBUTES.map((attr, idx) => (
          <button
            key={attr.name}
            onClick={() => setSelectedDRAttr(idx)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
            style={{
              backgroundColor: selectedDRAttr === idx ? `${attr.color}${OPACITY_15}` : 'transparent',
              borderColor: selectedDRAttr === idx ? `${attr.color}${OPACITY_30}` : 'var(--border)',
              color: selectedDRAttr === idx ? attr.color : 'var(--text-muted)',
            }}
          >
            {attr.name}
          </button>
        ))}
      </div>

      {(() => {
        const attr = DR_ATTRIBUTES[selectedDRAttr];
        const maxMarginal = Math.max(...attr.curve.map(c => c.marginalValue));
        return (
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
              points={attr.curve.map((c) => {
                const x = (c.points / 100) * 100;
                const y = 100 - (c.marginalValue / maxMarginal) * 90;
                return `${x},${y}`;
              }).join(' ')}
              fill="none" stroke={attr.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 3px ${attr.color})` }}
            />

            <motion.polygon
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
              points={[
                ...attr.curve.map(c => `${(c.points / 100) * 100},${100 - (c.marginalValue / maxMarginal) * 90}`),
                `${(attr.curve[attr.curve.length - 1].points / 100) * 100},100`,
                `${(attr.curve[0].points / 100) * 100},100`,
              ].join(' ')}
              fill={`${attr.color}${OPACITY_10}`}
            />

            {attr.curve.map((c, i) => {
              const x = (c.points / 100) * 100;
              const y = 100 - (c.marginalValue / maxMarginal) * 90;
              return (
                <circle key={i} cx={x} cy={y} r="3" fill={attr.color} vectorEffect="non-scaling-stroke">
                  <title>{c.points} points: +{c.marginalValue.toFixed(1)} value per point</title>
                </circle>
              );
            })}
          </NormalizedLineChart>
        );
      })()}
    </BlueprintPanel>
  );
}
