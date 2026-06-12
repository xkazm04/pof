'use client';

import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_LOCKED, STATUS_LOCKED_STROKE, ACCENT_CYAN, OVERLAY_WHITE,
  withOpacity, OPACITY_50,
} from '@/lib/chart-colors';
const ACCENT = ACCENT_CYAN;

/** The minimal zone shape the canvas renders. ZoneRecord is a structural superset. */
export interface MapZone {
  id: string;
  displayName: string;
  cx: number;
  cy: number;
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  connections: string[];
}

interface MapCanvasProps<Z extends MapZone> {
  zones: Z[];
  selectedZone: Z;
  onSelectZone: (z: Z) => void;
  matchingIds?: Set<string>;
}

export function ZoneMapCanvas<Z extends MapZone>({ zones, selectedZone, onSelectZone, matchingIds }: MapCanvasProps<Z>) {
  const hasFilter = matchingIds !== undefined && matchingIds.size > 0;
  const isInRange = (id: string) => !hasFilter || matchingIds!.has(id);
  const getZoneColor = (z: MapZone) => {
    switch (z.status) {
      case 'completed': return STATUS_SUCCESS;
      case 'active': return STATUS_WARNING;
      case 'locked': return STATUS_LOCKED;
    }
  };

  const getStrokeColor = (z: MapZone) => {
    switch (z.status) {
      case 'completed': return `${withOpacity(STATUS_SUCCESS, OPACITY_50)}`;
      case 'active': return `${withOpacity(STATUS_WARNING, OPACITY_50)}`;
      case 'locked': return STATUS_LOCKED_STROKE;
    }
  };

  return (
    <svg className="w-full h-full absolute inset-0 text-text cursor-crosshair">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.8" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Draw connections first so they are behind nodes */}
      {zones.map((zone) =>
        zone.connections.map((connId) => {
          const target = zones.find((z) => z.id === connId);
          if (!target) return null;
          const edgeInRange = isInRange(zone.id) && isInRange(target.id);
          return (
            <motion.line
              key={`${zone.id}-${connId}`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              x1={`${zone.cx}%`}
              y1={`${zone.cy}%`}
              x2={`${target.cx}%`}
              y2={`${target.cy}%`}
              stroke="url(#lineGrad)"
              strokeWidth="2"
              strokeDasharray="4 4"
              className={edgeInRange ? 'opacity-50' : 'opacity-15'}
              style={{ transition: 'opacity 200ms ease-out' }}
            />
          );
        }),
      )}

      {/* Draw nodes */}
      {zones.map((zone, i) => {
        const isSelected = zone.id === selectedZone.id;
        const color = getZoneColor(zone);
        const strokeColor = getStrokeColor(zone);
        const isBoss = zone.type === 'boss';
        const isHub = zone.type === 'hub';
        const inRange = isInRange(zone.id);
        const glowFilter = `drop-shadow(0 0 6px ${withOpacity(color, OPACITY_50)})`;

        return (
          <g
            key={zone.id}
            onClick={() => onSelectZone(zone)}
            className={`cursor-pointer group ${inRange ? '' : 'opacity-30'}`}
            style={{ transition: 'opacity 200ms ease-out' }}
          >
            {/* Hover ring */}
            <motion.circle
              initial={{ r: 0 }}
              animate={{ r: isSelected ? 24 : 18 }}
              cx={`${zone.cx}%`}
              cy={`${zone.cy}%`}
              fill="transparent"
              stroke={isSelected ? color : 'transparent'}
              strokeWidth={1}
              className="opacity-50 group-hover:stroke-text-muted transition-colors duration-300"
              style={{ filter: isSelected ? 'url(#glow)' : 'none' }}
            />

            {/* Pulsing ring for active zone */}
            {zone.status === 'active' && (
              <motion.circle
                cx={`${zone.cx}%`} cy={`${zone.cy}%`} r="12"
                fill="transparent" stroke={color} strokeWidth="1.5"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            {/* Base shape based on type. Boss = a diamond: a percent-positioned
                rect (like the hub) resting at a 45° rotation. The old polygon
                used the `points` attribute, which — unlike circle/rect/line/text
                — accepts only user-space units, not percentages, so every boss
                rendered at pixel (cx, cy) in the top-left corner, detached from
                its own percent-positioned label, edges, and rings. */}
            {isBoss ? (
              <motion.rect
                initial={{ scale: 0, rotate: 0 }}
                animate={{ scale: 1, rotate: 45 }}
                transition={{ delay: i * 0.1, type: 'spring' }}
                x={`${zone.cx}%`} y={`${zone.cy}%`} width="17" height="17"
                transform="translate(-8.5, -8.5)"
                fill={color}
                stroke={isSelected ? OVERLAY_WHITE : strokeColor}
                strokeWidth="2"
                style={{ transformBox: 'fill-box', transformOrigin: 'center', filter: hasFilter && inRange ? glowFilter : undefined }}
              />
            ) : isHub ? (
              <motion.rect
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: 'spring' }}
                x={`${zone.cx}%`} y={`${zone.cy}%`} width="20" height="20"
                transform="translate(-10, -10)"
                fill={color}
                stroke={isSelected ? OVERLAY_WHITE : strokeColor}
                strokeWidth="2"
                rx="4"
                style={{ filter: hasFilter && inRange ? glowFilter : undefined }}
              />
            ) : (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: 'spring' }}
                cx={`${zone.cx}%`} cy={`${zone.cy}%`}
                r={isSelected ? '10' : '8'}
                fill={color}
                stroke={isSelected ? OVERLAY_WHITE : strokeColor}
                strokeWidth="2"
                style={{ filter: hasFilter && inRange ? glowFilter : (zone.status !== 'locked' ? 'url(#glow)' : 'none') }}
              />
            )}

            {/* Selected Indicator */}
            {isSelected && (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                cx={`${zone.cx}%`} cy={`${zone.cy}%`} r="3"
                fill={isBoss ? '#fff' : '#000'}
              />
            )}

            {/* Label */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: isSelected ? 1 : 0.6 }}
              className="pointer-events-none transition-opacity duration-300 group-hover:opacity-100"
            >
              <rect
                x={`${zone.cx}%`} y={`${zone.cy + 5}%`}
                transform={`translate(-${(zone.displayName.length * 6) / 2}, 16)`}
                width={zone.displayName.length * 6 + 10} height="18" rx="4"
                fill="var(--surface-deep)" stroke="var(--border)" strokeWidth="1"
                className="opacity-90"
              />
              <text
                x={`${zone.cx}%`} y={`${zone.cy + 5}%`}
                transform="translate(0, 29)" textAnchor="middle"
                fontSize="10" fontFamily="monaco, monospace"
                fill="var(--text)" className="font-semibold"
              >
                {zone.displayName}
              </text>
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}
