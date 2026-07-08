import { STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING, ACCENT_EMERALD, ACCENT_PINK, STATUS_BLOCKER, STATUS_SUBDUED } from '@/lib/chart-colors';
import type { ScreenType, ScreenNode, ScreenTransition, MenuFlowConfig } from './types';

// ── Constants ──

export const NODE_W = 170;
export const NODE_H = 72;

export const SCREEN_TYPES: Record<ScreenType, { color: string; label: string; icon: string }> = {
  'main-menu': { color: STATUS_INFO, label: 'Main Menu', icon: 'M' },
  'settings': { color: ACCENT_VIOLET, label: 'Settings', icon: 'S' },
  'pause-menu': { color: STATUS_WARNING, label: 'Pause Menu', icon: 'P' },
  'hud': { color: ACCENT_EMERALD, label: 'HUD', icon: 'H' },
  'loading': { color: STATUS_SUBDUED, label: 'Loading', icon: 'L' },
  'splash': { color: ACCENT_PINK, label: 'Splash', icon: '◆' },
  'popup': { color: STATUS_BLOCKER, label: 'Popup', icon: '▢' },
  'custom': { color: 'var(--text-muted)', label: 'Custom', icon: '?' },
};

const DEFAULT_SCREENS: ScreenNode[] = [
  { id: 'scr-main', name: 'Main Menu', type: 'main-menu', x: 60, y: 120, widgets: ['Play Button', 'Settings Button', 'Quit Button'] },
  { id: 'scr-settings', name: 'Settings', type: 'settings', x: 320, y: 40, widgets: ['Graphics Tab', 'Audio Tab', 'Controls Tab', 'Back Button'] },
  { id: 'scr-pause', name: 'Pause Menu', type: 'pause-menu', x: 320, y: 220, widgets: ['Resume Button', 'Settings Button', 'Quit Button'] },
];

const DEFAULT_TRANSITIONS: ScreenTransition[] = [
  { id: 'tr-1', fromId: 'scr-main', toId: 'scr-settings', trigger: 'Settings Button', bidirectional: true },
  { id: 'tr-2', fromId: 'scr-pause', toId: 'scr-settings', trigger: 'Settings Button', bidirectional: true },
];

export { DEFAULT_SCREENS, DEFAULT_TRANSITIONS };

export const DEFAULT_MENU_FLOW: MenuFlowConfig = {
  screens: DEFAULT_SCREENS,
  transitions: DEFAULT_TRANSITIONS,
};
