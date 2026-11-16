// ── Helpers ────────────────────────────────────────────────────────────────

let _logIdCounter = 0;
export function nextLogId(): number {
  return ++_logIdCounter;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export interface ParsedViewTarget {
  loc: { x: number; y: number; z: number };
  rot: { pitch: number; yaw: number; roll: number };
  fov: number;
}

/** The numeric teleport target, or null when a field is blank/invalid or FOV is outside (0, 180). */
export function parseViewTarget(v: Record<'x' | 'y' | 'z' | 'pitch' | 'yaw' | 'roll' | 'fov', string>): ParsedViewTarget | null {
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const [x, y, z, pitch, yaw, roll, fov] = [v.x, v.y, v.z, v.pitch, v.yaw, v.roll, v.fov].map(num);
  if (![x, y, z, pitch, yaw, roll, fov].every(Number.isFinite) || fov <= 0 || fov >= 180) return null;
  return { loc: { x, y, z }, rot: { pitch, yaw, roll }, fov };
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}
