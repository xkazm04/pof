import type { RoomNode } from '@/types/level-design';
import type { PacingFinding } from '@/lib/level-design/pacing-linter';
import { STATUS_ERROR, STATUS_WARNING, ACCENT_VIOLET, OVERLAY_WHITE } from '@/lib/chart-colors';
import { ROOM_W, ROOM_H, ROOM_TYPE_CONFIG, DIFFICULTY_COLORS, SEVERITY_COLORS } from './constants';
import { highestSeverity } from './helpers';

interface RoomNodeGraphicProps {
  room: RoomNode;
  selectedRoomId: string | null;
  connectingFrom: string | null;
  accentColor: string;
  dragState: { roomId: string; offsetX: number; offsetY: number } | null;
  findingsByRoom?: Record<string, PacingFinding[]>;
  readOnly: boolean;
  handleMouseDown: (e: React.MouseEvent, roomId: string) => void;
  completeConnection: (toId: string) => void;
  startConnection: (roomId: string) => void;
  deleteRoom: (roomId: string) => void;
}

export function RoomNodeGraphic({
  room,
  selectedRoomId,
  connectingFrom,
  accentColor,
  dragState,
  findingsByRoom,
  readOnly,
  handleMouseDown,
  completeConnection,
  startConnection,
  deleteRoom,
}: RoomNodeGraphicProps) {
  const cfg = ROOM_TYPE_CONFIG[room.type];
  const isSelected = selectedRoomId === room.id;
  const isConnectTarget = connectingFrom && connectingFrom !== room.id;
  const diffColor = DIFFICULTY_COLORS[room.difficulty];
  const findings = findingsByRoom?.[room.id] ?? [];
  const topSeverity = findings.length > 0 ? highestSeverity(findings) : null;
  const badgeColor = topSeverity ? SEVERITY_COLORS[topSeverity] : null;
  const badgeTooltip = findings
    .slice(0, 3)
    .map((f) => `[${f.severity}] ${f.title}: ${f.suggestion}`)
    .join('\n');

  return (
    <g
      transform={`translate(${room.x},${room.y})`}
      onMouseDown={(e) => handleMouseDown(e, room.id)}
      onClick={() => isConnectTarget && completeConnection(room.id)}
      style={{ cursor: dragState?.roomId === room.id ? 'grabbing' : isConnectTarget ? 'crosshair' : 'pointer' }}
      className="transition-transform duration-200"
    >
      {/* Selection / Hover Glow Frame */}
      <rect
        x={-6} y={-6}
        width={ROOM_W + 12} height={ROOM_H + 12}
        rx={14} ry={14}
        fill="none"
        stroke={isSelected ? accentColor : isConnectTarget ? STATUS_WARNING : "transparent"}
        strokeWidth={isSelected ? 1.5 : 2}
        opacity={isSelected || isConnectTarget ? 0.6 : 0}
        className="transition-all duration-300"
        filter="url(#glow-node)"
      />

      {/* Primary node body */}
      <rect
        x={0} y={0}
        width={ROOM_W} height={ROOM_H}
        rx={12} ry={12}
        fill={isSelected ? `${cfg.color}15` : "#0a0a1e"}
        stroke={isSelected ? accentColor : isConnectTarget ? STATUS_WARNING : `${cfg.color}40`}
        strokeWidth={isSelected ? 1.5 : 1}
        className="transition-colors duration-300 shadow-2xl"
        style={{ filter: isSelected ? 'drop-shadow(0 0 20px rgba(0,0,0,0.8))' : 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' }}
      />

      {/* Left accent strip mapping to room type */}
      <rect
        x={2} y={16}
        width={3} height={ROOM_H - 32}
        rx={1.5} ry={1.5}
        fill={cfg.color}
        opacity={0.8}
      />

      {/* Title Background Area */}
      <rect x={1} y={1} width={ROOM_W - 2} height={26} rx={11} fill="rgba(255,255,255,0.02)" />
      <line x1={1} y1={27} x2={ROOM_W - 1} y2={27} stroke={`${cfg.color}20`} strokeWidth={1} />

      {/* Difficulty Gradient Bar (Top Edge) */}
      <rect
        x={12} y={0}
        width={(ROOM_W - 24) * (room.difficulty / 5)} height={2}
        fill={diffColor}
        opacity={0.8}
        style={{ filter: 'blur(0.5px)' }}
      />

      {/* Type icon simulation */}
      <circle cx={18} cy={14} r={3.5} fill={cfg.color} opacity={isSelected ? 1 : 0.7} />
      <circle cx={18} cy={14} r={6} fill="none" stroke={cfg.color} strokeWidth={1} opacity={0.3} />

      {/* Room name */}
      <text x={30} y={18} style={{ fontSize: 11 }} fill={isSelected ? OVERLAY_WHITE : 'var(--text)'} fontFamily="monospace" fontWeight={700} letterSpacing={0.5}>
        {room.name.length > 14 ? room.name.slice(0, 14) + '...' : room.name.toUpperCase()}
      </text>

      {/* Room type label */}
      <text x={18} y={42} style={{ fontSize: 11 }} fill={cfg.color} opacity={0.8} fontFamily="monospace" fontWeight={600} letterSpacing={1} className="uppercase">
        {cfg.label}
      </text>

      {/* Pacing indicator & Diff text */}
      <text x={18} y={56} style={{ fontSize: 11 }} fill="var(--text-muted)" opacity={0.7} fontFamily="monospace" letterSpacing={1} className="uppercase">
        PACING: <tspan fill="#d8b4fe">{room.pacing}</tspan> | DIFF: <tspan fill={diffColor}>{room.difficulty}</tspan>
      </text>

      {/* Grid texture inside node for tech look */}
      <rect
        x={ROOM_W - 40} y={32}
        width={30} height={20}
        fill="url(#grid)"
        opacity={0.3}
      />

      {/* Action buttons (visible on hover or selection) */}
      {!readOnly && isSelected && (
        <g className="opacity-0 hover:opacity-100 transition-opacity duration-300" style={{ opacity: 1 }}>
          {/* Link button */}
          <g
            transform={`translate(${ROOM_W - 38}, 4)`}
            onClick={(e) => { e.stopPropagation(); startConnection(room.id); }}
            style={{ cursor: 'pointer' }}
            className="group/btn"
          >
            <rect x={0} y={0} width={16} height={16} rx={4} fill="rgba(139,92,246,0.2)" stroke="rgba(139,92,246,0.4)" />
            <text x={4} y={12} style={{ fontSize: 11 }} fill={ACCENT_VIOLET} className="opacity-80 group-hover/btn:opacity-100">&#128279;</text>
          </g>
          {/* Delete button */}
          <g
            transform={`translate(${ROOM_W - 20}, 4)`}
            onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
            style={{ cursor: 'pointer' }}
            className="group/btn"
          >
            <rect x={0} y={0} width={16} height={16} rx={4} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}40`} />
            <text x={5.5} y={12} style={{ fontSize: 11 }} fill={STATUS_ERROR} className="opacity-80 group-hover/btn:opacity-100">&times;</text>
          </g>
        </g>
      )}

      {/* Spawn count HUD badge */}
      {room.spawnEntries.length > 0 && (
        <g transform={`translate(${ROOM_W - 24}, ${ROOM_H - 18})`}>
          <rect x={0} y={0} width={18} height={12} rx={2} fill={`${cfg.color}15`} stroke={`${cfg.color}40`} />
          <text x={9} y={9} style={{ fontSize: 11 }} fill={cfg.color} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
            {String(room.spawnEntries.reduce((s, e) => s + e.count, 0)).padStart(2, '0')}
          </text>
        </g>
      )}

      {/* Pacing-linter warning badge */}
      {badgeColor && (
        <g transform={`translate(${-10}, ${-10})`}>
          <title>{badgeTooltip}</title>
          <circle
            cx={10} cy={10} r={11}
            fill={badgeColor}
            opacity={0.25}
            filter="url(#glow-node)"
          />
          <circle
            cx={10} cy={10} r={9}
            fill="#0a0a1e"
            stroke={badgeColor}
            strokeWidth={1.5}
          />
          <text
            x={10} y={13.5}
            textAnchor="middle"
            fontFamily="monospace"
            fontWeight="bold"
            style={{ fontSize: 11 }}
            fill={badgeColor}
          >
            !
          </text>
          {findings.length > 1 && (
            <g transform="translate(14, -2)">
              <rect
                x={0} y={0}
                width={findings.length > 9 ? 14 : 10}
                height={10}
                rx={5}
                fill={badgeColor}
              />
              <text
                x={findings.length > 9 ? 7 : 5}
                y={8}
                textAnchor="middle"
                fontFamily="monospace"
                fontWeight="bold"
                style={{ fontSize: 9 }}
                fill="#0a0a1e"
              >
                {findings.length > 9 ? '9+' : findings.length}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}
