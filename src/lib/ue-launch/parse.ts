/**
 * Reads a `KEY=VALUE` marker out of a UE abslog — the deterministic result
 * channel for autonomous launches (emit `unreal.log('SPIKE=' + result)` in an
 * `-ExecCmds=py …`, then read the value back here). Returns the first match's
 * trimmed value, or null. The key is matched literally (no regex injection). Pure.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractLogMarker(log: string, key: string): string | null {
  const m = log.match(new RegExp(`${escapeRegExp(key)}=(.*)`));
  return m ? m[1].trim() : null;
}
