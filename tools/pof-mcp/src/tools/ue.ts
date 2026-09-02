import type { PofClient } from '../pofClient.js';
import { type ToolDef, reqStr, optStr, optNum, reqObj, qs, obj, STR, NUM, BOOL, readOnly, writes } from './shared.js';

const PORTQ = (args: Record<string, unknown>) => (optNum(args, 'port') != null ? { port: optNum(args, 'port') } : {});

/**
 * Write a UE automation payload back to the deferred L3 gates waiting on that test.
 *
 * The app route owns ALL the truth (which gates want the test, what the payload means, how a
 * verdict is persisted, and the drain lease) — this is only the proxy. A settle that cannot
 * happen is REPORTED, never swallowed: a 409 (a drain holds the scope) or any other failure
 * comes back as `{ error }` alongside the test result, so the agent is never told a gate moved
 * when it did not.
 */
async function settleGates(
  pof: PofClient,
  testName: string,
  result: unknown,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await pof.post('/api/pipeline-artifacts/drain/settle-test', {
      testName,
      result,
      ...(optStr(args, 'catalogId') ? { catalogId: optStr(args, 'catalogId') } : {}),
      ...(optStr(args, 'entityId') ? { entityId: optStr(args, 'entityId') } : {}),
    });
  } catch (e) {
    return { settled: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

const HISTORY_PATH = '/api/packaging/history';

// ── build wait ───────────────────────────────────────────────────────────────

/**
 * The build queue's terminal states (`BuildStatus` in `src/types/ue5-bridge.ts`).
 * `queued` and `running` are the only two a wait can usefully sit on.
 */
const BUILD_TERMINAL = new Set(['success', 'failed', 'aborted']);

/** Ceiling on a caller-requested wait. A tool that can hang a session forever is a hazard. */
export const BUILD_WAIT_MAX_S = 300;
/** How often the wait re-reads. Local HTTP to the app — cheap next to a UBT build. */
export const BUILD_WAIT_POLL_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'status' in payload) {
    const s = (payload as { status: unknown }).status;
    if (typeof s === 'string') return s;
  }
  return null;
}

/**
 * Poll `read` until the build settles or the budget runs out.
 *
 * `pof_ue_build` hands back a buildId and says "poll pof_ue_build_status", which costs the
 * agent one assistant turn per read for the whole length of a UBT build. MCP for Unity hit
 * the same shape with `run_tests` → `get_test_job` and added a `wait_timeout` for the same
 * two reasons: fewer round trips, and no client-side loop detection tripping on a run of
 * identical calls.
 *
 * Two honesty rules the rest of pof-mcp already holds to apply here:
 *  - a wait that runs out returns the LAST REAL status and `settled: false` — never a
 *    verdict the queue did not give;
 *  - a read that fails (a 404 for an unknown buildId) is returned at once, not retried
 *    until the budget expires: it will not become terminal by waiting.
 */
export async function waitForBuild(
  read: () => Promise<unknown>,
  requestedSeconds: number,
  opts: { pollMs?: number; now?: () => number } = {},
): Promise<unknown> {
  const pollMs = opts.pollMs ?? BUILD_WAIT_POLL_MS;
  const now = opts.now ?? Date.now;
  const budgetS = Math.min(requestedSeconds, BUILD_WAIT_MAX_S);
  const deadline = now() + budgetS * 1000;
  const startedAt = now();
  let polls = 0;
  let last: unknown;
  let status: string | null = null;

  for (;;) {
    polls += 1;
    try {
      last = await read();
    } catch (e) {
      return {
        result: last ?? null,
        wait: {
          requestedSeconds,
          budgetSeconds: budgetS,
          polls,
          settled: false,
          error: e instanceof Error ? e.message : String(e),
          note: 'the status read FAILED — returned immediately rather than waiting out the budget on a build that will never settle',
        },
      };
    }
    status = statusOf(last);
    if (status != null && BUILD_TERMINAL.has(status)) break;
    if (now() >= deadline) break;
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }

  const settled = status != null && BUILD_TERMINAL.has(status);
  return {
    result: last,
    wait: {
      requestedSeconds,
      budgetSeconds: budgetS,
      ...(budgetS < requestedSeconds ? { clamped: `waitSeconds was capped at ${BUILD_WAIT_MAX_S}` } : {}),
      waitedMs: now() - startedAt,
      polls,
      settled,
      status,
      note: settled
        ? `build reached the terminal state "${status}"`
        : `build is still "${status ?? 'unknown'}" after ${budgetS}s — this is NOT a verdict; call again with waitSeconds to keep waiting`,
    },
  };
}

