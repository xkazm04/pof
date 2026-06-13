import { type ToolDef, reqStr, optStr, optNum, reqObj, qs, obj, STR, NUM, BOOL } from './shared.js';

const PORTQ = (args: Record<string, unknown>) => (optNum(args, 'port') != null ? { port: optNum(args, 'port') } : {});

/**
 * UE truth & growth. The pof-bridge/* tools need a live editor (degrade gracefully when
 * offline). The filesystem/ue5-source scans + ue5-bridge build queue read disk and work
 * WITHOUT a live editor — they report ground truth a test can assert the project grew by.
 * Raw UE control (run a script, capture a viewport) stays with mcp-unreal.
 */
export const UE_TOOLS: ToolDef[] = [
  {
    name: 'pof_ue_status',
    description: 'PoF bridge plugin status: connection, engine/plugin version, editor state (idle/pie/compiling), manifest asset count. Returns { connected:false } when the editor is offline.',
    inputSchema: obj({ port: NUM }),
    example: { args: {}, note: 'Returns connected:false when the UE editor is not running.' },
    handler: (args, pof) => pof.get(`/api/pof-bridge/status${qs(PORTQ(args))}`),
  },
  {
    name: 'pof_ue_manifest',
    description: 'The UE project asset manifest (blueprints, materials, anim assets, data tables) + a content checksum. Asset count is a growth metric. Needs a live editor.',
    inputSchema: obj({ port: NUM, checksumOnly: BOOL }),
    handler: (args, pof) => pof.get(`/api/pof-bridge/manifest${qs({ ...PORTQ(args), ...(args.checksumOnly === true ? { 'checksum-only': 'true' } : {}) })}`),
  },
  {
    name: 'pof_ue_compile',
    description: 'Trigger a live-coding compile of the UE C++ and wait for the result (status + diagnostics with file/line/severity). Needs a live editor.',
    inputSchema: obj({ waitForComplete: BOOL, timeoutSeconds: NUM, port: NUM }),
    handler: (args, pof) =>
      pof.post(`/api/pof-bridge/compile${qs(PORTQ(args))}`, {
        ...(args.waitForComplete != null ? { waitForComplete: args.waitForComplete === true } : {}),
        ...(optNum(args, 'timeoutSeconds') != null ? { timeoutSeconds: optNum(args, 'timeoutSeconds') } : {}),
      }),
  },
  {
    name: 'pof_ue_run_tests',
    description: 'Run UE automation tests matching a filter (async). Poll pof_ue_test_results for verdicts. Needs a live editor with PIE.',
    inputSchema: obj({ filter: STR, flags: { type: 'array', items: STR }, port: NUM }, ['filter']),
    handler: (args, pof) =>
      pof.post(`/api/pof-bridge/test${qs(PORTQ(args))}`, {
        action: 'run-automation',
        filter: reqStr(args, 'filter'),
        ...(Array.isArray(args.flags) ? { flags: args.flags } : {}),
      }),
  },
  {
    name: 'pof_ue_test_results',
    description: 'Fetch UE automation test results (status, assertions, logs). Omit testId for all recent results.',
    inputSchema: obj({ testId: STR, port: NUM }),
    handler: (args, pof) => pof.get(`/api/pof-bridge/test${qs({ ...PORTQ(args), ...(optStr(args, 'testId') ? { testId: optStr(args, 'testId') } : {}) })}`),
  },
  {
    name: 'pof_ue_scan_project',
    description: "Scan the UE project's Source/ on disk: C++ classes, plugins, build deps, file count. Works WITHOUT a live editor. Class count is a growth metric.",
    inputSchema: obj({ projectPath: STR, moduleName: STR }, ['projectPath']),
    handler: (args, pof) =>
      pof.post('/api/filesystem/scan-project', { projectPath: reqStr(args, 'projectPath'), ...(optStr(args, 'moduleName') ? { moduleName: optStr(args, 'moduleName') } : {}) }),
  },
  {
    name: 'pof_ue_scan_assets',
    description: 'Inventory the UE project Content/ on disk: all .uasset/.umap files, sizes, inferred dependencies. Works WITHOUT a live editor. Asset count/size are growth metrics.',
    inputSchema: obj({ projectPath: STR }, ['projectPath']),
    handler: (args, pof) => pof.post('/api/filesystem/scan-assets', { projectPath: reqStr(args, 'projectPath') }),
  },
  {
    name: 'pof_ue_verify_semantic',
    description: 'Verify C++ classes match design expectations (members/functions/components present): per-item status (full|partial|stub|missing) + completeness %. Works WITHOUT a live editor.',
    inputSchema: obj({ projectPath: STR, items: { type: 'array', items: { type: 'object' } } }, ['projectPath', 'items']),
    handler: (args, pof) => {
      if (!Array.isArray(args.items)) throw new Error('"items" (array of { itemId, filePath? }) is required');
      return pof.post('/api/filesystem/verify-semantic', { projectPath: reqStr(args, 'projectPath'), items: args.items });
    },
  },
  {
    name: 'pof_ue_source_parse',
    description: 'Offline parse of the UE C++ ability-system source (classes, functions, properties). Works WITHOUT a live editor.',
    inputSchema: obj({ projectPath: STR }, ['projectPath']),
    handler: (args, pof) => pof.post('/api/ue5-source/parse', { projectPath: reqStr(args, 'projectPath') }),
  },
  {
    name: 'pof_ue_build',
    description: 'Enqueue a local C++ build (UBT) of the UE project. Returns a buildId; poll pof_ue_build_status. Runs locally — does NOT need a live editor.',
    inputSchema: obj(
      { projectPath: STR, targetName: STR, ueVersion: STR, platform: STR, configuration: STR },
      ['projectPath', 'targetName', 'ueVersion'],
    ),
    handler: (args, pof) =>
      pof.post('/api/ue5-bridge/build', {
        action: 'start',
        projectPath: reqStr(args, 'projectPath'),
        targetName: reqStr(args, 'targetName'),
        ueVersion: reqStr(args, 'ueVersion'),
        ...(optStr(args, 'platform') ? { platform: optStr(args, 'platform') } : {}),
        ...(optStr(args, 'configuration') ? { configuration: optStr(args, 'configuration') } : {}),
      }),
  },
  {
    name: 'pof_ue_build_status',
    description: 'Build status by id, or the queue + history for a project path.',
    inputSchema: obj({ buildId: STR, projectPath: STR }),
    handler: (args, pof) =>
      pof.get(`/api/ue5-bridge/build${qs({ ...(optStr(args, 'buildId') ? { buildId: optStr(args, 'buildId') } : {}), ...(optStr(args, 'projectPath') ? { projectPath: optStr(args, 'projectPath') } : {}) })}`),
  },
  {
    name: 'pof_ue_build_health',
    description: 'Build reliability report for a project: success rate, duration trend, slowest targets, recurring error fingerprints, regression alerts. Reads the build-history DB.',
    inputSchema: obj({ projectPath: STR, limit: NUM }, ['projectPath']),
    handler: (args, pof) =>
      pof.get(`/api/ue5-bridge/build-health${qs({ projectPath: reqStr(args, 'projectPath'), ...(optNum(args, 'limit') != null ? { limit: optNum(args, 'limit') } : {}) })}`),
  },
  {
    name: 'pof_asset_code_oracle',
    description: 'Analyze C++ ↔ asset consistency from pre-scanned data (classes + assets + dependencies → mismatches, missing refs, broken deps). Pure analysis.',
    inputSchema: obj({ classes: { type: 'array' }, assets: { type: 'array' }, dependencies: { type: 'array' } }, ['classes', 'assets', 'dependencies']),
    example: { args: { classes: [], assets: [], dependencies: [] }, note: 'Empty inputs document the result shape; feed real scans for a true audit.' },
    handler: (args, pof) =>
      pof.post('/api/asset-code-oracle', { classes: args.classes ?? [], assets: args.assets ?? [], dependencies: args.dependencies ?? [] }),
  },
  {
    name: 'pof_package_preflight',
    description: 'Validate the UE project before a cook (fast lint / build-verify / asset-validation): per-check results + overall pass|fail. Runs locally.',
    inputSchema: obj(
      { projectPath: STR, projectName: STR, ueVersion: STR, mapName: STR, check: { type: 'string', enum: ['fast', 'build-verify-editor', 'build-verify-shipping', 'asset-validation'] } },
      ['projectPath', 'projectName', 'ueVersion'],
    ),
    handler: (args, pof) =>
      pof.post('/api/packaging/preflight', {
        projectPath: reqStr(args, 'projectPath'),
        projectName: reqStr(args, 'projectName'),
        ueVersion: reqStr(args, 'ueVersion'),
        ...(optStr(args, 'mapName') ? { mapName: optStr(args, 'mapName') } : {}),
        ...(optStr(args, 'check') ? { check: optStr(args, 'check') } : {}),
      }),
  },
  {
    name: 'pof_package_history',
    description: 'Query the persistent build/cook history: list builds, stats, size trend, platforms, or version. Final .exe sizes are a growth/shipping metric.',
    inputSchema: obj({ action: { type: 'string', enum: ['list', 'get', 'stats', 'trend', 'platforms', 'version'] }, limit: NUM, id: STR, platform: STR }),
    example: { args: { action: 'list' } },
    handler: (args, pof) =>
      pof.get(`/api/packaging/history${qs({ action: optStr(args, 'action') ?? 'list', ...(optNum(args, 'limit') != null ? { limit: optNum(args, 'limit') } : {}), ...(optStr(args, 'id') ? { id: optStr(args, 'id') } : {}), ...(optStr(args, 'platform') ? { platform: optStr(args, 'platform') } : {}) })}`),
  },
];
