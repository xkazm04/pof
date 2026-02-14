'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Radar as RadarIcon,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  TrendingDown,
  TrendingUp,
  Zap,
  X,
} from 'lucide-react';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { EvaluatorReport, ModuleScore, Recommendation } from '@/types/evaluator';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

const EVAL_ACCENT = '#ef4444';

// ── Score → color ──

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#fb923c';
  return '#f87171';
}

function scoreBg(score: number): string {
  if (score >= 80) return '#4ade8012';
  if (score >= 60) return '#fbbf2412';
  if (score >= 40) return '#fb923c12';
  return '#f8717112';
}

// ── Priority color ──

const PRIORITY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: '#f87171', bg: '#f8717112', border: '#f8717125' },
  high: { text: '#fb923c', bg: '#fb923c12', border: '#fb923c25' },
  medium: { text: '#fbbf24', bg: '#fbbf2412', border: '#fbbf2425' },
  low: { text: 'var(--text-muted)', bg: 'var(--text-muted)12', border: 'var(--text-muted)25' },
};

// ── Radar chart geometry helpers ──

const RADAR_CX = 160;
const RADAR_CY = 140;
const RADAR_R = 110;
const RADAR_RINGS = 5; // 20, 40, 60, 80, 100

function polarToXY(angle: number, radius: number): { x: number; y: number } {
  // Start from top (-90°), go clockwise
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: RADAR_CX + Math.cos(rad) * radius,
    y: RADAR_CY + Math.sin(rad) * radius,
  };
}

// ── Component ──

