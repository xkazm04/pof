'use client';

import { motion } from 'framer-motion';
import { MOTION } from '@/lib/constants';
import { healthColor } from './helpers';

// ─── Sub-components ──────────────────────────────────────────────────────────

export function CombinedHealthGauge({ score }: { score: number }) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const sweepAngle = 270;

  const polarToCart = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  const arcPath = (startDeg: number, endDeg: number, r: number) => {
    const start = polarToCart(startDeg, r);
    const end = polarToCart(endDeg, r);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const trackPath = arcPath(startAngle, startAngle + sweepAngle, radius);
  const clamped = Math.max(0, Math.min(100, score));
  const scoreEndAngle = startAngle + (clamped / 100) * sweepAngle;
  const scorePath = clamped > 0 ? arcPath(startAngle, scoreEndAngle, radius) : '';
  const color = healthColor(score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: MOTION.slow }}
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <path d={trackPath} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} strokeLinecap="round" />
        {clamped > 0 && (
          <motion.path
            d={scorePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: MOTION.ease }}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-2xs text-text-muted font-medium mt-0.5">/100</span>
      </div>
    </motion.div>
  );
}
