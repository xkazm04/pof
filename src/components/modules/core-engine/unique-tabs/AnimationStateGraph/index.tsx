'use client';

import { useMemo, useState } from 'react';
import { Activity, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { withOpacity, OPACITY_5, OPACITY_10, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { useCatalogEntities } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { AnimationEntry } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';
import { ALL_MONTAGES } from './data';
import {
  TabHeader,
  LoadingSpinner,
  HeatmapGrid,
  SubTabNavigation,
  CollapsibleSection,
  NarrativeBreadcrumb,
  type NarrativeBreadcrumbStep,
  type SubTab,
} from '../_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT, HEATMAP_STATE_NAMES, HEATMAP_CELLS, COMBO_CHAIN_NODES, ANIM_SUBTABS, type AnimSubtab } from './data';
import { BlueprintPanel, SectionHeader } from '../_design';
import { StateMachinePanel } from './state-graph/StateMachinePanel';
import { BlendSpacePanel } from './budget/BlendSpacePanel';
import { StateDurationPanel } from './budget/StateDurationPanel';
import { ResponsivenessAnalyzer } from './state-graph/ResponsivenessAnalyzer';
import { ComboTimelinePanel } from './combos-montages/ComboTimelinePanel';
import { ComboChainPanel } from './combos-montages/ComboChainPanel';
import { FrameScrubberPanel } from './combos-montages/FrameScrubberPanel';
import { EventTimelinePanel } from './combos-montages/EventTimelinePanel';
import { RetargetingTab } from './retargeting/RetargetingTab';
import { BudgetTab } from './budget/BudgetTab';
import { StateGroupBrowser } from './state-graph/StateGroupBrowser';
import FeatureMapTab from '../FeatureMapTab';
import { VisibleSection } from '../VisibleSection';
import { renderAnimMetric } from './metrics';

/* ── Narrative Breadcrumb steps ────────────────────────────────────────── */

const NARRATIVE_STEPS: ReadonlyArray<NarrativeBreadcrumbStep<AnimSubtab>> = [
  { key: 'features', narrative: 'Catalog' },
  ...ANIM_SUBTABS.map((t) => ({ key: t.key, narrative: t.narrative })),
];

/* ── Active tab subtitle ──────────────────────────────────────────────── */

function getActiveSubtitle(tab: AnimSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = ANIM_SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

interface AnimationStateGraphProps {
  moduleId: SubModuleId;
}

const TABS: SubTab[] = [
  { id: 'features', label: 'Features', icon: LayoutGrid },
  ...ANIM_SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon } as SubTab)),
];

