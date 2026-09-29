import {
  MODULE_COLORS, STATUS_ERROR, STATUS_SUBDUED, STATUS_WARNING,
  ACCENT_PINK, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_RED, ACCENT_ROSE,
} from '@/lib/chart-colors';
import type { BudgetBar } from '@/types/unique-tab-improvements';
import type {
  AnimTransition, BreakpointWidget, HudContext, WidgetBinding, WidgetPlacement, ZLayer,
} from '@/components/modules/core-engine/sub_ui/_shared/data';

/**
 * The one owner of HUD widget identity in the UI designer module. Each widget
 * is one record: its canonical id, every other spelling it goes by (aliases),
 * its z-depth, and its optional placement, binding, animation and breakpoint.
 * Every table in `data.ts` (Z_LAYERS, WIDGET_PLACEMENTS, WIDGET_Z_COLOR,
 * HUD_CONTEXTS, BREAKPOINT_WIDGETS, WIDGET_BINDINGS, ANIM_CATALOG, the
 * Bindings budget, the overlay triggers and flow edges) and the ARPG preview
 * layout are projections of this file. `validateHudRegistry` names every
 * broken join instead of letting a table drop it silently.
 */

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface HudRect { x: number; y: number; w: number; h: number }

export interface HudWidget {
  id: string;
  label: string;
  aliases?: string[];
  zDepth: number;
  placement?: HudRect;
  binding?: Omit<WidgetBinding, 'widget'>;
  anim?: Omit<AnimTransition, 'widget'>;
  breakpoint?: Omit<BreakpointWidget, 'widget'>;
}

export interface HudDepth { depth: number; label: string; color: string }

/** A context names widgets by any spelling; projections resolve them to ids. */
export type HudContextSpec = HudContext;

export interface HudRegistry {
  widgets: HudWidget[];
  depths: HudDepth[];
  contexts: HudContextSpec[];
}

export type HudIssue =
  | { kind: 'duplicate-name'; widget: string }
  | { kind: 'unknown-widget'; context: string; widget: string }
  | { kind: 'unplaced-widget'; context: string; widget: string }
  | { kind: 'unlabelled-depth'; widget: string; zDepth: number }
  | { kind: 'unreachable-placement'; widget: string };

/** A screen's open trigger: a named Input Action (keys) or a gameplay event. */
export interface ScreenTriggerSpec {
  screen: string;
  flowNode: string;
  action?: { id: string; keys: string[] };
  event?: string;
}

/* ── Data ──────────────────────────────────────────────────────────────────── */

const fade = (duration: string, easing: string) => ({ openAnim: 'FadeIn', closeAnim: 'FadeOut', duration, easing });
const delegate = (attribute: string) => ({ attribute, updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false });

