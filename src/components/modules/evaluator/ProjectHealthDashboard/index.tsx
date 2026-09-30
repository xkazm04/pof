'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Radar as RadarIcon } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { generateFixPlan } from '@/lib/evaluator/fix-plan-generator';
import { MODULE_LABELS } from '@/lib/module-registry';
import { logger } from '@/lib/logger';
import type { Recommendation } from '@/types/evaluator';
import type { SubModuleId } from '@/types/modules';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { EVAL_ACCENT, RADAR_R } from './constants';
import { polarToXY, scoreColor } from './helpers';
import type { ProjectHealthDashboardProps } from './types';
import { useScannerFeed } from './useScannerFeed';
import { RegressionAlerts } from './RegressionAlerts';
import { HealthHeader } from './HealthHeader';
import { HealthRadarChart } from './HealthRadarChart';
import { SelectedModuleDetail } from './SelectedModuleDetail';
import { TopRecommendations } from './TopRecommendations';
import { ScanHistoryTimeline } from './ScanHistoryTimeline';

/** Session module before any Fix is clicked (no prompt is sent until one is). */
const IDLE_FIX_MODULE: SubModuleId = 'ai-behavior';

interface FixTarget {
  moduleId: SubModuleId;
  prompt: string;
  seq: number;
}

// ── Component ──

