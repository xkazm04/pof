'use client';

import {
  ENCOUNTER_COLORS, ENEMY_ARCHETYPE_BY_ID, GEAR_LOADOUTS,
  SWEEP_LEVEL_BOUNDS, SWEEP_COUNT_BOUNDS,
  type PredictiveBalanceConfig,
} from './data';
import type { ArchetypeRegistry } from '@/lib/combat/simulation-engine';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';
import { COMBAT_TUNING_LEVERS } from '@/lib/combat/sweep-tuning';

export function ConfigPanel({ config, setConfig, registry = ENEMY_ARCHETYPE_BY_ID, catalogSourced }: {
  config: PredictiveBalanceConfig;
  setConfig: React.Dispatch<React.SetStateAction<PredictiveBalanceConfig>>;
  /** Archetypes the sweep will actually resolve — catalog-hydrated when available. */
  registry?: ArchetypeRegistry;
  /** Archetype ids that came from a bestiary row, so the option can say so. */
  catalogSourced?: ReadonlySet<string>;
}) {
  const archetypes = [...registry.values()];
  // Levers moved off DEFAULT_TUNING (by a cell solve's Apply) — shown so a run's
  // tuning is never invisible, with a one-click way back.
  const activeLevers = COMBAT_TUNING_LEVERS.filter(l => config.tuning[l.lever] !== DEFAULT_TUNING[l.lever]);
  return (
    <div className="space-y-3">
      {/* Parameter grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Level Range
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number" min={SWEEP_LEVEL_BOUNDS[0]} max={SWEEP_LEVEL_BOUNDS[1]}
              aria-label="Lowest player level"
              value={config.levelRange[0]}
              onChange={e => setConfig(c => ({ ...c, levelRange: [+e.target.value, c.levelRange[1]] }))}
              className="w-12 px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text text-center"
            />
            <span className="text-text-muted">&mdash;</span>
            <input
              type="number" min={SWEEP_LEVEL_BOUNDS[0]} max={SWEEP_LEVEL_BOUNDS[1]}
              aria-label="Highest player level"
              value={config.levelRange[1]}
              onChange={e => setConfig(c => ({ ...c, levelRange: [c.levelRange[0], +e.target.value] }))}
              className="w-12 px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text text-center"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Iterations
          </span>
          <select
            aria-label="Iterations"
            value={config.iterations}
            onChange={e => setConfig(c => ({ ...c, iterations: +e.target.value }))}
            className="px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text"
          >
            {[100, 200, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Gear
          </span>
          <select
            aria-label="Gear"
            value={config.gearId}
            onChange={e => setConfig(c => ({ ...c, gearId: e.target.value }))}
            className="px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text"
          >
            {GEAR_LOADOUTS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Level Step
          </span>
          <select
            aria-label="Level step"
            value={config.levelStep}
            onChange={e => setConfig(c => ({ ...c, levelStep: +e.target.value }))}
            className="px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text"
          >
            {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {activeLevers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="uppercase tracking-[0.15em] text-text-muted">Tuning</span>
          {activeLevers.map(l => (
            <span key={l.lever} className="px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text tabular-nums">
              {l.label} ×{+config.tuning[l.lever].toFixed(3)}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setConfig(c => ({ ...c, tuning: DEFAULT_TUNING }))}
            className="px-1.5 py-0.5 rounded border border-border/40 text-text-muted hover:text-text"
          >
            Reset tuning
          </button>
        </div>
      )}

      {/* Encounter setup */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
          Encounter Setup
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {config.enemyConfigs.map((ec, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-deep border border-border/30 text-xs font-mono"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: ENCOUNTER_COLORS[i % ENCOUNTER_COLORS.length] }}
              />
              <select
                aria-label={`Encounter ${i + 1} archetype`}
                value={ec.archetypeId}
                onChange={e => {
                  const archetypeId = e.target.value;
                  setConfig(c => {
                    const next = [...c.enemyConfigs];
                    next[i] = { ...next[i], archetypeId };
                    return { ...c, enemyConfigs: next };
                  });
                }}
                className="flex-1 bg-transparent text-text border-none outline-none"
              >
                {archetypes.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{catalogSourced?.has(a.id) ? ' (catalog)' : ''}
                  </option>
                ))}
              </select>
              <span className="text-text-muted">&times;</span>
              <input
                type="number" min={SWEEP_COUNT_BOUNDS[0]} max={SWEEP_COUNT_BOUNDS[1]}
                aria-label={`Encounter ${i + 1} enemy count`}
                value={ec.count}
                onChange={e => {
                  const count = +e.target.value;
                  setConfig(c => {
                    const next = [...c.enemyConfigs];
                    next[i] = { ...next[i], count };
                    return { ...c, enemyConfigs: next };
                  });
                }}
                className="w-8 px-1 py-0.5 rounded bg-surface border border-border/40 text-text text-center"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
