import { STATUS_INFO, STATUS_SUCCESS, ACCENT_VIOLET, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, STATUS_SUBDUED, ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { ZoneType, LoadPriority, TransitionStyle, StreamingZone, ZoneTransition } from './types';

// ── Constants ──

export const CELL_SIZE = 72;

export const ZONE_TYPES: Record<ZoneType, { color: string; label: string; letter: string }> = {
  'town': { color: STATUS_INFO, label: 'Town', letter: 'T' },
  'forest': { color: STATUS_SUCCESS, label: 'Forest', letter: 'F' },
  'ruins': { color: ACCENT_VIOLET, label: 'Ruins', letter: 'R' },
  'catacombs': { color: STATUS_SUBDUED, label: 'Catacombs', letter: 'C' },
  'boss-arena': { color: STATUS_ERROR, label: 'Boss Arena', letter: 'B' },
  'hub': { color: ACCENT_CYAN_LIGHT, label: 'Hub', letter: 'H' },
  'dungeon': { color: STATUS_BLOCKER, label: 'Dungeon', letter: 'D' },
  'custom': { color: 'var(--text-muted)', label: 'Custom', letter: '?' },
};

export const PRIORITY_COLORS: Record<LoadPriority, string> = {
  always: STATUS_ERROR,
  high: STATUS_WARNING,
  normal: STATUS_INFO,
  low: 'var(--text-muted)',
};

export const DEFAULT_ZONES: StreamingZone[] = [
  { id: 'z-town', name: 'Town', type: 'town', gridX: 2, gridY: 2, loadPriority: 'always', alwaysLoaded: true, preloadRadius: 2 },
  { id: 'z-forest', name: 'Dark Forest', type: 'forest', gridX: 3, gridY: 1, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-ruins', name: 'Old Ruins', type: 'ruins', gridX: 4, gridY: 2, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-cata', name: 'Catacombs', type: 'catacombs', gridX: 3, gridY: 3, loadPriority: 'low', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-boss', name: 'Boss Arena', type: 'boss-arena', gridX: 5, gridY: 2, loadPriority: 'high', alwaysLoaded: false, preloadRadius: 2 },
];

export const DEFAULT_TRANSITIONS: ZoneTransition[] = [
  { id: 'tr-1', fromId: 'z-town', toId: 'z-forest', style: 'seamless', triggerType: 'proximity', condition: '' },
  { id: 'tr-2', fromId: 'z-forest', toId: 'z-ruins', style: 'seamless', triggerType: 'proximity', condition: '' },
  { id: 'tr-3', fromId: 'z-town', toId: 'z-cata', style: 'fade', triggerType: 'interaction', condition: '' },
  { id: 'tr-4', fromId: 'z-ruins', toId: 'z-boss', style: 'loading-screen', triggerType: 'interaction', condition: 'Collect 3 Rune Fragments' },
];

// ── Transition style config ──

export const TRANSITION_STYLES: Record<TransitionStyle, { color: string; label: string }> = {
  seamless: { color: STATUS_SUCCESS, label: 'Seamless' },
  'loading-screen': { color: STATUS_ERROR, label: 'Loading' },
  fade: { color: ACCENT_VIOLET, label: 'Fade' },
  portal: { color: STATUS_WARNING, label: 'Portal' },
};
