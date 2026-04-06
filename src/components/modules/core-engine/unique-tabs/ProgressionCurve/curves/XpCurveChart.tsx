'use client';

import { motion } from 'framer-motion';
import { ACCENT } from '../data';

/* -- XP Curve Chart SVG --------------------------------------------------- */

interface XpCurveChartProps {
  data: { level: number; xp: number }[];
  maxXp: number;
  chartId?: string;
  color?: string;
}

export function XpCurveChart({
  data, maxXp, chartId = 'main', color = ACCENT,
}: XpCurveChartProps) {
  const gradientId = `areaGradient-${chartId}`;
  const filterId = `glow-curve-${chartId}`;

  const pathData = data.reduce((acc, point, i, a) => {
    const x = i === 0 ? 0 : (i / (a.length - 1)) * 100;
    const y = 100 - (point.xp / maxXp) * 100;

    if (i === 0) return `M ${x},${y}`;

    const prevX = (i - 1) === 0 ? 0 : ((i - 1) / (a.length - 1)) * 100;
    const prevY = 100 - (a[i - 1].xp / maxXp) * 100;

    const cp1x = prevX + (x - prevX) * 0.5;
    const cp1y = prevY;
    const cp2x = prevX + (x - prevX) * 0.5;
    const cp2y = y;

    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
  }, '');

  return (
    <div className="w-full h-full relative">
      <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted leading-none z-10">
        <span>{maxXp >= 1000 ? `${(maxXp / 1000).toFixed(1)}k` : maxXp}</span>
        <span>{maxXp >= 1000 ? `${(maxXp * 0.5 / 1000).toFixed(1)}k` : Math.floor(maxXp * 0.5)}</span>
        <span>0</span>
      </div>

      <div className="absolute left-14 right-2 top-2 bottom-6 flex flex-col justify-between pointer-events-none opacity-20 z-0">
        <div className="border-b border-dashed border-border w-full" />
        <div className="border-b border-dashed border-border w-full" />
        <div className="border-b border-solid border-border w-full" />
      </div>

      <div className="absolute left-14 right-2 top-2 bottom-6 z-10">
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <motion.path
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
            d={`${pathData} L 100,100 L 0,100 Z`}
            fill={`url(#${gradientId})`}
            vectorEffect="non-scaling-stroke"
          />

          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `url(#${filterId})` }}
          />

          {data.map((d, i) => {
            const x = i === 0 ? 0 : (i / (data.length - 1)) * 100;
            const y = 100 - (d.xp / maxXp) * 100;
            return (
              <motion.circle
                key={i}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 + (i * 0.05), type: "spring" }}
                cx={`${x}%`} cy={`${y}%`}
                r="4"
                fill="var(--surface-deep)"
                stroke={color}
                strokeWidth="2"
                className="cursor-pointer transition-colors duration-200"
                vectorEffect="non-scaling-stroke"
              >
                <title>Level {d.level}: {d.xp.toLocaleString()} XP</title>
              </motion.circle>
            );
          })}
        </svg>
      </div>

      <div className="absolute left-14 right-2 bottom-0 flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted leading-none pt-1 border-t border-border/40">
        {data.filter((_, i) => i % 2 === 0).map((d) => (
          <span key={d.level}>Lv {d.level}</span>
        ))}
      </div>
    </div>
  );
}
