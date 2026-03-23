import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_SUBDUED,
  ACCENT_PINK, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { GraphNode, GraphEdge, BudgetBar } from '@/types/unique-tab-improvements';
import type { PillItem } from '@/components/ui/InteractivePill';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type InputMode = 'Game' | 'UI' | 'GameAndUI';

export interface ScreenNode {
  id: string;
  featureName: string;
  inputMode: InputMode;
  subWidgets: string[];
  description: string;
  trigger?: string;
}

export interface BreakpointWidget {
  widget: string;
  minRes: string;
  scaleMode: string;
  status: 'ok' | 'warn' | 'error';
}

export interface WidgetBinding {
  widget: string;
  attribute: string;
  updateMethod: string;
  frequency: string;
  isStale: boolean;
}

export interface AccessibilityCategory {
  name: string;
  grade: string;
  score: number;
  issues: number;
  color: string;
}

export interface AnimTransition {
  widget: string;
  openAnim: string;
  closeAnim: string;
  duration: string;
  easing: string;
}

export interface ZLayer {
  depth: number;
  label: string;
  widgets: string[];
  color: string;
  hasOverlap?: boolean;
}

export interface HudContext {
  name: string;
  color: string;
  visible: string[];
  hidden: string[];
}

export interface LangExpansion {
  code: string;
  label: string;
  expansion: number;
  overflowWidgets: string[];
}

export interface WidgetPlacement {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zDepth: number;
}

