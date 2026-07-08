import { STATUS_SUCCESS, STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING } from '@/lib/chart-colors';

// ── Equipment slot positions for the character silhouette layout ──

export const EQUIP_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  head: { x: 50, y: 4, label: 'Head' },
  chest: { x: 50, y: 28, label: 'Chest' },
  hands: { x: 14, y: 28, label: 'Hands' },
  legs: { x: 50, y: 52, label: 'Legs' },
  feet: { x: 50, y: 76, label: 'Feet' },
  'weapon-l': { x: 14, y: 52, label: 'Wpn L' },
  'weapon-r': { x: 86, y: 52, label: 'Wpn R' },
  'ring-1': { x: 14, y: 76, label: 'Ring' },
  'ring-2': { x: 86, y: 76, label: 'Ring' },
  amulet: { x: 86, y: 28, label: 'Amul' },
  belt: { x: 86, y: 4, label: 'Belt' },
  cape: { x: 14, y: 4, label: 'Cape' },
};

// ── Rarity colors ──
export const RARITY_COLORS: Record<string, string> = {
  Common: 'var(--text-muted)',
  Uncommon: STATUS_SUCCESS,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};
