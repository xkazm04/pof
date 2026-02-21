'use client';

import { useMemo, useState, useCallback } from 'react';
import { Monitor, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING,
  ACCENT_PINK,
  OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, LoadingSpinner } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

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

/* ── Component ─────────────────────────────────────────────────────────────── */

interface ScreenFlowMapProps {
  moduleId: SubModuleId;
}

export function ScreenFlowMap({ moduleId }: ScreenFlowMapProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

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

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const hudStatus: FeatureStatus = featureMap.get('Main HUD widget')?.status ?? 'unknown';
  const hudSc = STATUS_COLORS[hudStatus];

  return (
    <div className="space-y-4">
      {/* Header */}
      <TabHeader icon={Monitor} title="Screen Flow Map" implemented={stats.implemented} total={stats.total} accent={ACCENT}>
        {stats.partial > 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md border border-amber-500/20 shadow-sm"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_WARNING, boxShadow: `0 0 6px ${STATUS_WARNING}80` }} />
            {stats.partial} partial
          </motion.span>
        )}
      </TabHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {/* HUD root node */}
          <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-pink-500/10 transition-colors duration-1000" />

            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2 relative z-10">
              <Monitor className="w-4 h-4 text-pink-400" /> HUD Architecture Hub
            </div>

            <button
              onClick={() => toggleNode('hud-root')}
              className="w-full text-left relative z-10 focus:outline-none"
            >
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm transition-colors hover:bg-surface-hover/30"
                style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}15` }}
              >
                <motion.div animate={{ rotate: expandedNode === 'hud-root' ? 90 : 0 }}>
                  <ChevronRight className="w-4 h-4 text-pink-300" />
                </motion.div>
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
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
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

            {/* HUD children */}
            <div className="mt-4 pl-4 space-y-2 relative z-10">
              <div className="absolute left-6 top-0 bottom-6 w-px bg-[var(--border)] opacity-30" />
              {HUD_CHILDREN.map((node, i) => (
                <motion.div key={node.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                  <ScreenNodeRow
                    node={node}
                    featureMap={featureMap}
                    defs={defs}
                    expandedNode={expandedNode}
                    onToggle={toggleNode}
                    arrowLabel={node.trigger}
                  />
                </motion.div>
              ))}
            </div>
          </SurfaceCard>

          {/* Input mode legend */}
          <SurfaceCard level={2} className="p-4 relative">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-pink-400" /> Input Mode Legend
            </div>
            <div className="flex flex-col gap-2">
              {(Object.entries(INPUT_MODE_COLORS) as [InputMode, string][]).map(([mode, color]) => (
                <div key={mode} className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-border/50">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold w-24 text-center shadow-sm"
                    style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
                  >
                    {mode}
                  </span>
                  <span className="text-text-muted text-xs">
                    {mode === 'Game' ? 'Cursor hidden, gameplay active' : mode === 'UI' ? 'Cursor shown, game paused' : 'Cursor shown, gameplay active'}
                  </span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          {/* Overlay screens */}
          <SurfaceCard level={2} className="p-4 relative">
            <div className="absolute right-0 top-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-pink-400" /> Overlay Screens
            </div>
            <div className="space-y-2">
              {HUD_OVERLAYS.map((node, i) => (
                <motion.div key={node.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <ScreenNodeRow
                    node={node}
                    featureMap={featureMap}
                    defs={defs}
                    expandedNode={expandedNode}
                    onToggle={toggleNode}
                    arrowLabel={node.trigger}
                    fromLabel="HUD"
                  />
                </motion.div>
              ))}
            </div>
          </SurfaceCard>

          {/* Floating elements */}
          <SurfaceCard level={2} className="p-4 relative">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-pink-400" /> Floating World Elements
            </div>
            <div className="space-y-2">
              {FLOATING_NODES.map((node, i) => (
                <motion.div key={node.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <ScreenNodeRow
                    node={node}
                    featureMap={featureMap}
                    defs={defs}
                    expandedNode={expandedNode}
                    onToggle={toggleNode}
                    arrowLabel={node.trigger}
                  />
                </motion.div>
              ))}
            </div>
          </SurfaceCard>
        </div>
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
