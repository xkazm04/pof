// ── Types ──

export type ScreenType =
  | 'main-menu'
  | 'settings'
  | 'pause-menu'
  | 'hud'
  | 'loading'
  | 'splash'
  | 'popup'
  | 'custom';

export interface ScreenNode {
  id: string;
  name: string;
  type: ScreenType;
  x: number;
  y: number;
  widgets: string[];
}

export interface ScreenTransition {
  id: string;
  fromId: string;
  toId: string;
  trigger: string;
  bidirectional: boolean;
}

export interface MenuFlowConfig {
  screens: ScreenNode[];
  transitions: ScreenTransition[];
}
