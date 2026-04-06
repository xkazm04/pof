'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Eye, Brain, ChevronRight } from 'lucide-react';
import { MODULE_COLORS, ACCENT_CYAN, STATUS_SUCCESS, STATUS_NEUTRAL,
  withOpacity, OPACITY_25, OPACITY_8, OPACITY_20, OPACITY_50,
} from '@/lib/chart-colors';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { STATUS_COLORS, PipelineFlow } from '../../_shared';
import { AI_PIPELINE, DETECTED_ENTITIES, BT_TREE } from '../data';
import { BTFlowchart } from './BTFlowchart';
import { PerceptionConeViz } from './PerceptionConeViz';
import { DecisionDebugger } from './DecisionDebugger';
import { AbilityQuickPicker } from '../../CharacterBlueprint/input/AbilityQuickPicker';

interface AILogicTabProps {
  featureMap: Map<string, FeatureRow>;
  accent: string;
}

export function AILogicTab({ featureMap, accent }: AILogicTabProps) {
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [btExpandedNode, setBtExpandedNode] = useState<string | null>(null);

  const toggleBtNode = useCallback((id: string) => {
    setBtExpandedNode(prev => prev === id ? null : id);
  }, []);

  const spawnSc = STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown'];

  return (
    <motion.div key="ai-logic"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }} className="space-y-4">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Infrastructure pipeline */}
        <BlueprintPanel color={MODULE_COLORS.core} className="p-3">
          <SectionHeader icon={Zap} label="AI Infrastructure Pipeline" />
          <div className="mt-2.5">
            <PipelineFlow
              steps={AI_PIPELINE.map(n => ({
                label: n.label,
                status: (featureMap.get(n.featureName)?.status ?? 'unknown') as FeatureStatus,
              }))}
              accent={MODULE_COLORS.core} showStatus
            />
          </div>
        </BlueprintPanel>

        {/* Spawn config collapsible */}
        <BlueprintPanel color={accent} className="p-0 overflow-hidden h-fit">
          <button onClick={() => setSpawnOpen(!spawnOpen)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/30 transition-colors text-left focus:outline-none cursor-pointer">
            <motion.div animate={{ rotate: spawnOpen ? 90 : 0 }}>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </motion.div>
            <span className="text-sm font-bold text-text">Wave Spawner Configurator</span>
            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-md ml-auto border shadow-sm"
              style={{ backgroundColor: spawnSc.bg, color: spawnSc.dot, borderColor: `${withOpacity(spawnSc.dot, OPACITY_25)}` }}>
              {spawnSc.label}
            </span>
          </button>
          <AnimatePresence>
            {spawnOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-3 bg-surface/30">
                  <p className="text-sm text-text-muted leading-relaxed mt-2 bg-surface-deep p-3 rounded-lg border border-border/40">
                    Wave-based spawner drives enemy density. Each wave config specifies archetype pool, count range, spawn radius, and inter-spawn delay.
                  </p>
                  <div className="flex gap-3 mt-1">
                    {[{ label: 'Wave Inter', value: '60s' }, { label: 'Max Active', value: '12' }, { label: 'Spawn Radius', value: '800cm' }].map(item => (
                      <div key={item.label} className="flex-1 flex flex-col items-center py-2 px-3 rounded-xl text-center border shadow-sm"
                        style={{ backgroundColor: `${withOpacity(accent, OPACITY_8)}`, borderColor: `${withOpacity(accent, OPACITY_20)}` }}>
                        <span className="text-sm font-mono font-bold text-text">{item.value}</span>
                        <span className="text-xs uppercase font-bold text-text-muted mt-1 tracking-wider">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </BlueprintPanel>
      </div>

      {/* Perception Cone */}
      <BlueprintPanel color={ACCENT_CYAN} className="p-3">
        <SectionHeader icon={Eye} label="Perception Cone Visualizer" color={ACCENT_CYAN} />
        <div className="mt-3 flex items-center gap-4 min-h-[200px]">
          <PerceptionConeViz entities={DETECTED_ENTITIES} accent={ACCENT_CYAN} />
          <PerceptionLegend />
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* BT Flowchart */}
        <BlueprintPanel color={STATUS_SUCCESS} className="p-3">
          <SectionHeader icon={Brain} label="Behavior Tree Flowchart" color={STATUS_SUCCESS} />
          <div className="mt-3 flex flex-col md:flex-row gap-4">
            <BTFlowchart
              expandedNodeId={btExpandedNode} onNodeClick={toggleBtNode} accent={STATUS_SUCCESS} />
            <BtDetailsPanel expandedNodeId={btExpandedNode} />
          </div>
        </BlueprintPanel>

        <DecisionDebugger />
      </div>
      {/* Ability Reference */}
      <AbilityQuickPicker />
    </motion.div>
  );
}

/* ── Perception Legend ────────────────────────────────────────────────── */

function PerceptionLegend() {
  return (
    <div className="space-y-3 flex-1 min-w-0">
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Sense Legend</div>
      {[
        { label: 'Sight Cone', desc: '60 deg, 1500cm', color: withOpacity(ACCENT_CYAN, OPACITY_50), dashed: false },
        { label: 'Hearing Range', desc: '800cm radius', color: withOpacity(ACCENT_CYAN, OPACITY_25), dashed: true },
      ].map(s => (
        <div key={s.label} className="flex items-center gap-2 text-xs">
          <div className="w-5 h-[2px] flex-shrink-0"
            style={{ backgroundColor: s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : undefined }} />
          <span className="font-medium text-text">{s.label}</span>
          <span className="text-text-muted text-xs">{s.desc}</span>
        </div>
      ))}
      <div className="border-t border-border/30 pt-2 space-y-1.5 mt-2">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Detected</div>
        {DETECTED_ENTITIES.map(e => (
          <div key={e.label} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
            <span className="font-medium text-text">{e.label}</span>
            <span className="text-xs text-text-muted">
              {e.inCone ? 'In sight' : e.inHearing ? 'Heard' : 'Undetected'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── BT Details Panel ────────────────────────────────────────────────── */

function BtDetailsPanel({ expandedNodeId }: { expandedNodeId: string | null }) {
  const node = expandedNodeId ? BT_TREE.find(n => n.id === expandedNodeId) : null;
  return (
    <div className="flex-1 min-w-0">
      <AnimatePresence mode="sync">
        {node ? (
          <motion.div key={expandedNodeId}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            className="bg-surface-deep p-3 rounded-lg border border-border/40 space-y-3">
            <div className="text-xs font-bold text-text">{node.label}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-text-muted">Shape:</span>
              <span className="text-xs font-mono text-text">{node.shape}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: withOpacity(node.active ? STATUS_SUCCESS : STATUS_NEUTRAL, OPACITY_20),
                  color: node.active ? STATUS_SUCCESS : STATUS_NEUTRAL,
                }}>
                {node.active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{node.details}</p>
          </motion.div>
        ) : (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-text-muted italic mt-2">
            Click or press Enter on a node to view details. Arrow keys navigate between connected nodes.
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap gap-2 mt-3">
        {[
          { shape: 'diamond', label: 'Selector' },
          { shape: 'rect', label: 'Sequence' },
          { shape: 'rounded', label: 'Task' },
          { shape: 'hexagon', label: 'Decorator' },
        ].map(l => (
          <span key={l.shape} className="text-xs font-mono text-text-muted flex items-center gap-1">
            <span className="w-2 h-2 border border-text-muted/40 flex-shrink-0" style={{
              borderRadius: l.shape === 'rounded' ? '50%' : l.shape === 'diamond' ? '0' : '2px',
              transform: l.shape === 'diamond' ? 'rotate(45deg) scale(0.8)' : undefined,
            }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
