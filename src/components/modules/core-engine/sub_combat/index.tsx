'use client';

import { useMemo, useState, useCallback } from 'react';
import { Swords, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import type { SubModuleId } from '@/types/modules';
import { TabHeader, LoadingSpinner } from '../unique-tabs/_shared';
import type { SubTab } from '../unique-tabs/_shared';
import { VisibleSection } from '../unique-tabs/VisibleSection';
import { ACCENT, FEEDBACK_PARAMS, COMBAT_SUBTABS, type CombatSubtab } from './_shared/data';
import type { FeedbackPreset } from './_shared/data';
import { FlowTab } from './flow/FlowTab';
import { HitsTab } from './hits/HitsTab';
import { FeedbackTab } from './polish/FeedbackTab';
import { MetricsTab } from './metrics/MetricsTab';
import { renderCombatMetric } from './metrics';
import { AttributeDefaultsTab } from './attributes/AttributeDefaultsTab';
import FeatureMapTab from '../unique-tabs/FeatureMapTab';
import { NarrativeBreadcrumb, CombatSubTabNav, getActiveSubtitle } from './CombatNav';

interface CombatActionMapProps {
  moduleId: SubModuleId;
}

export function CombatActionMap({ moduleId }: CombatActionMapProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState<CombatSubtab>('flow');
  const [expanded, setExpanded] = useState<string | null>(null);

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    ...COMBAT_SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon })),
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

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <div className="space-y-4">
      <TabHeader icon={Swords} title="Combat Action Map" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* ── Narrative Breadcrumb ─────────────────────────────────────────── */}
      <NarrativeBreadcrumb activeTab={activeTab} onNavigate={setActiveTab} />

      {/* ── Sub-Tab Navigation ────────────────────────────────────────────── */}
      <CombatSubTabNav
        tabs={tabs}
        activeTabId={activeTab}
        onChange={(id) => setActiveTab(id as CombatSubtab)}
      />

      {/* ── Active Tab Subtitle ──────────────────────────────────────────── */}
      {subtitle && <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>}

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      <div className="relative min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderCombatMetric} />}
            {activeTab === 'flow' && (
              <VisibleSection moduleId={moduleId} sectionId="lanes">
                <FlowTab featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} />
              </VisibleSection>
            )}
            {activeTab === 'hits' && (
              <VisibleSection moduleId={moduleId} sectionId="traces">
                <HitsTab />
              </VisibleSection>
            )}
            {activeTab === 'metrics' && (
              <VisibleSection moduleId={moduleId} sectionId="dps">
                <MetricsTab />
              </VisibleSection>
            )}
            {activeTab === 'feedback' && (
              <VisibleSection moduleId={moduleId} sectionId="feedback-tuner">
                <FeedbackTab
                  feedbackValues={feedbackValues}
                  juiceLevel={juiceLevel}
                  onPreset={applyPreset}
                  onParam={updateFeedbackParam}
                />
              </VisibleSection>
            )}
            {activeTab === 'attributes' && (
              <VisibleSection moduleId={moduleId} sectionId="attribute-defaults">
                <AttributeDefaultsTab />
              </VisibleSection>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
