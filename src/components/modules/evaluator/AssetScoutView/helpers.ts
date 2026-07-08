import type { IntegrationSpec } from '@/types/marketplace';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive the download filename for an adapter file. The generated code embeds
 * the adapter class name (e.g. `UPoFSwordAdapter`) in its includes, so we parse
 * it back out to match exactly what a UE5 project expects on disk; falls back to
 * a sanitized asset name if the includes can't be parsed.
 */
export function adapterFileName(integration: IntegrationSpec, kind: 'header' | 'source'): string {
  const ext = kind === 'header' ? 'h' : 'cpp';
  const fromSource = integration.adapterSource.match(/#include\s+"[^"]*?([A-Za-z0-9_]+Adapter)\.h"/);
  const fromHeader = integration.adapterHeader.match(/([A-Za-z0-9_]+Adapter)\.generated\.h/);
  const base =
    fromSource?.[1] ??
    fromHeader?.[1] ??
    `${integration.assetName.replace(/[^A-Za-z0-9]/g, '')}Adapter`;
  return `${base}.${ext}`;
}

export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
