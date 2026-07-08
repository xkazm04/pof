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

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}
