import { STATUS_SUCCESS, STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING } from '@/lib/chart-colors';

// ── Equipment slot positions for the character silhouette layout ──
// `stub` is the on-screen tag: <= 4 chars on the Equip tab, its first 3 on the grid
// silhouette. Paired slots (weapons, rings) get explicit stubs so both stay distinct.

export const EQUIP_POSITIONS: Record<string, { x: number; y: number; label: string; stub?: string }> = {
  head: { x: 50, y: 4, label: 'Head' },
  chest: { x: 50, y: 28, label: 'Chest' },
  hands: { x: 14, y: 28, label: 'Hands' },
  legs: { x: 50, y: 52, label: 'Legs' },
  feet: { x: 50, y: 76, label: 'Feet' },
  'weapon-l': { x: 14, y: 52, label: 'Wpn L', stub: 'WpL' },
  'weapon-r': { x: 86, y: 52, label: 'Wpn R', stub: 'WpR' },
  'ring-1': { x: 14, y: 76, label: 'Ring', stub: 'Rg1' },
  'ring-2': { x: 86, y: 76, label: 'Ring', stub: 'Rg2' },
  amulet: { x: 86, y: 28, label: 'Amul' },
  belt: { x: 86, y: 4, label: 'Belt' },
  cape: { x: 14, y: 4, label: 'Cape' },
};

/** The visible tag of an equipment position, at most `max` chars. */
export function equipStub(pos: { label: string; stub?: string }, max: 3 | 4): string {
  return (pos.stub ?? pos.label).slice(0, max);
}

// ── Rarity colors ──
export const RARITY_COLORS: Record<string, string> = {
  Common: 'var(--text-muted)',
  Uncommon: STATUS_SUCCESS,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};
