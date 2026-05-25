/**
 * Centralized status color tokens for the Blender MCP surface.
 *
 * Single source of truth for the connection pill, status dot, connect/disconnect
 * buttons, error/warning banners, and result blocks. Built on the project's
 * status CSS variables (--status-green-*, --status-amber-*, --status-red-*)
 * exposed as Tailwind utilities via @theme inline in globals.css, so a theme
 * change propagates everywhere automatically and we stop sourcing raw palette
 * shades (emerald-500, amber-400, zinc-400…) from ad-hoc places.
 */

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

/** Pill (rounded chip) background + text for a given connection state. */
export const PILL_BY_STATE: Record<ConnectionState, string> = {
  connected: 'bg-status-green-subtle text-green-400',
  connecting: 'bg-status-amber-subtle text-amber-400',
  disconnected: 'bg-surface-deep text-text-muted',
};

/** Status dot background for a given connection state. Connecting pulses. */
export const DOT_BY_STATE: Record<ConnectionState, string> = {
  connected: 'bg-green-400',
  connecting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-text-muted',
};

/** Connect button uses the success palette; disconnect uses the error palette. */
export const CONNECT_BUTTON =
  'bg-status-green-subtle text-green-400 hover:bg-status-green-medium';

export const DISCONNECT_BUTTON =
  'bg-status-red-subtle text-red-400 hover:bg-status-red-medium';

/** Inline error banner — destructive emphasis with subtle fill + medium border. */
export const ERROR_BANNER =
  'bg-status-red-subtle border border-status-red-medium text-red-400';

/** Inline warning text — used for "Connect to Blender MCP first" hints. */
export const WARNING_TEXT = 'text-amber-400';

/** Success result block — subtle green fill + medium green border. */
export const SUCCESS_RESULT =
  'bg-status-green-subtle border border-status-green-medium';

/** Error result block — subtle red fill + medium red border. */
export const ERROR_RESULT =
  'bg-status-red-subtle border border-status-red-medium';
