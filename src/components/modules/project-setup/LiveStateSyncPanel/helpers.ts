// ── Helpers ────────────────────────────────────────────────────────────────

export function formatVec3(v: { x: number; y: number; z: number } | undefined): string {
  if (!v) return '—';
  return `${v.x.toFixed(0)}, ${v.y.toFixed(0)}, ${v.z.toFixed(0)}`;
}

export function formatRot(r: { pitch: number; yaw: number; roll: number } | undefined): string {
  if (!r) return '—';
  return `P:${r.pitch.toFixed(1)} Y:${r.yaw.toFixed(1)} R:${r.roll.toFixed(1)}`;
}
