'use client';

import { motion } from 'framer-motion';
import { STAGGER_SLOW } from '@/components/modules/core-engine/unique-tabs/_shared';
import type { ItemGenome } from '@/types/item-genome';
import { AXIS_CONFIGS } from './data';

/* ── DNA Strand Visualization ──────────────────────────────────────────── */

export function DNAStrand({ genome }: { genome: ItemGenome }) {
  const bases = 20;
  const height = 120;
  const width = 260;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {Array.from({ length: bases }).map((_, i) => {
        const x = (i / (bases - 1)) * (width - 20) + 10;
        const y1 = height / 2 + Math.sin((i / bases) * Math.PI * 4) * 25;
        const y2 = height / 2 - Math.sin((i / bases) * Math.PI * 4) * 25;
        const traitIdx = i % 4;
        const cfg = AXIS_CONFIGS[traitIdx];
        const gene = genome.traits.find((g) => g.axis === cfg.axis);
        const intensity = gene?.weight ?? 0.25;

        return (
          <g key={i}>
            <line x1={x} y1={y1} x2={x} y2={y2} stroke={`${cfg.color}40`} strokeWidth="1" />
            <motion.circle
              cx={x} cy={y1} r={2 + intensity * 3}
              fill={cfg.color}
              style={{ filter: `drop-shadow(0 0 ${2 + intensity * 4}px ${cfg.color})` }}
              animate={{ r: [2 + intensity * 3, 3 + intensity * 3, 2 + intensity * 3] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * STAGGER_SLOW }}
            />
            <motion.circle
              cx={x} cy={y2} r={2 + intensity * 3}
              fill={cfg.color}
              opacity={0.6}
              animate={{ r: [2 + intensity * 2, 3 + intensity * 2, 2 + intensity * 2] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * STAGGER_SLOW + 1 }}
            />
          </g>
        );
      })}
      {/* Backbone curves */}
      <path
        d={Array.from({ length: bases }).map((_, i) => {
          const x = (i / (bases - 1)) * (width - 20) + 10;
          const y = height / 2 + Math.sin((i / bases) * Math.PI * 4) * 25;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')}
        fill="none" stroke={`${genome.color}50`} strokeWidth="1.5"
      />
      <path
        d={Array.from({ length: bases }).map((_, i) => {
          const x = (i / (bases - 1)) * (width - 20) + 10;
          const y = height / 2 - Math.sin((i / bases) * Math.PI * 4) * 25;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')}
        fill="none" stroke={`${genome.color}50`} strokeWidth="1.5"
      />
    </svg>
  );
}
