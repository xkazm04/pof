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

/** catalogId -> why the MCP pipeline quality walker skips it. */
export const MCP_WALKER_SKIP: Record<string, string> = {
  'player-movement':
    'orphaned pipeline: registered but absent from CATALOG_SECTIONS, so no seeded entity exists to walk (mirrors e2e WALKER_SKIP)',
};