export function ProjectHealthDashboard({ onNavigateTab }: ProjectHealthDashboardProps) {
  // The durable deep-eval history (evaluator_results), projected into reports.
  const feed = useScannerFeed();
  const lastScan = feed.latest;
  const scanHistory = feed.reports;

  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [showHistoryOverlay, setShowHistoryOverlay] = useState(false);
  const [dismissed, setDismissed] = useState<{ scanId: string | null; ids: string[] }>({ scanId: null, ids: [] });

  // ── Fix CLI session — on the finding's OWN module ──

  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const fixModule = fixTarget?.moduleId ?? IDLE_FIX_MODULE;
  const fixCli = useModuleCLI({
    moduleId: fixModule,
    sessionKey: `evaluator-fix:${fixModule}`,
    label: `Fix · ${MODULE_LABELS[fixModule] ?? fixModule}`,
    accentColor: EVAL_ACCENT,
  });

  const handleFix = useCallback(
    (rec: Recommendation) => {
      const finding = feed.findingsById.get(rec.id);
      if (!finding) {
        logger.warn(`[scanner] no finding ${rec.id} in the newest scan — Fix skipped`);
        return;
      }
      const { projectName, projectPath, ueVersion } = useProjectStore.getState();
      const plan = generateFixPlan(finding, { projectName, projectPath, ueVersion });
      setFixTarget((prev) => ({ moduleId: finding.moduleId, prompt: plan.prompt, seq: (prev?.seq ?? 0) + 1 }));
    },
    [feed.findingsById],
  );

  // Dispatch once the CLI hook is bound to the target's module (the render after
  // the click), so the session the prompt lands in belongs to that module.
  const sentSeq = useRef(0);
  useEffect(() => {
    if (!fixTarget || fixTarget.seq === sentSeq.current) return;
    sentSeq.current = fixTarget.seq;
    fixCli.sendPrompt(fixTarget.prompt);
  }, [fixTarget, fixCli]);

  // ── Regression alerts (fingerprint diff of the two newest scans) ──

  const regressionAlerts = useMemo(() => {
    const hidden = dismissed.scanId === lastScan?.id ? new Set(dismissed.ids) : new Set<string>();
    return feed.alerts.filter((a) => !hidden.has(a.id));
  }, [feed.alerts, dismissed, lastScan?.id]);

  const dismissAlert = useCallback(
    (id: string) => {
      const scanId = lastScan?.id ?? null;
      setDismissed((prev) => ({ scanId, ids: [...(prev.scanId === scanId ? prev.ids : []), id] }));
    },
    [lastScan?.id],
  );

  // ── Radar data ──

  const radarData = useMemo(() => {
    if (!lastScan || lastScan.moduleScores.length === 0) return null;
    const scores = lastScan.moduleScores;
    const angleStep = 360 / scores.length;
    return scores.map((ms, i) => ({
      ...ms,
      angle: i * angleStep,
      label: MODULE_LABELS[ms.moduleId] ?? ms.moduleId,
    }));
  }, [lastScan]);

  // Previous scan for overlay
  const prevRadarData = useMemo(() => {
    if (!showHistoryOverlay || scanHistory.length < 2) return null;
    const prev = scanHistory[scanHistory.length - 2];
    if (!prev || prev.moduleScores.length === 0) return null;
    const scores = prev.moduleScores;
    const angleStep = 360 / scores.length;
    return scores.map((ms, i) => ({
      ...ms,
      angle: i * angleStep,
    }));
  }, [showHistoryOverlay, scanHistory]);

  // Build the radar polygon path
  const radarPath = useMemo(() => {
    if (!radarData) return '';
    return radarData
      .map((d) => {
        const r = (d.score / 100) * RADAR_R;
        const { x, y } = polarToXY(d.angle, r);
        return `${x},${y}`;
      })
      .join(' ');
  }, [radarData]);

  const prevRadarPath = useMemo(() => {
    if (!prevRadarData) return '';
    return prevRadarData
      .map((d) => {
        const r = (d.score / 100) * RADAR_R;
        const { x, y } = polarToXY(d.angle, r);
        return `${x},${y}`;
      })
      .join(' ');
  }, [prevRadarData]);

  // ── Selected module detail ──

  const selectedDetail = useMemo(() => {
    if (!selectedModule || !lastScan) return null;
    const ms = lastScan.moduleScores.find((m) => m.moduleId === selectedModule);
    const recs = lastScan.recommendations.filter((r) => r.moduleId === selectedModule);
    return ms ? { ...ms, recommendations: recs, label: MODULE_LABELS[ms.moduleId] ?? ms.moduleId } : null;
  }, [selectedModule, lastScan]);

  // ── Health pulse (based on overall score) ──

  const healthPulseColor = lastScan
    ? scoreColor(lastScan.overallScore)
    : 'var(--text-muted)';

  const runDeepEval = onNavigateTab ? () => onNavigateTab('deep-eval') : undefined;

  return (
    <div className="space-y-5">
      {/* ── Load failure — never read as "never scanned" ── */}
      {feed.error !== null && (
        <div className="space-y-1">
          <InlineErrorRetry message="Couldn't load scan history" onRetry={feed.retry} />
          <p className="text-2xs text-text-muted">{feed.error}</p>
        </div>
      )}

      {/* ── Regression alerts ── */}
      {regressionAlerts.length > 0 && (
        <RegressionAlerts regressionAlerts={regressionAlerts} dismissAlert={dismissAlert} />
      )}

      {/* ── Top row: Radial gauge + info + Deep Eval door ── */}
      <HealthHeader
        lastScan={lastScan}
        isLoading={feed.loading}
        scanHistory={scanHistory}
        showHistoryOverlay={showHistoryOverlay}
        setShowHistoryOverlay={setShowHistoryOverlay}
        onRunDeepEval={runDeepEval}
      />

      {/* ── Radar Chart ── */}
      {lastScan && radarData && radarData.length > 0 && (
        <HealthRadarChart
          lastScan={lastScan}
          radarData={radarData}
          prevRadarData={prevRadarData}
          radarPath={radarPath}
          prevRadarPath={prevRadarPath}
          showHistoryOverlay={showHistoryOverlay}
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          healthPulseColor={healthPulseColor}
        />
      )}

      {/* ── Selected module detail ── */}
      {selectedDetail && (
        <SelectedModuleDetail
          selectedDetail={selectedDetail}
          setSelectedModule={setSelectedModule}
          handleFix={handleFix}
          fixCli={fixCli}
          scanHistory={scanHistory}
        />
      )}

      {/* ── All Recommendations (when no module selected) ── */}
      {!selectedModule && lastScan && lastScan.recommendations.length > 0 && (
        <TopRecommendations lastScan={lastScan} handleFix={handleFix} fixCli={fixCli} />
      )}

      {/* ── Scan history timeline ── */}
      {scanHistory.length > 0 && (
        <ScanHistoryTimeline scanHistory={scanHistory} />
      )}

      {/* ── Empty state: the history loaded and holds no scan ── */}
      {!lastScan && !feed.loading && feed.error === null && (
        <EmptyState
          icon={RadarIcon}
          title="No health data yet"
          description="Health is scored from Deep Eval scans: run one to get per-module scores, issues, regressions and one-click fixes here."
          iconColor={EVAL_ACCENT}
          action={runDeepEval ? {
            label: 'Run Deep Eval',
            onClick: runDeepEval,
            color: EVAL_ACCENT,
          } : undefined}
        />
      )}
    </div>
  );
}
