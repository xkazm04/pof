'use client';

import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_LOCKED, STATUS_LOCKED_STROKE, ACCENT_CYAN, OVERLAY_WHITE } from '@/lib/chart-colors';
import type { ZoneRecord } from './data';

const ACCENT = ACCENT_CYAN;

interface MapCanvasProps {
  zones: ZoneRecord[];
  selectedZone: ZoneRecord;
  onSelectZone: (z: ZoneRecord) => void;
}

export function ZoneMapCanvas({ zones, selectedZone, onSelectZone }: MapCanvasProps) {
  const getZoneColor = (z: ZoneRecord) => {
    switch (z.status) {
      case 'completed': return STATUS_SUCCESS;
      case 'active': return STATUS_WARNING;
      case 'locked': return STATUS_LOCKED;
    }
  };

  const getStrokeColor = (z: ZoneRecord) => {
    switch (z.status) {
      case 'completed': return `${STATUS_SUCCESS}80`;
      case 'active': return `${STATUS_WARNING}80`;
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
              className="opacity-50"
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

        return (
          <g key={zone.id} onClick={() => onSelectZone(zone)} className="cursor-pointer group">
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

            {/* Base shape based on type */}
            {isBoss ? (
              <motion.polygon
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: i * 0.1, type: 'spring' }}
                points={`${zone.cx},${zone.cy - 12} ${zone.cx + 12},${zone.cy} ${zone.cx},${zone.cy + 12} ${zone.cx - 12},${zone.cy}`}
                fill={color}
                stroke={isSelected ? OVERLAY_WHITE : strokeColor}
                strokeWidth="2"
                style={{ transformOrigin: `${zone.cx}% ${zone.cy}%` }}
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
                style={{ filter: zone.status !== 'locked' ? 'url(#glow)' : 'none' }}
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
