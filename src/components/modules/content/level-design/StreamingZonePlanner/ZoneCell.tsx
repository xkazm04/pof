import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_WARNING, OVERLAY_WHITE } from '@/lib/chart-colors';
import { CELL_SIZE, ZONE_TYPES, PRIORITY_COLORS } from './constants';
import type { StreamingZone, ZoneType } from './types';

interface ZoneCellProps {
  zone: StreamingZone;
  selectedZoneId: string | null;
  linkingFrom: string | null;
  paintType: ZoneType | 'erase' | null;
  handleCellClick: (x: number, y: number) => void;
}

export function ZoneCell({ zone, selectedZoneId, linkingFrom, paintType, handleCellClick }: ZoneCellProps) {
  const cfg = ZONE_TYPES[zone.type];
  const isSelected = selectedZoneId === zone.id;
  const isLinkTarget = linkingFrom !== null && linkingFrom !== zone.id;
  const cx = zone.gridX * CELL_SIZE;
  const cy = zone.gridY * CELL_SIZE;

  return (
    <g
      onClick={() => handleCellClick(zone.gridX, zone.gridY)}
      style={{ cursor: paintType ? 'crosshair' : linkingFrom ? 'crosshair' : 'pointer' }}
    >
      {/* Preload radius indicator (animated radar ring) */}
      {isSelected && zone.preloadRadius > 0 && (
        <g>
          {/* Inner fill area */}
          <rect
            x={cx - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
            y={cy - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
            width={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
            height={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
            rx={12}
            fill={`${cfg.color}10`}
            className="pointer-events-none"
          />
          {/* Pulsing border */}
          <rect
            x={cx - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
            y={cy - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
            width={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
            height={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
            rx={12}
            fill="none"
            stroke={`${cfg.color}50`}
            strokeWidth={1}
            strokeDasharray="8,8"
            className="pointer-events-none"
          >
            <animate attributeName="stroke-dashoffset" from="32" to="0" dur="2s" repeatCount="indefinite" />
          </rect>
        </g>
      )}

      {/* Selection Highlight (Tech Brackets) */}
      {isSelected && (
        <g className="pointer-events-none" stroke={MODULE_COLORS.content} strokeWidth={2} fill="none">
          <path d={`M ${cx - 2} ${cy + 10} L ${cx - 2} ${cy - 2} L ${cx + 10} ${cy - 2}`} />
          <path d={`M ${cx + CELL_SIZE - 10} ${cy - 2} L ${cx + CELL_SIZE + 2} ${cy - 2} L ${cx + CELL_SIZE + 2} ${cy + 10}`} />
          <path d={`M ${cx + CELL_SIZE + 2} ${cy + CELL_SIZE - 10} L ${cx + CELL_SIZE + 2} ${cy + CELL_SIZE + 2} L ${cx + CELL_SIZE - 10} ${cy + CELL_SIZE + 2}`} />
          <path d={`M ${cx + 10} ${cy + CELL_SIZE + 2} L ${cx - 2} ${cy + CELL_SIZE + 2} L ${cx - 2} ${cy + CELL_SIZE - 10}`} />
        </g>
      )}

      {/* Link target highlight */}
      {isLinkTarget && (
        <rect
          x={cx} y={cy}
          width={CELL_SIZE} height={CELL_SIZE}
          rx={8}
          fill="none"
          stroke={STATUS_WARNING}
          strokeWidth={2}
          strokeDasharray="4,4"
          opacity={0.8}
          className="pointer-events-none animate-pulse"
        />
      )}

      {/* Zone cell body - Glassmorphism Block */}
      <rect
        x={cx + 3} y={cy + 3}
        width={CELL_SIZE - 6} height={CELL_SIZE - 6}
        rx={8}
        fill={`rgba(3,3,10,0.6)`}
        stroke={isSelected ? cfg.color : `${cfg.color}50`}
        strokeWidth={isSelected ? 1.5 : 1}
        className="transition-colors duration-300"
        style={{ backdropFilter: 'blur(4px)', filter: isSelected ? 'url(#sz-glow)' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
      />

      {/* Inner Gradient Tint */}
      <rect
        x={cx + 4} y={cy + 4}
        width={CELL_SIZE - 8} height={CELL_SIZE - 8}
        rx={6}
        fill={`${cfg.color}15`}
        className="pointer-events-none"
      />

      {/* Always-loaded indicator bar */}
      {zone.alwaysLoaded && (
        <rect
          x={cx + 4} y={cy + 4}
          width={CELL_SIZE - 8} height={4}
          rx={2}
          fill={PRIORITY_COLORS.always}
          opacity={0.9}
          filter="url(#sz-glow)"
        />
      )}

      {/* Zone letter */}
      <text
        x={cx + CELL_SIZE / 2}
        y={cy + CELL_SIZE / 2 - 2}
        fontSize={18}
        fill={isSelected ? OVERLAY_WHITE : cfg.color}
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight={800}
        opacity={0.9}
        className="transition-colors duration-300 pointer-events-none"
        style={{ textShadow: isSelected ? `0 0 10px ${cfg.color}80` : 'none' }}
      >
        {cfg.letter}
      </text>

      {/* Zone name */}
      <text
        x={cx + CELL_SIZE / 2}
        y={cy + CELL_SIZE / 2 + 14}
        style={{ fontSize: 11 }}
        fill="var(--text)"
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight={600}
        letterSpacing={0.5}
        className="uppercase pointer-events-none"
      >
        {zone.name.length > 10 ? zone.name.slice(0, 8) + '…' : zone.name}
      </text>

      {/* Priority dot / scanline */}
      <g className="pointer-events-none">
        <circle
          cx={cx + CELL_SIZE - 12}
          cy={cy + CELL_SIZE - 12}
          r={3.5}
          fill={PRIORITY_COLORS[zone.loadPriority]}
          opacity={0.9}
          filter="url(#sz-glow)"
        />
        <line
          x1={cx + 4} y1={cy + CELL_SIZE - 12}
          x2={cx + CELL_SIZE - 16} y2={cy + CELL_SIZE - 12}
          stroke={PRIORITY_COLORS[zone.loadPriority]}
          strokeWidth={0.5}
          opacity={0.3}
        />
      </g>

      {/* Preload radius label */}
      <text
        x={cx + 8}
        y={cy + CELL_SIZE - 10}
        style={{ fontSize: 11 }}
        fill="var(--text-muted)"
        fontFamily="monospace"
        fontWeight={600}
        className="pointer-events-none"
      >
        R{zone.preloadRadius}
      </text>
    </g>
  );
}
