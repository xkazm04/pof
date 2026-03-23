'use client';

import { useCallback } from 'react';
import { Monitor, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_PINK, STATUS_WARNING } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { STATUS_COLORS } from '../_shared';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { HUD_CHILDREN, HUD_OVERLAYS, FLOATING_NODES, INPUT_MODE_COLORS, SCREEN_TO_FLOW, FLOW_NODES } from './data';
import type { InputMode } from './data';
import { ScreenNodeRow, InputModeBadge } from './ScreenNodeRow';
import { FlowGraph } from './FlowGraph';

const ACCENT = ACCENT_PINK;

interface FlowNodesTabProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expandedNode: string | null;
  onToggleNode: (id: string) => void;
  highlightedFlowNode: string | null;
  onToggleFlowNode: (id: string) => void;
}

export function FlowNodesTab({
  featureMap, defs, expandedNode, onToggleNode,
  highlightedFlowNode, onToggleFlowNode,
}: FlowNodesTabProps) {
  const getScreenHighlightColor = useCallback((screenNodeId: string): string | null => {
    const flowId = SCREEN_TO_FLOW[screenNodeId];
    if (!flowId || flowId !== highlightedFlowNode) return null;
    return FLOW_NODES.find(n => n.id === flowId)?.color ?? null;
  }, [highlightedFlowNode]);

  const hudStatus: FeatureStatus = featureMap.get('Main HUD widget')?.status ?? 'unknown';
  const hudSc = STATUS_COLORS[hudStatus];

  return (
    <motion.div key="flow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <BlueprintPanel color={ACCENT} className="p-4 group">
            <SectionHeader label="HUD Architecture Hub" color={ACCENT} icon={Monitor} />
            <button onClick={() => onToggleNode('hud-root')} className="w-full text-left relative z-10 focus:outline-none">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-sm transition-colors hover:bg-surface-hover/30" style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}15` }}>
                <motion.div animate={{ rotate: expandedNode === 'hud-root' ? 90 : 0 }}>
                  <ChevronRight className="w-4 h-4" style={{ color: ACCENT }} />
                </motion.div>
                <span className="text-sm font-bold text-text">Main HUD Layout</span>
                <InputModeBadge mode="GameAndUI" />
                <span className="ml-auto flex items-center gap-1.5 bg-surface-deep px-2 py-0.5 rounded shadow-inner border border-border/40">
                  <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: hudSc.dot, color: hudSc.dot }} />
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold" style={{ color: hudSc.dot }}>{hudSc.label}</span>
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
            <div className="mt-2.5 pl-4 space-y-3 relative z-10">
              <div className="absolute left-6 top-0 bottom-6 w-px bg-[var(--border)] opacity-30" />
              {HUD_CHILDREN.map((node, i) => (
                <motion.div key={node.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                  <ScreenNodeRow node={node} featureMap={featureMap} defs={defs} expandedNode={expandedNode} onToggle={onToggleNode} arrowLabel={node.trigger} highlightColor={getScreenHighlightColor(node.id)} />
                </motion.div>
              ))}
            </div>
          </BlueprintPanel>

          <BlueprintPanel color={ACCENT} className="p-4">
            <SectionHeader label="Input Mode Legend" color={ACCENT} icon={Monitor} />
            <div className="flex flex-col gap-2">
              {(Object.entries(INPUT_MODE_COLORS) as [InputMode, string][]).map(([mode, color]) => (
                <div key={mode} className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-border/50">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.15em] font-bold w-24 text-center shadow-sm" style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>{mode}</span>
                  <span className="text-text-muted text-xs">{mode === 'Game' ? 'Cursor hidden, gameplay active' : mode === 'UI' ? 'Cursor shown, game paused' : 'Cursor shown, gameplay active'}</span>
                </div>
              ))}
            </div>
          </BlueprintPanel>
        </div>

        <div className="space-y-4">
          <BlueprintPanel color={ACCENT} className="p-4">
            <SectionHeader label="Overlay Screens" color={ACCENT} icon={Monitor} />
            <div className="space-y-3">
              {HUD_OVERLAYS.map((node, i) => (
                <motion.div key={node.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <ScreenNodeRow node={node} featureMap={featureMap} defs={defs} expandedNode={expandedNode} onToggle={onToggleNode} arrowLabel={node.trigger} fromLabel="HUD" highlightColor={getScreenHighlightColor(node.id)} />
                </motion.div>
              ))}
            </div>
          </BlueprintPanel>

          <BlueprintPanel color={ACCENT} className="p-4">
            <SectionHeader label="Floating World Elements" color={ACCENT} icon={Monitor} />
            <div className="space-y-3">
              {FLOATING_NODES.map((node, i) => (
                <motion.div key={node.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <ScreenNodeRow node={node} featureMap={featureMap} defs={defs} expandedNode={expandedNode} onToggle={onToggleNode} arrowLabel={node.trigger} highlightColor={getScreenHighlightColor(node.id)} />
                </motion.div>
              ))}
            </div>
          </BlueprintPanel>
        </div>
      </div>

      <FlowGraph highlightedFlowNode={highlightedFlowNode} onToggleNode={(id) => onToggleFlowNode(id)} />
    </motion.div>
  );
}
