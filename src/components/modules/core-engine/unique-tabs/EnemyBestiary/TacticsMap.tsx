'use client';

import type { TacticsEnemy } from './data';

interface TacticsMapProps {
  enemies: TacticsEnemy[];
  roleColors: Record<TacticsEnemy['role'], string>;
  accent?: string;
}

export function TacticsMap({ enemies, roleColors }: TacticsMapProps) {
  return (
    <svg width={200} height={200} viewBox="0 0 160 120" className="flex-shrink-0">
      {/* Arena bounds */}
      <rect x={4} y={4} width={152} height={112} rx={4} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Grid */}
      {[40, 80, 120].map(x => <line key={`vg${x}`} x1={x} y1={4} x2={x} y2={116} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
      {[30, 60, 90].map(y => <line key={`hg${y}`} x1={4} y1={y} x2={156} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
      {/* Player at center */}
      <circle cx={80} cy={60} r={8} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.5" />
      <text x={80} y={60} textAnchor="middle" dominantBaseline="central" className="text-[11px] font-mono font-bold fill-[#3b82f6]" style={{ fontSize: 11 }}>P</text>
      {/* Enemies */}
      {enemies.map(enemy => {
        const roleColor = roleColors[enemy.role];
        return (
          <g key={enemy.id}>
            <circle cx={enemy.x} cy={enemy.y} r={7}
              fill={`${roleColor}20`} stroke={roleColor} strokeWidth="1.5"
            />
            <text x={enemy.x} y={enemy.y} textAnchor="middle" dominantBaseline="central"
              className="text-[11px] font-mono font-bold pointer-events-none" fill={roleColor} style={{ fontSize: 11 }}>
              {enemy.id}
            </text>
            <text x={enemy.x} y={enemy.y + 14} textAnchor="middle"
              className="text-[11px] font-mono fill-[rgba(255,255,255,0.4)]" style={{ fontSize: 11 }}>
              {enemy.label}
            </text>
            {enemy.role === 'attacking' && (
              <line x1={enemy.x} y1={enemy.y} x2={80} y2={60}
                stroke={`${roleColor}40`} strokeWidth="1" strokeDasharray="3 3" />
            )}
            {enemy.role === 'flanking' && (
              <path
                d={`M ${enemy.x} ${enemy.y} Q ${enemy.x + 16} ${enemy.y - 24} ${80} ${60}`}
                fill="none" stroke={`${roleColor}50`} strokeWidth="1" strokeDasharray="3 2"
              />
            )}
          </g>
        );
      })}
      {/* Attack slot rotation arrow */}
      <path d="M 36 24 C 28 12, 56 8, 60 20" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="1" markerEnd="url(#arrowhead)" />
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="rgba(239,68,68,0.4)" />
        </marker>
      </defs>
    </svg>
  );
}
