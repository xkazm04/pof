'use client';

import { motion } from 'framer-motion';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { SpawnPoint } from './data';

interface SpawnFormationVizProps {
  spawnPoints: SpawnPoint[];
  accent?: string;
}

export function SpawnFormationViz({ spawnPoints, accent = MODULE_COLORS.content }: SpawnFormationVizProps) {
  return (
    <svg width={200} height={200} viewBox="0 0 140 140" className="flex-shrink-0">
      {/* Arena circle */}
      <circle cx={70} cy={70} r={58.3} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={70} cy={70} r={4} fill="rgba(255,255,255,0.3)" />
      <text x={70} y={77.8} textAnchor="middle" className="text-[11px] font-mono fill-[rgba(255,255,255,0.4)]" style={{ fontSize: 11 }}>CENTER</text>
      {/* Spawn points */}
      {spawnPoints.map(sp => (
        <g key={sp.id}>
          <motion.circle
            cx={sp.x} cy={sp.y} r={10}
            fill={`${accent}26`} stroke={accent} strokeWidth="1.5"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: sp.order * 0.15, type: 'spring' }}
          />
          <text x={sp.x} y={sp.y + 1} textAnchor="middle" dominantBaseline="central"
            className="text-[11px] font-mono font-bold pointer-events-none" fill={accent} style={{ fontSize: 11 }}>
            {sp.order}
          </text>
          <line x1={70} y1={70} x2={sp.x} y2={sp.y} stroke={`${accent}26`} strokeWidth="1" strokeDasharray="2 3" />
        </g>
      ))}
    </svg>
  );
}
