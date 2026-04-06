'use client';

import { motion } from 'framer-motion';
import { MODULE_COLORS, OVERLAY_WHITE,
  withOpacity, OPACITY_15, OPACITY_10, OPACITY_30, OPACITY_40,
} from '@/lib/chart-colors';
import type { SpawnPoint } from '../data';

export type SpawnFormation = 'Circle' | 'Line' | 'Ambush';

interface SpawnFormationVizProps {
  spawnPoints: SpawnPoint[];
  formation?: SpawnFormation;
  accent?: string;
}

/** Reposition spawn points based on formation type */
function layoutPoints(points: SpawnPoint[], formation: SpawnFormation): { x: number; y: number; order: number; id: number; color?: string; role?: string }[] {
  const cy = 70;
  if (formation === 'Line') {
    const spacing = 100 / (points.length + 1);
    return points.map((sp, i) => ({ id: sp.id, order: sp.order, x: 20 + spacing * (i + 1), y: cy, color: sp.color, role: sp.role }));
  }
  if (formation === 'Ambush') {
    // Two clusters flanking top-left and bottom-right
    const half = Math.ceil(points.length / 2);
    return points.map((sp, i) => {
      const cluster = i < half;
      const idx = cluster ? i : i - half;
      const groupSize = cluster ? half : points.length - half;
      const baseX = cluster ? 25 : 115;
      const baseY = cluster ? 30 : 110;
      const offsetY = groupSize > 1 ? (idx / (groupSize - 1) - 0.5) * 40 : 0;
      return { id: sp.id, order: sp.order, x: baseX, y: baseY + offsetY, color: sp.color, role: sp.role };
    });
  }
  // Default: Circle (original positions)
  return points.map(sp => ({ id: sp.id, order: sp.order, x: sp.x, y: sp.y, color: sp.color, role: sp.role }));
}

export function SpawnFormationViz({ spawnPoints, formation = 'Circle', accent = MODULE_COLORS.content }: SpawnFormationVizProps) {
  const laid = layoutPoints(spawnPoints, formation);

  return (
    <svg width={200} height={200} viewBox="0 0 140 140" className="flex-shrink-0">
      {/* Arena circle */}
      <circle cx={70} cy={70} r={58.3} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_10)} strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={70} cy={70} r={4} fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} />
      <text x={70} y={77.8} textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_40)}>CENTER</text>
      {/* Spawn points — role-colored when available */}
      {laid.map(sp => {
        const dotColor = sp.color ?? accent;
        return (
          <g key={sp.id}>
            <motion.circle
              cx={sp.x} cy={sp.y} r={10}
              fill={withOpacity(dotColor, OPACITY_15)} stroke={dotColor} strokeWidth="1.5"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: sp.order * 0.15, type: 'spring' }}
            />
            <text x={sp.x} y={sp.y + 1} textAnchor="middle" dominantBaseline="central"
              className="text-xs font-mono font-bold pointer-events-none" fill={dotColor}>
              {sp.order}
            </text>
            {sp.role && (
              <text x={sp.x} y={sp.y + 16} textAnchor="middle"
                className="text-xs font-mono uppercase" fill={withOpacity(dotColor, OPACITY_40)}>
                {sp.role.slice(0, 3)}
              </text>
            )}
            <line x1={70} y1={70} x2={sp.x} y2={sp.y} stroke={withOpacity(dotColor, OPACITY_15)} strokeWidth="1" strokeDasharray="2 3" />
          </g>
        );
      })}
    </svg>
  );
}