export interface StateMachineEdge {
  from: InputMode;
  to: InputMode;
  trigger: string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

export const INPUT_MODE_COLORS: Record<InputMode, string> = {
  Game: MODULE_COLORS.core,
  UI: ACCENT_PINK,
  GameAndUI: MODULE_COLORS.systems,
};

export const SCREEN_TO_FLOW: Record<string, string> = {
  'hud-health': 'HUD',
  'hud-abilities': 'HUD',
  'inventory': 'Inventory',
  'char-stats': 'CharStats',
  'pause': 'Pause',
  'enemy-bars': 'EnemyBars',
  'damage-numbers': 'DamageNumbers',
};

/* ── Screen node definitions ───────────────────────────────────────────────── */

export const HUD_CHILDREN: ScreenNode[] = [
  { id: 'hud-health', featureName: 'GAS attribute binding', inputMode: 'Game', subWidgets: ['WBP_HealthBar', 'WBP_ManaBar'], description: 'Real-time attribute delegates update bar fill percentage', trigger: 'Always visible' },
  { id: 'hud-abilities', featureName: 'Ability cooldown UI', inputMode: 'Game', subWidgets: ['WBP_AbilitySlot x4', 'WBP_CooldownSweep'], description: 'Ability slots with icon, cooldown sweep, keybind label', trigger: 'Always visible' },
];

export const HUD_OVERLAYS: ScreenNode[] = [
  { id: 'inventory', featureName: 'Inventory screen', inputMode: 'UI', subWidgets: ['WBP_ItemGrid', 'WBP_Tooltip', 'WBP_EquipPanel'], description: 'Grid inventory with drag-and-drop and equipment panel', trigger: 'Tab' },
  { id: 'char-stats', featureName: 'Character stats screen', inputMode: 'UI', subWidgets: ['WBP_StatRow', 'WBP_AttributeTotal'], description: 'All attributes with base + bonus display', trigger: 'C' },
  { id: 'pause', featureName: 'Pause/settings menus', inputMode: 'UI', subWidgets: ['WBP_PauseMenu', 'WBP_SettingsPanel'], description: 'Pause menu with graphics, audio, controls settings', trigger: 'Esc' },
];

export const FLOATING_NODES: ScreenNode[] = [
  { id: 'enemy-bars', featureName: 'Enemy health bars', inputMode: 'GameAndUI', subWidgets: ['WBP_EnemyHealthBar', 'UWidgetComponent'], description: 'Floating UWidgetComponent with fade-in/out behavior', trigger: 'On damage' },
  { id: 'damage-numbers', featureName: 'Floating damage numbers', inputMode: 'Game', subWidgets: ['WBP_DamageText', 'WBP_CritText'], description: 'Damage text at hit location, colored by type, crit variant', trigger: 'On hit' },
];

/* ── Flow Graph ────────────────────────────────────────────────────────────── */

export const FLOW_NODES: GraphNode[] = [
  { id: 'HUD', label: 'HUD', group: 'Core', color: ACCENT_PINK },
  { id: 'Inventory', label: 'Inventory', group: 'Overlay', color: ACCENT_CYAN },
  { id: 'CharStats', label: 'CharStats', group: 'Overlay', color: ACCENT_EMERALD },
  { id: 'Pause', label: 'Pause', group: 'Overlay', color: ACCENT_ORANGE },
  { id: 'EnemyBars', label: 'EnemyBars', group: 'Floating', color: ACCENT_VIOLET },
  { id: 'DamageNumbers', label: 'DamageNumbers', group: 'Floating', color: STATUS_ERROR },
];

export const FLOW_EDGES: GraphEdge[] = [
  { source: 'HUD', target: 'Inventory', label: 'Press I' },
  { source: 'HUD', target: 'CharStats', label: 'Press C' },
  { source: 'HUD', target: 'Pause', label: 'Press Esc' },
  { source: 'HUD', target: 'EnemyBars', label: 'On Damage' },
  { source: 'HUD', target: 'DamageNumbers', label: 'On Hit' },
  { source: 'Inventory', target: 'HUD', label: 'Press I', style: 'dashed' },
  { source: 'CharStats', target: 'HUD', label: 'Press C', style: 'dashed' },
  { source: 'Pause', target: 'HUD', label: 'Press Esc', style: 'dashed' },
];

export const FLOW_GROUP_COLORS: Record<string, string> = {
  Core: ACCENT_PINK,
  Overlay: ACCENT_CYAN,
  Floating: ACCENT_VIOLET,
};

/* ── Performance Budget ────────────────────────────────────────────────────── */

export const PERFORMANCE_BUDGETS: BudgetBar[] = [
  { label: 'VertexCount', current: 800, max: 2000, unit: '', color: ACCENT_CYAN, threshold: { warn: 1400, danger: 1800 } },
  { label: 'DrawCalls', current: 12, max: 50, unit: '', color: ACCENT_EMERALD, threshold: { warn: 35, danger: 45 } },
  { label: 'TextureMemory', current: 24, max: 128, unit: 'MB', color: ACCENT_ORANGE, threshold: { warn: 90, danger: 115 } },
  { label: 'Bindings', current: 8, max: 20, unit: '', color: ACCENT_VIOLET, threshold: { warn: 14, danger: 18 } },
];

/* ── Breakpoints ───────────────────────────────────────────────────────────── */

export const BREAKPOINTS: { label: string; width: number }[] = [
  { label: '720p', width: 1280 },
  { label: '1080p', width: 1920 },
  { label: '1440p', width: 2560 },
  { label: '4K', width: 3840 },
];

export const BREAKPOINT_PILLS: PillItem[] = BREAKPOINTS.map(bp => ({ id: bp.label, label: bp.label }));

export const BREAKPOINT_WIDGETS: BreakpointWidget[] = [
  { widget: 'HealthBar', minRes: '720p', scaleMode: 'DPI Scale', status: 'ok' },
  { widget: 'AbilitySlots', minRes: '720p', scaleMode: 'Anchor Stretch', status: 'ok' },
  { widget: 'Inventory', minRes: '1080p', scaleMode: 'Fixed Size', status: 'warn' },
  { widget: 'MiniMap', minRes: '720p', scaleMode: 'Scale Box', status: 'ok' },
  { widget: 'Tooltip', minRes: '720p', scaleMode: 'DPI Scale', status: 'ok' },
  { widget: 'DamageNumbers', minRes: '720p', scaleMode: 'World Space', status: 'ok' },
  { widget: 'QuestTracker', minRes: '1080p', scaleMode: 'Anchor Stretch', status: 'warn' },
  { widget: 'ChatBox', minRes: '1440p', scaleMode: 'Fixed Size', status: 'error' },
];

/* ── Input Mode State Machine ──────────────────────────────────────────────── */

export const SM_NODES: { id: InputMode; label: string }[] = [
  { id: 'Game', label: 'Game' },
  { id: 'UI', label: 'UI' },
  { id: 'GameAndUI', label: 'GameAndUI' },
];

export const SM_EDGES: StateMachineEdge[] = [
  { from: 'Game', to: 'UI', trigger: 'Open Menu' },
  { from: 'UI', to: 'Game', trigger: 'Close Menu' },
  { from: 'Game', to: 'GameAndUI', trigger: 'Show Cursor' },
  { from: 'GameAndUI', to: 'Game', trigger: 'Hide Cursor' },
  { from: 'GameAndUI', to: 'UI', trigger: 'Pause' },
  { from: 'UI', to: 'GameAndUI', trigger: 'Unpause' },
];

/* ── Widget Bindings ───────────────────────────────────────────────────────── */

export const WIDGET_BINDINGS: WidgetBinding[] = [
  { widget: 'HealthBar', attribute: 'HP', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'ManaBar', attribute: 'Mana', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'AbilitySlot', attribute: 'Cooldown', updateMethod: 'Timer', frequency: '0.1s', isStale: false },
  { widget: 'ExperienceBar', attribute: 'XP', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'EnemyHealthBar', attribute: 'EnemyHP', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'StaminaBar', attribute: 'Stamina', updateMethod: 'Poll', frequency: '0.5s', isStale: true },
  { widget: 'BuffIcon', attribute: 'ActiveEffects', updateMethod: 'Event', frequency: 'OnApply/Remove', isStale: false },
  { widget: 'DamageText', attribute: 'DamageValue', updateMethod: 'Event', frequency: 'OnHit', isStale: false },
];

/* ── Accessibility ─────────────────────────────────────────────────────────── */

export const A11Y_OVERALL_GRADE = 'B+';
export const A11Y_OVERALL_SCORE = 82;

export const A11Y_CATEGORIES: AccessibilityCategory[] = [
  { name: 'Text Readability', grade: 'A', score: 92, issues: 1, color: STATUS_SUCCESS },
  { name: 'Color Contrast', grade: 'B', score: 78, issues: 4, color: ACCENT_CYAN },
  { name: 'Input Accessibility', grade: 'C', score: 65, issues: 7, color: STATUS_WARNING },
  { name: 'Motion Sensitivity', grade: 'A', score: 95, issues: 0, color: ACCENT_EMERALD },
];

/* ── Animation Catalog ─────────────────────────────────────────────────────── */

export const ANIM_CATALOG: AnimTransition[] = [
  { widget: 'Inventory', openAnim: 'FadeIn', closeAnim: 'FadeOut', duration: '0.3s', easing: 'EaseOut' },
  { widget: 'CharStats', openAnim: 'SlideRight', closeAnim: 'SlideLeft', duration: '0.25s', easing: 'EaseInOut' },
  { widget: 'PauseMenu', openAnim: 'ScaleUp', closeAnim: 'ScaleDown', duration: '0.2s', easing: 'EaseOut' },
  { widget: 'Tooltip', openAnim: 'FadeIn', closeAnim: 'FadeOut', duration: '0.15s', easing: 'Linear' },
  { widget: 'HealthBar', openAnim: 'SlideDown', closeAnim: 'FadeOut', duration: '0.4s', easing: 'Spring' },
  { widget: 'DamageNumber', openAnim: 'PopIn', closeAnim: 'FloatUp', duration: '0.8s', easing: 'EaseOut' },
  { widget: 'EnemyHealthBar', openAnim: 'FadeIn', closeAnim: 'FadeOut', duration: '0.3s', easing: 'EaseInOut' },
  { widget: 'QuestNotify', openAnim: 'SlideRight', closeAnim: 'SlideRight', duration: '0.5s', easing: 'Spring' },
];

/* ── Z-Layers ──────────────────────────────────────────────────────────────── */

export const Z_LAYERS: ZLayer[] = [
  { depth: 0, label: 'GameWorld', widgets: ['Viewport', 'WorldActors'], color: STATUS_SUBDUED },
  { depth: 1, label: 'HUD', widgets: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap'], color: ACCENT_PINK },
  { depth: 2, label: 'FloatingBars', widgets: ['EnemyHealthBar', 'DamageNumbers'], color: ACCENT_VIOLET, hasOverlap: true },
  { depth: 3, label: 'Overlays', widgets: ['Inventory', 'CharStats', 'QuestTracker'], color: ACCENT_CYAN },
  { depth: 4, label: 'Modals', widgets: ['PauseMenu', 'SettingsPanel', 'ConfirmDialog'], color: ACCENT_ORANGE },
];

/* ── Localization ──────────────────────────────────────────────────────────── */

export const LANGUAGES: LangExpansion[] = [
  { code: 'EN', label: 'English', expansion: 100, overflowWidgets: [] },
  { code: 'DE', label: 'German', expansion: 135, overflowWidgets: ['AbilityTooltip', 'QuestDescription'] },
  { code: 'FR', label: 'French', expansion: 125, overflowWidgets: ['AbilityTooltip'] },
  { code: 'JA', label: 'Japanese', expansion: 90, overflowWidgets: [] },
  { code: 'ZH', label: 'Chinese', expansion: 85, overflowWidgets: [] },
];

export const LANGUAGE_PILLS: PillItem[] = LANGUAGES.map(l => ({ id: l.code, label: l.code }));

/* ── HUD Context Modes ─────────────────────────────────────────────────────── */

export const HUD_CONTEXTS: HudContext[] = [
  { name: 'Combat', color: STATUS_ERROR, visible: ['HealthBar', 'ManaBar', 'AbilitySlots', 'EnemyBars', 'DamageNumbers', 'StaminaBar'], hidden: ['MiniMap', 'QuestTracker', 'ChatBox'] },
  { name: 'Exploration', color: ACCENT_EMERALD, visible: ['HealthBar', 'MiniMap', 'QuestTracker', 'ManaBar'], hidden: ['AbilitySlots', 'EnemyBars', 'DamageNumbers', 'StaminaBar', 'ChatBox'] },
  { name: 'Dialogue', color: ACCENT_CYAN, visible: ['DialogueBox', 'PortraitFrame', 'ChoiceList'], hidden: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap', 'EnemyBars', 'DamageNumbers'] },
  { name: 'Death', color: STATUS_SUBDUED, visible: ['DeathOverlay', 'RespawnButton', 'DeathStats'], hidden: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap', 'EnemyBars', 'QuestTracker'] },
];

/* ── Widget Placements ─────────────────────────────────────────────────────── */

export const WIDGET_PLACEMENTS: WidgetPlacement[] = [
  { id: 'HealthBar', label: 'Health', x: 2, y: 3, w: 18, h: 5, zDepth: 1 },
  { id: 'ManaBar', label: 'Mana', x: 2, y: 10, w: 14, h: 4, zDepth: 1 },
  { id: 'StaminaBar', label: 'Stamina', x: 2, y: 16, w: 12, h: 3, zDepth: 1 },
  { id: 'AbilitySlots', label: 'Abilities', x: 30, y: 88, w: 40, h: 9, zDepth: 1 },
  { id: 'MiniMap', label: 'MiniMap', x: 82, y: 3, w: 16, h: 20, zDepth: 1 },
  { id: 'QuestTracker', label: 'Quests', x: 80, y: 26, w: 18, h: 18, zDepth: 3 },
  { id: 'ChatBox', label: 'Chat', x: 2, y: 70, w: 22, h: 16, zDepth: 3 },
  { id: 'EnemyBars', label: 'Enemy HP', x: 35, y: 20, w: 14, h: 4, zDepth: 2 },
  { id: 'DamageNumbers', label: 'Dmg Numbers', x: 45, y: 30, w: 12, h: 5, zDepth: 2 },
  { id: 'DialogueBox', label: 'Dialogue', x: 10, y: 65, w: 80, h: 22, zDepth: 3 },
  { id: 'PortraitFrame', label: 'Portrait', x: 3, y: 55, w: 12, h: 20, zDepth: 3 },
  { id: 'ChoiceList', label: 'Choices', x: 60, y: 45, w: 30, h: 18, zDepth: 3 },
  { id: 'DeathOverlay', label: 'Death Screen', x: 15, y: 20, w: 70, h: 40, zDepth: 4 },
  { id: 'RespawnButton', label: 'Respawn', x: 35, y: 65, w: 30, h: 10, zDepth: 4 },
  { id: 'DeathStats', label: 'Death Stats', x: 30, y: 78, w: 40, h: 12, zDepth: 4 },
];

export const WIDGET_Z_COLOR: Record<string, string> = {};
for (const layer of Z_LAYERS) {
  for (const w of layer.widgets) {
    WIDGET_Z_COLOR[w] = layer.color;
  }
}
WIDGET_Z_COLOR['EnemyBars'] = ACCENT_VIOLET;
WIDGET_Z_COLOR['DamageNumbers'] = ACCENT_VIOLET;
WIDGET_Z_COLOR['StaminaBar'] = ACCENT_PINK;
WIDGET_Z_COLOR['ChatBox'] = ACCENT_CYAN;
WIDGET_Z_COLOR['DialogueBox'] = ACCENT_CYAN;
WIDGET_Z_COLOR['PortraitFrame'] = ACCENT_CYAN;
WIDGET_Z_COLOR['ChoiceList'] = ACCENT_CYAN;
WIDGET_Z_COLOR['DeathOverlay'] = ACCENT_ORANGE;
WIDGET_Z_COLOR['RespawnButton'] = ACCENT_ORANGE;
WIDGET_Z_COLOR['DeathStats'] = ACCENT_ORANGE;

export const Z_DEPTH_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'HUD', color: ACCENT_PINK },
  2: { label: 'Floating', color: ACCENT_VIOLET },
  3: { label: 'Overlay', color: ACCENT_CYAN },
  4: { label: 'Modal', color: ACCENT_ORANGE },
};
