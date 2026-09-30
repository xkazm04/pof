// ── Types ──────────────────────────────────────────────────────────────────

export type SyncDirection = 'outbound' | 'inbound';
export type LogLevel = 'info' | 'warn' | 'conflict';

export interface SyncLogEntry {
  id: number;
  ts: number;
  direction: SyncDirection;
  level: LogLevel;
  category: string;
  message: string;
  detail?: string;
  /** Outbound only: the frame never left (socket not OPEN) - not counted as sent. */
  dropped?: boolean;
}

export interface PropertyEdit {
  objectPath: string;
  propertyName: string;
  value: string;
}

export interface ViewportTarget {
  x: string;
  y: string;
  z: string;
  pitch: string;
  yaw: string;
  roll: string;
  fov: string;
}

/** A diverged write from the WS client's ledger (base / written / inbound, typed). */
export type { SyncConflict } from '@/types/ue5-bridge';
