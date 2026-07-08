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

export interface SyncConflict {
  watchId: string;
  propertyName: string;
  inbound: unknown;
  outbound: string;
}
