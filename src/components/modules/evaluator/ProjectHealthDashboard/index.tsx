'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Radar as RadarIcon } from 'lucide-react';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { Recommendation } from '@/types/evaluator';
import { EmptyState } from '@/components/ui/EmptyState';
import { EVAL_ACCENT, RADAR_R } from './constants';
import { polarToXY, scoreColor } from './helpers';
import type { ProjectHealthDashboardProps, RegressionAlert } from './types';
import { RegressionAlerts } from './RegressionAlerts';
import { HealthHeader } from './HealthHeader';
import { HealthRadarChart } from './HealthRadarChart';
import { SelectedModuleDetail } from './SelectedModuleDetail';
import { TopRecommendations } from './TopRecommendations';
import { ScanHistoryTimeline } from './ScanHistoryTimeline';

// ── Component ──

export function ProjectHealthDashboard({ onNavigateTab }: ProjectHealthDashboardProps) {
  const lastScan = useEvaluatorStore((s) => s.lastScan);
  const scanHistory = useEvaluatorStore((s) => s.scanHistory);
  const isScanning = useEvaluatorStore((s) => s.isScanning);
  const setScanning = useEvaluatorStore((s) => s.setScanning);
  const setLastScan = useEvaluatorStore((s) => s.setLastScan);
  const addScanToHistory = useEvaluatorStore((s) => s.addScanToHistory);

  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [showHistoryOverlay, setShowHistoryOverlay] = useState(false);
  const [regressionAlerts, setRegressionAlerts] = useState<RegressionAlert[]>([]);

  // ── Fix CLI session ──

  const fixCli = useModuleCLI({
    moduleId: 'ai-behavior', // evaluator doesn't have its own sub-module, use generic
    sessionKey: 'evaluator-fix',
    label: 'Evaluator Fix',
    accentColor: EVAL_ACCENT,
  });

  const handleFix = useCallback(
    (rec: Recommendation) => {
      const task = TaskFactory.askClaude('ai-behavior', rec.suggestedPrompt, 'Evaluator Fix');
      fixCli.execute(task);
    },
    [fixCli],
  );

  // ── Regression detection ──

  useEffect(() => {
    if (scanHistory.length < 2) return;
    const current = scanHistory[scanHistory.length - 1];
    const previous = scanHistory[scanHistory.length - 2];

    const alerts: RegressionAlert[] = [];

    // Overall score regression
    if (current.overallScore < previous.overallScore - 5) {
      alerts.push({
        id: 'overall',
        message: `Overall health dropped from ${previous.overallScore} → ${current.overallScore}`,
        severity: 'high',
      });
    }

    // Per-module regressions
    const prevMap = new Map(previous.moduleScores.map((m) => [m.moduleId, m.score]));
    for (const ms of current.moduleScores) {
      const prevScore = prevMap.get(ms.moduleId);
      if (prevScore != null && ms.score < prevScore - 10) {
        alerts.push({
          id: ms.moduleId,
          message: `${MODULE_LABELS[ms.moduleId] ?? ms.moduleId} dropped from ${prevScore} → ${ms.score}`,
          severity: ms.score < 40 ? 'critical' : 'medium',
        });
      }
    }

    // Always replace the alert set — including with an empty array — so stale
    // alerts clear once the underlying regression has recovered on a new scan.
    const raf = requestAnimationFrame(() => setRegressionAlerts(alerts));
    return () => cancelAnimationFrame(raf);
  }, [scanHistory]);

  const dismissAlert = useCallback((id: string) => {
    setRegressionAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

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

  return (
    <div className="space-y-5">
      {/* ── Regression alerts ── */}
      {regressionAlerts.length > 0 && (
        <RegressionAlerts regressionAlerts={regressionAlerts} dismissAlert={dismissAlert} />
      )}

      {/* ── Top row: Radial gauge + info + scan button ── */}
      <HealthHeader
        lastScan={lastScan}
        isScanning={isScanning}
        scanHistory={scanHistory}
        showHistoryOverlay={showHistoryOverlay}
        setShowHistoryOverlay={setShowHistoryOverlay}
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

      {/* ── Empty state ── */}
      {!lastScan && !isScanning && (
        <EmptyState
          icon={RadarIcon}
          title="No health data yet"
          description="Scan your project to generate a health radar with per-module scores, issues, and actionable recommendations."
          iconColor={EVAL_ACCENT}
          action={onNavigateTab ? {
            label: 'Review Features First',
            onClick: () => onNavigateTab('features'),
            color: EVAL_ACCENT,
          } : undefined}
        />
      )}
    </div>
  );
}
