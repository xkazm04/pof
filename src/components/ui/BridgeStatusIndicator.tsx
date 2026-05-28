'use client';

import { motion } from 'framer-motion';
import { Loader2, Plug, PlugZap, AlertCircle, type LucideIcon } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL, ACCENT_ORANGE,
} from '@/lib/chart-colors';

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

interface StatusConfig {
  color: string;
  label: string;
  pulse: boolean;
  Icon: LucideIcon;
}

/**
 * Single source of truth: status → color/label/pulse/icon.
 * Every surface (panel/topbar/strip) reads from this map so a non-technical
 * user sees identical semantics across the app.
 */
const STATUS_CONFIG: Record<ConnectionStatus, StatusConfig> = {
  connected:    { color: STATUS_SUCCESS, label: 'Connected',     pulse: true,  Icon: PlugZap },
  connecting:   { color: ACCENT_ORANGE,  label: 'Connecting…',   pulse: true,  Icon: Loader2 },
  reconnecting: { color: ACCENT_ORANGE,  label: 'Reconnecting…', pulse: true,  Icon: Loader2 },
  disconnected: { color: STATUS_NEUTRAL, label: 'Offline',       pulse: false, Icon: Plug },
  error:        { color: STATUS_ERROR,   label: 'Error',         pulse: false, Icon: AlertCircle },
};

export type BridgeVariant = 'panel' | 'topbar' | 'strip';

interface BridgeStatusIndicatorProps {
  status: ConnectionStatus;
  /** Visual size/layout variant. Defaults to 'panel' for backward compatibility. */
  variant?: BridgeVariant;
  /** Override the default status label. */
  label?: string;
  /** Optional metric count rendered after the label (panel only). */
  count?: number;
  /** Native title attribute (tooltip) — usually topbar/strip. */
  title?: string;
  /**
   * Per-status color override for surfaces with a non-chart-color palette
   * (e.g. the /layout lab uses Blueprint/Studio theme tokens by design).
   */
  paletteOverride?: Partial<Record<ConnectionStatus, string>>;
  /** Extra className on the outer container. */
  className?: string;
}

const DOT_SIZES: Record<BridgeVariant, string> = {
  panel: 'w-2 h-2',
  topbar: 'w-2 h-2',
  strip: 'w-2 h-2',
};

const ICON_SIZES: Record<BridgeVariant, string> = {
  panel: 'w-3 h-3',
  topbar: 'w-3 h-3',
  strip: 'w-3 h-3',
};

const PULSE_ANIM = { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] };
const PULSE_TRANSITION = { duration: 2, repeat: Infinity };

export function BridgeStatusIndicator({
  status,
  variant = 'panel',
  label,
  count,
  title,
  paletteOverride,
  className,
}: BridgeStatusIndicatorProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const color = paletteOverride?.[status] ?? config.color;
  const displayLabel = label ?? config.label;

  if (variant === 'topbar') {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors${className ? ` ${className}` : ''}`}
        style={{
          backgroundColor: `${color}14`,
          border: `1px solid ${color}33`,
          color,
        }}
        title={title}
        role="status"
        aria-live="polite"
      >
        <config.Icon
          className={`${ICON_SIZES.topbar}${config.Icon === Loader2 ? ' animate-spin' : ''}`}
          style={{ color }}
          aria-hidden="true"
        />
        <span>{displayLabel}</span>
      </div>
    );
  }

  if (variant === 'strip') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-sm font-mono${className ? ` ${className}` : ''}`}
        style={{ color, userSelect: 'none' }}
        title={title}
        role="status"
        aria-live="polite"
      >
        <motion.span
          className={`${DOT_SIZES.strip} rounded-full inline-block flex-shrink-0`}
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
          animate={config.pulse ? PULSE_ANIM : {}}
          transition={PULSE_TRANSITION}
          aria-hidden="true"
        />
        <span>{displayLabel}</span>
      </span>
    );
  }

  // panel (default) — preserves the legacy ConnectionStatusBadge layout.
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-mono font-bold${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      style={{ color }}
      title={title}
    >
      <motion.span
        className={`${DOT_SIZES.panel} rounded-full`}
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
        animate={config.pulse ? PULSE_ANIM : {}}
        transition={PULSE_TRANSITION}
        aria-hidden="true"
      />
      {displayLabel}
      {count !== undefined && (
        <span className="text-text-muted font-normal ml-0.5">({count})</span>
      )}
    </span>
  );
}

/**
 * @deprecated Use `BridgeStatusIndicator` directly. Kept as an alias so existing
 * call sites (BridgeEndpointHealth / LiveStateSyncPanel / UE5RemoteController)
 * continue to render the legacy "panel" layout unchanged.
 */
export const ConnectionStatusBadge = (
  props: Omit<BridgeStatusIndicatorProps, 'variant'>,
) => <BridgeStatusIndicator {...props} variant="panel" />;
