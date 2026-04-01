/**
 * Shared constants — single source of truth for values duplicated across the codebase.
 *
 * Re-exports MODULE_COLORS from chart-colors.ts for accent color access.
 */

export { MODULE_COLORS } from './chart-colors';

/** Standardized z-index scale — prevents stacking-context collisions across components. */
export const Z_INDEX = {
  /** Inline overlays: tooltips on hover, sticky headers, playhead cursors */
  overlay: 20,
  /** Backdrop layers: modal backdrops, side-panel scrims */
  backdrop: 30,
  /** Panels: slide-over panels, drawers, sidebars */
  panel: 40,
  /** Toast / snackbar: always above panels */
  toast: 50,
  /** Modal: highest standard layer */
  modal: 60,
} as const;

/** Safe window.location.origin accessor for SSR / client contexts. */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  // Server-side: derive from env or default to localhost on the configured port
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Derive the app origin from an incoming request's Host header.
 * Use this in API route handlers where the request is available.
 */
export function getOriginFromRequest(request: { headers: { get(name: string): string | null } }): string {
  const host = request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    return `${proto}://${host}`;
  }
  return getAppOrigin();
}

/**
 * Unified motion timing scale — re-exported from motion.ts (single source of truth).
 * Consumers can import MOTION from either '@/lib/constants' or '@/lib/motion'.
 */
import { DURATION } from './motion';
export { DURATION as MOTION } from './motion';

/** CLI-specific animation presets — consistent timing for terminal UI. */
export const CLI_ANIM = {
  /** Fast expand/collapse transitions (120ms). */
  fast: { duration: 0.12, ease: DURATION.ease } as const,
  /** Medium state transitions (200ms). */
  medium: { duration: 0.2, ease: DURATION.ease } as const,
  /** Spring preset for drawer/panel animations. */
  spring: { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 },
} as const;

/** Standardized UI timing constants (ms). */
export const UI_TIMEOUTS = {
  /** Duration to show "Copied!" feedback before resetting. */
  copyFeedback: 1500,
  /** Toast / snackbar auto-dismiss duration. */
  toast: 3000,
  /** Microtask buffer to let synchronous store writes settle. */
  raceConditionBuffer: 50,
  /** Delay for terminal component to mount before dispatching events. */
  mountDelay: 100,
  /** Flash duration after a checklist item completes. */
  completionFlash: 2000,
  /** Delay between batch-queued checklist items. */
  batchItemDelay: 800,
  /** Watchdog interval: recover stuck batch state. */
  batchWatchdog: 3000,
  /** Polling interval for CLI-driven checklist completions. */
  pollInterval: 3000,
  /** Short settle time for DB writes before UI refresh. */
  dbSettle: 300,
  /** Heartbeat interval for long-running tasks. */
  heartbeatInterval: 2 * 60 * 1000,
  /** Interval to check for stuck/stale tasks. */
  stuckCheckInterval: 30 * 1000,
  /** Delay before starting the next queued task. */
  nextTaskDelay: 3000,
  /** Auto-submit delay after programmatic input fill. */
  autoSubmitDelay: 50,
  /** UE5 Remote Control health check interval. */
  ue5HealthCheck: 30_000,
  /** Base delay for UE5 reconnection attempts. */
  ue5ReconnectBase: 2_000,
  /** Maximum delay between reconnection attempts. */
  ue5ReconnectMax: 30_000,
  /** Timeout for individual UE5 HTTP requests. */
  ue5HttpTimeout: 10_000,
  /** Poll interval while a build is active. */
  buildPollInterval: 3_000,
  /** Maximum time for a headless build process (10 min). */
  buildProcessTimeout: 600_000,
  /** Poll interval for PoF Bridge health check. */
  pofHealthCheck: 10_000,
  /** Base delay for PoF Bridge reconnection attempts. */
  pofReconnectBase: 2_000,
  /** Maximum delay between PoF Bridge reconnection attempts. */
  pofReconnectMax: 30_000,
  /** Poll interval for manifest checksum change detection. */
  pofManifestPoll: 30_000,
  /** Timeout for individual PoF Bridge HTTP requests. */
  pofHttpTimeout: 15_000,
  /** Idle timeout before voice connection auto-disconnects (2 minutes). */
  voiceIdleDisconnect: 2 * 60 * 1000,
  /** Ping/keepalive interval for UE5 WebSocket connection. */
  ue5WsPingInterval: 15_000,
  /** Base delay for UE5 WebSocket reconnection attempts. */
  ue5WsReconnectBase: 2_000,
  /** Maximum delay between UE5 WebSocket reconnection attempts. */
  ue5WsReconnectMax: 30_000,
  /** Blender MCP TCP operation timeout. */
  blenderTcpTimeout: 30_000,
  /** Blender connection health check interval. */
  blenderHealthCheck: 15_000,
  /** Base delay for Blender reconnection attempts. */
  blenderReconnectBase: 2_000,
  /** Maximum delay between Blender reconnection attempts. */
  blenderReconnectMax: 30_000,
  /** Polling interval for Blender generation jobs. */
  blenderGenPollInterval: 5_000,
  /** Debounce delay for viewport screenshot requests. */
  blenderScreenshotDebounce: 500,
} as const;
