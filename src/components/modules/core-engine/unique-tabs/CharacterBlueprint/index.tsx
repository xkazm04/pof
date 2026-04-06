'use client';

import { useMemo, useState, useCallback } from 'react';
import { User, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, FeatureGrid, LoadingSpinner, SubTabNavigation, type SubTab } from '../_shared';
import { CharacterFeelOptimizer } from '../CharacterFeelOptimizer';
import FeatureMapTab from '../FeatureMapTab';
import { CharacterFeelPlayground } from '../CharacterFeelPlayground';
import { PredictiveBalanceSimulator } from '../PredictiveBalanceSimulator';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import type { SubModuleId } from '@/types/modules';
import {
  ACCENT, SUBTABS, CHARACTER_FEATURES, COMPARISON_CHARACTERS,
  computeBalanceScores, type BlueprintSubtab, type SelectableCharacter,
} from './data';
import { getCharacterMetric } from './metrics';
import { VisibleSection } from '../VisibleSection';
import { BlueprintPanel, SectionHeader } from './design';
import { ClassHierarchy } from './overview/ClassHierarchy';
import { CameraProfileComparison } from './overview/CameraProfileComparison';
import { CharacterScalingPreview } from './overview/CharacterScalingPreview';
import { HitboxWireframeViewer } from './overview/HitboxWireframeViewer';
import { PropertyInspector } from './overview/PropertyInspector';
import { InputBindingsTable } from './input/InputBindingsTable';
import { KeyboardVisualization } from './input/KeyboardVisualization';
import { MovementOverview } from './movement/MovementOverview';
import { DodgeTrajectorySection } from './movement/DodgeTrajectorySection';
import { ComparisonMatrix } from './simulator/ComparisonMatrix';
import { ArchetypeBalanceRadar } from './simulator/ArchetypeBalanceRadar';
import { AbilityQuickPicker } from './input/AbilityQuickPicker';
import { withOpacity, OPACITY_8, OPACITY_10, OPACITY_22 } from '@/lib/chart-colors';

/* ── Narrative Breadcrumb ──────────────────────────────────────────────── */

