// ── Helpers ────────────────────────────────────────────────────────────────

export function formatVec3(v: { x: number; y: number; z: number } | undefined): string {
  if (!v) return '—';
  return `${v.x.toFixed(0)}, ${v.y.toFixed(0)}, ${v.z.toFixed(0)}`;
}

export function formatRot(r: { pitch: number; yaw: number; roll: number } | undefined): string {
  if (!r) return '—';
  return `P:${r.pitch.toFixed(1)} Y:${r.yaw.toFixed(1)} R:${r.roll.toFixed(1)}`;
}

/**
 * Wall-clock HH:MM:SS for a watch update timestamp.
 *
 * Absolute (not "Xs ago") on purpose: a relative age would need `Date.now()`
 * during render, which the react-hooks purity rule rejects. Derived only from
 * the passed timestamp, so it stays pure. Returns null when unstamped.
 */
export function formatClock(ts: number | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
