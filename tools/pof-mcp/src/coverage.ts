/**
 * Coverage maps — kept honest by the Layer-0 guard in schema.test.ts.
 *
 * A tool may lack a static `example` only if it has a documented EXAMPLE_SKIP reason
 * (it's a write/live/path-dependent tool recorded dynamically by a bespoke case instead).
 * A registered pipeline may be absent from the MCP quality walker only with a
 * documented MCP_WALKER_SKIP reason. Never skip to dodge a real failure.
 */

/** tool name -> why it has no static contract example. */
export const EXAMPLE_SKIP: Record<string, string> = {
  pof_submit_artifact: 'write tool — recorded by the quality walker with a test-namespaced entity',
  pof_drain_gates: 'needs a live UE editor — recorded by the live growth suite',
  pof_harness_start: 'launches the autonomous loop — recorded by a bounded control-plane case',
  pof_harness_control: 'mutates harness state — recorded by a control-plane case',
  pof_harness_plan: 'returns 404 until a harness is started — recorded when a plan exists',
  pof_harness_guide: 'returns 404 until a guide exists — recorded when one exists',
  pof_harness_run: 'needs a concrete runId — recorded by a control-plane case once a run exists',
  pof_harness_run_diff: 'needs two concrete runIds — recorded by a control-plane case once runs exist',
  pof_combat_simulate: 'scenario built from pof_combat_catalog — recorded by the sim-quality case',
  pof_economy_simulate: 'config built from pof_economy_catalog — recorded by the sim-quality case',
  pof_economy_sweep: 'config built dynamically — recorded by the sim-quality case',
  pof_ue_manifest: 'needs a live UE editor (throws when offline, unlike status) — recorded by the growth suite',
  pof_ue_compile: 'needs a live UE editor — recorded by the growth suite',
  pof_ue_run_tests: 'needs a live UE editor — recorded by the growth suite',
  pof_ue_test_results: 'needs a live UE test run — recorded by the growth suite',
  pof_ue_scan_project: 'needs POF_UE_ROOT on disk — recorded by the UE suite',
  pof_ue_scan_assets: 'needs POF_UE_ROOT on disk — recorded by the UE suite',
  pof_ue_verify_semantic: 'needs POF_UE_ROOT + an item list — recorded by the UE suite',
  pof_ue_source_parse: 'needs POF_UE_ROOT on disk — recorded by the UE suite',
  pof_ue_build: 'enqueues a real build — recorded by the growth suite',
  pof_ue_build_status: 'needs a buildId / project path — recorded by the growth suite',
  pof_ue_build_health: 'needs a project path with build history — recorded by the UE suite',
  pof_package_preflight: 'spawns UBT/editor — recorded by the growth suite',
};

/**
 * route path (no query) -> why a tool annotated `readOnlyHint: true` may POST to it.
 *
 * A POST is a write until proven otherwise. Each entry names a route whose handler was
 * READ and found to only read disk or compute over the posted body — it imports no DB
 * module, writes no file, spawns no process. annotations.test.ts cross-checks the route
 * source for those primitives so this map cannot lie in the dangerous direction, and
 * fails on a stale entry no read-only tool reaches any more.
 */
export const READ_ONLY_POST: Record<string, string> = {
  '/api/combat-simulator': 'runCombatSimulationBatched over the posted scenario — pure Monte-Carlo, nothing persisted',
  '/api/economy-simulator/sweep': 'runSensitivitySweep over the posted config — pure compute (the plain /economy-simulator simulate DOES saveRun, and its tool is annotated as a write)',
  '/api/project-health': 'computeProjectHealth fuses the posted checklist/perf/crash inputs — reads no table, writes none',
  '/api/asset-code-oracle': 'analyzeConsistency over the posted classes/assets/dependencies — pure analysis',
  '/api/filesystem/scan-project': 'walks Source/ + .uproject on disk with fs reads only; the result is returned, not stored',
  '/api/filesystem/scan-assets': 'walks Content/ on disk with fs reads only; the result is returned, not stored',
  '/api/filesystem/verify-semantic': 'parses headers on disk and checks them against code-defined expectations; nothing persisted',
  '/api/ue5-source/parse': 'parseUE5AbilitySystem reads the Source/ tree; nothing persisted',
};

/**
 * tool name -> why a tool annotated as a WRITE still carries a static `example`.
 *
 * `example` is contractually a safe, read-only invocation (see ToolDef). A write tool may
 * keep one only when the example exercises a read action of a multi-action tool, and it
 * says so here. Kept honest by annotations.test.ts (no stale entries, no read-only tools).
 */
export const WRITE_TOOL_SAFE_EXAMPLE: Record<string, string> = {
  pof_gdd_compliance: 'the example runs the default `audit` action (a read); `resolve-gap` / `unresolve-gap` on the same tool write gap triage',
};

/** catalogId -> why the MCP pipeline quality walker skips it. */
export const MCP_WALKER_SKIP: Record<string, string> = {
  'player-movement':
    'orphaned pipeline: registered but absent from CATALOG_SECTIONS, so no seeded entity exists to walk (mirrors e2e WALKER_SKIP)',
};
