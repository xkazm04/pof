'use client';

import {
  ENCOUNTER_COLORS, ENEMY_ARCHETYPES, GEAR_LOADOUTS,
  type PredictiveBalanceConfig,
} from './data';

export function ConfigPanel({ config, setConfig }: {
  config: PredictiveBalanceConfig;
  setConfig: React.Dispatch<React.SetStateAction<PredictiveBalanceConfig>>;
}) {
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
              type="number" min={1} max={50}
              value={config.levelRange[0]}
              onChange={e => setConfig(c => ({ ...c, levelRange: [+e.target.value, c.levelRange[1]] }))}
              className="w-12 px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text text-center"
            />
            <span className="text-text-muted">&mdash;</span>
            <input
              type="number" min={1} max={50}
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
            value={config.levelStep}
            onChange={e => setConfig(c => ({ ...c, levelStep: +e.target.value }))}
            className="px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text"
          >
            {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

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
                value={ec.archetypeId}
                onChange={e => {
                  const next = [...config.enemyConfigs];
                  next[i] = { ...next[i], archetypeId: e.target.value };
                  setConfig(c => ({ ...c, enemyConfigs: next }));
                }}
                className="flex-1 bg-transparent text-text border-none outline-none"
              >
                {ENEMY_ARCHETYPES.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <span className="text-text-muted">&times;</span>
              <input
                type="number" min={1} max={10}
                value={ec.count}
                onChange={e => {
                  const next = [...config.enemyConfigs];
                  next[i] = { ...next[i], count: +e.target.value };
                  setConfig(c => ({ ...c, enemyConfigs: next }));
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
