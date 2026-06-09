'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ACCENT } from '../_shared/data';
import { EmptyPanel } from '@/components/modules/core-engine/unique-tabs/_shared';
import { SPRING, motionSafe } from '@/lib/motion';

/* -- XP Curve Chart SVG --------------------------------------------------- */

interface XpCurveChartProps {
  data: { level: number; xp: number }[];
  maxXp: number;
  chartId?: string;
  color?: string;
}

// Point coordinates in the 0..100 chart space. `x` is purely index-based (it
// never changes between renders), so only `y` moves when the curve params do —
// that's why a `d`/`cy` morph reads as the line fluidly reshaping.
const pointX = (i: number, len: number) => (i === 0 ? 0 : (i / (len - 1)) * 100);
const pointY = (xp: number, maxXp: number) => 100 - (xp / maxXp) * 100;

export function XpCurveChart({
  data, maxXp, chartId = 'main', color = ACCENT,
}: XpCurveChartProps) {
  // Honor prefers-reduced-motion. We gate ONLY the transition (never the
  // rendered markup), so the one-time draw-in, the per-point stagger, and the
  // param-change morph all collapse to instant snaps for users who opt out —
  // without risking a hydration mismatch. See reference-reduced-motion-pattern.
  const prefersReduced = useReducedMotion();
  // Short spring used to morph the curve (`d`) + dots (`cy`) when the tuning
  // sliders change, so dragging reshapes the line fluidly instead of teleporting.
  const morph = motionSafe(SPRING.snappy, prefersReduced);

  if (data.length < 2 || maxXp <= 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <EmptyPanel
          label="Not enough data points"
          hint="The XP curve needs at least two levels with positive XP to render."
          height={120}
        />
      </div>
    );
  }

  const gradientId = `areaGradient-${chartId}`;
  const filterId = `glow-curve-${chartId}`;

  const pathData = data.reduce((acc, point, i, a) => {
    const x = pointX(i, a.length);
    const y = pointY(point.xp, maxXp);

    if (i === 0) return `M ${x},${y}`;

    const prevX = pointX(i - 1, a.length);
    const prevY = pointY(a[i - 1].xp, maxXp);

    const cp1x = prevX + (x - prevX) * 0.5;
    const cp1y = prevY;
    const cp2x = prevX + (x - prevX) * 0.5;
    const cp2y = y;

    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
  }, '');

  // Same command structure every render (the level count is fixed), so framer
  // can interpolate the embedded numbers and morph the shape smoothly.
  const areaData = `${pathData} L 100,100 L 0,100 Z`;

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

          {/* Filled area: fades in once, then morphs its `d` with the params. */}
          <motion.path
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, d: areaData }}
            transition={{ opacity: motionSafe({ duration: 1 }, prefersReduced), d: morph }}
            fill={`url(#${gradientId})`}
            vectorEffect="non-scaling-stroke"
          />

          {/* Curve stroke: draws in once (pathLength), then morphs its `d`. */}
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1, d: pathData }}
            transition={{
              pathLength: motionSafe({ duration: 1.5, ease: 'easeOut' } as const, prefersReduced),
              d: morph,
            }}
            fill="none"
            stroke={color}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `url(#${filterId})` }}
          />

          {data.map((d, i) => {
            const x = pointX(i, data.length);
            const y = pointY(d.xp, maxXp);
            return (
              <motion.circle
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1, cy: `${y}%` }}
                transition={{
                  scale: motionSafe({ delay: 1 + (i * 0.05), type: 'spring' } as const, prefersReduced),
                  cy: morph,
                }}
                cx={`${x}%`}
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
