'use client';

import { motion } from 'framer-motion';
import { OVERLAY_WHITE, OPACITY_6, withOpacity } from '@/lib/chart-colors';
import { GROWTH_BUILDS } from '../data';

export function AttributeGrowthChart() {
  const w = 500;
  const h = 150;
  const pad = { top: 10, right: 20, bottom: 30, left: 45 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxPower = Math.max(...GROWTH_BUILDS.flatMap(b => b.points.map(p => p.power)));
  const maxLevel = 50;

  const toX = (level: number) => pad.left + (level / maxLevel) * chartW;
  const toY = (power: number) => pad.top + chartH - (power / maxPower) * chartH;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
      {/* Grid lines */}
      {[0, 200, 400, 600].map(v => (
        <g key={v}>
          <line x1={pad.left} y1={toY(v)} x2={w - pad.right} y2={toY(v)} stroke={withOpacity(OVERLAY_WHITE, OPACITY_6)} strokeWidth={1} />
          <text x={pad.left - 8} y={toY(v) + 3} textAnchor="end" className="text-xs font-mono fill-[var(--text-muted)]">{v}</text>
        </g>
      ))}
      {/* X-axis labels */}
      {[1, 10, 20, 30, 40, 50].map(lvl => (
        <text key={lvl} x={toX(lvl)} y={h - 5} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]">Lv{lvl}</text>
      ))}
      {/* Build lines */}
      {GROWTH_BUILDS.map((build) => {
        const pathData = build.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.level)} ${toY(p.power)}`).join(' ');
        return (
          <motion.g key={build.name}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          >
            <path d={pathData} fill="none" stroke={build.color} strokeWidth={2} opacity={0.8} />
            {build.points.map((p, pi) => (
              <circle key={pi} cx={toX(p.level)} cy={toY(p.power)} r={2.5} fill={build.color} opacity={0.9} />
            ))}
          </motion.g>
        );
      })}
      {/* Legend */}
      {GROWTH_BUILDS.map((build, i) => (
        <g key={build.name} transform={`translate(${pad.left + i * 90}, ${h - 18})`}>
          <rect width={10} height={3} rx={1} fill={build.color} />
          <text x={14} y={4} className="text-xs font-mono font-bold" fill={build.color}>{build.name}</text>
        </g>
      ))}
      {/* Axis labels */}
      <text x={w / 2} y={h} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]">Level</text>
    </svg>
  );
}
