'use client';

import { useMemo, useState, useCallback } from 'react';
import { TrendingUp, Settings2, LayoutGrid } from 'lucide-react';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { BlueprintPanel, SectionHeader } from '../_design';
import { TabHeader, FeatureGrid, LoadingSpinner, SubTabNavigation, type SubTab } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT, PROGRESSION_FEATURES, generateChartData } from './data';

/* -- Sub-section components ------------------------------------------------ */

import { MainChartArea } from './curves/MainChartArea';
import { CurveParametersPanel } from './curves/CurveParametersPanel';
import { MilestoneTimeline } from './curves/MilestoneTimeline';
import { MultiCurveOverlay } from './curves/MultiCurveOverlay';
import { BuildPathComparison } from './builds/BuildPathComparison';
import { XpSourceBreakdown } from './builds/XpSourceBreakdown';
import { LevelUpRewardPreview } from './rewards/LevelUpRewardPreview';
import { TimeToLevelEstimator } from './rewards/TimeToLevelEstimator';
import { PowerCurveDangerZones } from './analysis/PowerCurveDangerZones';
import { DiminishingReturnsVisualizer } from './analysis/DiminishingReturnsVisualizer';
import { AchievementBoard } from './rewards/AchievementBoard';
import { RestXpSystem } from './rewards/RestXpSystem';
import { BuildPresetPanel } from './builds/BuildPresetPanel';

/* Components still in legacy progression/ folder */
import { EncounterTTKSimulator } from '../progression/EncounterTTKSimulator';
import { PrestigePreview } from '../progression/PrestigePreview';
import { XpTableGenerator } from '../progression/XpTableGenerator';
import { DRCodeGenerator } from '../progression/DRCodeGenerator';
import FeatureMapTab from '../FeatureMapTab';
import { VisibleSection } from '../VisibleSection';

/* -- Component ------------------------------------------------------------- */

interface ProgressionCurveProps {
  moduleId: SubModuleId;
}

export function ProgressionCurve({ moduleId }: ProgressionCurveProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [activeBuild, setActiveBuild] = useState(0);
  const [activeTab, setActiveTab] = useState('curves');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    { id: 'curves', label: 'Curves' },
    { id: 'builds', label: 'Builds' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'analysis', label: 'Analysis' },
  ], []);

  /* Shared curve parameters */
  const [baseXp, setBaseXp] = useState(100);
  const [curveExp, setCurveExp] = useState(1.5);

  /* Compare mode state */
  const [compareMode, setCompareMode] = useState(false);
  const [snapshotBaseXp, setSnapshotBaseXp] = useState(100);
  const [snapshotCurveExp, setSnapshotCurveExp] = useState(1.5);

  const chartData = useMemo(() => generateChartData(baseXp, curveExp), [baseXp, curveExp]);
  const maxXp = chartData[chartData.length - 1]?.xp ?? 10000;

  const snapshotChartData = useMemo(
    () => compareMode ? generateChartData(snapshotBaseXp, snapshotCurveExp) : [],
    [compareMode, snapshotBaseXp, snapshotCurveExp],
  );
  const snapshotMaxXp = snapshotChartData[snapshotChartData.length - 1]?.xp ?? 10000;
  const sharedMaxXp = compareMode ? Math.max(maxXp, snapshotMaxXp) : maxXp;

  const toggleCompare = useCallback(() => {
    setCompareMode((prev) => {
      if (!prev) {
        setSnapshotBaseXp(baseXp);
        setSnapshotCurveExp(curveExp);
      }
      return !prev;
    });
  }, [baseXp, curveExp]);

  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      <TabHeader icon={TrendingUp} title="Progression Curve" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} />}

      {activeTab === 'curves' && (
        <VisibleSection moduleId={moduleId} sectionId="chart">
          {/* Main chart + curve parameters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MainChartArea
              chartData={chartData}
              maxXp={maxXp}
              sharedMaxXp={sharedMaxXp}
              compareMode={compareMode}
              baseXp={baseXp}
              curveExp={curveExp}
              snapshotChartData={snapshotChartData}
              snapshotBaseXp={snapshotBaseXp}
              snapshotCurveExp={snapshotCurveExp}
            />
            <CurveParametersPanel
              baseXp={baseXp}
              curveExp={curveExp}
              compareMode={compareMode}
              snapshotBaseXp={snapshotBaseXp}
              snapshotCurveExp={snapshotCurveExp}
              onBaseXpChange={setBaseXp}
              onCurveExpChange={setCurveExp}
              onToggleCompare={toggleCompare}
            />
          </div>

          <MultiCurveOverlay />

          {/* Milestone timeline + feature grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MilestoneTimeline />
            <BlueprintPanel color={ACCENT} className="p-3">
              <SectionHeader label="System Integration Status" icon={Settings2} color={ACCENT} />
              <FeatureGrid
                featureNames={PROGRESSION_FEATURES}
                featureMap={featureMap}
                defs={defs}
                expanded={expandedAsset}
                onToggle={toggleAsset}
                accent={ACCENT}
              />
            </BlueprintPanel>
          </div>
        </VisibleSection>
      )}

      {activeTab === 'builds' && (
        <VisibleSection moduleId={moduleId} sectionId="presets">
          <BuildPresetPanel activeBuild={activeBuild} setActiveBuild={setActiveBuild} />

          <BuildPathComparison />
          <XpSourceBreakdown />
          <XpTableGenerator baseXp={baseXp} curveExp={curveExp} />
        </VisibleSection>
      )}

      {activeTab === 'rewards' && (
        <VisibleSection moduleId={moduleId} sectionId="milestones">
          <AchievementBoard />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LevelUpRewardPreview />
            <TimeToLevelEstimator />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RestXpSystem />
            <PrestigePreview />
          </div>
        </VisibleSection>
      )}

      {activeTab === 'analysis' && (
        <VisibleSection moduleId={moduleId} sectionId="danger-zones">
          <PowerCurveDangerZones />
          <DiminishingReturnsVisualizer />
          <EncounterTTKSimulator />
          <DRCodeGenerator />
        </VisibleSection>
      )}
    </div>
  );
}
