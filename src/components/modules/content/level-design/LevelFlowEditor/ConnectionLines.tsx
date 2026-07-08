import type { RoomConnection } from '@/types/level-design';
import { ACCENT_VIOLET } from '@/lib/chart-colors';

interface ConnectionLinesProps {
  connections: RoomConnection[];
  connectingFrom: string | null;
  accentColor: string;
  readOnly: boolean;
  getRoomCenter: (roomId: string) => { x: number; y: number };
  deleteConnection: (connId: string) => void;
}

export function ConnectionLines({
  connections,
  connectingFrom,
  accentColor,
  readOnly,
  getRoomCenter,
  deleteConnection,
}: ConnectionLinesProps) {
  return (
    <>
      {connections.map((conn) => {
        const from = getRoomCenter(conn.fromId);
        const to = getRoomCenter(conn.toId);
        const isTarget = connectingFrom && (conn.fromId === connectingFrom || conn.toId === connectingFrom);

        return (
          <g key={conn.id} className="group/conn">
            {/* Glow layer (visible on hover or when connected node selected) */}
            <line
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={accentColor}
              strokeWidth={6}
              opacity={isTarget ? 0.3 : 0}
              className="transition-opacity duration-300 group-hover/conn:opacity-40"
              filter="url(#glow-link)"
            />

            {/* Base dashed link */}
            <line
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={isTarget ? accentColor : "rgba(139,92,246,0.2)"}
              strokeWidth={2}
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
                <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r={5} fill="#050510" stroke={accentColor} strokeWidth={1} />
                <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r={2} fill={accentColor} />
              </>
            )}

            {/* Invisible hover area for deletion */}
            {!readOnly && (
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: 'pointer' }}
                onClick={() => deleteConnection(conn.id)}
              />
            )}
          </g>
        );
      })}
    </>
  );
}
