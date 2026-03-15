'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Play, RotateCcw, Shield, Swords, Heart, Zap, Timer,
  AlertTriangle, TrendingUp, TrendingDown, Eye, EyeOff,
  ChevronRight, Copy, Camera, Pause,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
  MODULE_COLORS, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from './_shared';
import type { FeedbackConfig, FeedbackComparisonResult, FeedbackInsightSeverity } from '@/types/combat-simulator';
import { runFeedbackComparison, DEFAULT_FEEDBACK_CONFIG } from '@/lib/combat/simulation-engine';
import {
  PLAYER_ABILITIES,
  GEAR_LOADOUTS,
  DEFAULT_TUNING,
  DEFAULT_CONFIG,
  FEEDBACK_PRESETS,
} from '@/lib/combat/definitions';
import type { CombatScenario } from '@/types/combat-simulator';

const ACCENT = MODULE_COLORS.core;

const INSIGHT_COLORS: Record<FeedbackInsightSeverity, string> = {
  positive: STATUS_SUCCESS,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

const INSIGHT_ICONS: Record<FeedbackInsightSeverity, typeof Heart> = {
  positive: TrendingUp,
  warning: AlertTriangle,
  critical: TrendingDown,
};

/* ── Default scenario ─────────────────────────────────────────────────── */

const DEFAULT_SCENARIO: CombatScenario = {
  name: 'Standard Fight',
  playerLevel: 10,
  playerGear: GEAR_LOADOUTS[1], // Mid-Tier
  playerAbilities: PLAYER_ABILITIES,
  enemies: [{ archetypeId: 'elite-knight', count: 1, level: 10 }],
};

const SCENARIO_PRESETS = [
  { id: 'grunt-pack', name: '3× Grunts', enemies: [{ archetypeId: 'melee-grunt', count: 3, level: 8 }] },
  { id: 'knight', name: '1× Knight', enemies: [{ archetypeId: 'elite-knight', count: 1, level: 10 }] },
  { id: 'mixed', name: 'Knight + Mage', enemies: [{ archetypeId: 'elite-knight', count: 1, level: 10 }, { archetypeId: 'ranged-caster', count: 1, level: 10 }] },
  { id: 'brute', name: '1× Stone Brute', enemies: [{ archetypeId: 'brute', count: 1, level: 12 }] },
];

/* ── Helpers ──────────────────────────────────────────────────────────── */

function StatInput({ label, value, onChange, min, max, step, unit, color, diverged }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; unit?: string; color: string; diverged?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-text-muted w-28 truncate flex items-center gap-1">
        {diverged && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
            title="Modified from preset"
          />
        )}
        {label}
      </span>
      <input
        type="range" min={min} max={max} step={step ?? 0.01}
        value={value} onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-current cursor-pointer" style={{ color }}
      />
      <span className="text-2xs font-mono w-14 text-right" style={{ color }}>
        {step && step >= 1 ? value.toFixed(0) : value.toFixed(step && step < 0.01 ? 3 : 2)}{unit ?? ''}
      </span>
    </div>
  );
}

function formatMetricValue(value: number, unit?: string): string {
  if (typeof value === 'number' && value < 1 && unit === '%') return `${(value * 100).toFixed(1)}%`;
  return `${value.toFixed(1)}${unit ?? ''}`;
}

function formatDelta(delta: number, unit?: string): string {
  if (typeof delta === 'number' && Math.abs(delta) < 1 && unit === '%') return `${(delta * 100).toFixed(1)}%`;
  return delta.toFixed(1);
}

function MetricCell({ label, value, unit, icon: Icon, color, muted }: {
  label: string; value: number; unit?: string;
  icon: typeof Heart; color: string; muted?: boolean;
}) {
  const bg = muted ? 'var(--color-surface-deep)' : `${color}${OPACITY_15}`;
  const iconColor = muted ? 'var(--color-text-muted)' : color;
  const valueColor = muted ? 'var(--color-text)' : color;

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md" style={{ backgroundColor: bg, opacity: muted ? 0.7 : 1 }}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: iconColor }} />
      <div className="flex-1 min-w-0">
        <div className="text-2xs text-text-muted">{label}</div>
        <span className="text-xs font-bold font-mono" style={{ color: valueColor }}>
          {formatMetricValue(value, unit)}
        </span>
      </div>
    </div>
  );
}

