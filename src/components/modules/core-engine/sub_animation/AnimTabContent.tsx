'use client';

import { withOpacity, OPACITY_5, OPACITY_10, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { HeatmapGrid, CollapsibleSection } from '../unique-tabs/_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import { ACCENT, HEATMAP_STATE_NAMES, HEATMAP_CELLS, COMBO_CHAIN_NODES } from './_shared/data';
import { BlueprintPanel, SectionHeader } from '../unique-tabs/_design';
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

/* ── State Graph Tab ──────────────────────────────────────────────────── */

export function StateGraphTabContent({ featureMap }: { featureMap: Map<string, FeatureRow> }) {
  return (
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
  );
}

/* ── Combos/Montages Tab ──────────────────────────────────────────────── */

interface CombosMontagesTabContentProps {
  selectedComboNode: string | null;
  setSelectedComboNode: (id: string | null) => void;
}

export function CombosMontagesTabContent({ selectedComboNode, setSelectedComboNode }: CombosMontagesTabContentProps) {
  return (
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
  );
}

/* ── Retargeting Tab ──────────────────────────────────────────────────── */

export function RetargetingTabContent() {
  return (
    <div className="space-y-4">
      <RetargetingTab />
    </div>
  );
}

/* ── Budget Tab ───────────────────────────────────────────────────────── */

export function BudgetTabContent({ featureMap, defs }: {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}) {
  return (
    <div className="space-y-4">
      <BudgetTab featureMap={featureMap} defs={defs} />
    </div>
  );
}

/* Re-export for parent's typing convenience */
export type { SubModuleId };
