'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { Play, Activity, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_20,
  withOpacity, OPACITY_25,
} from '@/lib/chart-colors';
import {
  ACCENT,
  runPredictiveBalance, DEFAULT_PREDICTIVE_CONFIG,
  type BalanceReport, type PredictiveBalanceConfig,
} from './data';
import { BlueprintPanel, SectionHeader } from './design';
import { ConfigPanel } from './ConfigPanel';
import { ResultsPanel } from './ResultsPanel';
import { EnemySourcePanel } from './EnemySourcePanel';
import { useBestiaryEnemies } from './useBestiaryEnemies';

export function PredictiveBalanceSimulator() {
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<PredictiveBalanceConfig>(DEFAULT_PREDICTIVE_CONFIG);
  const runLock = useRef(false);
  // Enemies come from the REAL bestiary catalog when it holds usable rows, and
  // fall back to the hardcoded fixtures otherwise — the panel says which.
  const enemies = useBestiaryEnemies();

  const runSim = useCallback(() => {
    if (runLock.current) return;
    runLock.current = true;
    setIsRunning(true);

    requestAnimationFrame(() => {
      const result = runPredictiveBalance(config, {
        registry: enemies.registry,
        provenance: enemies.provenance,
      });
      setReport(result);
      setIsRunning(false);
      runLock.current = false;
    });
  }, [config, enemies.registry, enemies.provenance]);

  const levels = useMemo(() => {
    const ls: number[] = [];
    for (let l = config.levelRange[0]; l <= config.levelRange[1]; l += config.levelStep) {
      ls.push(l);
    }
    return ls;
  }, [config]);

  const enemyLabels = useMemo(() => {
    return config.enemyConfigs.map(ec => {
      const arch = enemies.registry.get(ec.archetypeId);
      return `${ec.count}x ${arch?.name ?? ec.archetypeId}`;
    });
  }, [config, enemies.registry]);

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <SectionHeader icon={TrendingUp} label="Predictive Balance Simulator" color={ACCENT} />
        <button
          onClick={runSim}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
          style={{
            backgroundColor: `${ACCENT}${OPACITY_20}`,
            color: ACCENT,
            border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}`,
          }}
        >
          {isRunning ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Activity className="w-3.5 h-3.5" />
            </motion.div>
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isRunning ? 'Simulating...' : 'Run Simulation'}
        </button>
      </div>

      <div className="p-3 space-y-3">
        <EnemySourcePanel
          provenance={enemies.provenance}
          loading={enemies.loading}
          error={enemies.error}
        />

        <ConfigPanel
          config={config}
          setConfig={setConfig}
          registry={enemies.registry}
          catalogSourced={new Set(enemies.provenance.hydrated.map(h => h.archetypeId))}
        />

        {/* Empty state */}
        {!report && !isRunning && (
          <div className="text-center py-8 text-text-muted text-xs font-mono">
            Click &quot;Run Simulation&quot; to sweep Lv.{config.levelRange[0]}&ndash;{config.levelRange[1]} across {config.enemyConfigs.length} encounter types
          </div>
        )}

        {/* Loading state */}
        {isRunning && (
          <div className="text-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="inline-block"
            >
              <Activity className="w-6 h-6" style={{ color: ACCENT }} />
            </motion.div>
            <div className="text-xs text-text-muted font-mono mt-2">
              Running {config.iterations} iterations x {levels.length} levels x {config.enemyConfigs.length} encounters...
            </div>
          </div>
        )}

        {/* Results */}
        {report && !isRunning && (
          <ResultsPanel report={report} levels={levels} enemyLabels={enemyLabels} />
        )}
      </div>
    </BlueprintPanel>
  );
}