function MetricRow({ label, feedbackOn, feedbackOff, unit, higherIsBetter, icon, color }: {
  label: string; feedbackOn: number; feedbackOff: number; unit?: string;
  higherIsBetter: boolean; icon: typeof Heart; color: string;
}) {
  const delta = feedbackOn - feedbackOff;
  const better = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = Math.abs(delta) < 0.01;
  const deltaColor = neutral ? 'var(--color-text-muted)' : better ? STATUS_SUCCESS : STATUS_ERROR;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0">
      <MetricCell label={label} value={feedbackOn} unit={unit} icon={icon} color={color} />
      {/* Connector line with delta */}
      <div className="flex items-center w-20 px-1">
        <div className="flex-1 h-px" style={{ backgroundColor: `${deltaColor}40` }} />
        <span
          className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: deltaColor, backgroundColor: `${deltaColor}15` }}
        >
          {neutral ? '=' : `${delta > 0 ? '+' : ''}${formatDelta(delta, unit)}`}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: `${deltaColor}40` }} />
      </div>
      <MetricCell label={label} value={feedbackOff} unit={unit} icon={icon} color={color} muted />
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */

export function FeedbackBalanceSimulator() {
  const [feedbackConfig, setFeedbackConfig] = useState<FeedbackConfig>({ ...DEFAULT_FEEDBACK_CONFIG });
  const [scenario, setScenario] = useState<CombatScenario>({ ...DEFAULT_SCENARIO });
  const [activePreset, setActivePreset] = useState('default');
  const [activeScenario, setActiveScenario] = useState('knight');
  const [iterations, setIterations] = useState(500);

  const [result, setResult] = useState<FeedbackComparisonResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const loadPreset = useCallback((presetId: string) => {
    const preset = FEEDBACK_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setFeedbackConfig({ ...preset.config });
    setActivePreset(presetId);
    setResult(null);
  }, []);

  const loadScenario = useCallback((scenarioId: string) => {
    const preset = SCENARIO_PRESETS.find(p => p.id === scenarioId);
    if (!preset) return;
    setScenario(s => ({ ...s, enemies: preset.enemies }));
    setActiveScenario(scenarioId);
    setResult(null);
  }, []);

  const updateFeedback = useCallback((key: keyof FeedbackConfig, value: number | boolean) => {
    setFeedbackConfig(prev => ({ ...prev, [key]: value }));
    setActivePreset('');
  }, []);

  const presetConfig = useMemo(() => {
    if (!activePreset) return null;
    const preset = FEEDBACK_PRESETS.find(p => p.id === activePreset);
    return preset?.config ?? null;
  }, [activePreset]);

  const runSim = useCallback(() => {
    setIsRunning(true);
    requestAnimationFrame(() => {
      const config = { ...DEFAULT_CONFIG, iterations, seed: Date.now() % 100000 };
      const comparison = runFeedbackComparison(scenario, DEFAULT_TUNING, config, feedbackConfig);
      setResult(comparison);
      setIsRunning(false);
    });
  }, [scenario, feedbackConfig, iterations]);

  const copyReport = useCallback(() => {
    if (!result) return;
    const lines = [
      '# Feedback-Aware Balance Report',
      '',
      '## Config',
      `Hitstop: ${feedbackConfig.hitstopDurationSec * 1000}ms`,
      `Camera Shake: ${feedbackConfig.cameraShakeScale}x`,
      `Base Reaction: ${feedbackConfig.baseReactionTimeSec * 1000}ms`,
      `Shake Accuracy Penalty: ${(feedbackConfig.shakeAccuracyPenalty * 100).toFixed(0)}%`,
      `Recovery Window: ${feedbackConfig.hitRecoveryWindowSec * 1000}ms`,
      `Recovery I-Frames: ${feedbackConfig.hitRecoveryIFrames ? 'Yes' : 'No'}`,
      '',
      '## With Feedback',
      `Survival: ${(result.withFeedback.survivalRate * 100).toFixed(1)}%`,
      `Avg Duration: ${result.withFeedback.avgDurationSec.toFixed(1)}s`,
      `DPS: ${result.withFeedback.avgDPS.toFixed(1)}`,
      `Dodges from Hitstop: ${result.withFeedback.avgDodgesFromHitstop.toFixed(1)}/fight`,
      `Misses from Shake: ${result.withFeedback.avgMissesFromShake.toFixed(1)}/fight`,
      '',
      '## Without Feedback (Pure Math)',
      `Survival: ${(result.withoutFeedback.survivalRate * 100).toFixed(1)}%`,
      `Avg Duration: ${result.withoutFeedback.avgDurationSec.toFixed(1)}s`,
      `DPS: ${result.withoutFeedback.avgDPS.toFixed(1)}`,
      '',
      '## Insights',
      ...result.insights.map(i => `[${i.severity.toUpperCase()}] ${i.message}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
  }, [result, feedbackConfig]);

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${ACCENT_VIOLET}10` }} />
        <SectionLabel icon={Eye} label="Feedback-Aware Balance Simulator" color={ACCENT_VIOLET} />
        <p className="text-2xs text-text-muted mt-1">
          Compares combat outcomes WITH and WITHOUT feedback mechanics (hitstop, camera shake, recovery windows).
          Quantifies how UCombatFeedbackComponent parameters affect player survival, DPS, and reaction windows.
        </p>

        {/* Feedback Presets */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-2xs text-text-muted">Feedback:</span>
          {FEEDBACK_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => loadPreset(p.id)}
              className="text-2xs px-2 py-0.5 rounded-md border transition-colors"
              style={{
                borderColor: activePreset === p.id ? ACCENT_VIOLET : 'var(--color-border)',
                backgroundColor: activePreset === p.id ? `${ACCENT_VIOLET}${OPACITY_15}` : 'transparent',
                color: activePreset === p.id ? ACCENT_VIOLET : 'var(--color-text-muted)',
              }}
              title={p.description}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Scenario Presets */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-2xs text-text-muted">Encounter:</span>
          {SCENARIO_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => loadScenario(p.id)}
              className="text-2xs px-2 py-0.5 rounded-md border transition-colors"
              style={{
                borderColor: activeScenario === p.id ? ACCENT : 'var(--color-border)',
                backgroundColor: activeScenario === p.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
                color: activeScenario === p.id ? ACCENT : 'var(--color-text-muted)',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-2.5">
        {/* Left: Config */}
        <div className="space-y-2.5">
          {/* Feedback Parameters */}
          <SurfaceCard level={2} className="p-3 space-y-2">
            <button onClick={() => setShowConfig(o => !o)} className="w-full flex items-center gap-2 text-left">
              <motion.div animate={{ rotate: showConfig ? 90 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <ChevronRight className="w-3 h-3 text-text-muted" />
              </motion.div>
              <Pause className="w-3 h-3" style={{ color: ACCENT_VIOLET }} />
              <span className="text-xs font-semibold text-text">Feedback Parameters</span>
            </button>

            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  <StatInput
                    label="Hitstop Duration"
                    value={feedbackConfig.hitstopDurationSec}
                    onChange={v => updateFeedback('hitstopDurationSec', v)}
                    min={0} max={0.3} step={0.005} unit="s"
                    color={ACCENT_VIOLET}
                    diverged={!!presetConfig && feedbackConfig.hitstopDurationSec !== presetConfig.hitstopDurationSec}
                  />
                  <StatInput
                    label="Camera Shake"
                    value={feedbackConfig.cameraShakeScale}
                    onChange={v => updateFeedback('cameraShakeScale', v)}
                    min={0} max={5} step={0.1} unit="x"
                    color={ACCENT_ORANGE}
                    diverged={!!presetConfig && feedbackConfig.cameraShakeScale !== presetConfig.cameraShakeScale}
                  />
                  <StatInput
                    label="Reaction Time"
                    value={feedbackConfig.baseReactionTimeSec}
                    onChange={v => updateFeedback('baseReactionTimeSec', v)}
                    min={0.1} max={0.5} step={0.01} unit="s"
                    color={ACCENT_CYAN}
                    diverged={!!presetConfig && feedbackConfig.baseReactionTimeSec !== presetConfig.baseReactionTimeSec}
                  />
                  <StatInput
                    label="Shake Accuracy Penalty"
                    value={feedbackConfig.shakeAccuracyPenalty}
                    onChange={v => updateFeedback('shakeAccuracyPenalty', v)}
                    min={0} max={0.5} step={0.01}
                    color={STATUS_WARNING}
                    diverged={!!presetConfig && feedbackConfig.shakeAccuracyPenalty !== presetConfig.shakeAccuracyPenalty}
                  />
                  <StatInput
                    label="Recovery Window"
                    value={feedbackConfig.hitRecoveryWindowSec}
                    onChange={v => updateFeedback('hitRecoveryWindowSec', v)}
                    min={0} max={0.5} step={0.01} unit="s"
                    color={ACCENT_EMERALD}
                    diverged={!!presetConfig && feedbackConfig.hitRecoveryWindowSec !== presetConfig.hitRecoveryWindowSec}
                  />
                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      checked={feedbackConfig.hitRecoveryIFrames}
                      onChange={e => updateFeedback('hitRecoveryIFrames', e.target.checked)}
                      className="accent-current" style={{ color: ACCENT_EMERALD }}
                    />
                    <span className="text-2xs text-text-muted">Recovery I-Frames</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SurfaceCard>

          {/* Iterations */}
          <div className="flex items-center gap-2 px-1">
            <Timer className="w-3 h-3 text-text-muted" />
            <span className="text-2xs text-text-muted">Iterations:</span>
            <input
              type="number" min={100} max={5000} step={100}
              value={iterations}
              onChange={e => setIterations(Math.max(100, Number(e.target.value)))}
              className="w-16 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text"
            />
          </div>

          {/* Run */}
          <button
            onClick={runSim}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${ACCENT_VIOLET}${OPACITY_20}`,
              color: ACCENT_VIOLET,
              border: `1px solid ${ACCENT_VIOLET}40`,
            }}
          >
            {isRunning ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <RotateCcw className="w-4 h-4" />
              </motion.div>
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? 'Simulating...' : `Compare (${iterations}×2 fights)`}
          </button>

          {/* Current config summary */}
          <SurfaceCard level={3} className="p-2 text-2xs text-text-muted space-y-0.5">
            <div className="flex items-center gap-1">
              <Pause className="w-2.5 h-2.5" style={{ color: ACCENT_VIOLET }} />
              Hitstop: {(feedbackConfig.hitstopDurationSec * 1000).toFixed(0)}ms
            </div>
            <div className="flex items-center gap-1">
              <Camera className="w-2.5 h-2.5" style={{ color: ACCENT_ORANGE }} />
              Shake: {feedbackConfig.cameraShakeScale.toFixed(1)}x → {(feedbackConfig.shakeAccuracyPenalty * 100).toFixed(0)}% miss
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" style={{ color: ACCENT_EMERALD }} />
              Recovery: {(feedbackConfig.hitRecoveryWindowSec * 1000).toFixed(0)}ms {feedbackConfig.hitRecoveryIFrames ? '+ i-frames' : ''}
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" style={{ color: ACCENT_CYAN }} />
              Effective reaction: {((feedbackConfig.hitstopDurationSec + feedbackConfig.baseReactionTimeSec) * 1000).toFixed(0)}ms
            </div>
          </SurfaceCard>
        </div>

        {/* Right: Results */}
        <div>
          {result ? (
            <ResultsPanel result={result} feedbackConfig={feedbackConfig} onCopyReport={copyReport} />
          ) : (
            <SurfaceCard level={2} className="p-8 text-center">
              <div className="flex flex-col items-center gap-2 text-text-muted">
                <Eye className="w-8 h-8 opacity-30" />
                <p className="text-sm">Configure feedback parameters and run the comparison</p>
                <p className="text-2xs">Results will compare feedback-on vs feedback-off across survival, DPS, and reaction metrics</p>
              </div>
            </SurfaceCard>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Results Panel ────────────────────────────────────────────────────── */

function ResultsPanel({ result, feedbackConfig, onCopyReport }: {
  result: FeedbackComparisonResult;
  feedbackConfig: FeedbackConfig;
  onCopyReport: () => void;
}) {
  const { withFeedback: on, withoutFeedback: off, deltas, insights } = result;

  return (
    <div className="space-y-2.5">
      {/* Side-by-side comparison */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionLabel icon={Swords} label="Feedback vs Pure Math" color={ACCENT} />
          <button
            onClick={onCopyReport}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs transition-colors"
            style={{ color: ACCENT_VIOLET, backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}` }}
          >
            <Copy className="w-3 h-3" />
            Copy Report
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 mb-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3" style={{ color: ACCENT_VIOLET }} />
            <span className="text-2xs font-bold uppercase tracking-wider" style={{ color: ACCENT_VIOLET }}>With Feedback</span>
          </div>
          <div className="w-20 text-center">
            <span className="text-2xs text-text-muted uppercase tracking-wider">Delta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <EyeOff className="w-3 h-3 text-text-muted" />
            <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Pure Math</span>
          </div>
        </div>

        {/* Metric rows with connector lines */}
        <div className="space-y-1.5">
          <MetricRow label="Survival Rate" feedbackOn={on.survivalRate} feedbackOff={off.survivalRate} unit="%" higherIsBetter icon={Heart} color={STATUS_SUCCESS} />
          <MetricRow label="Avg Duration" feedbackOn={on.avgDurationSec} feedbackOff={off.avgDurationSec} unit="s" higherIsBetter={false} icon={Timer} color={ACCENT_CYAN} />
          <MetricRow label="Player DPS" feedbackOn={on.avgDPS} feedbackOff={off.avgDPS} higherIsBetter icon={Swords} color={ACCENT_ORANGE} />
          <MetricRow label="Damage Taken" feedbackOn={on.avgDamageTaken} feedbackOff={off.avgDamageTaken} higherIsBetter={false} icon={Shield} color={STATUS_ERROR} />
        </div>
      </SurfaceCard>

      {/* Feedback-Specific Metrics */}
      <SurfaceCard level={2} className="p-3">
        <SectionLabel icon={Pause} label="Feedback Mechanics Impact" color={ACCENT_VIOLET} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <FeedbackMetric
            label="Dodges from Hitstop"
            value={on.avgDodgesFromHitstop.toFixed(1)}
            unit="/fight"
            color={ACCENT_EMERALD}
            description={`${(feedbackConfig.hitstopDurationSec * 1000).toFixed(0)}ms freeze → ${((feedbackConfig.hitstopDurationSec + feedbackConfig.baseReactionTimeSec) * 1000).toFixed(0)}ms window`}
            viz={{ type: 'bar', ratio: Math.min(on.avgDodgesFromHitstop / 10, 1) }}
          />
          <FeedbackMetric
            label="Misses from Shake"
            value={on.avgMissesFromShake.toFixed(1)}
            unit="/fight"
            color={ACCENT_ORANGE}
            description={`${feedbackConfig.cameraShakeScale.toFixed(1)}x shake × ${(feedbackConfig.shakeAccuracyPenalty * 100).toFixed(0)}% penalty`}
            viz={{ type: 'bar', ratio: Math.min(on.avgMissesFromShake / 10, 1) }}
          />
          <FeedbackMetric
            label="Total Hitstop"
            value={on.avgTotalHitstopSec.toFixed(1)}
            unit="s/fight"
            color={ACCENT_VIOLET}
            description={`${on.avgDurationSec > 0 ? ((on.avgTotalHitstopSec / on.avgDurationSec) * 100).toFixed(1) : 0}% of fight is freeze frames`}
            viz={{ type: 'donut', ratio: on.avgDurationSec > 0 ? on.avgTotalHitstopSec / on.avgDurationSec : 0 }}
          />
          <FeedbackMetric
            label="Effective Reaction"
            value={`${(on.avgEffectiveReactionSec * 1000).toFixed(0)}`}
            unit="ms"
            color={ACCENT_CYAN}
            description={`hitstop + base reaction time`}
            viz={{ type: 'gauge', ratio: (on.avgEffectiveReactionSec * 1000) / 500 }}
          />
        </div>
      </SurfaceCard>

      {/* Delta Summary Bar */}
      <SurfaceCard level={2} className="p-3">
        <SectionLabel icon={TrendingUp} label="Net Impact (Feedback ON − OFF)" color={ACCENT} />
        <div className="grid grid-cols-4 gap-2 mt-2">
          <DeltaBadge label="Survival" delta={deltas.survivalRateDelta} isPercent higherIsBetter />
          <DeltaBadge label="Duration" delta={deltas.durationDelta} unit="s" higherIsBetter={false} />
          <DeltaBadge label="DPS" delta={deltas.dpsDelta} higherIsBetter />
          <DeltaBadge label="Dmg Taken" delta={deltas.damageTakenDelta} higherIsBetter={false} />
        </div>
      </SurfaceCard>

      {/* Insights */}
      <BalanceInsightsPanel insights={insights} />
    </div>
  );
}

/* ── Balance Insights Panel ───────────────────────────────────────────── */

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, positive: 2 };

const SEVERITY_FILTERS: { key: string; label: string; color: string }[] = [
  { key: 'critical', label: 'Critical', color: STATUS_ERROR },
  { key: 'warning', label: 'Warning', color: STATUS_WARNING },
  { key: 'positive', label: 'Positive', color: STATUS_SUCCESS },
];

function BalanceInsightsPanel({ insights }: { insights: { severity: string; category: string; message: string }[] }) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set(['critical', 'warning', 'positive']));

  const counts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, warning: 0, positive: 0 };
    for (const ins of insights) c[ins.severity] = (c[ins.severity] ?? 0) + 1;
    return c;
  }, [insights]);

  const toggleFilter = useCallback((key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); } else next.add(key);
      return next;
    });
  }, []);

  const filtered = useMemo(() =>
    [...insights]
      .filter(i => activeFilters.has(i.severity))
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)),
    [insights, activeFilters],
  );

  return (
    <SurfaceCard level={2} className="p-3">
      <SectionLabel icon={AlertTriangle} label="Balance Insights" color={STATUS_WARNING} />

      {/* Severity filter pills */}
      <div className="flex items-center gap-1.5 mt-2 mb-2">
        {SEVERITY_FILTERS.map(s => {
          const active = activeFilters.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleFilter(s.key)}
              className="flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full border transition-colors"
              style={{
                borderColor: active ? s.color : 'var(--color-border)',
                backgroundColor: active ? `${s.color}15` : 'transparent',
                color: active ? s.color : 'var(--color-text-muted)',
                opacity: active ? 1 : 0.5,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="font-mono ml-0.5">{counts[s.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Insight cards */}
      <div className="space-y-2">
        {filtered.map((insight, i) => {
          const color = INSIGHT_COLORS[insight.severity as keyof typeof INSIGHT_COLORS] ?? STATUS_WARNING;
          const Icon = INSIGHT_ICONS[insight.severity as keyof typeof INSIGHT_ICONS] ?? AlertTriangle;
          const isCritical = insight.severity === 'critical';
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 px-3 py-2 rounded-md border overflow-hidden"
              style={{
                borderColor: `${color}30`,
                backgroundColor: `${color}08`,
                borderLeftWidth: isCritical ? 3 : undefined,
                borderLeftColor: isCritical ? STATUS_ERROR : undefined,
              }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
                    {insight.severity}
                  </span>
                  <span className="text-2xs font-mono text-text-muted uppercase">{insight.category}</span>
                </div>
                <p className="text-2xs text-text leading-relaxed">{insight.message}</p>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-2xs text-text-muted text-center py-2">No insights match the selected filters</p>
        )}
      </div>
    </SurfaceCard>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────── */

type MiniViz =
  | { type: 'donut'; ratio: number }
  | { type: 'bar'; ratio: number }
  | { type: 'gauge'; ratio: number };

function MiniVizSvg({ viz, color }: { viz: MiniViz; color: string }) {
  const S = 28;
  if (viz.type === 'donut') {
    const r = 10, cx = S / 2, cy = S / 2;
    const circumference = 2 * Math.PI * r;
    const filled = Math.min(1, Math.max(0, viz.ratio)) * circumference;
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${color}25`} strokeWidth={3} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (viz.type === 'bar') {
    const barW = 20, barH = 6, x0 = (S - barW) / 2, y0 = (S - barH) / 2;
    const filled = Math.min(1, Math.max(0, viz.ratio)) * barW;
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
        <rect x={x0} y={y0} width={barW} height={barH} rx={2} fill={`${color}25`} />
        <rect x={x0} y={y0} width={filled} height={barH} rx={2} fill={color} />
      </svg>
    );
  }
  // gauge
  const trackW = 22, trackH = 4, x0 = (S - trackW) / 2, y0 = S / 2 - trackH / 2;
  const clamped = Math.min(1, Math.max(0, viz.ratio));
  const markerX = x0 + clamped * trackW;
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
      <rect x={x0} y={y0} width={trackW} height={trackH} rx={2} fill={`${color}25`} />
      <rect x={x0} y={y0} width={clamped * trackW} height={trackH} rx={2} fill={color} />
      <line x1={markerX} y1={y0 - 2} x2={markerX} y2={y0 + trackH + 2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function FeedbackMetric({ label, value, unit, color, description, viz }: {
  label: string; value: string; unit: string; color: string; description: string; viz?: MiniViz;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-2 rounded-md text-center" style={{ backgroundColor: `${color}${OPACITY_15}` }}>
      <div className="flex items-center gap-1.5">
        {viz && <MiniVizSvg viz={viz} color={color} />}
        <span className="text-xs font-bold font-mono" style={{ color }}>{value}<span className="text-2xs">{unit}</span></span>
      </div>
      <span className="text-2xs text-text-muted mt-0.5">{label}</span>
      <span className="text-2xs text-text-muted opacity-60 mt-0.5">{description}</span>
    </div>
  );
}

function DeltaBadge({ label, delta, unit, isPercent, higherIsBetter }: {
  label: string; delta: number; unit?: string; isPercent?: boolean; higherIsBetter: boolean;
}) {
  const better = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = Math.abs(delta) < 0.01;
  const color = neutral ? 'var(--color-text-muted)' : better ? STATUS_SUCCESS : STATUS_ERROR;
  const displayValue = isPercent ? `${(delta * 100).toFixed(1)}%` : `${delta.toFixed(1)}${unit ?? ''}`;

  return (
    <div className="flex flex-col items-center px-2 py-1.5 rounded-md text-center" style={{ backgroundColor: `${neutral ? 'var(--color-border)' : color}${OPACITY_15}` }}>
      <span className="text-xs font-bold font-mono" style={{ color }}>
        {delta > 0 ? '+' : ''}{displayValue}
      </span>
      <span className="text-2xs text-text-muted">{label}</span>
    </div>
  );
}
