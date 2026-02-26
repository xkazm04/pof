'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Monitor, ChevronDown, ChevronRight, ExternalLink, Network,
  Gauge, Smartphone, GitBranch, Link2, Award, PlayCircle,
  Layers, Eye, Globe, Component, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_PINK, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
  OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, SectionLabel, LoadingSpinner, SubTab, SubTabNavigation } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { GraphNode, GraphEdge, BudgetBar } from '@/types/unique-tab-improvements';

const ACCENT = ACCENT_PINK;

/* ── Screen node definitions ───────────────────────────────────────────────── */

type InputMode = 'Game' | 'UI' | 'GameAndUI';

const INPUT_MODE_COLORS: Record<InputMode, string> = {
  Game: MODULE_COLORS.core,
  UI: ACCENT_PINK,
  GameAndUI: MODULE_COLORS.systems,
};

interface ScreenNode {
  id: string;
  featureName: string;
  inputMode: InputMode;
  subWidgets: string[];
  description: string;
  trigger?: string;
}

const HUD_CHILDREN: ScreenNode[] = [
  {
    id: 'hud-health',
    featureName: 'GAS attribute binding',
    inputMode: 'Game',
    subWidgets: ['WBP_HealthBar', 'WBP_ManaBar'],
    description: 'Real-time attribute delegates update bar fill percentage',
    trigger: 'Always visible',
  },
  {
    id: 'hud-abilities',
    featureName: 'Ability cooldown UI',
    inputMode: 'Game',
    subWidgets: ['WBP_AbilitySlot x4', 'WBP_CooldownSweep'],
    description: 'Ability slots with icon, cooldown sweep, keybind label',
    trigger: 'Always visible',
  },
];

const HUD_OVERLAYS: ScreenNode[] = [
  {
    id: 'inventory',
    featureName: 'Inventory screen',
    inputMode: 'UI',
    subWidgets: ['WBP_ItemGrid', 'WBP_Tooltip', 'WBP_EquipPanel'],
    description: 'Grid inventory with drag-and-drop and equipment panel',
    trigger: 'Tab',
  },
  {
    id: 'char-stats',
    featureName: 'Character stats screen',
    inputMode: 'UI',
    subWidgets: ['WBP_StatRow', 'WBP_AttributeTotal'],
    description: 'All attributes with base + bonus display',
    trigger: 'C',
  },
  {
    id: 'pause',
    featureName: 'Pause/settings menus',
    inputMode: 'UI',
    subWidgets: ['WBP_PauseMenu', 'WBP_SettingsPanel'],
    description: 'Pause menu with graphics, audio, controls settings',
    trigger: 'Esc',
  },
];

const FLOATING_NODES: ScreenNode[] = [
  {
    id: 'enemy-bars',
    featureName: 'Enemy health bars',
    inputMode: 'GameAndUI',
    subWidgets: ['WBP_EnemyHealthBar', 'UWidgetComponent'],
    description: 'Floating UWidgetComponent with fade-in/out behavior',
    trigger: 'On damage',
  },
  {
    id: 'damage-numbers',
    featureName: 'Floating damage numbers',
    inputMode: 'Game',
    subWidgets: ['WBP_DamageText', 'WBP_CritText'],
    description: 'Damage text at hit location, colored by type, crit variant',
    trigger: 'On hit',
  },
];

/* ── 9.1 Interactive Screen Flow Graph ─────────────────────────────────────── */

const FLOW_NODES: GraphNode[] = [
  { id: 'HUD', label: 'HUD', group: 'Core', color: ACCENT_PINK },
  { id: 'Inventory', label: 'Inventory', group: 'Overlay', color: ACCENT_CYAN },
  { id: 'CharStats', label: 'CharStats', group: 'Overlay', color: ACCENT_EMERALD },
  { id: 'Pause', label: 'Pause', group: 'Overlay', color: ACCENT_ORANGE },
  { id: 'EnemyBars', label: 'EnemyBars', group: 'Floating', color: ACCENT_VIOLET },
  { id: 'DamageNumbers', label: 'DamageNumbers', group: 'Floating', color: STATUS_ERROR },
];

const FLOW_EDGES: GraphEdge[] = [
  { source: 'HUD', target: 'Inventory', label: 'Press I' },
  { source: 'HUD', target: 'CharStats', label: 'Press C' },
  { source: 'HUD', target: 'Pause', label: 'Press Esc' },
  { source: 'HUD', target: 'EnemyBars', label: 'On Damage' },
  { source: 'HUD', target: 'DamageNumbers', label: 'On Hit' },
  { source: 'Inventory', target: 'HUD', label: 'Press I', style: 'dashed' },
  { source: 'CharStats', target: 'HUD', label: 'Press C', style: 'dashed' },
  { source: 'Pause', target: 'HUD', label: 'Press Esc', style: 'dashed' },
];

const FLOW_GROUP_COLORS: Record<string, string> = {
  Core: ACCENT_PINK,
  Overlay: ACCENT_CYAN,
  Floating: ACCENT_VIOLET,
};

/* ── 9.2 Widget Performance Budget ─────────────────────────────────────────── */

const PERFORMANCE_BUDGETS: BudgetBar[] = [
  { label: 'VertexCount', current: 800, max: 2000, unit: '', color: ACCENT_CYAN, threshold: { warn: 1400, danger: 1800 } },
  { label: 'DrawCalls', current: 12, max: 50, unit: '', color: ACCENT_EMERALD, threshold: { warn: 35, danger: 45 } },
  { label: 'TextureMemory', current: 24, max: 128, unit: 'MB', color: ACCENT_ORANGE, threshold: { warn: 90, danger: 115 } },
  { label: 'Bindings', current: 8, max: 20, unit: '', color: ACCENT_VIOLET, threshold: { warn: 14, danger: 18 } },
];