const HUD_WIDGETS: HudWidget[] = [
  { id: 'Viewport', label: 'Viewport', zDepth: 0 },
  { id: 'WorldActors', label: 'World Actors', zDepth: 0 },
  { id: 'HealthBar', label: 'Health', aliases: ['WBP_HealthBar'], zDepth: 1, placement: { x: 2, y: 3, w: 18, h: 5 }, binding: delegate('HP'),
    anim: { openAnim: 'SlideDown', closeAnim: 'FadeOut', duration: '0.4s', easing: 'Spring' }, breakpoint: { minRes: '720p', scaleMode: 'DPI Scale', status: 'ok' } },
  { id: 'ManaBar', label: 'Mana', aliases: ['WBP_ManaBar'], zDepth: 1, placement: { x: 2, y: 10, w: 14, h: 4 }, binding: delegate('Mana') },
  { id: 'StaminaBar', label: 'Stamina', zDepth: 1, placement: { x: 2, y: 16, w: 12, h: 3 },
    binding: { attribute: 'Stamina', updateMethod: 'Poll', frequency: '0.5s', isStale: true } },
  { id: 'AbilitySlots', label: 'Abilities', aliases: ['AbilitySlot', 'WBP_AbilitySlot'], zDepth: 1, placement: { x: 30, y: 88, w: 40, h: 9 },
    binding: { attribute: 'Cooldown', updateMethod: 'Timer', frequency: '0.1s', isStale: false }, breakpoint: { minRes: '720p', scaleMode: 'Anchor Stretch', status: 'ok' } },
  { id: 'MiniMap', label: 'MiniMap', aliases: ['minimap'], zDepth: 1, placement: { x: 82, y: 3, w: 16, h: 20 },
    breakpoint: { minRes: '720p', scaleMode: 'Scale Box', status: 'ok' } },
  { id: 'ExperienceBar', label: 'XP Bar', aliases: ['xp-bar'], zDepth: 1, placement: { x: 2, y: 76, w: 96, h: 3 }, binding: delegate('XP') },
  { id: 'BuffIcon', label: 'Buffs / Debuffs', aliases: ['buffs'], zDepth: 1, placement: { x: 12, y: 4, w: 18, h: 6 },
    binding: { attribute: 'ActiveEffects', updateMethod: 'Event', frequency: 'OnApply/Remove', isStale: false } },
  { id: 'player-portrait', label: 'Portrait Frame', aliases: ['portrait'], zDepth: 1, placement: { x: 2, y: 4, w: 8, h: 12 } },
  { id: 'target-frame', label: 'Target Frame', aliases: ['WBP_TargetFrame'], zDepth: 1, placement: { x: 35, y: 30, w: 20, h: 8 } },
  { id: 'QuestNotify', label: 'Quest Notify', zDepth: 1, anim: { openAnim: 'SlideRight', closeAnim: 'SlideRight', duration: '0.5s', easing: 'Spring' } },
  { id: 'EnemyBars', label: 'Enemy HP', aliases: ['EnemyHealthBar', 'WBP_EnemyHealthBar'], zDepth: 2, placement: { x: 35, y: 20, w: 14, h: 4 },
    binding: delegate('EnemyHP'), anim: fade('0.3s', 'EaseInOut') },
  { id: 'DamageNumbers', label: 'Dmg Numbers', aliases: ['DamageNumber', 'DamageText', 'WBP_DamageText'], zDepth: 2, placement: { x: 45, y: 30, w: 12, h: 5 },
    binding: { attribute: 'DamageValue', updateMethod: 'Event', frequency: 'OnHit', isStale: false },
    anim: { openAnim: 'PopIn', closeAnim: 'FloatUp', duration: '0.8s', easing: 'EaseOut' }, breakpoint: { minRes: '720p', scaleMode: 'World Space', status: 'ok' } },
  { id: 'loot-feed', label: 'Loot Feed', zDepth: 2, placement: { x: 2, y: 20, w: 15, h: 30 } },
  { id: 'TargetLock', label: 'Target Lock', aliases: ['WBP_TargetLock'], zDepth: 2, placement: { x: 40, y: 36, w: 8, h: 14 } },
  { id: 'QuestTracker', label: 'Quests', aliases: ['quest-tracker'], zDepth: 3, placement: { x: 80, y: 26, w: 18, h: 18 },
    breakpoint: { minRes: '1080p', scaleMode: 'Anchor Stretch', status: 'warn' } },
  { id: 'ChatBox', label: 'Chat', zDepth: 3, placement: { x: 2, y: 70, w: 22, h: 16 }, breakpoint: { minRes: '1440p', scaleMode: 'Fixed Size', status: 'error' } },
  { id: 'DialogueBox', label: 'Dialogue', zDepth: 3, placement: { x: 10, y: 65, w: 80, h: 22 } },
  { id: 'PortraitFrame', label: 'Portrait', zDepth: 3, placement: { x: 3, y: 55, w: 12, h: 20 } },
  { id: 'ChoiceList', label: 'Choices', zDepth: 3, placement: { x: 60, y: 45, w: 30, h: 18 } },
  { id: 'combo-counter', label: 'Combo Counter', aliases: ['WBP_ComboCounter'], zDepth: 3, placement: { x: 75, y: 40, w: 10, h: 6 } },
  { id: 'ForceMenu', label: 'Force Menu', aliases: ['WBP_ForceMenu'], zDepth: 3, placement: { x: 32, y: 52, w: 36, h: 30 } },
  { id: 'Inventory', label: 'Inventory', zDepth: 3, anim: fade('0.3s', 'EaseOut'), breakpoint: { minRes: '1080p', scaleMode: 'Fixed Size', status: 'warn' } },
  { id: 'CharStats', label: 'Character Stats', zDepth: 3, anim: { openAnim: 'SlideRight', closeAnim: 'SlideLeft', duration: '0.25s', easing: 'EaseInOut' } },
  { id: 'Tooltip', label: 'Tooltip', zDepth: 3, anim: fade('0.15s', 'Linear'), breakpoint: { minRes: '720p', scaleMode: 'DPI Scale', status: 'ok' } },
  { id: 'PauseMenu', label: 'Pause Menu', zDepth: 4, anim: { openAnim: 'ScaleUp', closeAnim: 'ScaleDown', duration: '0.2s', easing: 'EaseOut' } },
  { id: 'SettingsPanel', label: 'Settings', zDepth: 4 },
  { id: 'ConfirmDialog', label: 'Confirm Dialog', zDepth: 4 },
  { id: 'DeathOverlay', label: 'Death Screen', zDepth: 4, placement: { x: 15, y: 20, w: 70, h: 40 } },
  { id: 'RespawnButton', label: 'Respawn', zDepth: 4, placement: { x: 35, y: 65, w: 30, h: 10 } },
  { id: 'DeathStats', label: 'Death Stats', zDepth: 4, placement: { x: 30, y: 78, w: 40, h: 12 } },
  { id: 'stamina-arc', label: 'Stamina Arc', aliases: ['WBP_StaminaArc'], zDepth: 4, placement: { x: 8, y: 75, w: 8, h: 5 } },
  { id: 'health-globe', label: 'Health Globe', zDepth: 5, placement: { x: 3, y: 72, w: 14, h: 24 } },
  { id: 'force-globe', label: 'Force Globe', aliases: ['WBP_ForceMeter'], zDepth: 5, placement: { x: 83, y: 72, w: 14, h: 24 } },
  { id: 'skill-bar', label: 'Skill Bar (1-6, Q, R)', zDepth: 6, placement: { x: 22, y: 84, w: 56, h: 10 } },
];

