'use client';

import { motion } from 'framer-motion';

export function FlowArrow({ x1, y1, x2, y2, color, label, delay, dashed }: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; label?: string; delay: number; dashed?: boolean;
}) {
  const isStraight = x1 === x2;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.7 }}
      transition={{ delay, duration: 0.2 }}
    >
      {isStraight ? (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color} strokeWidth={1.5}
            strokeDasharray={dashed ? '4 3' : undefined} />
          <polygon
            points={`${x2 - 4},${y2 - 6} ${x2},${y2} ${x2 + 4},${y2 - 6}`}
            fill={color} />
        </>
      ) : (
        <>
          <path
            d={`M ${x1} ${y1} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth={1.5}
            strokeDasharray={dashed ? '4 3' : undefined} />
          <polygon
            points={`${x2 - 4},${y2 - 6} ${x2},${y2} ${x2 + 4},${y2 - 6}`}
            fill={color} />
        </>
      )}
      {label && (
        <text
          x={(x1 + x2) / 2 + (x1 === x2 ? 8 : 0)}
          y={(y1 + y2) / 2 - 3}
          className="text-2xs font-mono font-bold"
          fill={color} textAnchor="middle">
          {label}
        </text>
      )}
    </motion.g>
  );
}