/* ── 9.3 Responsive Layout Breakpoints ─────────────────────────────────────── */

interface BreakpointWidget {
  widget: string;
  minRes: string;
  scaleMode: string;
  status: 'ok' | 'warn' | 'error';
}

const BREAKPOINTS: { label: string; width: number }[] = [
  { label: '720p', width: 1280 },
  { label: '1080p', width: 1920 },
  { label: '1440p', width: 2560 },
  { label: '4K', width: 3840 },
];

const BREAKPOINT_WIDGETS: BreakpointWidget[] = [
  { widget: 'HealthBar', minRes: '720p', scaleMode: 'DPI Scale', status: 'ok' },
  { widget: 'AbilitySlots', minRes: '720p', scaleMode: 'Anchor Stretch', status: 'ok' },
  { widget: 'Inventory', minRes: '1080p', scaleMode: 'Fixed Size', status: 'warn' },
  { widget: 'MiniMap', minRes: '720p', scaleMode: 'Scale Box', status: 'ok' },
  { widget: 'Tooltip', minRes: '720p', scaleMode: 'DPI Scale', status: 'ok' },
  { widget: 'DamageNumbers', minRes: '720p', scaleMode: 'World Space', status: 'ok' },
  { widget: 'QuestTracker', minRes: '1080p', scaleMode: 'Anchor Stretch', status: 'warn' },
  { widget: 'ChatBox', minRes: '1440p', scaleMode: 'Fixed Size', status: 'error' },
];

/* ── 9.4 Input Mode State Machine ──────────────────────────────────────────── */

interface StateMachineNode {
  id: InputMode;
  label: string;
}

interface StateMachineEdge {
  from: InputMode;
  to: InputMode;
  trigger: string;
}

const SM_NODES: StateMachineNode[] = [
  { id: 'Game', label: 'Game' },
  { id: 'UI', label: 'UI' },
  { id: 'GameAndUI', label: 'GameAndUI' },
];

const SM_EDGES: StateMachineEdge[] = [
  { from: 'Game', to: 'UI', trigger: 'Open Menu' },
  { from: 'UI', to: 'Game', trigger: 'Close Menu' },
  { from: 'Game', to: 'GameAndUI', trigger: 'Show Cursor' },
  { from: 'GameAndUI', to: 'Game', trigger: 'Hide Cursor' },
  { from: 'GameAndUI', to: 'UI', trigger: 'Pause' },
  { from: 'UI', to: 'GameAndUI', trigger: 'Unpause' },
];

/* ── 9.5 Widget Binding Inspector ──────────────────────────────────────────── */

interface WidgetBinding {
  widget: string;
  attribute: string;
  updateMethod: string;
  frequency: string;
  isStale: boolean;
}

const WIDGET_BINDINGS: WidgetBinding[] = [
  { widget: 'HealthBar', attribute: 'HP', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'ManaBar', attribute: 'Mana', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'AbilitySlot', attribute: 'Cooldown', updateMethod: 'Timer', frequency: '0.1s', isStale: false },
  { widget: 'ExperienceBar', attribute: 'XP', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'EnemyHealthBar', attribute: 'EnemyHP', updateMethod: 'Delegate', frequency: 'EveryChange', isStale: false },
  { widget: 'StaminaBar', attribute: 'Stamina', updateMethod: 'Poll', frequency: '0.5s', isStale: true },
  { widget: 'BuffIcon', attribute: 'ActiveEffects', updateMethod: 'Event', frequency: 'OnApply/Remove', isStale: false },
  { widget: 'DamageText', attribute: 'DamageValue', updateMethod: 'Event', frequency: 'OnHit', isStale: false },
];

/* ── 9.6 Accessibility Score Card ──────────────────────────────────────────── */

interface AccessibilityCategory {
  name: string;
  grade: string;
  score: number;
  issues: number;
  color: string;
}

const A11Y_OVERALL_GRADE = 'B+';
const A11Y_OVERALL_SCORE = 82;

const A11Y_CATEGORIES: AccessibilityCategory[] = [
  { name: 'Text Readability', grade: 'A', score: 92, issues: 1, color: STATUS_SUCCESS },
  { name: 'Color Contrast', grade: 'B', score: 78, issues: 4, color: ACCENT_CYAN },
  { name: 'Input Accessibility', grade: 'C', score: 65, issues: 7, color: STATUS_WARNING },
  { name: 'Motion Sensitivity', grade: 'A', score: 95, issues: 0, color: ACCENT_EMERALD },
];

/* ── 9.7 Animation/Transition Catalog ──────────────────────────────────────── */

interface AnimTransition {
  widget: string;
  openAnim: string;
  closeAnim: string;
  duration: string;
  easing: string;
}

