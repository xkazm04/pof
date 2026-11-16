import { WifiOff, Loader2, AlertTriangle, RotateCw, Radio } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, ACCENT_ORANGE, ACCENT_CYAN } from '@/lib/chart-colors';
import type { UE5ConnectionStatus } from '@/types/ue5-bridge';

// ── Pre-snapshot state copy ───────────────────────────────────────────────
// Honest per-status copy: the panel must never claim "not connected" while the
// socket is mid-handshake, retrying, or connected-but-awaiting its first frame.

export interface StatusCopy {
  icon: typeof WifiOff;
  title: string;
  detail: string;
  color?: string;
  spin?: boolean;
}

export function statusCopy(status: UE5ConnectionStatus, wsPort: number): StatusCopy {
  switch (status) {
    case 'connecting':
      return {
        icon: Loader2,
        title: 'Connecting…',
        detail: `Opening the WebSocket channel on port ${wsPort}`,
        color: ACCENT_CYAN,
        spin: true,
      };
    case 'reconnecting':
      return {
        icon: RotateCw,
        title: 'Connection lost — reconnecting',
        detail: 'The channel closed unexpectedly. Retrying with backoff.',
        color: ACCENT_ORANGE,
        spin: true,
      };
    case 'error':
      return {
        icon: AlertTriangle,
        title: 'WebSocket connection failed',
        detail: `Could not reach the UE5 plugin on port ${wsPort}. Check the editor is running and the plugin's WS port matches.`,
        color: STATUS_ERROR,
      };
    case 'connected':
      return {
        icon: Radio,
        title: 'Connected — waiting for the first snapshot',
        detail: 'The channel is open; no editor state has arrived yet.',
        color: STATUS_SUCCESS,
      };
    default:
      return {
        icon: WifiOff,
        title: 'WebSocket not connected',
        detail: 'Connect to stream real-time editor state from UE5',
      };
  }
}
