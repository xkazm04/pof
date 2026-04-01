'use client';

import { useState, useCallback, useMemo } from 'react';
import { Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_VIOLET, OPACITY_15 } from '@/lib/chart-colors';
import type { FeedbackConfig, CombatScenario } from '@/types/combat-simulator';
import { runFeedbackComparison, DEFAULT_FEEDBACK_CONFIG } from '@/lib/combat/simulation-engine';
import {
  PLAYER_ABILITIES, GEAR_LOADOUTS, DEFAULT_TUNING,
  DEFAULT_CONFIG, FEEDBACK_PRESETS,
} from '@/lib/combat/definitions';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, SCENARIO_PRESETS } from './types';
import { ConfigPanel } from './ConfigPanel';
import { ResultsPanel } from './ResultsPanel';

/* ── Default scenario ────────────────────────────────────────────────── */

const DEFAULT_SCENARIO: CombatScenario = {
  name: 'Standard Fight',
  playerLevel: 10,
  playerGear: GEAR_LOADOUTS[1],
  playerAbilities: PLAYER_ABILITIES,
  enemies: [{ archetypeId: 'elite-knight', count: 1, level: 10 }],
};

/* ── Main Component ──────────────────────────────────────────────────── */

export function FeedbackBalanceSimulator() {
  const [feedbackConfig, setFeedbackConfig] = useState<FeedbackConfig>({ ...DEFAULT_FEEDBACK_CONFIG });
  const [scenario, setScenario] = useState<CombatScenario>({ ...DEFAULT_SCENARIO });
  const [activePreset, setActivePreset] = useState('default');
  const [activeScenario, setActiveScenario] = useState('knight');
  const [iterations, setIterations] = useState(500);
  const [result, setResult] = useState<ReturnType<typeof runFeedbackComparison> | null>(null);
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
    return FEEDBACK_PRESETS.find(p => p.id === activePreset)?.config ?? null;
  }, [activePreset]);

  const runSim = useCallback(() => {
    setIsRunning(true);
    requestAnimationFrame(() => {
      const config = { ...DEFAULT_CONFIG, iterations, seed: Date.now() % 100000 };
      setResult(runFeedbackComparison(scenario, DEFAULT_TUNING, config, feedbackConfig));
      setIsRunning(false);
    });
  }, [scenario, feedbackConfig, iterations]);

  const copyReport = useCallback(() => {
    if (!result) return;
    const lines = [
      '# Feedback-Aware Balance Report', '',
      '## Config',
      `Hitstop: ${feedbackConfig.hitstopDurationSec * 1000}ms`,
      `Camera Shake: ${feedbackConfig.cameraShakeScale}x`,
      `Base Reaction: ${feedbackConfig.baseReactionTimeSec * 1000}ms`,
      `Shake Accuracy Penalty: ${(feedbackConfig.shakeAccuracyPenalty * 100).toFixed(0)}%`,
      `Recovery Window: ${feedbackConfig.hitRecoveryWindowSec * 1000}ms`,
      `Recovery I-Frames: ${feedbackConfig.hitRecoveryIFrames ? 'Yes' : 'No'}`, '',
      '## With Feedback',
      `Survival: ${(result.withFeedback.survivalRate * 100).toFixed(1)}%`,
      `Avg Duration: ${result.withFeedback.avgDurationSec.toFixed(1)}s`,
      `DPS: ${result.withFeedback.avgDPS.toFixed(1)}`,
      `Dodges from Hitstop: ${result.withFeedback.avgDodgesFromHitstop.toFixed(1)}/fight`,
      `Misses from Shake: ${result.withFeedback.avgMissesFromShake.toFixed(1)}/fight`, '',
      '## Without Feedback (Pure Math)',
      `Survival: ${(result.withoutFeedback.survivalRate * 100).toFixed(1)}%`,
      `Avg Duration: ${result.withoutFeedback.avgDurationSec.toFixed(1)}s`,
      `DPS: ${result.withoutFeedback.avgDPS.toFixed(1)}`, '',
      '## Insights',
      ...result.insights.map(i => `[${i.severity.toUpperCase()}] ${i.message}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
  }, [result, feedbackConfig]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-4">
      {/* Header */}
      <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
        <SectionHeader icon={Eye} label="Feedback-Aware Balance Simulator" color={ACCENT_VIOLET} />
        <p className="text-xs font-mono text-text-muted mt-1">
          Compares combat outcomes WITH and WITHOUT feedback mechanics (hitstop, camera shake, recovery windows).
          Quantifies how UCombatFeedbackComponent parameters affect player survival, DPS, and reaction windows.
        </p>

        {/* Feedback Presets */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Feedback:</span>
          {FEEDBACK_PRESETS.map(p => (
            <button key={p.id} onClick={() => loadPreset(p.id)} title={p.description}
              className="text-xs font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border transition-colors"
              style={{
                borderColor: activePreset === p.id ? ACCENT_VIOLET : 'var(--color-border)',
                backgroundColor: activePreset === p.id ? `${ACCENT_VIOLET}${OPACITY_15}` : 'transparent',
                color: activePreset === p.id ? ACCENT_VIOLET : 'var(--color-text-muted)',
              }}>
              {p.name}
            </button>
          ))}
        </div>

        {/* Scenario Presets */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Encounter:</span>
          {SCENARIO_PRESETS.map(p => (
            <button key={p.id} onClick={() => loadScenario(p.id)}
              className="text-xs font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border transition-colors"
              style={{
                borderColor: activeScenario === p.id ? ACCENT : 'var(--color-border)',
                backgroundColor: activeScenario === p.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
                color: activeScenario === p.id ? ACCENT : 'var(--color-text-muted)',
              }}>
              {p.name}
            </button>
          ))}
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
        {/* Left: Config */}
        <ConfigPanel
          feedbackConfig={feedbackConfig} presetConfig={presetConfig}
          showConfig={showConfig} isRunning={isRunning} iterations={iterations}
          onUpdateFeedback={updateFeedback} onToggleConfig={() => setShowConfig(o => !o)}
          onSetIterations={setIterations} onRun={runSim}
        />

        {/* Right: Results */}
        <div>
          {result ? (
            <ResultsPanel result={result} feedbackConfig={feedbackConfig} onCopyReport={copyReport} />
          ) : (
            <BlueprintPanel className="p-8 text-center">
              <div className="flex flex-col items-center gap-2 text-text-muted">
                <Eye className="w-8 h-8 opacity-30" />
                <p className="text-sm font-mono">Configure feedback parameters and run the comparison</p>
                <p className="text-xs font-mono">
                  Results will compare feedback-on vs feedback-off across survival, DPS, and reaction metrics
                </p>
              </div>
            </BlueprintPanel>
          )}
        </div>
      </div>
    </motion.div>
  );
}
