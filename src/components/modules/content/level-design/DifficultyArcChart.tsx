'use client';

import type { RoomNode } from '@/types/level-design';

const DIFFICULTY_COLORS: Record<number, string> = {
  1: '#4ade80',
  2: '#a3e635',
  3: '#fbbf24',
  4: '#fb923c',
  5: '#f87171',
};

const PACING_ICONS: Record<string, string> = {
  rest: '\u25CB',      // ○
  buildup: '\u25B3',   // △
  rising: '\u25B2',    // ▲
  peak: '\u2B24',      // ⬤
  falling: '\u25BD',   // ▽
};

interface DifficultyArcChartProps {
  rooms: RoomNode[];
  difficultyArc: string[];
  accentColor: string;
  onSelectRoom: (roomId: string) => void;
}

export function DifficultyArcChart({
  rooms,
  difficultyArc,
  accentColor,
  onSelectRoom,
}: DifficultyArcChartProps) {
  // Order rooms by the difficulty arc (or by position if no arc defined)
  const orderedRooms = difficultyArc.length > 0
    ? difficultyArc.map((id) => rooms.find((r) => r.id === id)).filter(Boolean) as RoomNode[]
    : rooms;

  if (orderedRooms.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-[#4a4e6a]">Add rooms to see the difficulty arc.</p>
      </div>
    );
  }

  const chartW = Math.max(orderedRooms.length * 60, 200);
  const chartH = 100;
  const padX = 30;
  const padY = 15;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  const points = orderedRooms.map((room, i) => ({
    room,
    x: padX + (orderedRooms.length > 1 ? (i / (orderedRooms.length - 1)) * plotW : plotW / 2),
    y: padY + plotH - ((room.difficulty - 1) / 4) * plotH,
  }));

  // Create smoothed path
  const pathD = points.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
  }).join(' ');

  // Area fill path
  const areaD = pathD
    + ` L ${points[points.length - 1].x} ${padY + plotH}`
    + ` L ${points[0].x} ${padY + plotH} Z`;

  return (
    <div className="overflow-x-auto">
      <svg width={chartW} height={chartH} className="min-w-full">
        {/* Grid lines */}
        {[1, 2, 3, 4, 5].map((d) => {
          const y = padY + plotH - ((d - 1) / 4) * plotH;
          return (
            <g key={d}>
              <line x1={padX} y1={y} x2={padX + plotW} y2={y} stroke="var(--border)" strokeWidth={0.5} />
              <text x={padX - 6} y={y + 3} fontSize={8} fill="#4a4e6a" textAnchor="end">{d}</text>
            </g>
          );
        })}

        {/* Area gradient */}
        <defs>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#arcGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth={1.5} opacity={0.7} />

        {/* Points */}
        {points.map((p) => (
          <g key={p.room.id} style={{ cursor: 'pointer' }} onClick={() => onSelectRoom(p.room.id)}>
            <circle cx={p.x} cy={p.y} r={6} fill="var(--surface)" stroke={DIFFICULTY_COLORS[p.room.difficulty]} strokeWidth={2} />
            <text
              x={p.x}
              y={padY + plotH + 12}
              fontSize={7}
              fill="var(--text-muted)"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              {p.room.name.slice(0, 8)}
            </text>
            <text x={p.x} y={p.y + 3} fontSize={7} fill="var(--text)" textAnchor="middle">
              {PACING_ICONS[p.room.pacing] ?? ''}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
