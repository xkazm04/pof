'use client';

import { motion } from 'framer-motion';
import type { SpawnPoint } from '@/components/modules/core-engine/unique-tabs/EnemyBestiary/data';
import { MODULE_COLORS, OPACITY_10, OPACITY_15, OPACITY_30, OPACITY_40, OVERLAY_WHITE, withOpacity } from '@/lib/chart-colors';

interface SpawnFormationVizProps {
  spawnPoints: SpawnPoint[];
  accent?: string;
}

export function SpawnFormationViz({ spawnPoints, accent = MODULE_COLORS.content }: SpawnFormationVizProps) {
  return (
    <svg width={200} height={200} viewBox="0 0 140 140" className="flex-shrink-0">
      {/* Arena circle */}
      <circle cx={70} cy={70} r={58.3} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_10)} strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={70} cy={70} r={4} fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} />
      <text x={70} y={77.8} textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_40)}>CENTER</text>
      {/* Spawn points */}
      {spawnPoints.map(sp => (
        <g key={sp.id}>
          <motion.circle
            cx={sp.x} cy={sp.y} r={10}
            fill={withOpacity(accent, OPACITY_15)} stroke={accent} strokeWidth="1.5"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: sp.order * 0.15, type: 'spring' }}
          />
          <text x={sp.x} y={sp.y + 1} textAnchor="middle" dominantBaseline="central"
            className="text-xs font-mono font-bold pointer-events-none" fill={accent}>
            {sp.order}
          </text>
          {/* Connection line to center */}
          <line x1={70} y1={70} x2={sp.x} y2={sp.y} stroke={withOpacity(accent, OPACITY_15)} strokeWidth="1" strokeDasharray="2 3" />
        </g>
      ))}
    </svg>
  );
}
