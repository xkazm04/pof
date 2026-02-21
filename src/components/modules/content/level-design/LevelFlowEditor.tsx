'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Unlink } from 'lucide-react';
import type { RoomNode, RoomConnection, RoomType, DifficultyLevel } from '@/types/level-design';
import {
  STATUS_ERROR, STATUS_SUCCESS, STATUS_LIME, STATUS_WARNING, STATUS_BLOCKER, STATUS_INFO,
  ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_PINK,
} from '@/lib/chart-colors';

// ── Constants ──

const ROOM_W = 160;
const ROOM_H = 80;

const ROOM_TYPE_CONFIG: Record<RoomType, { color: string; label: string }> = {
  combat: { color: STATUS_ERROR, label: 'Combat' },
  puzzle: { color: ACCENT_VIOLET, label: 'Puzzle' },
  exploration: { color: ACCENT_EMERALD, label: 'Exploration' },
  boss: { color: STATUS_WARNING, label: 'Boss' },
  safe: { color: STATUS_INFO, label: 'Safe Zone' },
  transition: { color: '#8b8fb0', label: 'Transition' },
  cutscene: { color: ACCENT_PINK, label: 'Cutscene' },
  hub: { color: '#2dd4bf', label: 'Hub' },
};

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  1: STATUS_SUCCESS,
  2: STATUS_LIME,
  3: STATUS_WARNING,
  4: STATUS_BLOCKER,
  5: STATUS_ERROR,
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
    <div className="relative w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 overflow-hidden shadow-[inset_0_0_80px_rgba(167,139,250,0.05)]">
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600/5 blur-[100px] rounded-full pointer-events-none" />
      </div>

      {/* Toolbar */}
      {!readOnly && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={addRoom}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
              border: `1px solid ${accentColor}50`,
              boxShadow: `0 0 15px ${accentColor}30, inset 0 0 10px ${accentColor}15`,
            }}
          >
            <Plus className="w-4 h-4" />
            Add Room
          </button>
          {connectingFrom && (
            <button
              onClick={() => setConnectingFrom(null)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all animate-pulse"
              style={{
                backgroundColor: `${STATUS_ERROR}20`,
                color: STATUS_ERROR,
                border: `1px solid ${STATUS_ERROR}50`,
                boxShadow: `0 0 15px ${STATUS_ERROR}40, inset 0 0 10px ${STATUS_ERROR}20`,
              }}
            >
              <Unlink className="w-4 h-4" />
              Cancel Link
            </button>
          )}
        </div>
      )}

      {/* Room count badge */}
      <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg border bg-surface-deep/80 backdrop-blur-sm border-violet-900/40 text-[10px] uppercase font-mono font-bold tracking-widest text-violet-300/80 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        {rooms.length} NODES <span className="mx-1 text-violet-500/50">|</span> {connections.length} LINKS
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full relative z-0"
        style={{ cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab' }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Blueprint Dot Grid */}
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % 32},${pan.y % 32})`}
          >
            <circle cx="16" cy="16" r="1" fill={accentColor} opacity="0.15" />
            <path d="M 16 12 L 16 20 M 12 16 L 20 16" stroke={accentColor} strokeWidth="0.5" opacity="0.05" />
          </pattern>
          {/* Glow Filters */}
          <filter id="glow-node" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-link" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${pan.x},${pan.y})`}>
          {/* Connections */}
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
                  stroke={isTarget ? '#d8b4fe' : "rgba(139,92,246,0.6)"}
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
                <text x={30} y={18} fontSize={11} fill={isSelected ? '#fff' : 'var(--text)'} fontFamily="monospace" fontWeight={700} letterSpacing={0.5}>
                  {room.name.length > 14 ? room.name.slice(0, 14) + '...' : room.name.toUpperCase()}
                </text>

                {/* Room type label */}
                <text x={18} y={42} fontSize={9} fill={cfg.color} opacity={0.8} fontFamily="monospace" fontWeight={600} letterSpacing={1} className="uppercase">
                  {cfg.label}
                </text>

                {/* Pacing indicator & Diff text */}
                <text x={18} y={56} fontSize={8} fill="var(--text-muted)" opacity={0.7} fontFamily="monospace" letterSpacing={1} className="uppercase">
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
                      <text x={4} y={12} fontSize={10} fill="#a78bfa" className="opacity-80 group-hover/btn:opacity-100">&#128279;</text>
                    </g>
                    {/* Delete button */}
                    <g
                      transform={`translate(${ROOM_W - 20}, 4)`}
                      onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                      style={{ cursor: 'pointer' }}
                      className="group/btn"
                    >
                      <rect x={0} y={0} width={16} height={16} rx={4} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}40`} />
                      <text x={5.5} y={12} fontSize={10} fill={STATUS_ERROR} className="opacity-80 group-hover/btn:opacity-100">&times;</text>
                    </g>
                  </g>
                )}

                {/* Spawn count HUD badge */}
                {room.spawnEntries.length > 0 && (
                  <g transform={`translate(${ROOM_W - 24}, ${ROOM_H - 18})`}>
                    <rect x={0} y={0} width={18} height={12} rx={2} fill={`${cfg.color}15`} stroke={`${cfg.color}40`} />
                    <text x={9} y={9} fontSize={8} fill={cfg.color} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                      {String(room.spawnEntries.reduce((s, e) => s + e.count, 0)).padStart(2, '0')}
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
