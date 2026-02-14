'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Unlink } from 'lucide-react';
import type { RoomNode, RoomConnection, RoomType, DifficultyLevel } from '@/types/level-design';

// ── Constants ──

const ROOM_W = 160;
const ROOM_H = 80;

const ROOM_TYPE_CONFIG: Record<RoomType, { color: string; label: string }> = {
  combat:      { color: '#f87171', label: 'Combat' },
  puzzle:      { color: '#a78bfa', label: 'Puzzle' },
  exploration: { color: '#34d399', label: 'Exploration' },
  boss:        { color: '#fbbf24', label: 'Boss' },
  safe:        { color: '#60a5fa', label: 'Safe Zone' },
  transition:  { color: '#8b8fb0', label: 'Transition' },
  cutscene:    { color: '#f472b6', label: 'Cutscene' },
  hub:         { color: '#2dd4bf', label: 'Hub' },
};

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  1: '#4ade80',
  2: '#a3e635',
  3: '#fbbf24',
  4: '#fb923c',
  5: '#f87171',
};

interface LevelFlowEditorProps {
  rooms: RoomNode[];
  connections: RoomConnection[];
  onUpdateRooms: (rooms: RoomNode[]) => void;
  onUpdateConnections: (connections: RoomConnection[]) => void;
  onSelectRoom: (roomId: string | null) => void;
  selectedRoomId: string | null;
  accentColor: string;
  readOnly?: boolean;
}

