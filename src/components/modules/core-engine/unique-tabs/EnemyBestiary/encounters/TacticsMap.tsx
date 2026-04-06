'use client';

import type { TacticsEnemy } from '../data';

import { ACCENT_RED, OVERLAY_WHITE, MODULE_COLORS, withOpacity, OPACITY_12, OPACITY_20, OPACITY_25, OPACITY_30, OPACITY_40, OPACITY_8, OPACITY_3 } from '@/lib/chart-colors';
interface TacticsMapProps {
  enemies: TacticsEnemy[];
  roleColors: Record<TacticsEnemy['role'], string>;
  accent?: string;
}

export function TacticsMap({ enemies, roleColors }: TacticsMapProps) {
  return (
    <svg width={200} height={200} viewBox="0 0 160 120" className="flex-shrink-0">
      {/* Arena bounds */}
      <rect x={4} y={4} width={152} height={112} rx={4} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="1" strokeDasharray="4 4" />
      {/* Grid */}
      {[40, 80, 120].map(x => <line key={`vg${x}`} x1={x} y1={4} x2={x} y2={116} stroke={withOpacity(OVERLAY_WHITE, OPACITY_3)} strokeWidth="1" />)}
      {[30, 60, 90].map(y => <line key={`hg${y}`} x1={4} y1={y} x2={156} y2={y} stroke={withOpacity(OVERLAY_WHITE, OPACITY_3)} strokeWidth="1" />)}
      {/* Player at center */}
      <circle cx={80} cy={60} r={8} fill={withOpacity(MODULE_COLORS.core, OPACITY_20)} stroke={MODULE_COLORS.core} strokeWidth="1.5" />
      <text x={80} y={60} textAnchor="middle" dominantBaseline="central" className="text-xs font-mono font-bold" fill={MODULE_COLORS.core}>P</text>
      {/* Enemies */}
      {enemies.map(enemy => {
        const roleColor = roleColors[enemy.role];
        return (
          <g key={enemy.id}>
            <circle cx={enemy.x} cy={enemy.y} r={7}
              fill={`${withOpacity(roleColor, OPACITY_12)}`} stroke={roleColor} strokeWidth="1.5"
            />
            <text x={enemy.x} y={enemy.y} textAnchor="middle" dominantBaseline="central"
              className="text-xs font-mono font-bold pointer-events-none" fill={roleColor}>
              {enemy.id}
            </text>
            <text x={enemy.x} y={enemy.y + 14} textAnchor="middle"
              className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_40)}>
              {enemy.label}
            </text>
            {enemy.role === 'attacking' && (
              <line x1={enemy.x} y1={enemy.y} x2={80} y2={60}
                stroke={`${withOpacity(roleColor, OPACITY_25)}`} strokeWidth="1" strokeDasharray="3 3" />
            )}
            {enemy.role === 'flanking' && (
              <path
                d={`M ${enemy.x} ${enemy.y} Q ${enemy.x + 16} ${enemy.y - 24} ${80} ${60}`}
                fill="none" stroke={`${withOpacity(roleColor, OPACITY_30)}`} strokeWidth="1" strokeDasharray="3 2"
              />
            )}
          </g>
        );
      })}
      {/* Attack slot rotation arrow */}
      <path d="M 36 24 C 28 12, 56 8, 60 20" fill="none" stroke={withOpacity(ACCENT_RED, OPACITY_30)} strokeWidth="1" markerEnd="url(#arrowhead)" />
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill={withOpacity(ACCENT_RED, OPACITY_40)} />
        </marker>
      </defs>
    </svg>
  );
}
