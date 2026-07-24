import { useState } from 'react';
import type { RoomConnection } from '@/types/level-design';
import { ACCENT_VIOLET, STATUS_ERROR } from '@/lib/chart-colors';

interface ConnectionLinesProps {
  connections: RoomConnection[];
  connectingFrom: string | null;
  accentColor: string;
  readOnly: boolean;
  /** Link currently armed for deletion — the next activation removes it. */
  armedConnectionId: string | null;
  getRoomCenter: (roomId: string) => { x: number; y: number };
  getRoomName: (roomId: string) => string;
  toggleArmConnection: (connId: string) => void;
  deleteConnection: (connId: string) => void;
}

export function ConnectionLines({
  connections,
  connectingFrom,
  accentColor,
  readOnly,
  armedConnectionId,
  getRoomCenter,
  getRoomName,
  toggleArmConnection,
  deleteConnection,
}: ConnectionLinesProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  /** First activation arms the link, the second deletes it. */
  const activate = (connId: string) => {
    if (armedConnectionId === connId) deleteConnection(connId);
    else toggleArmConnection(connId);
  };

  return (
    <>
      {connections.map((conn) => {
        const from = getRoomCenter(conn.fromId);
        const to = getRoomCenter(conn.toId);
        const isTarget = connectingFrom && (conn.fromId === connectingFrom || conn.toId === connectingFrom);
        const isArmed = armedConnectionId === conn.id;
        const isFocused = focusedId === conn.id;
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const label = `Link ${getRoomName(conn.fromId)} to ${getRoomName(conn.toId)}`;

        return (
          <g key={conn.id} className="group/conn">
            {/* Glow layer (visible on hover or when connected node selected) */}
            <line
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={isArmed ? STATUS_ERROR : accentColor}
              strokeWidth={6}
              opacity={isArmed || isFocused ? 0.45 : isTarget ? 0.3 : 0}
              className="transition-opacity duration-300 group-hover/conn:opacity-40"
              filter="url(#glow-link)"
            />

            {/* Base dashed link */}
            <line
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={isArmed ? STATUS_ERROR : isTarget ? accentColor : "rgba(139,92,246,0.2)"}
              strokeWidth={isArmed ? 3 : 2}
              strokeDasharray={conn.condition ? '8,4' : undefined}
              className="transition-colors duration-300"
            />

            {/* Animated data flow dots */}
            <line
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={isTarget ? ACCENT_VIOLET : "rgba(139,92,246,0.6)"}
              strokeWidth={1.5}
              strokeDasharray="4 16"
              className="pointer-events-none"
            >
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
            </line>

            {conn.bidirectional && (
              <>
                <circle cx={mid.x} cy={mid.y} r={5} fill="#050510" stroke={accentColor} strokeWidth={1} />
                <circle cx={mid.x} cy={mid.y} r={2} fill={accentColor} />
              </>
            )}

            {/* Keyboard-reachable hit area. Deletion is two-step: this line is 20px
                wide and invisible, so one stray click must never destroy a link. */}
            {!readOnly && (
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: 'pointer', outline: 'none' }}
                tabIndex={0}
                role="button"
                aria-label={isArmed ? `${label} — armed, activate again to delete` : `${label} — activate to arm deletion`}
                onClick={() => activate(conn.id)}
                onFocus={() => setFocusedId(conn.id)}
                onBlur={() => setFocusedId((cur) => (cur === conn.id ? null : cur))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    activate(conn.id);
                  }
                }}
              />
            )}

            {/* Armed confirmation prompt at the link midpoint */}
            {isArmed && (
              <g transform={`translate(${mid.x},${mid.y})`} pointerEvents="none">
                <rect
                  x={-46} y={-30} width={92} height={18} rx={9}
                  fill="#0a0a1e" stroke={STATUS_ERROR} strokeWidth={1}
                />
                <text
                  x={0} y={-17}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight="bold"
                  style={{ fontSize: 10 }}
                  fill={STATUS_ERROR}
                >
                  DELETE? AGAIN
                </text>
              </g>
            )}

            {/* Keyboard focus ring — SVG can't use the box-shadow focus utilities. */}
            {isFocused && !isArmed && (
              <circle
                cx={mid.x} cy={mid.y} r={10}
                fill="none"
                stroke="var(--focus-accent, #60a5fa)"
                strokeWidth={2}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </>
  );
}
