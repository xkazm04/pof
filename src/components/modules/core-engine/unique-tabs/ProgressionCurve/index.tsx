'use client';

import { useMemo, useState, useCallback } from 'react';
import { TrendingUp, Settings2 } from 'lucide-react';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { BlueprintPanel, SectionHeader } from '../_design';
import { TabHeader, FeatureGrid, LoadingSpinner } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT, PROGRESSION_FEATURES, generateChartData } from './data';

/* -- Sub-section components ------------------------------------------------ */

import { MainChartArea } from './MainChartArea';
import { CurveParametersPanel } from './CurveParametersPanel';
import { MilestoneTimeline } from './MilestoneTimeline';
import { MultiCurveOverlay } from './MultiCurveOverlay';
import { BuildPathComparison } from './BuildPathComparison';
import { XpSourceBreakdown } from './XpSourceBreakdown';
import { LevelUpRewardPreview } from './LevelUpRewardPreview';
import { TimeToLevelEstimator } from './TimeToLevelEstimator';
import { PowerCurveDangerZones } from './PowerCurveDangerZones';
import { DiminishingReturnsVisualizer } from './DiminishingReturnsVisualizer';
import { AchievementBoard } from './AchievementBoard';
import { RestXpSystem } from './RestXpSystem';

/* Components still in legacy progression/ folder */
import { EncounterTTKSimulator } from '../progression/EncounterTTKSimulator';
import { PrestigePreview } from '../progression/PrestigePreview';
import { XpTableGenerator } from '../progression/XpTableGenerator';
import { DRCodeGenerator } from '../progression/DRCodeGenerator';

/* -- Component ------------------------------------------------------------- */

interface ProgressionCurveProps {
  moduleId: SubModuleId;
}

export function ProgressionCurve({ moduleId }: ProgressionCurveProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

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

      <MultiCurveOverlay />
      <BuildPathComparison />
      <XpSourceBreakdown />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LevelUpRewardPreview />
        <TimeToLevelEstimator />
      </div>

      <PowerCurveDangerZones />
      <EncounterTTKSimulator />
      <DiminishingReturnsVisualizer />
      <AchievementBoard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RestXpSystem />
        <PrestigePreview />
      </div>

      <XpTableGenerator baseXp={baseXp} curveExp={curveExp} />
      <DRCodeGenerator />
    </div>
  );
}
