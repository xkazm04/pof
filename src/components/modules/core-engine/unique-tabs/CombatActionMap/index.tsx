'use client';

import { useMemo, useState, useCallback } from 'react';
import { Swords, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import type { SubModuleId } from '@/types/modules';
import { TabHeader, LoadingSpinner } from '../_shared';
import type { SubTab } from '../_shared';
import { VisibleSection } from '../VisibleSection';
import { ACCENT, FEEDBACK_PARAMS, COMBAT_SUBTABS, type CombatSubtab } from './data';
import type { FeedbackPreset } from './data';
import { FlowTab } from './flow/FlowTab';
import { HitsTab } from './hits/HitsTab';
import { FeedbackTab } from './polish/FeedbackTab';
import { MetricsTab } from './metrics/MetricsTab';
import { renderCombatMetric } from './metrics';
import { AttributeDefaultsTab } from './attributes/AttributeDefaultsTab';
import FeatureMapTab from '../FeatureMapTab';

/* ── Narrative Breadcrumb ──────────────────────────────────────────────── */

const FEATURES_STEP = { key: 'features' as CombatSubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...COMBAT_SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: CombatSubtab; onNavigate: (tab: CombatSubtab) => void }) {
  const activeIdx = NARRATIVE_STEPS.findIndex(s => s.key === activeTab);
  return (
    <div className="flex items-center gap-0.5 text-[10px] font-mono tracking-wide overflow-x-auto custom-scrollbar pb-0.5">
      {NARRATIVE_STEPS.map((step, i) => {
        const isPast = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-shrink-0">
            {i > 0 && <span className="text-text-muted/40 mx-0.5">{'>'}</span>}
            <button
              onClick={() => onNavigate(step.key)}
              className="px-1.5 py-0.5 rounded transition-all cursor-pointer"
              style={{
                color: isActive ? ACCENT : isPast ? withOpacity(ACCENT, '99') : 'var(--text-muted)',
                backgroundColor: isActive ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
                fontWeight: isActive ? 700 : isPast ? 600 : 400,
                opacity: !isActive && !isPast ? 0.5 : 1,
              }}
            >
              {step.narrative}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── Sub-Tab Navigation (local copy of shared SubTabNavigation, with testIds) ── */

function CombatSubTabNav({
  tabs,
  activeTabId,
  onChange,
}: {
  tabs: SubTab[];
  activeTabId: string;
  onChange: (id: string) => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex gap-1 mb-2 border-b border-border/40 pb-1.5 overflow-x-auto custom-scrollbar">
      {tabs.map(tab => {
        const isActive = activeTabId === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            data-testid={`pof-module-arpg-combat-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`
              relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold
              transition-all duration-300 focus:outline-none whitespace-nowrap
              ${isActive ? 'text-white' : 'text-text-muted hover:text-text hover:bg-surface/50'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeCombatSubTabBg"
                className="absolute inset-0 rounded-lg opacity-20"
                style={{ backgroundColor: ACCENT }}
                transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
            {Icon && (
              <Icon
                className="w-3.5 h-3.5 relative z-10 transition-colors duration-300"
                style={{ color: isActive ? ACCENT : 'currentColor' }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Active tab subtitle ──────────────────────────────────────────────── */

function getActiveSubtitle(tab: CombatSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = COMBAT_SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

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