export function ProjectHealthDashboard() {
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

    if (alerts.length > 0) {
      setRegressionAlerts(alerts);
    }
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
        <div className="space-y-2">
          {regressionAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
              style={{
                backgroundColor: PRIORITY_COLORS[alert.severity]?.bg ?? '#f8717112',
                borderColor: PRIORITY_COLORS[alert.severity]?.border ?? '#f8717125',
              }}
            >
              <TrendingDown className="w-4 h-4 flex-shrink-0" style={{ color: PRIORITY_COLORS[alert.severity]?.text ?? '#f87171' }} />
              <span className="text-xs text-text flex-1">{alert.message}</span>
              <span
                className="text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  color: PRIORITY_COLORS[alert.severity]?.text,
                  backgroundColor: PRIORITY_COLORS[alert.severity]?.bg,
                }}
              >
                Regression
              </span>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="p-0.5 rounded hover:bg-[#ffffff10] transition-colors"
              >
                <X className="w-3 h-3 text-text-muted" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Top row: Radial gauge + info + scan button ── */}
      <div className="flex items-center gap-5">
        {/* Radial Score Gauge */}
        <div className="flex-shrink-0">
          <RadialScoreGauge score={lastScan?.overallScore ?? null} isScanning={isScanning} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text">
            {lastScan ? 'Project Health' : 'No scans yet'}
          </h3>
          {lastScan ? (
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
              {lastScan.summary}
            </p>
          ) : (
            <p className="text-xs text-text-muted mt-0.5">
              Run a scan to analyze your UE5 project structure, code quality, and systems.
            </p>
          )}
          {lastScan && (
            <p className="text-2xs text-[#4a4e6a] mt-1">
              {new Date(lastScan.timestamp).toLocaleString()} · {lastScan.moduleScores.length} modules · {lastScan.recommendations.length} recommendations
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            disabled={isScanning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${EVAL_ACCENT}12`,
              color: EVAL_ACCENT,
              border: `1px solid ${EVAL_ACCENT}25`,
            }}
            title="Scan functionality requires CLI integration"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Scan Project
              </>
            )}
          </button>
          {scanHistory.length >= 2 && (
            <button
              onClick={() => setShowHistoryOverlay(!showHistoryOverlay)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                showHistoryOverlay
                  ? 'bg-[#8b5cf620] text-[#8b5cf6] border border-[#8b5cf625]'
                  : 'bg-surface text-text-muted border border-border hover:text-text'
              }`}
            >
              {showHistoryOverlay ? 'Hide Previous' : 'Compare Previous'}
            </button>
          )}
        </div>
      </div>

      {/* ── Radar Chart ── */}
      {lastScan && radarData && radarData.length > 0 && (
        <SurfaceCard level={3} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <RadarIcon className="w-3.5 h-3.5 text-[#ef4444]" />
            <span className="text-xs font-semibold text-[#9ca0be] uppercase tracking-wider">
              Module Health Radar
            </span>
            {showHistoryOverlay && prevRadarData && (
              <span className="text-2xs text-[#8b5cf6] ml-auto">
                Purple = previous scan
              </span>
            )}
          </div>

          <svg
            viewBox={`0 0 ${RADAR_CX * 2} ${RADAR_CY * 2}`}
            className="w-full max-w-sm mx-auto"
            style={{ maxHeight: 300 }}
          >
            {/* Background rings */}
            {Array.from({ length: RADAR_RINGS }, (_, i) => {
              const r = ((i + 1) / RADAR_RINGS) * RADAR_R;
              return (
                <circle
                  key={i}
                  cx={RADAR_CX}
                  cy={RADAR_CY}
                  r={r}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={0.5}
                />
              );
            })}

            {/* Axis lines */}
            {radarData.map((d) => {
              const { x, y } = polarToXY(d.angle, RADAR_R);
              return (
                <line
                  key={`axis-${d.moduleId}`}
                  x1={RADAR_CX}
                  y1={RADAR_CY}
                  x2={x}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={0.5}
                />
              );
            })}

            {/* Previous scan overlay */}
            {showHistoryOverlay && prevRadarPath && (
              <polygon
                points={prevRadarPath}
                fill="#8b5cf610"
                stroke="#8b5cf650"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            )}

            {/* Current scan polygon */}
            <polygon
              points={radarPath}
              fill={`${EVAL_ACCENT}12`}
              stroke={`${EVAL_ACCENT}60`}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />

            {/* Module nodes (clickable) */}
            {radarData.map((d) => {
              const r = (d.score / 100) * RADAR_R;
              const { x, y } = polarToXY(d.angle, r);
              const labelPos = polarToXY(d.angle, RADAR_R + 16);
              const isSelected = selectedModule === d.moduleId;
              const color = scoreColor(d.score);

              return (
                <g key={d.moduleId} className="cursor-pointer" onClick={() => setSelectedModule(isSelected ? null : d.moduleId)}>
                  {/* Hit area */}
                  <circle cx={x} cy={y} r={12} fill="transparent" />
                  {/* Dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 5 : 4}
                    fill={isSelected ? color : `${color}80`}
                    stroke={isSelected ? color : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                  {/* Score badge on selected */}
                  {isSelected && (
                    <>
                      <rect
                        x={x - 12}
                        y={y - 20}
                        width={24}
                        height={14}
                        rx={4}
                        fill="var(--surface-deep)"
                        stroke={color}
                        strokeWidth={0.5}
                      />
                      <text
                        x={x}
                        y={y - 10}
                        textAnchor="middle"
                        className="text-2xs font-bold"
                        fill={color}
                      >
                        {d.score}
                      </text>
                    </>
                  )}
                  {/* Label */}
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-2xs font-medium"
                    fill={isSelected ? 'var(--text)' : 'var(--text-muted)'}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* Center score */}
            <text
              x={RADAR_CX}
              y={RADAR_CY - 6}
              textAnchor="middle"
              className="text-[18px] font-bold"
              fill={healthPulseColor}
            >
              {lastScan.overallScore}
            </text>
            <text
              x={RADAR_CX}
              y={RADAR_CY + 10}
              textAnchor="middle"
              className="text-2xs"
              fill="var(--text-muted)"
            >
              overall
            </text>
          </svg>
        </SurfaceCard>
      )}

      {/* ── Selected module detail ── */}
      {selectedDetail && (
        <SurfaceCard level={3} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: scoreColor(selectedDetail.score) }}
              />
              <span className="text-sm font-semibold text-text">{selectedDetail.label}</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{
                  color: scoreColor(selectedDetail.score),
                  backgroundColor: scoreBg(selectedDetail.score),
                }}
              >
                {selectedDetail.score}/100
              </span>
            </div>
            <button
              onClick={() => setSelectedModule(null)}
              className="p-1 rounded-md hover:bg-border transition-colors"
            >
              <X className="w-3.5 h-3.5 text-text-muted" />
            </button>
          </div>

          {/* Issues */}
          {selectedDetail.issues.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Issues ({selectedDetail.issues.length})
              </h4>
              <div className="space-y-1">
                {selectedDetail.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-md bg-surface-deep">
                    <AlertTriangle className="w-3 h-3 text-[#fbbf24] flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-[#9ca0be]">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations with fix buttons */}
          {selectedDetail.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Recommendations
              </h4>
              <div className="space-y-2">
                {selectedDetail.recommendations.map((rec) => {
                  const pc = PRIORITY_COLORS[rec.priority] ?? PRIORITY_COLORS.low;
                  return (
                    <div
                      key={rec.id}
                      className="rounded-lg border px-3 py-2.5"
                      style={{ backgroundColor: pc.bg, borderColor: pc.border }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ color: pc.text, backgroundColor: `${pc.text}15` }}
                        >
                          {rec.priority}
                        </span>
                        <span className="text-xs font-semibold text-text">{rec.title}</span>
                      </div>
                      <p className="text-xs text-text-muted-hover mb-2">{rec.description}</p>
                      <button
                        onClick={() => handleFix(rec)}
                        disabled={fixCli.isRunning}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                        style={{
                          backgroundColor: `${EVAL_ACCENT}12`,
                          color: EVAL_ACCENT,
                          border: `1px solid ${EVAL_ACCENT}25`,
                        }}
                      >
                        {fixCli.isRunning ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        Fix with Claude
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Score trend from history */}
          <ModuleScoreTrend moduleId={selectedDetail.moduleId} scanHistory={scanHistory} />
        </SurfaceCard>
      )}

      {/* ── All Recommendations (when no module selected) ── */}
      {!selectedModule && lastScan && lastScan.recommendations.length > 0 && (
        <SurfaceCard level={3} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span className="text-xs font-semibold text-[#9ca0be] uppercase tracking-wider">
              Top Recommendations
            </span>
            <span className="text-2xs text-text-muted ml-auto">
              {lastScan.recommendations.length} total
            </span>
          </div>
          <div className="space-y-2">
            {lastScan.recommendations
              .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
              .slice(0, 5)
              .map((rec) => {
                const pc = PRIORITY_COLORS[rec.priority] ?? PRIORITY_COLORS.low;
                return (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    style={{ backgroundColor: pc.bg, borderColor: pc.border }}
                  >
                    <span
                      className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ color: pc.text, backgroundColor: `${pc.text}15` }}
                    >
                      {rec.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-text">{rec.title}</span>
                      <span className="text-xs text-text-muted ml-2">
                        {MODULE_LABELS[rec.moduleId] ?? rec.moduleId}
                      </span>
                    </div>
                    <button
                      onClick={() => handleFix(rec)}
                      disabled={fixCli.isRunning}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all disabled:opacity-50 flex-shrink-0"
                      style={{
                        backgroundColor: `${EVAL_ACCENT}12`,
                        color: EVAL_ACCENT,
                        border: `1px solid ${EVAL_ACCENT}25`,
                      }}
                    >
                      <Zap className="w-2.5 h-2.5" />
                      Fix
                    </button>
                  </div>
                );
              })}
          </div>
        </SurfaceCard>
      )}

      {/* ── Scan history timeline ── */}
      {scanHistory.length > 0 && (
        <SurfaceCard level={3} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-[#4ade80]" />
            <span className="text-xs font-semibold text-[#9ca0be] uppercase tracking-wider">
              Scan History
            </span>
            <span className="text-2xs text-text-muted ml-auto">
              {scanHistory.length} scans
            </span>
          </div>

          {/* Sparkline of overall scores */}
          <OverallScoreSparkline scanHistory={scanHistory} accent={EVAL_ACCENT} />

          {/* History list */}
          <div className="mt-3 space-y-1">
            {[...scanHistory].reverse().slice(0, 5).map((scan, idx) => {
              const prev = idx < scanHistory.length - 1 ? [...scanHistory].reverse()[idx + 1] : null;
              const delta = prev ? scan.overallScore - prev.overallScore : 0;
              return (
                <div
                  key={scan.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: scoreColor(scan.overallScore) }}
                  />
                  <span className="text-xs font-bold" style={{ color: scoreColor(scan.overallScore) }}>
                    {scan.overallScore}
                  </span>
                  {delta !== 0 && (
                    <span
                      className="text-2xs font-medium flex items-center gap-0.5"
                      style={{ color: delta > 0 ? '#4ade80' : '#f87171' }}
                    >
                      {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                  <span className="text-xs text-text-muted flex-1">
                    {new Date(scan.timestamp).toLocaleDateString()} {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-2xs text-[#4a4e6a]">
                    {scan.moduleScores.length} modules
                  </span>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* ── Empty state ── */}
      {!lastScan && !isScanning && (
        <SurfaceCard level={3} className="p-8 text-center">
          <RadarIcon className="w-10 h-10 mx-auto text-border-bright mb-3" />
          <h3 className="text-sm font-semibold text-text mb-2">No Health Data</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
            Scan your project to generate a health radar with per-module scores, issues, and actionable recommendations.
          </p>
        </SurfaceCard>
      )}
    </div>
  );
}

// ── Sub-components ──

interface RegressionAlert {
  id: string;
  message: string;
  severity: string;
}

function priorityOrder(p: string): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[p] ?? 4;
}

function ModuleScoreTrend({ moduleId, scanHistory }: { moduleId: string; scanHistory: EvaluatorReport[] }) {
  const points = useMemo(() => {
    return scanHistory
      .map((scan) => {
        const ms = scan.moduleScores.find((m) => m.moduleId === moduleId);
        return ms ? { score: ms.score, timestamp: scan.timestamp } : null;
      })
      .filter((p): p is { score: number; timestamp: number } => p !== null);
  }, [moduleId, scanHistory]);

  if (points.length < 2) return null;

  const w = 200;
  const h = 40;
  const pad = 4;
  const min = Math.max(0, Math.min(...points.map((p) => p.score)) - 10);
  const max = Math.min(100, Math.max(...points.map((p) => p.score)) + 10);
  const range = max - min || 1;

  const svgPoints = points.map((p, i) => ({
    x: pad + (i / (points.length - 1)) * (w - pad * 2),
    y: h - pad - ((p.score - min) / range) * (h - pad * 2),
  }));

  const pathD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.score - first.score;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Score Trend</span>
        <span
          className="text-2xs font-medium"
          style={{ color: delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'var(--text-muted)' }}
        >
          {delta > 0 ? '+' : ''}{delta} over {points.length} scans
        </span>
      </div>
      <svg width={w} height={h} className="w-full">
        <defs>
          <linearGradient id="module-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EVAL_ACCENT} stopOpacity="0.2" />
            <stop offset="100%" stopColor={EVAL_ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L${svgPoints[svgPoints.length - 1].x},${h} L${svgPoints[0].x},${h} Z`}
          fill="url(#module-trend-fill)"
        />
        <path d={pathD} fill="none" stroke={EVAL_ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {svgPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill={EVAL_ACCENT} />
        ))}
      </svg>
    </div>
  );
}

function RadialScoreGauge({ score, isScanning }: { score: number | null; isScanning: boolean }) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 270-degree arc: starts at 135° (bottom-left), sweeps 270° clockwise to 45° (bottom-right)
  const startAngle = 135;
  const sweepAngle = 270;

  const polarToCart = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  const arcPath = (startDeg: number, endDeg: number, r: number) => {
    const start = polarToCart(startDeg, r);
    const end = polarToCart(endDeg, r);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  // Background track (full 270°)
  const trackPath = arcPath(startAngle, startAngle + sweepAngle, radius);

  // Score arc
  const clampedScore = score !== null ? Math.max(0, Math.min(100, score)) : 0;
  const scoreEndAngle = startAngle + (clampedScore / 100) * sweepAngle;
  const scorePath = clampedScore > 0 ? arcPath(startAngle, scoreEndAngle, radius) : '';

  // Color grading: red (0-30), amber (31-60), green (61-100)
  const gaugeColor = score !== null
    ? score <= 30 ? '#ef4444' : score <= 60 ? '#fbbf24' : '#4ade80'
    : 'var(--text-muted)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        {score !== null && clampedScore > 0 && (
          <path
            d={scorePath}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${gaugeColor}40)` }}
          />
        )}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isScanning ? (
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: gaugeColor }} />
        ) : score !== null ? (
          <div className="flex items-baseline gap-0.5">
            <span className="text-[32px] font-bold leading-none" style={{ color: gaugeColor }}>
              {score}
            </span>
            <span className="text-xs text-text-muted font-medium">/100</span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">--</span>
        )}
      </div>
    </div>
  );
}

function OverallScoreSparkline({ scanHistory, accent }: { scanHistory: EvaluatorReport[]; accent: string }) {
  if (scanHistory.length < 2) return null;

  const w = 300;
  const h = 32;
  const pad = 4;
  const scores = scanHistory.map((s) => s.overallScore);
  const min = Math.max(0, Math.min(...scores) - 10);
  const max = Math.min(100, Math.max(...scores) + 10);
  const range = max - min || 1;

  const points = scores.map((s, i) => ({
    x: pad + (i / (scores.length - 1)) * (w - pad * 2),
    y: h - pad - ((s - min) / range) * (h - pad * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg width={w} height={h} className="w-full">
      <defs>
        <linearGradient id="overall-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`}
        fill="url(#overall-sparkline-fill)"
      />
      <path d={pathD} fill="none" stroke={accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.5} fill={accent} />
    </svg>
  );
}