/**
 * What a build-history read could and could NOT see, in the agent's own response.
 *
 * `build_history.project_id` is scoped by the app's one own-plus-legacy rule
 * (`projectScopeSql`): a NAMED project sees its own rows plus the unattributed legacy
 * `''` rows, and an UNSCOPED caller sees ONLY the legacy set — it does not silently get
 * everything. `pof_package_history` passed no project at all, so every headless query
 * answered from the pre-attribution rows and could not see a single build cooked since.
 *
 * The scope counts come from the route's own `action=scope` (never recomputed here), and
 * a scope lookup that fails is REPORTED beside the result rather than swallowed — an
 * agent must never read "0 builds" as "you have never built".
 */
async function historyScope(pof: PofClient, projectPath: string | undefined): Promise<unknown> {
  const note = projectPath
    ? `Scoped to project "${projectPath}": this read sees that project's builds PLUS the unattributed legacy rows (project_id = '').`
    : 'UNSCOPED — no projectPath was given, so this read sees ONLY the unattributed legacy rows '
      + "(project_id = ''), NOT every build. Builds recorded under a named project are excluded. "
      + 'Pass projectPath to see a project\'s own cooks.';
  let counts: unknown;
  try {
    const res = await pof.get<{ scope?: unknown }>(
      `${HISTORY_PATH}${qs({ action: 'scope', ...(projectPath ? { projectPath } : {}) })}`,
    );
    counts = res && typeof res === 'object' && 'scope' in res ? res.scope : res;
  } catch (e) {
    counts = { error: e instanceof Error ? e.message : String(e) };
  }
  return { projectPath: projectPath ?? null, scoped: !!projectPath, note, counts };
}

/**
 * UE truth & growth. The pof-bridge/* tools need a live editor (degrade gracefully when
 * offline). The filesystem/ue5-source scans + ue5-bridge build queue read disk and work
 * WITHOUT a live editor — they report ground truth a test can assert the project grew by.
 * Raw UE control (run a script, capture a viewport) stays with mcp-unreal.
 */
