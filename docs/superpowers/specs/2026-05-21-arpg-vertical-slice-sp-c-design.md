---
date: 2026-05-21
status: draft
sub_project: SP-C (packaging)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario — post-D9 roadmap (P0–P3)
predecessor_docs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-chunk2-summary.md
  - docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md
---

# Sub-project SP-C: Packaging

## Context

SP-B drove autonomous Claude to generate the ARPG gameplay systems (combat,
enemy, loot, HUD, damage numbers — operator-flow steps 11–16). SP-C is the P1
continuation: **operator-flow steps 17–21 — produce a packaged Win64 Shipping
`.exe`** via PoF's packaging UI (the cook backend `/api/packaging/execute` and
`CookProgress` UI were built in sub-project B; stub-validated in D1, never run
live).

A Win64 Shipping cook compiles the entire UE project, including the
loot/HUD/damage-number C++ that SP-B's autonomous sessions just generated.
SP-B's artifact checks were loose (`fileNameContains` matches) — they never
verified that generated code actually *compiles*. A real Shipping cook runs
30–60+ minutes; discovering a compile error deep into it wastes the run.

## Goals

1. **Build-verify pre-flight:** confirm the UE project — with SP-B's generated
   C++ — compiles clean, fast, before the long cook.
2. **Cook:** drive PoF's packaging UI to produce a packaged Win64 Shipping
   `.exe`, and read back its path.
3. Stub-test the cook wiring before the live run.

## Non-goals

- **No PIE / in-game verification** — running the `.exe` and checking the
  5 vertical-slice bullets is SP-E.
- **No app source change** — the packaging backend (`/api/packaging/execute`)
  and `CookProgress` UI already exist (sub-project B).
- **No fix for the cook pipeline itself** — if the cook fails on a PoF/UE
  packaging-config issue, that is a finding to triage, not pre-scoped work.

## Decision record (from brainstorming)

1. **Build-verify pre-flight included** (chosen over cook-only, and over
   build-verify-only-defer-cook).
2. **A1 — direct `UnrealBuildTool`** for the pre-flight (chosen over A2, driving
   operator-flow Step 6 through the PoF UI / a Claude dispatch). The pre-flight
   is a deterministic compile gate; running UBT directly is reliable, fast, and
   has no CLI-session dependency.

## Design

### Part A — build-verify pre-flight (controller-driven)

Before any cook, the controller runs `UnrealBuildTool` directly on the editor
target:

```
<UBT> PoFEditor Win64 Development "-Project=C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex
```

where `<UBT>` is `C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe` (the exact path is confirmed at plan time against the engine install — the harness's existing build-verify prompt uses this command).

- **Clean build (exit 0, no errors)** → SP-B's generated C++ compiles → proceed
  to Part B.
- **Compile errors** → **STOP**. The errors are a finding — most likely a
  defect in SP-B's autonomously-generated code (loot/HUD/damage-number C++).
  They must be fixed before the cook (a targeted Claude fix-dispatch or a manual
  fix — handled as a checkpoint, not pre-planned, since whether it fails is
  unknown). Editor `Development` target is used: it is the fast, conventional
  compile check and catches the common errors (missing includes, syntax,
  signature mismatches) that would fail the cook too.

This is operator-flow Step 6's intent — a build verification — finally run.
Duration ~5–15 min depending on how much SP-B changed.

### Part B — the cook (e2e spec + gated live run)

A new `e2e/arpg-vertical-slice-sp-c.spec.ts` drives the packaging UI:

1. `setupHarnessMode(page)` → `completeSetupWizard(page)`.
2. `seedPackagingProfile(page)` — seeds a Win64 / Shipping profile via
   `POST /api/packaging/profiles`; returns the profile id.
3. Navigate the sidebar to the packaging module (`game-systems` →
   `packaging`).
4. Click `pof-module-packaging-start-cook-${profileId}` — triggers
   `/api/packaging/execute`; `CookProgress` mounts.
5. `waitForCookComplete(page, timeoutMs)` — polls `pof-cook-progress-result`
   until it appears; reads its `data-status`.
6. Assert (live mode): `result` status is `success` and
   `pof-cook-progress-exe-path` is non-empty.

`setupHarnessMode`'s stub mode mocks `/api/packaging/execute` with a synthetic
SSE stream (cook → stage → package → done in ~2 s), so a **stub run proves the
spec's wiring** — navigation, the seeded profile's start-cook button, and
`waitForCookComplete` — with no real cook. Then **one gated live cook**
(keep-awake pre-flight, ~90 min cap) produces the real packaged `.exe`.

The cook's `timeoutMs` for the live run is generous (~80 min) — a Win64 Shipping
cook+stage of this project is long; `waitForCookComplete` already records
`timedOut` if exceeded.

## Verification

- **Part A:** the UBT exit code + a scan of its output for `error` lines.
  Clean = pass-gate; errors = stop + finding.
- **Part B stub run:** `e2e/arpg-vertical-slice-sp-c.spec.ts` passes in stub
  mode — proves navigation + the start-cook trigger + `waitForCookComplete`
  wiring against the synthetic cook.
- **Part B live run:** one gated live cook; success = `pof-cook-progress-result`
  status `success` + a non-empty `pof-cook-progress-exe-path`, and the `.exe`
  exists on disk at that path.

## Cross-cutting

- **Branch:** `master`.
- **No app source change.** New: `e2e/arpg-vertical-slice-sp-c.spec.ts` + a
  findings doc.
- **UE project is built and cooked** by this sub-project — real, slow, and
  environment-dependent (needs the UE 5.7 install + `RunUAT`). Keep-awake
  pre-flight before the live cook (the cook far exceeds any sleep timer).
- Commit locally only — the user pushes manually.
- The Claude CLI environment was repaired during SP-B; Part A (direct UBT) and
  Part B (the cook) do not depend on the Claude CLI at all — only the UE
  toolchain.

## Definition of done

1. Part A: `UnrealBuildTool` run on `PoFEditor` completes; the result (clean,
   or the compile errors) is recorded. If errors, they are fixed and the build
   re-verified before Part B.
2. `e2e/arpg-vertical-slice-sp-c.spec.ts` created; stub run passes.
3. One gated live cook executed; findings doc records the cook outcome.
4. On success: a packaged Win64 Shipping `.exe` exists at the path
   `CookProgress` reported.
5. Committed to `master`; chat summary.

**Success criterion:** a packaged Win64 Shipping `.exe` is produced on disk and
its path is surfaced by PoF's `CookProgress` UI — proving PoF can take the
autonomously-generated ARPG project all the way to a runnable build.

## Risks & mitigations

- **SP-B's generated C++ does not compile.** This is the *expected* thing Part A
  exists to catch. Mitigation: Part A is a hard gate; a failure fails fast (~10
  min, not 30+ into a cook) with focused UBT error output, and is fixed before
  Part B.
- **The cook fails on a Shipping-specific or content/cook-config issue** the
  editor build did not surface. Mitigation: `waitForCookComplete` records the
  failure + the cook log; it becomes a triage finding — out of pre-planned
  scope, handled as a checkpoint.
- **The cook is very long / machine sleep.** Mitigation: keep-awake pre-flight;
  generous timeout; watched run.
- **`RunUAT` / UE install issues.** Mitigation: Part A (a direct UBT build)
  also implicitly confirms the UE toolchain is healthy before the cook.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: build-verify pre-flight → cook spec + stub run → gated live cook.
5. SP-C complete → refresh the scenario report → SP-E (PIE verification) is the
   last roadmap sub-project.
