'use client';

import { useMemo, useState, useCallback } from 'react';
import { Swords, GitBranch, Crosshair, Gauge, Activity } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import type { SubModuleId } from '@/types/modules';
import { TabHeader, LoadingSpinner, SubTabNavigation } from '../_shared';
import type { SubTab } from '../_shared';
import { ACCENT, FEEDBACK_PARAMS } from './data';
import type { FeedbackPreset } from './data';
import { FlowTab } from './FlowTab';
import { HitsTab } from './HitsTab';
import { FeedbackTab } from './FeedbackTab';
import { MetricsTab } from './MetricsTab';

interface CombatActionMapProps {
  moduleId: SubModuleId;
}

export function CombatActionMap({ moduleId }: CombatActionMapProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState('flow');
  const [expanded, setExpanded] = useState<string | null>(null);

  const tabs: SubTab[] = useMemo(() => [
    { id: 'flow', label: 'Flow & Sequences', icon: GitBranch },
    { id: 'hits', label: 'Analysis & Hits', icon: Crosshair },
    { id: 'feedback', label: 'Polish & Tuner', icon: Gauge },
    { id: 'metrics', label: 'Combat Metrics', icon: Activity },
  ], []);

  const [feedbackValues, setFeedbackValues] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    for (const p of FEEDBACK_PARAMS) defaults[p.id] = p.defaultValue;
    return defaults;
  });

  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  const juiceLevel = useMemo(() => {
    let total = 0;
    for (const p of FEEDBACK_PARAMS) {
      const norm = (feedbackValues[p.id] - p.min) / (p.max - p.min);
      total += norm;
    }
    return total / FEEDBACK_PARAMS.length;
  }, [feedbackValues]);

  const applyPreset = useCallback((preset: FeedbackPreset) => {
    setFeedbackValues({ ...preset.values });
  }, []);

  const updateFeedbackParam = useCallback((id: string, value: number) => {
    setFeedbackValues(prev => ({ ...prev, [id]: value }));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Swords} title="Combat Action Map" implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <div className="mt-4 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'flow' && (
            <FlowTab featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} />
          )}
          {activeTab === 'hits' && <HitsTab />}
          {activeTab === 'feedback' && (
            <FeedbackTab
              feedbackValues={feedbackValues}
              juiceLevel={juiceLevel}
              onPreset={applyPreset}
              onParam={updateFeedbackParam}
            />
          )}
          {activeTab === 'metrics' && <MetricsTab />}
        </AnimatePresence>
      </div>
    </div>
  );
}
