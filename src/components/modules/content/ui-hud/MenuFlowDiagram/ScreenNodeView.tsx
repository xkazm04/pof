'use client';

import { NODE_W, NODE_H, SCREEN_TYPES } from './constants';
import type { ScreenNode } from './types';

interface ScreenNodeViewProps {
  scr: ScreenNode;
  selectedId: string | null;
  connectingFrom: string | null;
  dragState: { screenId: string; offsetX: number; offsetY: number } | null;
  handleNodeMouseDown: (e: React.MouseEvent, screenId: string) => void;
  setEditingScreen: (id: string | null) => void;
  completeConnection: (toId: string) => void;
  startConnection: (fromId: string) => void;
  deleteScreen: (id: string) => void;
}

export function ScreenNodeView({
  scr,
  selectedId,
  connectingFrom,
  dragState,
  handleNodeMouseDown,
  setEditingScreen,
  completeConnection,
  startConnection,
  deleteScreen,
}: ScreenNodeViewProps) {
  const cfg = SCREEN_TYPES[scr.type];
  const isSelected = selectedId === scr.id;
  const isConnectTarget = connectingFrom !== null && connectingFrom !== scr.id;
  const isBeingDragged = dragState?.screenId === scr.id;

  return (
    <g
      key={scr.id}
      transform={`translate(${scr.x},${scr.y})`}
      onMouseDown={(e) => handleNodeMouseDown(e, scr.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingScreen(scr.id);
      }}
      onClick={() => {
        if (isConnectTarget) completeConnection(scr.id);
      }}
      style={{
        cursor: isBeingDragged
          ? 'grabbing'
          : isConnectTarget
            ? 'crosshair'
            : 'pointer',
        opacity: isBeingDragged ? 0.8 : 1,
      }}
    >
      {/* Selection glow */}
      {isSelected && (
        <rect
          x={-4} y={-4}
          width={NODE_W + 8} height={NODE_H + 8}
          rx={12} ry={12}
          fill="rgba(167,139,250,0.05)"
          stroke="rgba(167,139,250,0.6)"
          strokeWidth={2}
          style={{ filter: 'url(#neon-glow)' }}
        />
      )}

      {/* Connect-target highlight */}
      {isConnectTarget && (
        <rect
          x={-3} y={-3}
          width={NODE_W + 6} height={NODE_H + 6}
          rx={11} ry={11}
          fill="rgba(52,211,153,0.05)"
          stroke="rgba(52,211,153,0.6)"
          strokeWidth={1.5}
          strokeDasharray="4,4"
          className="animate-[spin_4s_linear_infinite]"
          style={{ transformOrigin: 'center' }}
        />
      )}

      {/* Node body (glassmorphism) */}
      <rect
        x={0} y={0}
        width={NODE_W} height={NODE_H}
        rx={8} ry={8}
        fill="rgba(0,0,0,0.6)"
        stroke={isSelected ? 'rgba(167,139,250,1)' : `${cfg.color}50`}
        strokeWidth={isSelected ? 2 : 1}
      />

      {/* Inner subtle glow */}
      <rect
        x={1} y={1}
        width={NODE_W - 2} height={NODE_H - 2}
        rx={7} ry={7}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={1}
      />

      {/* Colored top bar gradient line */}
      <rect
        x={0} y={0}
        width={NODE_W} height={4}
        rx={4} ry={4}
        fill={cfg.color}
        opacity={0.8}
      />
      {/* Cover bottom corners of top bar */}
      <rect x={0} y={2} width={NODE_W} height={2} fill={cfg.color} opacity={0.8} />

      {/* Type icon background */}
      <rect x={10} y={14} width={22} height={22} rx={6} fill={`${cfg.color}15`} stroke={`${cfg.color}30`} strokeWidth={1} />
      <text
        x={21} y={29}
        fontSize={12}
        fill={cfg.color}
        textAnchor="middle"
        fontFamily="sans-serif"
        fontWeight={800}
        style={{ filter: `drop-shadow(0 0 5px ${cfg.color})` }}
      >
        {cfg.icon}
      </text>

      {/* Screen name */}
      <text x={42} y={24} fontSize={11} fill="white" fontFamily="sans-serif" fontWeight={700} letterSpacing="0.5">
        {scr.name.length > 15 ? scr.name.slice(0, 15) + '…' : scr.name}
      </text>

      {/* Type label */}
      <text x={42} y={35} fontSize={8} fill={`${cfg.color}90`} fontFamily="monospace" fontWeight={600} letterSpacing="1">
        {cfg.label.toUpperCase()}
      </text>

      {/* Widget count indicator string */}
      <g transform={`translate(10, 48)`}>
        {/* Tiny nodes representing widgets */}
        <rect x={0} y={0} width={NODE_W - 20} height={10} rx={3} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" />
        {Array.from({ length: Math.min(scr.widgets.length, 12) }).map((_, i) => (
          <rect key={i} x={4 + i * 8} y={3} width={4} height={4} rx={1} fill={`${cfg.color}80`} />
        ))}
        {scr.widgets.length > 12 && (
          <text x={4 + 12 * 8} y={8} fontSize={8} fill={`${cfg.color}80`}>+</text>
        )}
        {scr.widgets.length === 0 && (
          <text x={5} y={8} fontSize={7} fill="rgba(255,255,255,0.2)" fontFamily="monospace">NO_ELEMENTS</text>
        )}
      </g>

      {/* Action buttons when selected */}
      {isSelected && (
        <>
          {/* Link button */}
          <g
            transform={`translate(${NODE_W - 44}, -16)`}
            onClick={(e) => {
              e.stopPropagation();
              startConnection(scr.id);
            }}
            style={{ cursor: 'pointer' }}
            className="group"
          >
            <rect x={0} y={0} width={20} height={20} rx={6} fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.4)" strokeWidth={1} />
            <text x={10} y={13} fontSize={10} fill="rgba(52,211,153,1)" textAnchor="middle">→</text>
          </g>
          {/* Delete button */}
          <g
            transform={`translate(${NODE_W - 20}, -16)`}
            onClick={(e) => {
              e.stopPropagation();
              deleteScreen(scr.id);
            }}
            style={{ cursor: 'pointer' }}
            className="group"
          >
            <rect x={0} y={0} width={20} height={20} rx={6} fill="rgba(244,63,94,0.15)" stroke="rgba(244,63,94,0.4)" strokeWidth={1} />
            <text x={10} y={14} fontSize={12} fill="rgba(244,63,94,1)" textAnchor="middle" fontWeight="bold">×</text>
          </g>
        </>
      )}
    </g>
  );
}
