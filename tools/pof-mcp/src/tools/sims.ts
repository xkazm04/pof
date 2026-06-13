import { type ToolDef, reqStr, reqObj, optStr, optNum, qs, obj, STR, NUM, OBJ } from './shared.js';

/** Simulation & balance: Monte-Carlo combat, economy agent-sim, sensitivity sweep, GAS/stat specs. */
export const SIM_TOOLS: ToolDef[] = [
  {
    name: 'pof_combat_catalog',
    description:
      'Combat-sim inputs: enemy archetypes, player ability templates, gear loadouts, and the default tuning + sim config. Use this to build a scenario for pof_combat_simulate.',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/combat-simulator'),
  },
  {
    name: 'pof_combat_simulate',
    description:
      'Run a Monte-Carlo combat simulation. Returns per-fight results, an aggregated summary (survival rate, durations, ability heatmap, threat breakdown), and balance alerts. Pass a fixed config.seed for reproducible results.',
    inputSchema: obj(
      {
        scenario: { type: 'object', description: 'Enemies + count + player level + abilities + gear (see pof_combat_catalog).' },
        config: { type: 'object', description: '{ iterations (1–5000), seed, maxFightDurationSec }.' },
        tuning: { type: 'object', description: 'Optional health/damage/armor multipliers (0.5–2.0).' },
      },
      ['scenario'],
    ),
    handler: (args, pof) =>
      pof.post('/api/combat-simulator', {
        action: 'simulate',
        scenario: reqObj(args, 'scenario'),
        ...(args.config && typeof args.config === 'object' ? { config: args.config } : {}),
        ...(args.tuning && typeof args.tuning === 'object' ? { tuning: args.tuning } : {}),
      }),
  },
  {
    name: 'pof_economy_catalog',
    description:
      'Economy-sim inputs: faucet/sink flows, items (categories + prices), the XP curve, and the default simulation config. Use this to build a config for pof_economy_simulate.',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/economy-simulator'),
  },
  {
    name: 'pof_economy_simulate',
    description:
      'Run the economy agent-simulation. Returns per-level metrics (gold, gini, inflow/outflow, velocity), supply/demand curves, and inflation alerts. Pass a fixed config.seed for reproducibility.',
    inputSchema: obj({ config: { type: 'object', description: 'SimulationConfig (agentCount, maxLevel, maxPlayHours, philosophy, seed, overrides).' } }, ['config']),
    handler: (args, pof) => pof.post('/api/economy-simulator', { action: 'simulate', config: reqObj(args, 'config') }),
  },
  {
    name: 'pof_economy_sweep',
    description:
      'One-at-a-time sensitivity sweep: perturbs each economy parameter and ranks them by impact on the chosen output (tornado chart). config must include a seed.',
    inputSchema: obj(
      {
        config: OBJ,
        output: { type: 'string', enum: ['gini', 'netFlow', 'criticalAlerts'] },
        range: { type: 'number', description: '0.05–0.9 perturbation band.' },
      },
      ['config', 'output'],
    ),
    handler: (args, pof) =>
      pof.post('/api/economy-simulator/sweep', {
        config: reqObj(args, 'config'),
        output: reqStr(args, 'output'),
        ...(optNum(args, 'range') != null ? { range: optNum(args, 'range') } : {}),
      }),
  },
  {
    name: 'pof_balance_baseline',
    description: 'Read the stored balance baseline (threat score + stat snapshot) for an entity — the reference for regression diffs. Returns null if none stored.',
    inputSchema: obj({ catalogId: STR, entityId: STR }, ['catalogId', 'entityId']),
    example: { args: { catalogId: 'bestiary', entityId: 'brute' } },
    handler: (args, pof) =>
      pof.get(`/api/balance-baseline${qs({ catalogId: reqStr(args, 'catalogId'), entityId: reqStr(args, 'entityId') })}`),
  },
  {
    name: 'pof_ability_spec',
    description: 'Read the stored GAS ability spec (effects + tag rules) for an entity — drives round-trip UE codegen. Returns null if none stored.',
    inputSchema: obj({ catalogId: STR, entityId: STR }, ['catalogId', 'entityId']),
    example: { args: { catalogId: 'spellbook', entityId: 'off-fire-01' } },
    handler: (args, pof) =>
      pof.get(`/api/ability-spec${qs({ catalogId: reqStr(args, 'catalogId'), entityId: reqStr(args, 'entityId') })}`),
  },
];
