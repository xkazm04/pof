import { type ToolDef, reqStr, optStr, optNum, qs, obj, STR } from './shared.js';

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
    description:
      "One catalog's ordered steps plus its entities — the 'what is left to build' map. Steps are annotated with dual-execution info (`browserMirror`: 'direct'/'partial' when the step class also runs in the browser preview runtime; `browserHydratable` on the catalog when the preview can hydrate it today), so generation can plan a browser path alongside UE.",
    inputSchema: obj({ catalogId: STR }, ['catalogId']),
    example: { args: { catalogId: 'items' } },
    handler: async (args, pof) => {
      const catalogId = reqStr(args, 'catalogId');
      const cats = await pof.get<Array<{ catalogId: string }>>('/api/catalog/pipelines');
      const cat = cats.find((c) => c.catalogId === catalogId);
      if (!cat) throw new Error(`Unknown catalog: ${catalogId}. Known: ${cats.map((c) => c.catalogId).join(', ')}`);
      const entities = await pof.get(`/api/catalog/entities${qs({ catalogId })}`);
      // Dual-execution annotation — tolerate an app build without the preview routes.
      let browserHydratable: boolean | undefined;
      let mirrorBySteps: Record<string, string> | undefined;
      try {
        const map = await pof.get<{
          hydratable?: boolean;
          steps: Array<{ step: string; browserMirror: string }>;
        }>(`/api/preview/mirror-map${qs({ catalogId })}`);
        browserHydratable = map.hydratable;
        mirrorBySteps = Object.fromEntries(
          map.steps.filter((s) => s.browserMirror !== 'none').map((s) => [s.step, s.browserMirror]),
        );
      } catch {
        /* preview layer absent — return the plain pipeline */
      }
      return {
        ...cat,
        entities,
        ...(browserHydratable !== undefined ? { browserHydratable } : {}),
        ...(mirrorBySteps ? { browserMirror: mirrorBySteps } : {}),
      };
    },
  },
  {
    name: 'pof_preview_hydrate',
    description:
      "Dual-execution browser path: fetch a catalog's aggregated mechanics artifacts exactly as the browser preview runtime hydrates them (read-only; tuning goes through the graded artifact write paths). Use when a PoF project also targets a browser realization of the same SOR.",
    inputSchema: obj({ catalogId: STR }, ['catalogId']),
    example: { args: { catalogId: 'spellbook' } },
    handler: (args, pof) => pof.get(`/api/preview/hydrate${qs({ catalogId: reqStr(args, 'catalogId') })}`),
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
    name: 'pof_gate_evidence',
    description:
      'The PROOF behind drained L3/L4 gate verdicts: which abslog markers matched, the observed scenario stats + sampled observations, and the frame a visual verdict was judged from. Audit a pass/fail (or a whole catalog) WITHOUT re-running the gate — and see which gate rows carry no proof at all (`missing`), since an un-auditable verdict is itself a finding.',
    inputSchema: obj(
      {
        catalogId: STR,
        entityId: { type: 'string', description: 'Restrict to one entity.' },
        step: { type: 'string', description: 'Restrict to one step label.' },
        tier: { type: 'string', enum: ['L3', 'L4'], description: 'Restrict to one gate tier.' },
      },
      ['catalogId'],
    ),
    example: { args: { catalogId: 'items' } },
    handler: (args, pof) =>
      pof.get(
        `/api/pipeline-artifacts/drain/evidence${qs({
          catalogId: reqStr(args, 'catalogId'),
          entityId: optStr(args, 'entityId'),
          step: optStr(args, 'step'),
          tier: optStr(args, 'tier'),
        })}`,
      ),
  },
  {
    name: 'pof_drain_gates',
    description:
      'Run deferred L3/L4 Test Gates, turning "deferred" into pass/fail. SCOPE is yours to choose: no catalogId/entityId drains EVERYTHING (the global sweep — the only way a real entity\'s gate gets a verdict when its test name was only ever proven on a fixture), catalogId alone drains one catalog, entityIds is a multi-entity batch within a catalog, entityId is one entity. Use `limit` to cap cost (it bounds the batch BEFORE any editor boots). L3 runs on the live editor (bridge) or headless (allowSpawn — the UE editor must be CLOSED). For L4 VISUAL gates, pass projectPath + autoCapture:true to RENDER a real frame headlessly — the result\'s `screenshots` array holds PNG paths you MUST Read and judge with your own eyes: the automated visual judge catches only gross errors (T-pose, black scene, missing humanoid), not "the attack has no swing" or debug cruft. One drain at a time per scope (concurrent → 409; a global drain is exclusive with everything).',
    inputSchema: obj({
      catalogId: { type: 'string', description: 'Restrict to one catalog. Omit (with entityId omitted) for a GLOBAL drain of every deferred gate.' },
      entityId: { type: 'string', description: 'Restrict to one entity. Omit for catalog-wide/global.' },
      entityIds: {
        type: 'array',
        items: STR,
        description: 'Multi-entity batch within `catalogId` — ONE collection, ONE availability probe, ONE grouped editor boot for the whole set. All-or-nothing lease: 409 if ANY entity is already draining.',
      },
      tier: { type: 'string', enum: ['L3', 'L4'], description: 'Only drain this tier (default: both).' },
      limit: { type: 'number', description: 'Cap how many gates run this pass; bounds the batch before any UE boot.' },
      executor: { type: 'string', enum: ['bridge', 'spawn'], description: "L3 mechanism: 'bridge' (live editor plugin, default) or 'spawn' (headless UnrealEditor-Cmd; also set allowSpawn)." },
      allowSpawn: { type: 'boolean', description: 'Enable the headless spawn executor (implies executor:"spawn"). Needs POF_UE_EDITOR_CMD + POF_UE_UPROJECT and a CLOSED editor.' },
      port: { type: 'number', description: 'Bridge port override (default 30040).' },
      screenshotPath: { type: 'string', description: 'L4: an operator-supplied PNG to judge instead of capturing one.' },
      visualMode: { type: 'string', enum: ['hud', 'texture', 'lighting', 'character'], description: 'L4 visual-judge rubric.' },
      projectPath: { type: 'string', description: 'UE project path — required with autoCapture.' },
      autoCapture: { type: 'boolean', description: 'L4: render the frame autonomously (headless -game -RenderOffScreen). Requires projectPath.' },
    }),
    // No static `example` — it is in EXAMPLE_SKIP (a drain needs a live editor and WRITES verdicts).
    handler: (args, pof) => {
      const allowSpawn = args.allowSpawn === true;
      const executor = allowSpawn ? 'spawn' : optStr(args, 'executor');
      const projectPath = optStr(args, 'projectPath');
      const autoCapture = args.autoCapture === true && !!projectPath;
      const entityIds = Array.isArray(args.entityIds)
        ? args.entityIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : undefined;
      // Scope is fully optional — omitting catalogId AND entityId is the GLOBAL drain.
      return pof.post('/api/pipeline-artifacts/drain', {
        ...(optStr(args, 'catalogId') ? { catalogId: optStr(args, 'catalogId') } : {}),
        ...(optStr(args, 'entityId') ? { entityId: optStr(args, 'entityId') } : {}),
        ...(entityIds?.length ? { entityIds } : {}),
        ...(optStr(args, 'tier') ? { tier: optStr(args, 'tier') } : {}),
        ...(optNum(args, 'limit') !== undefined ? { limit: optNum(args, 'limit') } : {}),
        ...(executor ? { executor } : {}),
        ...(allowSpawn ? { allowSpawn: true } : {}),
        ...(optNum(args, 'port') !== undefined ? { port: optNum(args, 'port') } : {}),
        ...(optStr(args, 'screenshotPath') ? { screenshotPath: optStr(args, 'screenshotPath') } : {}),
        ...(optStr(args, 'visualMode') ? { visualMode: optStr(args, 'visualMode') } : {}),
        ...(autoCapture ? { autoCapture: true, projectPath } : {}),
      });
    },
  },
];