const ANIM_CATALOG: AnimTransition[] = [
  { widget: 'Inventory', openAnim: 'FadeIn', closeAnim: 'FadeOut', duration: '0.3s', easing: 'EaseOut' },
  { widget: 'CharStats', openAnim: 'SlideRight', closeAnim: 'SlideLeft', duration: '0.25s', easing: 'EaseInOut' },
  { widget: 'PauseMenu', openAnim: 'ScaleUp', closeAnim: 'ScaleDown', duration: '0.2s', easing: 'EaseOut' },
  { widget: 'Tooltip', openAnim: 'FadeIn', closeAnim: 'FadeOut', duration: '0.15s', easing: 'Linear' },
  { widget: 'HealthBar', openAnim: 'SlideDown', closeAnim: 'FadeOut', duration: '0.4s', easing: 'Spring' },
  { widget: 'DamageNumber', openAnim: 'PopIn', closeAnim: 'FloatUp', duration: '0.8s', easing: 'EaseOut' },
  { widget: 'EnemyHealthBar', openAnim: 'FadeIn', closeAnim: 'FadeOut', duration: '0.3s', easing: 'EaseInOut' },
  { widget: 'QuestNotify', openAnim: 'SlideRight', closeAnim: 'SlideRight', duration: '0.5s', easing: 'Spring' },
];

/* ── 9.8 Screen Depth / Z-Order Visualizer ─────────────────────────────────── */

interface ZLayer {
  depth: number;
  label: string;
  widgets: string[];
  color: string;
  hasOverlap?: boolean;
}