export const UE_TOOLS: ToolDef[] = [
  {
    name: 'pof_ue_status',
    annotations: readOnly('UE status'),
    description: 'PoF bridge plugin status: connection, engine/plugin version, editor state (idle/pie/compiling), manifest asset count. Returns { connected:false } when the editor is offline.',
    inputSchema: obj({ port: NUM }),
    example: { args: {}, note: 'Returns connected:false when the UE editor is not running.' },
    handler: (args, pof) => pof.get(`/api/pof-bridge/status${qs(PORTQ(args))}`),
  },
  {
    name: 'pof_ue_manifest',
    annotations: readOnly('UE manifest'),
    description: 'The UE project asset manifest (blueprints, materials, anim assets, data tables) + a content checksum. Asset count is a growth metric. Needs a live editor.',
    inputSchema: obj({ port: NUM, checksumOnly: BOOL }),
    handler: (args, pof) => pof.get(`/api/pof-bridge/manifest${qs({ ...PORTQ(args), ...(args.checksumOnly === true ? { 'checksum-only': 'true' } : {}) })}`),
  },
  {
    name: 'pof_ue_compile',
    annotations: writes('UE compile'),
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
    annotations: writes('UE run tests'),
    description:
      'Run UE automation tests matching a filter and SETTLE the deferred L3 gates waiting on that test — running the test a gate waits on now closes the loop instead of leaving it deferred for a drain. Set settle:false for a raw run. Settling reuses the drain\'s own truth (same verdict semantics, same "planned, not registered in UE" deferral) and respects the drain lease: if a drain holds the scope the settle is refused rather than clobbering it. Results matching no gate change nothing and say so. Needs a live editor with PIE.',
    inputSchema: obj({
      filter: STR,
      flags: { type: 'array', items: STR },
      port: NUM,
      settle: { type: 'boolean', description: 'Write the result back to matching deferred gates (default true).' },
      catalogId: { type: 'string', description: 'Narrow the settle to one catalog (default: every gate waiting on this test).' },
      entityId: { type: 'string', description: 'Narrow the settle to one entity.' },
    }, ['filter']),
    handler: async (args, pof) => {
      const filter = reqStr(args, 'filter');
      const result = await pof.post(`/api/pof-bridge/test${qs(PORTQ(args))}`, {
        action: 'run-automation',
        filter,
        ...(Array.isArray(args.flags) ? { flags: args.flags } : {}),
      });
      if (args.settle === false) return { result, settle: { skipped: 'settle:false — no gate was updated' } };
      return { result, settle: await settleGates(pof, filter, result, args) };
    },
  },
  {
    name: 'pof_ue_test_results',
    annotations: writes('UE test results', { idempotent: true }),
    description:
      'Fetch UE automation test results (status, assertions, logs) and, when `testName` is given, SETTLE the deferred L3 gates waiting on that test from the fetched payload — the poll-then-close-the-loop half of pof_ue_run_tests (use it when a run came back non-terminal). Without `testName` it is a plain read that changes nothing. Omit testId for all recent results.',
    inputSchema: obj({
      testId: STR,
      port: NUM,
      testName: { type: 'string', description: 'The automation test name to settle gates for. Omit to only read results.' },
      catalogId: { type: 'string', description: 'Narrow the settle to one catalog.' },
      entityId: { type: 'string', description: 'Narrow the settle to one entity.' },
    }),
    handler: async (args, pof) => {
      const result = await pof.get(`/api/pof-bridge/test${qs({ ...PORTQ(args), ...(optStr(args, 'testId') ? { testId: optStr(args, 'testId') } : {}) })}`);
      const testName = optStr(args, 'testName');
      if (!testName) return result;
      return { result, settle: await settleGates(pof, testName, result, args) };
    },
  },
  {
    name: 'pof_ue_scan_project',
    annotations: readOnly('UE scan project'),
    description: "Scan the UE project's Source/ on disk: C++ classes, plugins, build deps, file count. Works WITHOUT a live editor. Class count is a growth metric.",
    inputSchema: obj({ projectPath: STR, moduleName: STR }, ['projectPath']),
    handler: (args, pof) =>
      pof.post('/api/filesystem/scan-project', { projectPath: reqStr(args, 'projectPath'), ...(optStr(args, 'moduleName') ? { moduleName: optStr(args, 'moduleName') } : {}) }),
  },
  {
    name: 'pof_ue_scan_assets',
    annotations: readOnly('UE scan assets'),
    description: 'Inventory the UE project Content/ on disk: all .uasset/.umap files, sizes, inferred dependencies. Works WITHOUT a live editor. Asset count/size are growth metrics.',
    inputSchema: obj({ projectPath: STR }, ['projectPath']),
    handler: (args, pof) => pof.post('/api/filesystem/scan-assets', { projectPath: reqStr(args, 'projectPath') }),
  },
  {
    name: 'pof_ue_verify_semantic',
    annotations: readOnly('UE verify semantic'),
    description: 'Verify C++ classes match design expectations (members/functions/components present): per-item status (full|partial|stub|missing) + completeness %. Works WITHOUT a live editor.',
    inputSchema: obj({ projectPath: STR, items: { type: 'array', items: { type: 'object' } } }, ['projectPath', 'items']),
    handler: (args, pof) => {
      if (!Array.isArray(args.items)) throw new Error('"items" (array of { itemId, filePath? }) is required');
      return pof.post('/api/filesystem/verify-semantic', { projectPath: reqStr(args, 'projectPath'), items: args.items });
    },
  },
  {
    name: 'pof_ue_source_parse',
    annotations: readOnly('UE source parse'),
    description: 'Offline parse of the UE C++ ability-system source (classes, functions, properties). Works WITHOUT a live editor.',
    inputSchema: obj({ projectPath: STR }, ['projectPath']),
    handler: (args, pof) => pof.post('/api/ue5-source/parse', { projectPath: reqStr(args, 'projectPath') }),
  },
  {
    name: 'pof_ue_build',
    annotations: writes('UE build'),
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
    annotations: readOnly('UE build status'),
    description:
      'Build status by id, or the queue + history for a project path. Pass `waitSeconds` with a `buildId` to WAIT for the build to reach a terminal state (success/failed/aborted) instead of returning a "running" you then have to poll for by hand — one call that blocks is cheaper than twenty that do not, and it keeps a long UBT build from filling the transcript with identical status reads. The wait always reports whether it actually settled; a build still running when the budget runs out comes back non-terminal and says so, never as a verdict.',
    inputSchema: obj({
      buildId: STR,
      projectPath: STR,
      waitSeconds: {
        type: 'number',
        description: `Wait up to this many seconds (capped at ${BUILD_WAIT_MAX_S}) for the build to finish before returning. Requires buildId. Returns as soon as it settles. Omit for an immediate read.`,
      },
    }),
    handler: async (args, pof) => {
      const buildId = optStr(args, 'buildId');
      const read = () =>
        pof.get<unknown>(`/api/ue5-bridge/build${qs({ ...(buildId ? { buildId } : {}), ...(optStr(args, 'projectPath') ? { projectPath: optStr(args, 'projectPath') } : {}) })}`);

      const requested = optNum(args, 'waitSeconds');
      if (requested == null || requested <= 0) return read();
      if (!buildId) {
        // A queue/history read has no terminal state to wait for — say so rather than
        // sleeping for nothing and returning the same list a moment later.
        return { result: await read(), wait: { skipped: 'waitSeconds needs a buildId — a queue/history read never settles' } };
      }
      return waitForBuild(read, requested);
    },
  },
  {
    name: 'pof_ue_build_health',
    annotations: readOnly('UE build health'),
    description: 'Build reliability report for a project: success rate, duration trend, slowest targets, recurring error fingerprints, regression alerts. Reads the build-history DB.',
    inputSchema: obj({ projectPath: STR, limit: NUM }, ['projectPath']),
    handler: (args, pof) =>
      pof.get(`/api/ue5-bridge/build-health${qs({ projectPath: reqStr(args, 'projectPath'), ...(optNum(args, 'limit') != null ? { limit: optNum(args, 'limit') } : {}) })}`),
  },
  {
    name: 'pof_asset_code_oracle',
    annotations: readOnly('Asset-code oracle'),
    description: 'Analyze C++ ↔ asset consistency from pre-scanned data (classes + assets + dependencies → mismatches, missing refs, broken deps). Pure analysis.',
    inputSchema: obj({ classes: { type: 'array' }, assets: { type: 'array' }, dependencies: { type: 'array' } }, ['classes', 'assets', 'dependencies']),
    example: { args: { classes: [], assets: [], dependencies: [] }, note: 'Empty inputs document the result shape; feed real scans for a true audit.' },
    handler: (args, pof) =>
      pof.post('/api/asset-code-oracle', { classes: args.classes ?? [], assets: args.assets ?? [], dependencies: args.dependencies ?? [] }),
  },
  {
    name: 'pof_package_preflight',
    annotations: writes('Package preflight'),
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
    annotations: readOnly('Package history'),
    description:
      'Query the persistent build/cook history: list builds, stats, size trend, platforms, or version. Final .exe sizes are a growth/shipping metric. SCOPE IT with `projectPath`: build rows carry the project that cooked them, and WITHOUT a projectPath this reads ONLY the unattributed legacy rows recorded before builds carried a project — never every build. The response always states which view you got and what it could not see.',
    inputSchema: obj({
      action: { type: 'string', enum: ['list', 'get', 'stats', 'trend', 'platforms', 'version', 'scope', 'dashboard'] },
      limit: NUM,
      id: STR,
      platform: STR,
      projectPath: {
        type: 'string',
        description: 'Absolute UE project path to scope the read to (that project\'s builds + the unattributed legacy rows). Stated EXPLICITLY — never inferred server-side. Omit only when you want the legacy/unattributed view.',
      },
    }),
    example: { args: { action: 'list' }, note: 'No projectPath = the legacy/unattributed view; the response says so.' },
    handler: async (args, pof) => {
      const projectPath = optStr(args, 'projectPath');
      const result = await pof.get(
        `${HISTORY_PATH}${qs({
          action: optStr(args, 'action') ?? 'list',
          ...(optNum(args, 'limit') != null ? { limit: optNum(args, 'limit') } : {}),
          ...(optStr(args, 'id') ? { id: optStr(args, 'id') } : {}),
          ...(optStr(args, 'platform') ? { platform: optStr(args, 'platform') } : {}),
          ...(projectPath ? { projectPath } : {}),
        })}`,
      );
      return { result, scope: await historyScope(pof, projectPath) };
    },
  },
];