const HUD_DEPTHS: HudDepth[] = [
  { depth: 0, label: 'GameWorld', color: STATUS_SUBDUED },
  { depth: 1, label: 'HUD', color: ACCENT_PINK },
  { depth: 2, label: 'Floating', color: ACCENT_VIOLET },
  { depth: 3, label: 'Overlay', color: ACCENT_CYAN },
  { depth: 4, label: 'Modal', color: ACCENT_ORANGE },
  { depth: 5, label: 'Resource Globes', color: ACCENT_ROSE },
  { depth: 6, label: 'Action Bar', color: STATUS_WARNING },
];

/** The context the ARPG preview panel draws (its layout is this context's placements). */
export const ARPG_LAYOUT_CONTEXT = 'ARPG Layout';

const HUD_CONTEXT_SPECS: HudContextSpec[] = [
  { name: 'Combat', color: STATUS_ERROR, visible: ['HealthBar', 'ManaBar', 'AbilitySlots', 'EnemyBars', 'DamageNumbers', 'StaminaBar'], hidden: ['MiniMap', 'QuestTracker', 'ChatBox'] },
  { name: 'Exploration', color: ACCENT_EMERALD, visible: ['HealthBar', 'MiniMap', 'QuestTracker', 'ManaBar', 'loot-feed'], hidden: ['AbilitySlots', 'EnemyBars', 'DamageNumbers', 'StaminaBar', 'ChatBox'] },
  { name: 'Dialogue', color: ACCENT_CYAN, visible: ['DialogueBox', 'PortraitFrame', 'ChoiceList'], hidden: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap', 'EnemyBars', 'DamageNumbers'] },
  { name: 'Death', color: STATUS_SUBDUED, visible: ['DeathOverlay', 'RespawnButton', 'DeathStats', 'ChatBox'], hidden: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap', 'EnemyBars', 'QuestTracker'] },
  { name: 'Force Focus', color: MODULE_COLORS.core, visible: ['WBP_ForceMenu', 'WBP_ForceMeter', 'WBP_TargetLock'], hidden: ['MiniMap', 'QuestTracker', 'ChatBox', 'AbilitySlots'] },
  { name: 'Lightsaber Combat', color: ACCENT_RED, visible: ['WBP_ComboCounter', 'WBP_StaminaArc', 'WBP_TargetFrame'], hidden: ['MiniMap', 'QuestTracker', 'ChatBox', 'DialogueBox'] },
  { name: ARPG_LAYOUT_CONTEXT, color: STATUS_WARNING,
    visible: ['portrait', 'buffs', 'minimap', 'loot-feed', 'quest-tracker', 'target-frame', 'combo-counter', 'xp-bar', 'skill-bar', 'health-globe', 'force-globe'],
    hidden: ['HealthBar', 'ManaBar', 'StaminaBar', 'AbilitySlots'] },
];

export const HUD_REGISTRY: HudRegistry = { widgets: HUD_WIDGETS, depths: HUD_DEPTHS, contexts: HUD_CONTEXT_SPECS };

export const SCREEN_TRIGGERS: ScreenTriggerSpec[] = [
  { screen: 'inventory', flowNode: 'Inventory', action: { id: 'IA_OpenInventory', keys: ['Tab', 'I'] } },
  { screen: 'char-stats', flowNode: 'CharStats', action: { id: 'IA_OpenCharStats', keys: ['C'] } },
  { screen: 'pause', flowNode: 'Pause', action: { id: 'IA_Pause', keys: ['Esc'] } },
  { screen: 'enemy-bars', flowNode: 'EnemyBars', event: 'On damage' },
  { screen: 'damage-numbers', flowNode: 'DamageNumbers', event: 'On hit' },
];

/* ── Identity ──────────────────────────────────────────────────────────────── */

function nameIndex(reg: HudRegistry): Map<string, HudWidget> {
  const m = new Map<string, HudWidget>();
  for (const w of reg.widgets) {
    for (const name of [w.id, ...(w.aliases ?? [])]) if (!m.has(name)) m.set(name, w);
  }
  return m;
}

const SHIPPED_INDEX = nameIndex(HUD_REGISTRY);
const indexFor = (reg: HudRegistry) => (reg === HUD_REGISTRY ? SHIPPED_INDEX : nameIndex(reg));

/** Canonical id for any spelling of a widget, or undefined when no widget answers to it. */
export function resolveWidgetId(name: string, reg: HudRegistry = HUD_REGISTRY): string | undefined {
  return indexFor(reg).get(name)?.id;
}

/* ── Projections ───────────────────────────────────────────────────────────── */

function toPlacement(w: HudWidget): WidgetPlacement | null {
  return w.placement ? { id: w.id, label: w.label, ...w.placement, zDepth: w.zDepth } : null;
}

function resolvedWidgets(names: string[], reg: HudRegistry): HudWidget[] {
  const idx = indexFor(reg);
  const out: HudWidget[] = [];
  for (const n of names) {
    const w = idx.get(n);
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

const placementsOf = (ws: HudWidget[]) => ws.map(toPlacement).filter((p): p is WidgetPlacement => p !== null);

export function widgetPlacements(reg: HudRegistry = HUD_REGISTRY): WidgetPlacement[] {
  return placementsOf(reg.widgets);
}

/** The rects a context actually draws: its visible names, resolved, that carry a placement. */
export function placementsForContext(name: string, reg: HudRegistry = HUD_REGISTRY): WidgetPlacement[] {
  const ctx = reg.contexts.find(c => c.name === name);
  return ctx ? placementsOf(resolvedWidgets(ctx.visible, reg)) : [];
}

/** Every rect any context draws (visible or hidden), in registry order. */
export function contextPlacements(reg: HudRegistry = HUD_REGISTRY): WidgetPlacement[] {
  const named = new Set(reg.contexts.flatMap(c => resolvedWidgets([...c.visible, ...c.hidden], reg)));
  return placementsOf(reg.widgets.filter(w => named.has(w)));
}

/** Contexts with every name resolved to its canonical id (an unknown name is kept verbatim). */
export function canonicalContexts(reg: HudRegistry = HUD_REGISTRY): HudContext[] {
  const idx = indexFor(reg);
  const canon = (names: string[]) => [...new Set(names.map(n => idx.get(n)?.id ?? n))];
  return reg.contexts.map(c => ({ ...c, visible: canon(c.visible), hidden: canon(c.hidden) }));
}

const intersects = (a: HudRect, b: HudRect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** True when some context shows two widgets at this depth whose rects intersect. */
function depthHasOverlap(depth: number, reg: HudRegistry): boolean {
  return reg.contexts.some(c => {
    const ps = placementsForContext(c.name, reg).filter(p => p.zDepth === depth);
    return ps.some((a, i) => ps.slice(i + 1).some(b => intersects(a, b)));
  });
}

export function zLayers(reg: HudRegistry = HUD_REGISTRY): ZLayer[] {
  return reg.depths
    .map(d => ({ d, widgets: reg.widgets.filter(w => w.zDepth === d.depth).map(w => w.id) }))
    .filter(({ widgets }) => widgets.length > 0)
    .map(({ d, widgets }) => ({
      depth: d.depth, label: d.label, widgets, color: d.color,
      ...(depthHasOverlap(d.depth, reg) ? { hasOverlap: true } : {}),
    }));
}

export function zDepthLabels(reg: HudRegistry = HUD_REGISTRY): Record<number, { label: string; color: string }> {
  return Object.fromEntries(reg.depths.map(d => [d.depth, { label: d.label, color: d.color }]));
}

export function widgetZColor(reg: HudRegistry = HUD_REGISTRY): Record<string, string> {
  const labels = zDepthLabels(reg);
  return Object.fromEntries(reg.widgets.filter(w => labels[w.zDepth]).map(w => [w.id, labels[w.zDepth].color]));
}

export function breakpointWidgets(reg: HudRegistry = HUD_REGISTRY): BreakpointWidget[] {
  return reg.widgets.flatMap(w => (w.breakpoint ? [{ widget: w.id, ...w.breakpoint }] : []));
}

export function widgetBindings(reg: HudRegistry = HUD_REGISTRY): WidgetBinding[] {
  return reg.widgets.flatMap(w => (w.binding ? [{ widget: w.id, ...w.binding }] : []));
}

export function animCatalog(reg: HudRegistry = HUD_REGISTRY): AnimTransition[] {
  return reg.widgets.flatMap(w => (w.anim ? [{ widget: w.id, ...w.anim }] : []));
}

const STATIC_BUDGETS: BudgetBar[] = [
  { label: 'VertexCount', current: 800, max: 2000, unit: '', color: ACCENT_CYAN, threshold: { warn: 1400, danger: 1800 } },
  { label: 'DrawCalls', current: 12, max: 50, unit: '', color: ACCENT_EMERALD, threshold: { warn: 35, danger: 45 } },
  { label: 'TextureMemory', current: 24, max: 128, unit: 'MB', color: ACCENT_ORANGE, threshold: { warn: 90, danger: 115 } },
];

/** Widget budgets; Bindings.current is the number of registry widgets that carry a binding. */
export function performanceBudgets(reg: HudRegistry = HUD_REGISTRY): BudgetBar[] {
  const bindings = reg.widgets.filter(w => w.binding).length;
  return [...STATIC_BUDGETS, { label: 'Bindings', current: bindings, max: 20, unit: '', color: ACCENT_VIOLET, threshold: { warn: 14, danger: 18 } }];
}

/** The ARPG preview's rects: the ARPG Layout context's placements in draw (z) order. */
export function arpgPreviewLayout(reg: HudRegistry = HUD_REGISTRY): WidgetPlacement[] {
  return [...placementsForContext(ARPG_LAYOUT_CONTEXT, reg)].sort((a, b) => a.zDepth - b.zDepth);
}

/* ── Screen triggers ───────────────────────────────────────────────────────── */

/** 'IA_OpenInventory (Tab / I)' for an Input Action, the event text otherwise. */
export function triggerLabel(t: ScreenTriggerSpec): string {
  return t.action ? `${t.action.id} (${t.action.keys.join(' / ')})` : (t.event ?? '');
}

export function screenTrigger(screen: string): string | undefined {
  const t = SCREEN_TRIGGERS.find(s => s.screen === screen);
  return t ? triggerLabel(t) : undefined;
}

/* ── Lint ──────────────────────────────────────────────────────────────────── */

export function validateHudRegistry(reg: HudRegistry): HudIssue[] {
  const issues: HudIssue[] = [];
  const owner = new Map<string, string>();
  for (const w of reg.widgets) {
    for (const name of [w.id, ...(w.aliases ?? [])]) {
      if (owner.has(name) && owner.get(name) !== w.id) issues.push({ kind: 'duplicate-name', widget: name });
      else owner.set(name, w.id);
    }
  }
  const idx = nameIndex(reg);
  const shown = new Set<string>();
  for (const c of reg.contexts) {
    for (const name of [...c.visible, ...c.hidden]) {
      const w = idx.get(name);
      if (!w) { issues.push({ kind: 'unknown-widget', context: c.name, widget: name }); continue; }
      if (!c.visible.includes(name)) continue;
      if (w.placement) shown.add(w.id);
      else issues.push({ kind: 'unplaced-widget', context: c.name, widget: name });
    }
  }
  const labelled = new Set(reg.depths.map(d => d.depth));
  for (const w of reg.widgets) {
    if (!labelled.has(w.zDepth)) issues.push({ kind: 'unlabelled-depth', widget: w.id, zDepth: w.zDepth });
    if (w.placement && !shown.has(w.id)) issues.push({ kind: 'unreachable-placement', widget: w.id });
  }
  return issues;
}