const Z_LAYERS: ZLayer[] = [
  { depth: 0, label: 'GameWorld', widgets: ['Viewport', 'WorldActors'], color: '#64748b' },
  { depth: 1, label: 'HUD', widgets: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap'], color: ACCENT_PINK },
  { depth: 2, label: 'FloatingBars', widgets: ['EnemyHealthBar', 'DamageNumbers'], color: ACCENT_VIOLET, hasOverlap: true },
  { depth: 3, label: 'Overlays', widgets: ['Inventory', 'CharStats', 'QuestTracker'], color: ACCENT_CYAN },
  { depth: 4, label: 'Modals', widgets: ['PauseMenu', 'SettingsPanel', 'ConfirmDialog'], color: ACCENT_ORANGE },
];

/* ── 9.9 HUD Context Modes ─────────────────────────────────────────────────── */

interface HudContext {
  name: string;
  color: string;
  visible: string[];
  hidden: string[];
}

const HUD_CONTEXTS: HudContext[] = [
  {
    name: 'Combat',
    color: STATUS_ERROR,
    visible: ['HealthBar', 'ManaBar', 'AbilitySlots', 'EnemyBars', 'DamageNumbers', 'StaminaBar'],
    hidden: ['MiniMap', 'QuestTracker', 'ChatBox'],
  },
  {
    name: 'Exploration',
    color: ACCENT_EMERALD,
    visible: ['HealthBar', 'MiniMap', 'QuestTracker', 'ManaBar'],
    hidden: ['AbilitySlots', 'EnemyBars', 'DamageNumbers', 'StaminaBar', 'ChatBox'],
  },
  {
    name: 'Dialogue',
    color: ACCENT_CYAN,
    visible: ['DialogueBox', 'PortraitFrame', 'ChoiceList'],
    hidden: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap', 'EnemyBars', 'DamageNumbers'],
  },
  {
    name: 'Death',
    color: '#64748b',
    visible: ['DeathOverlay', 'RespawnButton', 'DeathStats'],
    hidden: ['HealthBar', 'ManaBar', 'AbilitySlots', 'MiniMap', 'EnemyBars', 'QuestTracker'],
  },
];

/* ── 9.10 Localization Layout Preview ──────────────────────────────────────── */

interface LangExpansion {
  code: string;
  label: string;
  expansion: number; // percentage relative to EN
  overflowWidgets: string[];
}

const LANGUAGES: LangExpansion[] = [
  { code: 'EN', label: 'English', expansion: 100, overflowWidgets: [] },
  { code: 'DE', label: 'German', expansion: 135, overflowWidgets: ['AbilityTooltip', 'QuestDescription'] },
  { code: 'FR', label: 'French', expansion: 125, overflowWidgets: ['AbilityTooltip'] },
  { code: 'JA', label: 'Japanese', expansion: 90, overflowWidgets: [] },
  { code: 'ZH', label: 'Chinese', expansion: 85, overflowWidgets: [] },
];

/* ── Component ─────────────────────────────────────────────────────────────── */

interface ScreenFlowMapProps {
  moduleId: SubModuleId;
}

export function ScreenFlowMap({ moduleId }: ScreenFlowMapProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('flow');

  /* 9.1 */
  const [highlightedFlowNode, setHighlightedFlowNode] = useState<string | null>(null);
  /* 9.3 */
  const [selectedBreakpoint, setSelectedBreakpoint] = useState(1);
  /* 9.4 */
  const [currentInputMode, setCurrentInputMode] = useState<InputMode>('Game');
  /* 9.9 */
  const [activeContext, setActiveContext] = useState(0);
  /* 9.10 */
  const [selectedLang, setSelectedLang] = useState(0);

  const tabs: SubTab[] = useMemo(() => [
    { id: 'flow', label: 'Flow & Nodes', icon: Network },
    { id: 'systems', label: 'Systems & Constraints', icon: Layers },
    { id: 'ui', label: 'UI Bindings', icon: Component },
    { id: 'a11y', label: 'Accessibility', icon: Globe },
  ], []);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0;
    for (const d of defs) {
      const s = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (s === 'implemented' || s === 'improved') implemented++;
      else if (s === 'partial') partial++;
    }
    return { total, implemented, partial };
  }, [defs, featureMap]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  const sortedBudgets = useMemo(() =>
    [...PERFORMANCE_BUDGETS].sort((a, b) => (b.current / b.max) - (a.current / a.max)),
    []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const hudStatus: FeatureStatus = featureMap.get('Main HUD widget')?.status ?? 'unknown';
  const hudSc = STATUS_COLORS[hudStatus];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Monitor} title="Screen Flow Map" implemented={stats.implemented} total={stats.total} accent={ACCENT}>
          {stats.partial > 0 && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md border border-amber-500/20 shadow-sm">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_WARNING, boxShadow: `0 0 6px ${STATUS_WARNING}80` }} />
              {stats.partial} partial
            </motion.span>
          )}
        </TabHeader>
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'flow' && (
            <motion.div key="flow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <div className="space-y-2.5">
                  <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent pointer-events-none" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-pink-500/10 transition-colors duration-1000" />
                    <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2 relative z-10"><Monitor className="w-4 h-4 text-pink-400" /> HUD Architecture Hub</div>
                    <button onClick={() => toggleNode('hud-root')} className="w-full text-left relative z-10 focus:outline-none">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm transition-colors hover:bg-surface-hover/30" style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}15` }}>
                        <motion.div animate={{ rotate: expandedNode === 'hud-root' ? 90 : 0 }}><ChevronRight className="w-4 h-4 text-pink-300" /></motion.div>
                        <span className="text-sm font-bold text-text">Main HUD Layout</span>
                        <InputModeBadge mode="GameAndUI" />
                        <span className="ml-auto flex items-center gap-1.5 bg-surface-deep px-2 py-0.5 rounded shadow-inner border border-border/40">
                          <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: hudSc.dot, color: hudSc.dot }} />
                          <span className="text-2xs font-bold uppercase" style={{ color: hudSc.dot }}>{hudSc.label}</span>
                        </span>
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedNode === 'hud-root' && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mt-3 mx-4 p-3 bg-surface-deep/80 rounded-lg border border-border/30 shadow-inner">
                            {(() => {
                              const row = featureMap.get('Main HUD widget');
                              const def = defs.find((d) => d.featureName === 'Main HUD widget');
                              return (
                                <>
                                  <p className="text-xs text-text-muted leading-relaxed">{def?.description ?? row?.description ?? 'No description'}</p>
                                  {row?.nextSteps && <p className="text-xs font-medium mt-2 p-2 bg-amber-500/10 border-l-2 border-amber-500 rounded text-amber-400 shadow-sm">Next: {row.nextSteps}</p>}
                                </>
                              );
                            })()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="mt-2.5 pl-4 space-y-2 relative z-10">
                      <div className="absolute left-6 top-0 bottom-6 w-px bg-[var(--border)] opacity-30" />
                      {HUD_CHILDREN.map((node, i) => (
                        <motion.div key={node.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                          <ScreenNodeRow node={node} featureMap={featureMap} defs={defs} expandedNode={expandedNode} onToggle={toggleNode} arrowLabel={node.trigger} />
                        </motion.div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard level={2} className="p-4 relative">
                    <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2"><Monitor className="w-4 h-4 text-pink-400" /> Input Mode Legend</div>
                    <div className="flex flex-col gap-2">
                      {(Object.entries(INPUT_MODE_COLORS) as [InputMode, string][]).map(([mode, color]) => (
                        <div key={mode} className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-border/50">
                          <span className="px-2 py-0.5 rounded text-xs font-bold w-24 text-center shadow-sm" style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>{mode}</span>
                          <span className="text-text-muted text-xs">{mode === 'Game' ? 'Cursor hidden, gameplay active' : mode === 'UI' ? 'Cursor shown, game paused' : 'Cursor shown, gameplay active'}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                </div>

                <div className="space-y-2.5">
                  <SurfaceCard level={2} className="p-4 relative">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full pointer-events-none" />
                    <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2"><Monitor className="w-4 h-4 text-pink-400" /> Overlay Screens</div>
                    <div className="space-y-2">
                      {HUD_OVERLAYS.map((node, i) => (
                        <motion.div key={node.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                          <ScreenNodeRow node={node} featureMap={featureMap} defs={defs} expandedNode={expandedNode} onToggle={toggleNode} arrowLabel={node.trigger} fromLabel="HUD" />
                        </motion.div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard level={2} className="p-4 relative">
                    <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2"><Monitor className="w-4 h-4 text-pink-400" /> Floating World Elements</div>
                    <div className="space-y-2">
                      {FLOATING_NODES.map((node, i) => (
                        <motion.div key={node.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                          <ScreenNodeRow node={node} featureMap={featureMap} defs={defs} expandedNode={expandedNode} onToggle={toggleNode} arrowLabel={node.trigger} />
                        </motion.div>
                      ))}
                    </div>
                  </SurfaceCard>
                </div>
              </div>

              <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-40 h-40 bg-pink-500/5 blur-3xl rounded-full pointer-events-none" />
                <div className="mb-2.5"><SectionLabel icon={Network} label="Interactive Screen Flow Graph" color={ACCENT} /></div>
                <div className="flex justify-center">
                  <svg width={340} height={340} viewBox="0 0 340 340" className="overflow-visible">
                    {FLOW_EDGES.map((edge, i) => {
                      const si = FLOW_NODES.findIndex((n) => n.id === edge.source);
                      const ti = FLOW_NODES.findIndex((n) => n.id === edge.target);
                      if (si < 0 || ti < 0) return null;
                      const count = FLOW_NODES.length;
                      const angleS = (2 * Math.PI * si) / count - Math.PI / 2;
                      const angleT = (2 * Math.PI * ti) / count - Math.PI / 2;
                      const radius = 140;
                      const sx = 200 + radius * Math.cos(angleS);
                      const sy = 200 + radius * Math.sin(angleS);
                      const tx = 200 + radius * Math.cos(angleT);
                      const ty = 200 + radius * Math.sin(angleT);
                      const mx = (sx + tx) / 2;
                      const my = (sy + ty) / 2;
                      const isHighlighted = highlightedFlowNode === edge.source || highlightedFlowNode === edge.target;
                      return (
                        <g key={`edge-${i}`}>
                          <line x1={sx} y1={sy} x2={tx} y2={ty} stroke={isHighlighted ? ACCENT : 'rgba(255,255,255,0.12)'} strokeWidth={isHighlighted ? 2 : 1.5} strokeDasharray={edge.style === 'dashed' ? '6 4' : undefined} style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }} />
                          {edge.label && <text x={mx} y={my - 6} textAnchor="middle" className="text-[7px] font-mono" fill={isHighlighted ? ACCENT : 'var(--text-muted)'} style={{ transition: 'fill 0.2s' }}>{edge.label}</text>}
                        </g>
                      );
                    })}
                    {FLOW_NODES.map((node, i) => {
                      const count = FLOW_NODES.length;
                      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
                      const radius = 140;
                      const x = 200 + radius * Math.cos(angle);
                      const y = 200 + radius * Math.sin(angle);
                      const nodeColor = node.color ?? ACCENT;
                      const isHighlighted = highlightedFlowNode === node.id;
                      return (
                        <g key={node.id} onClick={() => setHighlightedFlowNode(prev => prev === node.id ? null : node.id)} className="cursor-pointer">
                          <circle cx={x} cy={y} r={isHighlighted ? 28 : 24} fill={`${nodeColor}${isHighlighted ? '40' : '20'}`} stroke={nodeColor} strokeWidth={isHighlighted ? 3 : 2} style={{ filter: isHighlighted ? `drop-shadow(0 0 10px ${nodeColor})` : `drop-shadow(0 0 4px ${nodeColor}40)`, transition: 'all 0.2s' }} />
                          <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="text-[9px] font-mono font-bold pointer-events-none" fill={nodeColor}>{node.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {Object.entries(FLOW_GROUP_COLORS).map(([group, color]) => (
                    <span key={group} className="flex items-center gap-1.5 text-[10px] font-mono font-bold" style={{ color }}><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />{group}</span>
                  ))}
                </div>
              </SurfaceCard>
            </motion.div>
          )}

          {activeTab === 'systems' && (
            <motion.div key="systems" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <SurfaceCard level={2} className="p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full pointer-events-none" />
                <div className="mb-2.5"><SectionLabel icon={Gauge} label="Widget Performance Budget" color={ACCENT} /></div>
                <div className="space-y-3">
                  {sortedBudgets.map((b, i) => {
                    const pct = b.current / b.max;
                    const barColor = b.threshold ? (b.current >= b.threshold.danger ? STATUS_ERROR : b.current >= b.threshold.warn ? STATUS_WARNING : STATUS_SUCCESS) : (b.color ?? ACCENT);
                    return (
                      <motion.div key={b.label} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs font-mono font-bold text-text w-36 truncate">{b.label}</span>
                          <span className="text-[10px] font-mono text-text-muted">{b.current}{b.unit ? ` ${b.unit}` : ''} / {b.max}{b.unit ? ` ${b.unit}` : ''}</span>
                          <span className="ml-auto text-[10px] font-mono font-bold" style={{ color: barColor }}>{Math.round(pct * 100)}%</span>
                        </div>
                        <div className="h-2.5 bg-surface-deep rounded-full overflow-hidden border border-border/30">
                          <motion.div className="h-full rounded-full" style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}40` }} initial={{ width: 0 }} animate={{ width: `${Math.min(pct * 100, 100)}%` }} transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </SurfaceCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <SurfaceCard level={2} className="p-4 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full pointer-events-none" />
                  <div className="mb-2.5"><SectionLabel icon={Layers} label="Screen Depth / Z-Order" color={ACCENT} /></div>
                  <div className="space-y-2 relative pl-6">
                    <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-border/50 rounded-full" />
                    {Z_LAYERS.map((layer, i) => (
                      <motion.div key={layer.depth} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative">
                        <div className="absolute top-1.5 -left-[22px] w-2 h-2 rounded-full border-2 border-surface bg-background" style={{ borderColor: layer.color }} />
                        <div className="flex items-start gap-3">
                          <div className="w-12 pt-0.5 text-right flex-shrink-0"><span className="text-[10px] font-mono text-text-muted">Z: {layer.depth}</span></div>
                          <div className="flex-1 bg-surface/50 rounded-md border border-border/30 p-2 relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 opacity-60" style={{ backgroundColor: layer.color }} />
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-bold font-mono" style={{ color: layer.color }}>{layer.label}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {layer.widgets.map(w => <span key={w} className="px-1.5 py-0.5 bg-background rounded border border-border/50 text-[9px] font-mono text-text-muted">{w}</span>)}
                              </div>
                            </div>
                            {layer.hasOverlap && <div className="absolute top-1.5 right-1.5 text-amber-500"><AlertCircle className="w-3 h-3" /></div>}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard level={2} className="p-4 relative overflow-hidden">
                  <div className="mb-2.5"><SectionLabel icon={Eye} label="HUD Context Modes" color={ACCENT} /></div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {HUD_CONTEXTS.map((ctx, i) => (
                      <button key={ctx.name} onClick={() => setActiveContext(i)} className="px-2 py-1 flex-1 text-center text-xs font-mono font-bold rounded border transition-colors hover:brightness-125" style={{ backgroundColor: i === activeContext ? `${ctx.color}20` : 'transparent', borderColor: i === activeContext ? `${ctx.color}60` : 'var(--border)', color: i === activeContext ? ctx.color : 'var(--text-muted)' }}>{ctx.name}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface/50 p-3 rounded-lg border border-border/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5"><Eye className="w-3 h-3" /> Visible</div>
                      <div className="flex flex-col gap-1">
                        {HUD_CONTEXTS[activeContext].visible.map(w => <span key={w} className="text-xs font-mono text-emerald-400 truncate flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-emerald-400" /> {w}</span>)}
                      </div>
                    </div>
                    <div className="bg-surface/50 p-3 rounded-lg border border-border/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5"><Eye className="w-3 h-3 opacity-40" /> Hidden</div>
                      <div className="flex flex-col gap-1">
                        {HUD_CONTEXTS[activeContext].hidden.map(w => <span key={w} className="text-xs font-mono text-text-muted opacity-60 truncate flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-muted" /> {w}</span>)}
                      </div>
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            </motion.div>
          )}

          {activeTab === 'ui' && (
            <motion.div key="ui" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <SurfaceCard level={2} className="p-4 relative overflow-hidden">
                  <div className="mb-2.5"><SectionLabel icon={Smartphone} label="Responsive Breakpoints" color={ACCENT} /></div>
                  <div className="flex items-center gap-2 mb-2.5">
                    {BREAKPOINTS.map((bp, i) => (
                      <button key={bp.label} onClick={() => setSelectedBreakpoint(i)} className="flex-1 text-center text-[10px] font-mono font-bold py-1.5 rounded-md border transition-all" style={{ backgroundColor: i === selectedBreakpoint ? `${ACCENT}20` : 'transparent', borderColor: i === selectedBreakpoint ? `${ACCENT}60` : 'var(--border)', color: i === selectedBreakpoint ? ACCENT : 'var(--text-muted)', boxShadow: i === selectedBreakpoint ? `0 0 8px ${ACCENT}20` : 'none' }}>{bp.label}</button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 gap-2 text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider px-2 pb-1 border-b border-border/30">
                      <span>Widget</span><span>MinRes</span><span>Scale</span><span>Status</span>
                    </div>
                    {BREAKPOINT_WIDGETS.map((w, i) => {
                      const bpWidth = BREAKPOINTS[selectedBreakpoint].width;
                      const minIdx = BREAKPOINTS.findIndex(b => b.label === w.minRes);
                      const isActive = selectedBreakpoint >= minIdx;
                      return (
                        <motion.div key={w.widget} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="grid grid-cols-4 gap-2 text-xs font-mono px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors" style={{ opacity: isActive ? 1 : 0.4 }}>
                          <span className="text-text font-medium truncate">{w.widget}</span>
                          <span className="text-text-muted">{w.minRes}</span>
                          <span className="text-text-muted">{w.scaleMode}</span>
                          <span><span className="text-[10px] px-1.5 py-0.5 rounded font-bold border" style={{ backgroundColor: `${w.status === 'ok' ? STATUS_SUCCESS : w.status === 'warn' ? STATUS_WARNING : STATUS_ERROR}15`, color: w.status === 'ok' ? STATUS_SUCCESS : w.status === 'warn' ? STATUS_WARNING : STATUS_ERROR, borderColor: `${w.status === 'ok' ? STATUS_SUCCESS : w.status === 'warn' ? STATUS_WARNING : STATUS_ERROR}30` }}>{w.status === 'ok' ? 'OK' : w.status === 'warn' ? 'WARN' : 'FAIL'}</span></span>
                        </motion.div>
                      );
                    })}
                  </div>
                </SurfaceCard>

                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="mb-2.5"><SectionLabel icon={GitBranch} label="Input Mode SM" color={ACCENT} /></div>
                  <div className="flex justify-center mb-2.5">
                    <svg width={280} height={160} viewBox="0 0 280 160" className="overflow-visible">
                      {(() => {
                        const positions: Record<InputMode, { x: number; y: number }> = { Game: { x: 80, y: 50 }, UI: { x: 240, y: 50 }, GameAndUI: { x: 160, y: 170 } };
                        return (
                          <>
                            {SM_EDGES.map((edge, i) => {
                              const from = positions[edge.from];
                              const to = positions[edge.to];
                              const mx = (from.x + to.x) / 2;
                              const my = (from.y + to.y) / 2;
                              const isActive = currentInputMode === edge.from;
                              const dx = to.x - from.x;
                              const dy = to.y - from.y;
                              const len = Math.sqrt(dx * dx + dy * dy) || 1;
                              const offsetSign = i % 2 === 0 ? 1 : -1;
                              const perpX = (-dy / len) * 8 * offsetSign;
                              const perpY = (dx / len) * 8 * offsetSign;
                              return (
                                <g key={`sm-edge-${i}`}>
                                  <line x1={from.x + perpX} y1={from.y + perpY} x2={to.x + perpX} y2={to.y + perpY} stroke={isActive ? INPUT_MODE_COLORS[edge.from] : 'rgba(255,255,255,0.1)'} strokeWidth={isActive ? 2 : 1} strokeDasharray="4 3" markerEnd="url(#sm-arrow)" />
                                  <text x={mx + perpX} y={my + perpY - 4} textAnchor="middle" className="text-[7px] font-mono" fill={isActive ? INPUT_MODE_COLORS[edge.from] : 'var(--text-muted)'}>{edge.trigger}</text>
                                </g>
                              );
                            })}
                            <defs>
                              <marker id="sm-arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.3)" />
                              </marker>
                            </defs>
                            {SM_NODES.map((node) => {
                              const pos = positions[node.id];
                              const color = INPUT_MODE_COLORS[node.id];
                              const isActive = currentInputMode === node.id;
                              return (
                                <g key={node.id} onClick={() => setCurrentInputMode(node.id)} className="cursor-pointer">
                                  <circle cx={pos.x} cy={pos.y} r={isActive ? 32 : 28} fill={`${color}${isActive ? '30' : '15'}`} stroke={color} strokeWidth={isActive ? 3 : 1.5} style={{ filter: isActive ? `drop-shadow(0 0 12px ${color})` : 'none', transition: 'all 0.2s' }} />
                                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" className="text-[9px] font-mono font-bold pointer-events-none" fill={color}>{node.label}</text>
                                  {isActive && <circle cx={pos.x} cy={pos.y} r={36} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity={0.4} />}
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="text-center text-xs text-text-muted font-mono">Current Mode: <span className="font-bold" style={{ color: INPUT_MODE_COLORS[currentInputMode] }}>{currentInputMode}</span><span className="ml-2 opacity-60">(click nodes to switch)</span></div>
                </SurfaceCard>
              </div>

              <SurfaceCard level={2} className="p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full pointer-events-none" />
                <div className="mb-2.5"><SectionLabel icon={Link2} label="Widget Binding Inspector" color={ACCENT} /></div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Widget</th>
                        <th className="text-left px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Attribute</th>
                        <th className="text-left px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Method</th>
                        <th className="text-left px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Frequency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {WIDGET_BINDINGS.map((w, i) => (
                        <motion.tr key={w.widget} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="hover:bg-surface-hover/30 transition-colors group">
                          <td className="px-2 py-2"><span className="text-text font-bold">{w.widget}</span></td>
                          <td className="px-2 py-2"><span className="px-1.5 py-0.5 bg-surface-deep rounded border border-border/40 text-[10px] text-text-muted">{w.attribute}</span></td>
                          <td className="px-2 py-2"><span className={`text-[10px] ${w.updateMethod === 'Delegate' ? 'text-emerald-400' : w.updateMethod === 'Poll' ? 'text-amber-400' : 'text-cyan-400'}`}>{w.updateMethod}</span></td>
                          <td className="px-2 py-2 flex items-center gap-2">
                            <span className="text-text-muted text-[10px]">{w.frequency}</span>
                            {w.isStale && <span className="ml-auto px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[9px] uppercase tracking-wider font-bold">Stale</span>}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SurfaceCard>

              <SurfaceCard level={2} className="p-4 relative overflow-hidden">
                <div className="mb-2.5"><SectionLabel icon={PlayCircle} label="Animation/Transition Catalog" color={ACCENT} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ANIM_CATALOG.map((anim, i) => (
                    <motion.div key={anim.widget} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="bg-surface/50 rounded-lg border border-border/40 p-3 hover:border-border/80 transition-colors">
                      <div className="text-xs font-bold text-text mb-2 truncate">{anim.widget}</div>
                      <div className="flex flex-col gap-1.5 text-[10px] font-mono text-text-muted">
                        <div className="flex justify-between"><span>Open:</span><span className="text-cyan-300">{anim.openAnim}</span></div>
                        <div className="flex justify-between"><span>Close:</span><span className="text-pink-300">{anim.closeAnim}</span></div>
                        <div className="h-px w-full bg-border/30 my-0.5" />
                        <div className="flex justify-between"><span>Timing:</span><span>{anim.duration} @ {anim.easing}</span></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </SurfaceCard>
            </motion.div>
          )}

          {activeTab === 'a11y' && (
            <motion.div key="a11y" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <SurfaceCard level={2} className="p-4 relative overflow-hidden">
                  <div className="mb-2.5"><SectionLabel icon={Globe} label="Localization Expansion Preview" color={ACCENT} /></div>
                  <div className="flex items-center gap-2 mb-2.5">
                    {LANGUAGES.map((lang, i) => (
                      <button key={lang.code} onClick={() => setSelectedLang(i)} className="flex-1 text-center py-1 rounded transition-colors" style={{ backgroundColor: i === selectedLang ? 'rgba(255,255,255,0.1)' : 'transparent', color: i === selectedLang ? '#fff' : 'var(--text-muted)' }}>
                        <span className="text-xs font-bold font-mono">{lang.code}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bg-surface-deep/50 rounded-lg p-3 border border-border/30">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Estimated Expansion</span>
                      <span className="text-lg font-mono font-bold" style={{ color: LANGUAGES[selectedLang].expansion > 110 ? STATUS_WARNING : STATUS_SUCCESS }}>{LANGUAGES[selectedLang].expansion}%</span>
                    </div>
                    <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-border/20 relative">
                      <div className="absolute top-0 bottom-0 left-0 bg-surface-hover z-0" style={{ width: '100%' }} />
                      <motion.div className="absolute top-0 bottom-0 left-0 z-10" style={{ backgroundColor: LANGUAGES[selectedLang].expansion > 110 ? STATUS_WARNING : STATUS_SUCCESS }} initial={{ width: 0 }} animate={{ width: `${Math.min(LANGUAGES[selectedLang].expansion, 150)}%` }} transition={{ type: 'spring' }} />
                      <div className="absolute top-0 bottom-0 left-[100%] w-0.5 bg-red-500 z-20 shadow-[0_0_4px_red]" />
                    </div>
                    {LANGUAGES[selectedLang].overflowWidgets.length > 0 && (
                      <div className="mt-2.5 pt-3 border-t border-border/20">
                        <span className="text-[10px] font-mono text-amber-500 font-bold mb-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Potential Overflow Areas</span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {LANGUAGES[selectedLang].overflowWidgets.map(w => <span key={w} className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/30 text-[10px] font-mono">{w}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </SurfaceCard>

                <SurfaceCard level={2} className="p-4 relative overflow-hidden flex flex-col items-center justify-center">
                  <div className="w-full mb-2.5"><SectionLabel icon={Award} label="Accessibility Score Card" color={ACCENT} /></div>
                  <div className="flex items-center justify-center gap-8 w-full shrink-0">
                    <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 shadow-lg shrink-0" style={{ borderColor: A11Y_OVERALL_SCORE > 80 ? STATUS_SUCCESS : STATUS_WARNING, backgroundColor: `${A11Y_OVERALL_SCORE > 80 ? STATUS_SUCCESS : STATUS_WARNING}10` }}>
                      <div className="flex flex-col items-center text-center">
                        <span className="text-[10px] font-mono uppercase text-text-muted">Grade</span>
                        <span className="text-4xl font-black">{A11Y_OVERALL_GRADE}</span>
                        <span className="text-xs font-mono" style={{ color: A11Y_OVERALL_SCORE > 80 ? STATUS_SUCCESS : STATUS_WARNING }}>{A11Y_OVERALL_SCORE}/100</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 shrink-0 max-w-[50%]">
                      {A11Y_CATEGORIES.map(c => (
                        <div key={c.name} className="flex items-center justify-between text-[10px] font-mono bg-surface/50 p-1.5 rounded border border-border/30">
                          <span className="text-text-muted truncate w-[60%] shrink">{c.name}</span>
                          <span className="font-bold shrink-0 w-[40px] text-center" style={{ color: c.color }}>{c.grade}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Screen node row ───────────────────────────────────────────────────────── */

function ScreenNodeRow({
  node,
  featureMap,
  defs,
  expandedNode,
  onToggle,
  arrowLabel,
  fromLabel,
}: {
  node: ScreenNode;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expandedNode: string | null;
  onToggle: (id: string) => void;
  arrowLabel?: string;
  fromLabel?: string;
}) {
  const row = featureMap.get(node.featureName);
  const def = defs.find((d) => d.featureName === node.featureName);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];
  const isExpanded = expandedNode === node.id;

  return (
    <SurfaceCard level={3} className="relative overflow-hidden group border-border/60 hover:border-text-muted/40 transition-colors">
      <button
        onClick={() => onToggle(node.id)}
        className="w-full text-left px-3.5 py-2.5 focus:outline-none"
      >
        <div className="flex items-center gap-2.5">
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text transition-colors" />
          </motion.div>
          {fromLabel && (
            <span className="text-2xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border/30">{fromLabel} &rarr;</span>
          )}
          <span className="text-xs font-bold text-text truncate max-w-[200px]">{node.featureName}</span>

          <div className="hidden sm:flex ml-2">
            <InputModeBadge mode={node.inputMode} />
          </div>

          <span className="ml-auto flex items-center gap-1.5 bg-surface px-2 py-0.5 rounded border border-border/40 shadow-sm flex-shrink-0">
            <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
            <span className="text-[10px] font-bold uppercase" style={{ color: sc.dot }}>{sc.label}</span>
          </span>
        </div>

        {/* Mobile Input Mode Badge & Trigger */}
        <div className="flex sm:hidden mt-2 ml-6 items-center gap-2">
          <InputModeBadge mode={node.inputMode} />
          {arrowLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border"
              style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, borderColor: `${ACCENT}30` }}>
              Trigger: {arrowLabel}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-border/40 space-y-3 bg-surface/30">
              <div className="flex items-center gap-3">
                <p className="text-xs text-text-muted leading-relaxed flex-1">
                  {def?.description ?? row?.description ?? 'No description'}
                </p>
                {arrowLabel && (
                  <span className="hidden sm:inline-block text-[10px] px-2 py-1 rounded font-mono font-medium border whitespace-nowrap"
                    style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, borderColor: `${ACCENT}30` }}>
                    Trigger: {arrowLabel}
                  </span>
                )}
              </div>

              {/* Sub-widget list */}
              <div className="bg-surface-deep p-2 rounded-lg border border-border/40">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5 ml-1">Sub-Widgets</div>
                <div className="flex flex-wrap gap-1.5">
                  {node.subWidgets.map((w) => (
                    <span
                      key={w}
                      className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border shadow-sm"
                      style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, borderColor: `${ACCENT}30` }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>

              {row?.filePaths && row.filePaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {row.filePaths.slice(0, 3).map((fp) => (
                    <span key={fp} className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border bg-surface" style={{ color: ACCENT, borderColor: `${ACCENT}30` }}>
                      <ExternalLink className="w-2.5 h-2.5" />
                      {fp.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}

              {row?.nextSteps && (
                <div className="text-xs p-2 bg-amber-500/10 border-l-2 border-amber-500 rounded text-amber-500 font-medium">
                  Next: {row.nextSteps}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

/* ── Input mode badge ──────────────────────────────────────────────────────── */

function InputModeBadge({ mode }: { mode: InputMode }) {
  const color = INPUT_MODE_COLORS[mode];
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-bold border"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}40` }}
    >
      {mode}
    </span>
  );
}
