'use client';

import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_ORANGE,
} from '@/lib/chart-colors';

export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';

interface StatusConfig {
  color: string;
  label: string;
  pulse: boolean;
}

const STATUS_CONFIG: Record<ConnectionStatus, StatusConfig> = {
  connected:    { color: STATUS_SUCCESS, label: 'Connected', pulse: true },
  connecting:   { color: ACCENT_ORANGE,  label: 'Connecting...', pulse: true },
  reconnecting: { color: ACCENT_ORANGE,  label: 'Reconnecting...', pulse: true },
  disconnected: { color: STATUS_NEUTRAL, label: 'Offline', pulse: false },
  error:        { color: STATUS_ERROR,   label: 'Error', pulse: false },
};

const DOT_SIZE = 'w-2 h-2';
const GLOW_SPREAD = '6px';
const PULSE_DURATION = 2;

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  /** Override the default label text */
  label?: string;
  /** Optional metric count displayed after the label */
  count?: number;
  /** Extra className on the outer span */
  className?: string;
}

export function ConnectionStatusBadge({ status, label, count, className }: ConnectionStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const displayLabel = label ?? config.label;

  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-mono font-bold${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      style={{ color: config.color }}
    >
      <motion.span
        className={`${DOT_SIZE} rounded-full`}
        style={{
          backgroundColor: config.color,
          boxShadow: `0 0 ${GLOW_SPREAD} ${config.color}60`,
        }}
        animate={config.pulse ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : {}}
        transition={{ duration: PULSE_DURATION, repeat: Infinity }}
      />
      {displayLabel}
      {count !== undefined && (
        <span className="text-text-muted font-normal ml-0.5">({count})</span>
      )}
    </span>
  );
}