export function LevelFlowEditor({
  rooms,
  connections,
  onUpdateRooms,
  onUpdateConnections,
  onSelectRoom,
  selectedRoomId,
  accentColor,
  readOnly = false,
}: LevelFlowEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<{
    roomId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // ── Room CRUD ──

  const addRoom = useCallback(() => {
    const id = `room-${Date.now()}`;
    const newRoom: RoomNode = {
      id,
      name: `Room ${rooms.length + 1}`,
      type: 'combat',
      description: '',
      encounterDesign: '',
      difficulty: 2,
      pacing: 'rising',
      x: 100 + Math.random() * 200 - pan.x,
      y: 100 + Math.random() * 200 - pan.y,
      linkedFiles: [],
      spawnEntries: [],
      tags: [],
    };
    onUpdateRooms([...rooms, newRoom]);
    onSelectRoom(id);
  }, [rooms, onUpdateRooms, onSelectRoom, pan]);

  const deleteRoom = useCallback((roomId: string) => {
    onUpdateRooms(rooms.filter((r) => r.id !== roomId));
    onUpdateConnections(connections.filter((c) => c.fromId !== roomId && c.toId !== roomId));
    if (selectedRoomId === roomId) onSelectRoom(null);
  }, [rooms, connections, onUpdateRooms, onUpdateConnections, selectedRoomId, onSelectRoom]);

  // ── Connection handling ──

  const startConnection = useCallback((roomId: string) => {
    setConnectingFrom(roomId);
  }, []);

  const completeConnection = useCallback((toId: string) => {
    if (!connectingFrom || connectingFrom === toId) {
      setConnectingFrom(null);
      return;
    }
    const exists = connections.some(
      (c) => (c.fromId === connectingFrom && c.toId === toId) || (c.fromId === toId && c.toId === connectingFrom)
    );
    if (!exists) {
      const newConn: RoomConnection = {
        id: `conn-${Date.now()}`,
        fromId: connectingFrom,
        toId,
        bidirectional: true,
        condition: '',
      };
      onUpdateConnections([...connections, newConn]);
    }
    setConnectingFrom(null);
  }, [connectingFrom, connections, onUpdateConnections]);

  const deleteConnection = useCallback((connId: string) => {
    onUpdateConnections(connections.filter((c) => c.id !== connId));
  }, [connections, onUpdateConnections]);

  // ── Drag handling ──

  const getSVGPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - pan.x,
      y: e.clientY - rect.top - pan.y,
    };
  }, [pan]);

  const handleMouseDown = useCallback((e: React.MouseEvent, roomId: string) => {
    if (readOnly) return;
    e.stopPropagation();

    if (connectingFrom) {
      completeConnection(roomId);
      return;
    }

    const pt = getSVGPoint(e);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    setDragState({
      roomId,
      offsetX: pt.x - room.x,
      offsetY: pt.y - room.y,
    });
    onSelectRoom(roomId);
  }, [readOnly, connectingFrom, completeConnection, getSVGPoint, rooms, onSelectRoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x + panStart.current.panX,
        y: e.clientY - panStart.current.y + panStart.current.panY,
      });
      return;
    }
    if (!dragState) return;
    const pt = getSVGPoint(e);
    onUpdateRooms(rooms.map((r) =>
      r.id === dragState.roomId
        ? { ...r, x: pt.x - dragState.offsetX, y: pt.y - dragState.offsetY }
        : r
    ));
  }, [dragState, isPanning, getSVGPoint, rooms, onUpdateRooms]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setIsPanning(false);
  }, []);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      if (connectingFrom) {
        setConnectingFrom(null);
        return;
      }
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      setIsPanning(true);
      onSelectRoom(null);
    }
  }, [connectingFrom, pan, onSelectRoom]);

  // ── Get room center for connections ──

  const getRoomCenter = useCallback((roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return { x: 0, y: 0 };
    return { x: room.x + ROOM_W / 2, y: room.y + ROOM_H / 2 };
  }, [rooms]);

  return (
    <div className="relative w-full h-full bg-[#080818] rounded-lg border border-border overflow-hidden">
      {/* Toolbar */}
      {!readOnly && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          <button
            onClick={addRoom}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface border border-border-bright text-text hover:bg-surface-hover transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Room
          </button>
          {connectingFrom ? (
            <button
              onClick={() => setConnectingFrom(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#f8717118] border border-[#f8717130] text-[#f87171] transition-colors"
            >
              <Unlink className="w-3 h-3" />
              Cancel Link
            </button>
          ) : null}
        </div>
      )}

      {/* Room count badge */}
      <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded text-xs bg-surface border border-border text-text-muted">
        {rooms.length} rooms &middot; {connections.length} links
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab' }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % 24},${pan.y % 24})`}
          >
            <circle cx="12" cy="12" r="0.5" fill="var(--border)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${pan.x},${pan.y})`}>
          {/* Connections */}
          {connections.map((conn) => {
            const from = getRoomCenter(conn.fromId);
            const to = getRoomCenter(conn.toId);
            return (
              <g key={conn.id}>
                <line
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke="var(--border-bright)"
                  strokeWidth={2}
                  strokeDasharray={conn.condition ? '6,3' : undefined}
                />
                {conn.bidirectional && (
                  <circle
                    cx={(from.x + to.x) / 2}
                    cy={(from.y + to.y) / 2}
                    r={4}
                    fill="var(--border-bright)"
                  />
                )}
                {!readOnly && (
                  <line
                    x1={from.x} y1={from.y}
                    x2={to.x} y2={to.y}
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ cursor: 'pointer' }}
                    onClick={() => deleteConnection(conn.id)}
                  />
                )}
              </g>
            );
          })}

          {/* Room nodes */}
          {rooms.map((room) => {
            const cfg = ROOM_TYPE_CONFIG[room.type];
            const isSelected = selectedRoomId === room.id;
            const isConnectTarget = connectingFrom && connectingFrom !== room.id;
            const diffColor = DIFFICULTY_COLORS[room.difficulty];

            return (
              <g
                key={room.id}
                transform={`translate(${room.x},${room.y})`}
                onMouseDown={(e) => handleMouseDown(e, room.id)}
                onClick={() => isConnectTarget && completeConnection(room.id)}
                style={{ cursor: dragState?.roomId === room.id ? 'grabbing' : isConnectTarget ? 'crosshair' : 'pointer' }}
              >
                {/* Selection glow */}
                {isSelected && (
                  <rect
                    x={-3} y={-3}
                    width={ROOM_W + 6} height={ROOM_H + 6}
                    rx={10} ry={10}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                )}

                {/* Room body */}
                <rect
                  x={0} y={0}
                  width={ROOM_W} height={ROOM_H}
                  rx={8} ry={8}
                  fill="var(--surface)"
                  stroke={isSelected ? accentColor : isConnectTarget ? '#fbbf24' : cfg.color + '40'}
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Difficulty bar */}
                <rect
                  x={0} y={ROOM_H - 4}
                  width={ROOM_W * (room.difficulty / 5)}
                  height={4}
                  rx={0}
                  fill={diffColor}
                  opacity={0.6}
                />
                <rect
                  x={0} y={ROOM_H - 4}
                  width={ROOM_W}
                  height={4}
                  rx={0}
                  ry={0}
                  fill="none"
                  stroke="none"
                />

                {/* Type indicator dot */}
                <circle cx={16} cy={20} r={5} fill={cfg.color} opacity={0.8} />

                {/* Room name */}
                <text x={28} y={24} fontSize={12} fill="var(--text)" fontFamily="sans-serif" fontWeight={600}>
                  {room.name.length > 14 ? room.name.slice(0, 14) + '...' : room.name}
                </text>

                {/* Room type label */}
                <text x={28} y={40} fontSize={9} fill="var(--text-muted)" fontFamily="sans-serif">
                  {cfg.label}
                </text>

                {/* Pacing indicator */}
                <text x={28} y={54} fontSize={8} fill="#4a4e6a" fontFamily="sans-serif">
                  {room.pacing} &middot; diff {room.difficulty}
                </text>

                {/* Action buttons (visible on hover or selection) */}
                {!readOnly && isSelected && (
                  <>
                    {/* Link button */}
                    <g
                      transform={`translate(${ROOM_W - 36}, 6)`}
                      onClick={(e) => { e.stopPropagation(); startConnection(room.id); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect x={0} y={0} width={14} height={14} rx={3} fill="var(--border)" />
                      <text x={3} y={11} fontSize={10} fill="var(--text-muted-hover)">&#128279;</text>
                    </g>
                    {/* Delete button */}
                    <g
                      transform={`translate(${ROOM_W - 18}, 6)`}
                      onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect x={0} y={0} width={14} height={14} rx={3} fill="#f8717118" />
                      <text x={3} y={11} fontSize={10} fill="#f87171">&times;</text>
                    </g>
                  </>
                )}

                {/* Spawn count badge */}
                {room.spawnEntries.length > 0 && (
                  <g transform={`translate(${ROOM_W - 20}, ${ROOM_H - 20})`}>
                    <rect x={0} y={0} width={16} height={14} rx={3} fill={cfg.color + '20'} />
                    <text x={8} y={11} fontSize={8} fill={cfg.color} textAnchor="middle" fontFamily="sans-serif">
                      {room.spawnEntries.reduce((s, e) => s + e.count, 0)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