export function AnimationStateGraph({ moduleId }: AnimationStateGraphProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState<AnimSubtab>('state-graph');
  const [selectedComboNode, setSelectedComboNode] = useState<string | null>(null);

  /* folder-09 R3 UI: lifecycle + (Re)generate for the primary montage.
   * NB: the State Graph recipe loudly flags `author-python` as MANUAL — the AnimBP
   * graph itself cannot be authored from Python. The cell still drives dispatch;
   * the recipe's prompt text handles the MANUAL framing. */
  const animEntries = useCatalogEntities('state-graph') as AnimationEntry[];
  const entryByMontageId = useMemo(
    () => new Map(animEntries.map((e) => [e.data.id, e])),
    [animEntries],
  );
  const primaryMontageId = ALL_MONTAGES[0]?.id;
  const primaryEntry =
    (primaryMontageId != null ? entryByMontageId.get(primaryMontageId) : undefined)
    ?? animEntries[0];
  const gen = useGeneration(primaryEntry!);
  const nextStep: GenerationStep =
    primaryEntry?.lifecycle === 'generated' ? 'wire'
      : primaryEntry?.lifecycle === 'wired' ? 'verify'
        : 'author-python';

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <div className="space-y-4">
      <TabHeader icon={Activity} title="Animation State Graph" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* ── Narrative Breadcrumb ─────────────────────────────────────────── */}
      <NarrativeBreadcrumb
        steps={NARRATIVE_STEPS}
        activeKey={activeTab}
        accent={ACCENT}
        onNavigate={setActiveTab}
      />

      {/* ── Sub-Tab Navigation ──────────────────────────────────────────── */}
      <SubTabNavigation tabs={TABS} activeTabId={activeTab} onChange={(id) => setActiveTab(id as AnimSubtab)} accent={ACCENT} />

      {/* folder-09 R3: catalog lifecycle cell for the primary montage */}
      {primaryEntry && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            {primaryEntry.data.name ?? primaryEntry.data.id}
          </span>
          <CatalogLifecycleCell
            lifecycle={primaryEntry.lifecycle}
            ueAssetCount={primaryEntry.ueAssets?.length ?? 0}
            busy={gen.isRunning}
            onRegenerate={() => gen.generate(nextStep)}
          />
        </div>
      )}

      {/* ── Active Tab Subtitle ─────────────────────────────────────────── */}
      {subtitle && <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>}

      {/* ── Tab Content with Animated Transitions ─────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderAnimMetric} />}

          {activeTab === 'state-graph' && (
            <VisibleSection moduleId={moduleId} sectionId="states">
              <div className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <StateMachinePanel featureMap={featureMap} />
                  <BlendSpacePanel />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <BlueprintPanel color={ACCENT} className="p-4">
                    <SectionHeader label="State Transition Heatmap" color={ACCENT} />
                    <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
                      Normalized transition frequency between animation states. Brighter cells indicate more frequent transitions.
                    </p>
                    <HeatmapGrid rows={HEATMAP_STATE_NAMES} cols={HEATMAP_STATE_NAMES} cells={HEATMAP_CELLS} accent={ACCENT} />
                  </BlueprintPanel>
                  <StateDurationPanel />
                </div>
                <ResponsivenessAnalyzer />
                <CollapsibleSection title="State Browser" color={ACCENT}>
                  <StateGroupBrowser />
                </CollapsibleSection>
              </div>
            </VisibleSection>
          )}

          {activeTab === 'combos-montages' && (
            <VisibleSection moduleId={moduleId} sectionId="chain">
              <div className="space-y-4">
                {/* Combo node selector chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Select combo:</span>
                  {COMBO_CHAIN_NODES.map((node) => {
                    const active = selectedComboNode === node.id;
                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedComboNode(active ? null : node.id)}
                        className="px-2.5 py-1 rounded-md text-xs font-mono font-bold border transition-all cursor-pointer"
                        style={active
                          ? { backgroundColor: withOpacity(ACCENT, OPACITY_10), borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }
                          : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                        }
                      >
                        {node.name}
                      </button>
                    );
                  })}
                </div>

                {selectedComboNode && (() => {
                  const node = COMBO_CHAIN_NODES.find(n => n.id === selectedComboNode);
                  if (!node) return null;
                  return (
                    <div className="rounded-lg border p-3 text-xs font-mono space-y-1"
                      style={{ borderColor: withOpacity(ACCENT, OPACITY_20), backgroundColor: withOpacity(ACCENT, OPACITY_5) }}>
                      <div className="font-bold text-sm" style={{ color: ACCENT }}>{node.name}</div>
                      <div className="text-text-muted">Montage: <span className="text-text">{node.montage}</span></div>
                      <div className="text-text-muted">Damage: <span className="font-bold text-text">{node.damage}</span></div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <ComboTimelinePanel />
                  <ComboChainPanel selectedNodeId={selectedComboNode} onSelectNode={setSelectedComboNode} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <FrameScrubberPanel />
                  <EventTimelinePanel />
                </div>
              </div>
            </VisibleSection>
          )}

          {activeTab === 'retargeting' && (
            <VisibleSection moduleId={moduleId} sectionId="skeleton">
              <div className="space-y-4">
                <RetargetingTab />
              </div>
            </VisibleSection>
          )}

          {activeTab === 'budget' && (
            <VisibleSection moduleId={moduleId} sectionId="assets">
              <div className="space-y-4">
                <BudgetTab featureMap={featureMap} defs={defs} />
              </div>
            </VisibleSection>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