const FEATURES_STEP = { key: 'features' as BlueprintSubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: BlueprintSubtab; onNavigate: (tab: BlueprintSubtab) => void }) {
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

/* ── Active tab subtitle ──────────────────────────────────────────────── */

function getActiveSubtitle(tab: BlueprintSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

interface CharacterBlueprintProps {
  moduleId: SubModuleId;
}

export function CharacterBlueprint({ moduleId }: CharacterBlueprintProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);

  const [activeTab, setActiveTab] = useState<BlueprintSubtab>('overview');
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  /* ── Comparison tab state ─────────────────────────────────────────────── */
  const [comparisonIds, setComparisonIds] = useState<string[]>(
    () => COMPARISON_CHARACTERS.slice(0, 2).map(c => c.id),
  );
  const comparisonChars = useMemo(() => {
    const idSet = new Set(comparisonIds);
    return COMPARISON_CHARACTERS.filter(c => idSet.has(c.id));
  }, [comparisonIds]);
  const balanceResults = useMemo(
    () => computeBalanceScores(comparisonChars),
    [comparisonChars],
  );
  const scoreMean = useMemo(() => {
    if (balanceResults.length === 0) return 0;
    return balanceResults.reduce((a, b) => a + b.compositeScore, 0) / balanceResults.length;
  }, [balanceResults]);

  /* ── Overview character picker state ──────────────────────────────────── */
  const [overviewCharId, setOverviewCharId] = useState<string | null>(null);
  const [overviewPickerOpen, setOverviewPickerOpen] = useState(false);
  const overviewChar = useMemo(
    () => overviewCharId ? COMPARISON_CHARACTERS.find(c => c.id === overviewCharId) ?? null : null,
    [overviewCharId],
  );

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-5">
      <TabHeader icon={User} title="Character Blueprint" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* ── Narrative Breadcrumb ─────────────────────────────────────────── */}
      <NarrativeBreadcrumb activeTab={activeTab} onNavigate={setActiveTab} />

      {/* ── Sub-Tab Navigation (unified) ──────────────────────────────────── */}
      <SubTabNavigation
        tabs={[{ id: 'features', label: 'Features', icon: LayoutGrid } as SubTab, ...SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon } as SubTab))]}
        activeTabId={activeTab}
        onChange={(id) => setActiveTab(id as BlueprintSubtab)}
        accent={ACCENT}
      />

      {/* ── Active Tab Subtitle ──────────────────────────────────────────── */}
      {(() => { const sub = getActiveSubtitle(activeTab); return sub ? <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{sub}</p> : null; })()}

      {/* ── Tab Content with Animated Transitions ─────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={getCharacterMetric} />}

          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* ── Character Picker ──────────────────────────────────────── */}
              <BlueprintPanel color={ACCENT} className="p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setOverviewPickerOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono font-bold border border-dashed border-border/50 text-text-muted hover:text-text hover:border-border transition-colors cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                    {overviewChar ? overviewChar.name : 'Select Character'}
                  </button>
                  {overviewChar && (
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: overviewChar.color }} />
                      <span className="px-1.5 py-0.5 rounded border text-xs font-bold"
                        style={{ color: overviewChar.color, borderColor: withOpacity(overviewChar.color, OPACITY_22), backgroundColor: withOpacity(overviewChar.color, OPACITY_8) }}>
                        {overviewChar.category}
                      </span>
                      <span className="text-text-muted capitalize">{overviewChar.tier}</span>
                      <span className="text-text-muted">{overviewChar.area}</span>
                    </div>
                  )}
                </div>
              </BlueprintPanel>
              <ScalableSelector<SelectableCharacter>
                items={COMPARISON_CHARACTERS}
                groupBy="area"
                renderItem={(item: SelectableCharacter, sel: boolean) => (
                  <div className={`flex items-center gap-2 px-2 py-1.5 text-xs font-mono transition-all ${sel ? 'font-bold' : 'opacity-60'}`}
                    style={sel ? { color: item.color } : { color: 'var(--text-muted)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                    <span className="text-[9px] text-text-muted ml-auto">{item.category}</span>
                  </div>
                )}
                onSelect={(items: SelectableCharacter[]) => setOverviewCharId(items[0]?.id ?? null)}
                selected={overviewCharId ? [overviewCharId] : []}
                searchKey="name"
                mode="single"
                open={overviewPickerOpen}
                onClose={() => setOverviewPickerOpen(false)}
                title="Select Character"
                accent={ACCENT}
              />

              <VisibleSection moduleId={moduleId} sectionId="class-hierarchy">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <ClassHierarchy />
                  <CameraProfileComparison />
                </div>
              </VisibleSection>
              <BlueprintPanel color={ACCENT} className="p-4">
                <SectionHeader label="Architectural Components" />
                <FeatureGrid featureNames={CHARACTER_FEATURES} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} accent={ACCENT} />
              </BlueprintPanel>
              <VisibleSection moduleId={moduleId} sectionId="scaling">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <CharacterScalingPreview />
                  <HitboxWireframeViewer />
                </div>
              </VisibleSection>
              <VisibleSection moduleId={moduleId} sectionId="properties">
                <PropertyInspector />
              </VisibleSection>
            </div>
          )}

          {activeTab === 'input' && (
            <VisibleSection moduleId={moduleId} sectionId="bindings">
              <div className="space-y-5">
                <InputBindingsTable featureMap={featureMap} />
                <KeyboardVisualization />
                <AbilityQuickPicker />
              </div>
            </VisibleSection>
          )}

          {activeTab === 'movement' && (
            <VisibleSection moduleId={moduleId} sectionId="states">
              <div className="space-y-5">
                <MovementOverview />
                <DodgeTrajectorySection />
              </div>
            </VisibleSection>
          )}

          {activeTab === 'playground' && <CharacterFeelPlayground />}
          {activeTab === 'ai-feel' && <CharacterFeelOptimizer moduleId={moduleId} />}

          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <ComparisonMatrix
                selected={comparisonIds}
                onSelectionChange={setComparisonIds}
              />
              <ArchetypeBalanceRadar balanceResults={balanceResults} scoreMean={scoreMean} />
              <PredictiveBalanceSimulator />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
