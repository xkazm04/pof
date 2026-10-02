---
name: pof-mcp
description: Operate PoF headlessly through the pof-mcp server from Claude Code - drive a catalog entity through its pipeline (recipe -> do the work -> submit -> server-derived verdict -> drain), steer the autonomous harness, or read UE truth (compile, tests, builds, manifest). Use when the session has pof_* tools, when asked to "drive the pipeline from the CLI", "submit an artifact", "drain gates", "start the harness", or when a pof_* call returned an error you need to recover from.
---

# pof-mcp operator guide

`pof-mcp` is a thin stdio adapter over the running PoF backend (`POF_APP_ORIGIN`, default
`http://127.0.0.1:3001`). Every tool proxies one app route; the backend's SQLite and its
single harness orchestrator stay the source of truth, so a run you start here is the run the
web UI shows. Schemas + recorded example responses: `tools/pof-mcp/TOOLS-REFERENCE.md`.

## Division of labor (do not cross it)

| Server | Owns |
|---|---|
| `pof-mcp` (`pof_*`) | PoF's STRUCTURED layer: pipelines, derived acceptance, persistence, the harness, the gate drain, UE truth reads |
| `unreal-official` (`:8000`, tool-search meta-tools) + `PoFToolset` | RAW Unreal editor ops: run Python, capture a viewport, spawn/tune actors, GAS mutation |

pof-mcp never duplicates raw UE control. When a recipe needs an editor change, make it
through the Unreal server, then record it with `pof_submit_artifact`.

## The pipeline loop (structure + truth model)

1. `pof_list_catalogs` -> `pof_list_entities {catalogId}` -> pick an entity.
2. `pof_get_step {catalogId, entityId, step, direction?}` returns the RECIPE: canon-prefixed
   prompt, View shape, UE asset targets, the step body's `example` output, the Acceptance
   contract, any already-persisted artifact, and `settle` (what settles the current verdict).
   **The example is a shape reference, not this entity's content.** For most entities it is the
   catalog EXEMPLAR's content with the name swapped: then `example.data.template` names the
   exemplar and `acceptance.exampleStatus` is `pending` with a `TEMPLATE:` `exampleReason`.
   Never submit it or paraphrase it - produce THIS entity's content from the prompt.
3. Do the work yourself (generate the data; make UE edits through the Unreal server).
4. `pof_submit_artifact {catalogId, entityId, step, data, ueAssets?}`. **The server derives the
   verdict from the step's own checker - never self-grade, never write a verdict field.** Then
   read `next`: `next.settle` names the ONE act that settles this verdict (null on pass) and
   `next.entityStep` is the step the lab coach would pick next (`{step, priority}`). Act on
   `settle.kind`:

   | kind | do |
   |---|---|
   | `resubmit` | `fail`: the reason names the failing check - fix the data, resubmit |
   | `produce` / `produce-live` | pending (SOURCED seed, TEMPLATE stub, or not yet graded): `pof_get_step`, produce this entity's own content, submit |
   | `fill-gap` | a field is a declared reference gap ("not in the reference") - supply a designed value, say it is designed, resubmit |
   | `drain` | L3/L4 gate waiting on a live editor - `pof_drain_gates` with `settle.args` (tier) |
   | `settle` | L0-L2 or packaging deferral - `POST /api/pipeline-artifacts/settle` (bind-icons -> verify-static -> verify-packaging); no pof tool wraps it yet |
   | `none` (`actionable:false`) | UNGRADED - nothing here can settle it; do NOT resubmit, move on to `next.entityStep` |
5. `pof_get_acceptance {catalogId, entityId?}` for the rollup; `pof_gate_evidence` for the
   proof behind a drained verdict (a verdict with `missing` evidence is itself a finding).
6. `pof_drain_gates` turns `deferred` into pass/fail on the live editor (or headless with
   `allowSpawn` and a CLOSED editor). Choose scope deliberately: no `catalogId`/`entityId` is
   a GLOBAL drain. `limit` caps cost before any editor boots. For L4 visual gates pass
   `projectPath` + `autoCapture:true`, then READ the returned PNGs with your own eyes - the
   automated judge catches only gross errors.

## Rules that the tool descriptions state and that agents keep breaking

- **Scope your reads.** `pof_feature_matrix*`, `pof_gdd_compliance`, `pof_gdd`,
  `pof_package_history`, `pof_harness_runs` are project-scoped: without `projectPath` they
  read ONLY the unattributed legacy rows, which on a backfilled DB is nothing. "0 rows" is
  not "nothing exists" - every response carries a `scope` block saying which view you got.
- **Blast radius is advertised.** Every tool carries MCP annotations. Read-only tools (38 of
  49) are safe to repeat. `pof_drain_gates` and `pof_harness_start` are destructive
  (verdict flips, editor boots, a budgeted autonomous session); `pof_submit_artifact`,
  `pof_ue_compile`, `pof_ue_run_tests`, `pof_ue_build`, `pof_package_preflight`,
  `pof_economy_simulate`, `pof_gdd_compliance` write.
- **One drain per scope.** A concurrent drain returns 409; a global drain is exclusive with
  everything. `pof_ue_run_tests` settles the gates waiting on that test unless
  `settle:false`; a refused settle (lease held) is REPORTED beside the result, never implied.
- **Budget the harness.** `pof_harness_start` applies a default $25 cap; `unlimited:true` is
  the only way to run uncapped. Prefer `passRateBasis:"verified"` (the default) - it counts
  only gate-backed passes.

## Needs a live editor vs. works from disk

| Live editor (bridge `:30040`) | Disk only |
|---|---|
| `pof_ue_manifest` (throws offline), `pof_ue_compile`, `pof_ue_run_tests`, `pof_ue_test_results`, `pof_drain_gates` (bridge executor) | `pof_ue_scan_project`, `pof_ue_scan_assets`, `pof_ue_verify_semantic`, `pof_ue_source_parse`, `pof_ue_build` (UBT), `pof_package_preflight`, `pof_asset_code_oracle` |

`pof_ue_status` is the one bridge read that degrades instead of throwing: check it first when
a live-editor tool fails, and read its `editorState` (idle / pie / compiling).

## Error recovery

| Symptom | Cause | Do |
|---|---|---|
| `PoF backend not reachable at ...` | app not running / wrong port | start the app (`npm run dev`) or set `POF_APP_ORIGIN` to its port |
| 409 from a drain or settle | another drain holds the scope | wait or narrow the scope; never retry in a loop |
| `pof_ue_manifest` / `_compile` throw, `pof_ue_status` says `connected:false` | editor or bridge plugin down | open the editor with the PoF bridge; disk-only tools still work |
| `Unknown catalog: ...` | typo | the error lists the known catalog ids |
| empty feature/GDD/build results | unscoped read on a backfilled DB | pass `projectPath` |
| `fail` on submit | checker rejected the data | the reason names the failing check; fix the data, resubmit |
