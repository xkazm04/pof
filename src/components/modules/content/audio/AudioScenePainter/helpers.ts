import type { AudioZone } from '@/types/audio-scene';
import { ZONE_COLORS } from './constants';

// ── Helpers ──

/** Resolve a zone's display color, falling back to its reverb preset hue. */
export function resolveZoneColor(zone: AudioZone): string {
  return zone.color || ZONE_COLORS[zone.reverbPreset] || 'var(--text-muted)';
}

/** Geometric center of a zone — circle origin is already its center, rect is top-left. */
export function zoneCentroid(zone: AudioZone): { x: number; y: number } {
  return zone.shape === 'circle'
    ? { x: zone.x, y: zone.y }
    : { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
}

export function findContainingZone(x: number, y: number, zones: AudioZone[]): string | null {
  for (const zone of zones) {
    if (zone.shape === 'circle') {
      const dx = x - zone.x;
      const dy = y - zone.y;
      if (dx * dx + dy * dy <= (zone.width / 2) * (zone.width / 2)) return zone.id;
    } else {
      if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) return zone.id;
    }
  }
  return null;
}
