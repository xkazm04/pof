'use client';

import { useMemo, useState } from 'react';
import { Activity, Play, RefreshCw, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, LoadingSpinner, HeatmapGrid, SubTabNavigation, type SubTab } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT, HEATMAP_STATE_NAMES, HEATMAP_CELLS } from './data';
import { BlueprintPanel, SectionHeader } from '../_design';
import { StateMachinePanel } from './StateMachinePanel';
import { BlendSpacePanel } from './BlendSpacePanel';
import { StateDurationPanel } from './StateDurationPanel';
import { ResponsivenessAnalyzer } from './ResponsivenessAnalyzer';
import { ComboTimelinePanel } from './ComboTimelinePanel';
import { ComboChainPanel } from './ComboChainPanel';
import { FrameScrubberPanel } from './FrameScrubberPanel';
import { EventTimelinePanel } from './EventTimelinePanel';
import { RetargetingTab } from './RetargetingTab';
import { BudgetTab } from './BudgetTab';

interface AnimationStateGraphProps {
  moduleId: SubModuleId;
}

const ENTER = { opacity: 0, y: 10 } as const;
const VISIBLE = { opacity: 1, y: 0 } as const;
const EXIT = { opacity: 0, y: -10 } as const;
const TRANSITION = { duration: 0.2 } as const;

export function AnimationStateGraph({ moduleId }: AnimationStateGraphProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState('state-graph');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'state-graph', label: 'State Graph & Transitions', icon: Activity },
    { id: 'combos-montages', label: 'Combos & Montages', icon: Play },
    { id: 'retargeting', label: 'Retargeting & Trajectories', icon: RefreshCw },
    { id: 'budget', label: 'Budget & Assets', icon: Cpu },
  ], []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Activity} title="Animation State Graph" implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <div className="mt-4 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'state-graph' && (
            <motion.div key="state-graph" initial={ENTER} animate={VISIBLE} exit={EXIT} transition={TRANSITION} className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <StateMachinePanel featureMap={featureMap} />
                <BlendSpacePanel />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <BlueprintPanel color={ACCENT} className="p-4">
                  <SectionHeader label="State Transition Heatmap" color={ACCENT} />
                  <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
                    Normalized transition frequency between animation states. Brighter cells indicate more frequent transitions.
                  </p>
                  <HeatmapGrid rows={HEATMAP_STATE_NAMES} cols={HEATMAP_STATE_NAMES} cells={HEATMAP_CELLS} accent={ACCENT} />
                </BlueprintPanel>
                <StateDurationPanel />
              </div>
              <ResponsivenessAnalyzer />
            </motion.div>
          )}
          {activeTab === 'combos-montages' && (
            <motion.div key="combos-montages" initial={ENTER} animate={VISIBLE} exit={EXIT} transition={TRANSITION} className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ComboTimelinePanel />
                <ComboChainPanel />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <FrameScrubberPanel />
                <EventTimelinePanel />
              </div>
            </motion.div>
          )}
          {activeTab === 'retargeting' && (
            <motion.div key="retargeting" initial={ENTER} animate={VISIBLE} exit={EXIT} transition={TRANSITION} className="space-y-4">
              <RetargetingTab />
            </motion.div>
          )}
          {activeTab === 'budget' && (
            <motion.div key="budget" initial={ENTER} animate={VISIBLE} exit={EXIT} transition={TRANSITION} className="space-y-4">
              <BudgetTab featureMap={featureMap} defs={defs} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
