# 2026-10-22 — UE 5.8 convergence: the verification path held (record, not a code change)

Status: **recorded** (evidence run by a headless builder, 2026-10-22, on `autopilot/accepted-idea-delivery-b985d047`, base = master tip `c2a6a544`). Closes milestone 3 goal 3 except the UE-gated drain leg below.

## Constraint

`docs/ue58-mcp-convergence-plan.md` "Non-goals (hold the line)": the convergence must not remove the verification spine (`src/lib/test-gate-runner/`, the `:30040` PoF Bridge, `execute_script`, the autonomous L4 capture). Window checked: `711106ac..HEAD` = 11 commits, including 614536f8 (engine-path resolution), 7fce7f3d (phase-2 tool-map settlement), c2a6a544 (anim_blueprint descope) and the security fixes (3dcbac2a, fe6bdcb4, 65b45eab, e00a2b0b, 73b68a79). No prior dated verification record existed in the plan doc (reconciled first).

## What was proven (commands run, real output)

1. `npm run test` -> `Test Files  1910 passed | 10 skipped (1920)` / `Tests  14508 passed | 53 skipped (14561)`, Duration 354.09s. No failures. (jsdom "Not implemented: HTMLCanvasElement getContext" lines are pre-existing noise.)
2. `npm run typecheck` (`tsgo --noEmit`) -> exit clean, no diagnostics.
3. `git log --diff-filter=D --name-only 711106ac..HEAD -- src/lib/test-gate-runner/` -> empty; `git diff --stat 711106ac..HEAD -- src/lib/test-gate-runner/` -> empty (the directory is byte-identical across the window: 18 files, none deleted, none modified).
4. Live references:
   - `:30040` bridge: `src/lib/test-gate-runner/bridgeExecutor.ts:6` (`DEFAULT_PORT = 30040`), `:163` (`http://127.0.0.1:${port}/pof`); `src/lib/bridge/run-python.ts:20` (`/pof/python/run`); `src/lib/pof-bridge/constants.ts:12`; `src/lib/bridge-doctor/remediation.ts:40`.
   - **Correction to the brief's premise:** `execute_script` and `capture_viewport` are NOT call sites in `src/`. `execute_script` in `src/` appears only in prose (`src/lib/knowledge/ue-gotchas.ts:98`) and golden fixtures; `capture_viewport` appears nowhere in `src/` (`captureViewportSnapshot` in `src/lib/blender-mcp/snapshot.ts:27` is the Blender path, unrelated). Their live homes are the UE plugin toolset: `ue/PoFToolset/Content/Python/pof_toolset/toolsets/viewport.py:20` (`capture_viewport`, L4 capture) and `toolsets/script.py:19` (`run_python`, the code-mode successor to `:8090 execute_script`, see script.py:6). The script path is reached from `src/` through `/pof/python/run` (`src/lib/bridge/run-python.ts`, `src/app/api/pipeline-artifacts/drain-python/route.ts`). No code defect found; this is a naming/location fact.

## UE-gated (NOT proven)

The L3 drain verdict leg was **not run**. Blocker: both executors need a real editor. `makeBridgeExecutor` (`bridgeExecutor.ts`) talks to a RUNNING editor's PoF Bridge on `127.0.0.1:30040`; the spawn executor (`spawnExecutor.ts:251-254`) needs `POF_UE_EDITOR_CMD` + `POF_UE_UPROJECT` and `allowSpawn`. This checkout has neither: no `POF_UE_*` env, no `~/Documents/Unreal Projects`, no Epic install (see fleet-memory 2026-10-22 [ue]: project lost in the 2026-10-19 reset; the editor is unsupported on this ARM64 box). The only live-drain test, `src/__tests__/lib/test-gate-runner/live-drain.integration.test.ts`, is skip-by-default behind `POF_UE_EDITOR_CMD` + `POF_UE_UPROJECT` + `POF_RUN_UE_GATES=1`. No verdict was mocked or simulated; the 40+ mocked drain unit tests passing (item 1) prove the plumbing, not an L3 verdict.

## What would close it

On x64-capable hardware with the PoF UE project restored and UE 5.8 installed: set the three env vars and run `npx vitest run src/__tests__/lib/test-gate-runner/live-drain.integration.test.ts`, or start the editor with the bridge and drain via `drainAll` with the bridge executor; quote the resulting verdict on the `GenFireball gate` artifact.
