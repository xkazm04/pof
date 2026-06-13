import { type ToolDef, reqStr, optStr, qs, obj, STR } from './shared.js';

/** Pipeline loop: discover → recipe → submit → accept → drain. */
export const PIPELINE_TOOLS: ToolDef[] = [
  {
    name: 'pof_list_catalogs',
    description:
      'List every PoF catalog (items, currency, bestiary, quests, …) with its ordered Produce steps and seeded entity count. Start here to see what can be built.',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/catalog/pipelines'),
  },
  {
    name: 'pof_list_entities',
    description:
      'List the seeded entities of one catalog with their current lifecycle state. Pick an entity to drive through its pipeline.',
    inputSchema: obj({ catalogId: STR }, ['catalogId']),
    example: { args: { catalogId: 'items' } },
    handler: (args, pof) => pof.get(`/api/catalog/entities${qs({ catalogId: reqStr(args, 'catalogId') })}`),
  },
  {
    name: 'pof_get_pipeline',
    description: "One catalog's ordered steps plus its entities — the 'what is left to build' map.",
    inputSchema: obj({ catalogId: STR }, ['catalogId']),
    example: { args: { catalogId: 'items' } },
    handler: async (args, pof) => {
      const catalogId = reqStr(args, 'catalogId');
      const cats = await pof.get<Array<{ catalogId: string }>>('/api/catalog/pipelines');
      const cat = cats.find((c) => c.catalogId === catalogId);
      if (!cat) throw new Error(`Unknown catalog: ${catalogId}. Known: ${cats.map((c) => c.catalogId).join(', ')}`);
      const entities = await pof.get(`/api/catalog/entities${qs({ catalogId })}`);
      return { ...cat, entities };
    },
  },
  {
    name: 'pof_get_step',
    description:
      "A step's RECIPE — the structure + truth you fulfil yourself: canon-prefixed prompt, View shape, UE asset targets, an example of passing data, the Acceptance contract, and any already-persisted artifact. Do the work (generate data, edit UE via mcp-unreal), then call pof_submit_artifact.",
    inputSchema: obj(
      { catalogId: STR, entityId: STR, step: STR, direction: { type: 'string', description: 'Optional direction woven into the prompt.' } },
      ['catalogId', 'entityId', 'step'],
    ),
    example: { args: { catalogId: 'items', entityId: 'item-1', step: 'Concept Brief' } },
    handler: (args, pof) =>
      pof.get(
        `/api/catalog/step-recipe${qs({
          catalogId: reqStr(args, 'catalogId'),
          entityId: reqStr(args, 'entityId'),
          step: reqStr(args, 'step'),
          direction: optStr(args, 'direction'),
        })}`,
      ),
  },
  {
    name: 'pof_submit_artifact',
    description:
      'Submit the work you produced for a step (data object + UE asset paths). The SERVER derives the acceptance verdict from the step\'s own checker — you never self-grade. On fail, read the reason and retry; L3/L4 "deferred" is upgraded later by pof_drain_gates.',
    inputSchema: obj(
      {
        catalogId: STR,
        entityId: STR,
        step: STR,
        data: { type: 'object', description: 'The produced artifact data.' },
        ueAssets: { type: 'array', items: STR, description: 'UE content paths created (e.g. /Game/Items/Sword/T_Sword_Icon).' },
      },
      ['catalogId', 'entityId', 'step', 'data'],
    ),
    handler: (args, pof) => {
      const data = args.data;
      if (data == null || typeof data !== 'object' || Array.isArray(data)) throw new Error('"data" (object) is required');
      const ueAssets = Array.isArray(args.ueAssets) ? args.ueAssets.filter((a): a is string => typeof a === 'string') : [];
      return pof.post('/api/catalog/step-submit', {
        catalogId: reqStr(args, 'catalogId'),
        entityId: reqStr(args, 'entityId'),
        step: reqStr(args, 'step'),
        data,
        ueAssets,
      });
    },
  },
  {
    name: 'pof_get_acceptance',
    description:
      "Persisted acceptance for a catalog (or one entity): every step's status/tier/reason plus a pass/pending/fail/deferred summary — the config-complete rollup.",
    inputSchema: obj({ catalogId: STR, entityId: STR }, ['catalogId']),
    example: { args: { catalogId: 'items' } },
    handler: async (args, pof) => {
      const catalogId = reqStr(args, 'catalogId');
      const entityId = optStr(args, 'entityId');
      const steps = await pof.get<Array<{ status: string }>>(`/api/pipeline-artifacts${qs({ catalogId, entityId })}`);
      const summary: Record<string, number> = { total: steps.length, pass: 0, pending: 0, fail: 0, deferred: 0 };
      for (const s of steps) summary[s.status] = (summary[s.status] ?? 0) + 1;
      return { catalogId, entityId: entityId ?? null, steps, summary };
    },
  },
  {
    name: 'pof_drain_gates',
    description:
      'Run the deferred L3/L4 Test Gates for an entity against the LIVE UE editor (via the PoF bridge), turning "deferred" gates into pass/fail. The editor is non-reentrant — one drain at a time (concurrent → 409). Set allowSpawn to use a headless editor.',
    inputSchema: obj(
      {
        catalogId: STR,
        entityId: STR,
        tier: { type: 'string', enum: ['L3', 'L4'] },
        allowSpawn: { type: 'boolean' },
      },
      ['catalogId', 'entityId'],
    ),
    handler: (args, pof) => {
      const allowSpawn = args.allowSpawn === true;
      return pof.post('/api/pipeline-artifacts/drain', {
        catalogId: reqStr(args, 'catalogId'),
        entityId: reqStr(args, 'entityId'),
        ...(optStr(args, 'tier') ? { tier: optStr(args, 'tier') } : {}),
        ...(allowSpawn ? { executor: 'spawn', allowSpawn: true } : {}),
      });
    },
  },
];
