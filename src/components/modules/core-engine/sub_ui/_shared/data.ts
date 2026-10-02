import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_PINK, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { GraphNode, GraphEdge, BudgetBar } from '@/types/unique-tab-improvements';
import type { PillItem } from '@/components/ui/InteractivePill';
import {
  SCREEN_TRIGGERS, triggerLabel, screenTrigger, performanceBudgets, breakpointWidgets, widgetBindings,
  animCatalog, zLayers, canonicalContexts, widgetPlacements, widgetZColor, zDepthLabels,
} from '@/components/modules/core-engine/sub_ui/_shared/hudRegistry';

/*
 * Widget identity (ids, z-depths, placements, bindings, animations,
 * breakpoints, context membership) and the overlay triggers are owned by
 * `hudRegistry.ts`. The widget tables below are projections of it; edit the
 * registry, not these exports.
 */

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
  { id: 'inventory', featureName: 'Inventory screen', inputMode: 'UI', subWidgets: ['WBP_ItemGrid', 'WBP_Tooltip', 'WBP_EquipPanel'], description: 'Grid inventory with drag-and-drop and equipment panel', trigger: screenTrigger('inventory') },
  { id: 'char-stats', featureName: 'Character stats screen', inputMode: 'UI', subWidgets: ['WBP_StatRow', 'WBP_AttributeTotal'], description: 'All attributes with base + bonus display', trigger: screenTrigger('char-stats') },
  { id: 'pause', featureName: 'Pause/settings menus', inputMode: 'UI', subWidgets: ['WBP_PauseMenu', 'WBP_SettingsPanel'], description: 'Pause menu with graphics, audio, controls settings', trigger: screenTrigger('pause') },
];

export const FLOATING_NODES: ScreenNode[] = [
  { id: 'enemy-bars', featureName: 'Enemy health bars', inputMode: 'GameAndUI', subWidgets: ['WBP_EnemyHealthBar', 'UWidgetComponent'], description: 'Floating UWidgetComponent with fade-in/out behavior', trigger: screenTrigger('enemy-bars') },
  { id: 'damage-numbers', featureName: 'Floating damage numbers', inputMode: 'Game', subWidgets: ['WBP_DamageText', 'WBP_CritText'], description: 'Damage text at hit location, colored by type, crit variant', trigger: screenTrigger('damage-numbers') },
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

/** HUD -> screen on its trigger; an Input Action screen also closes back to the HUD on the same action. */
export const FLOW_EDGES: GraphEdge[] = [
  ...SCREEN_TRIGGERS.map(t => ({ source: 'HUD', target: t.flowNode, label: triggerLabel(t) })),
  ...SCREEN_TRIGGERS.filter(t => t.action).map(t => ({ source: t.flowNode, target: 'HUD', label: triggerLabel(t), style: 'dashed' as const })),
];

export const FLOW_GROUP_COLORS: Record<string, string> = {
  Core: ACCENT_PINK,
  Overlay: ACCENT_CYAN,
  Floating: ACCENT_VIOLET,
};

/* ── Performance Budget ────────────────────────────────────────────────────── */

export const PERFORMANCE_BUDGETS: BudgetBar[] = performanceBudgets();

/* ── Breakpoints ───────────────────────────────────────────────────────────── */

export const BREAKPOINTS: { label: string; width: number }[] = [
  { label: '720p', width: 1280 },
  { label: '1080p', width: 1920 },
  { label: '1440p', width: 2560 },
  { label: '4K', width: 3840 },
];

export const BREAKPOINT_PILLS: PillItem[] = BREAKPOINTS.map(bp => ({ id: bp.label, label: bp.label }));

export const BREAKPOINT_WIDGETS: BreakpointWidget[] = breakpointWidgets();

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

export const WIDGET_BINDINGS: WidgetBinding[] = widgetBindings();

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

export const ANIM_CATALOG: AnimTransition[] = animCatalog();

/* ── Z-Layers ──────────────────────────────────────────────────────────────── */

export const Z_LAYERS: ZLayer[] = zLayers();

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

/** Every context with its widget names resolved to registry ids. */
export const HUD_CONTEXTS: HudContext[] = canonicalContexts();

/* ── Widget Placements ─────────────────────────────────────────────────────── */

export const WIDGET_PLACEMENTS: WidgetPlacement[] = widgetPlacements();

/** Depth colour per widget id, straight from the registry depth table (no per-widget overrides). */
export const WIDGET_Z_COLOR: Record<string, string> = widgetZColor();

export const Z_DEPTH_LABELS: Record<number, { label: string; color: string }> = zDepthLabels();
