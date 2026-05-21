---
date: 2026-05-21
status: draft
sub_project: SP-E (packaged-build launch smoke-test + honest verdict)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario — post-D9 roadmap (P0–P3)
predecessor_docs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-c-cook.md
  - docs/superpowers/specs/2026-05-21-arpg-vertical-slice-sp-c-design.md
---

# Sub-project SP-E: Packaged-build launch smoke-test + honest verdict

## Context

SP-C produced a packaged Win64 Shipping build of the project:
`…\PoF\Saved\StagedBuilds\Windows\PoF.exe`. SP-E is the final roadmap
sub-project (operator-flow steps 22–24): verify the packaged build.

SP-E was originally scoped as "drive the packaged `.exe` and verify the five
vertical-slice success criteria in-game." Exploring the project invalidated
that premise:

- `Content/` holds **12 `.uasset` files** (8 animation assets, 2 input
  actions, an XP curve) and **zero `.umap` files** — there is no level.
- `DefaultEngine.ini` sets no `GlobalDefaultGameMode` and no default/startup
  map.
- There are no Blueprints deriving from the project's C++ gameplay classes,
  and no placed actors.
- The SP-C cook confirmed this ("Assets Built 0").

SP-B generated the gameplay **systems** as C++ classes (`ARPGPlayerCharacter`,
`ARPGEnemyCharacter`, `ARPGLevelGenerator`, `ARPGGameMode`, `EnemySpawnPoint`,
`ARPGPlayerStart`, …) and SP-C packaged them — but nobody ever assembled a
**playable level**. So the packaged `PoF.exe` launches no game. Of the five
success criteria, four (WASD movement, attack, enemy hit, loot drop) cannot be
verified because there is nothing runnable to verify.

**Decision (from brainstorming):** re-scope SP-E to a launch **smoke-test plus
an honest verdict report**, and scope the follow-on "assemble + run the game"
work as a clearly-defined next phase.

## Goals

1. Verify what genuinely exists: the packaged `PoF.exe` launches as a process
   and does not crash on startup.
2. Record an honest verdict — which of the five success criteria are met,
   which are not, and exactly why.
3. Scope the next phase: enumerate the artifacts and dependencies needed to
   accomplish the full cycle (an actually-runnable vertical slice).
4. Close the scenario report with the accurate end-to-end verdict.

## Non-goals

- **No gameplay verification** — WASD/attack/enemy/loot/HUD cannot be checked;
  there is no level. SP-E states this, it does not attempt it.
- **No content authoring** — SP-E does not create maps, Blueprints, a
  GameMode, or placed actors. That is the next phase (scoped here, not built).
- **No app source change** — SP-E only launches an already-built artifact.
- **No keyboard simulation / frame-diffing** — out of scope by definition once
  there is no playable level.

## The five success criteria — SP-E disposition

From `INDEX.md` §1:

| # | Criterion | SP-E disposition |
|---|-----------|------------------|
| 1 | Packaged Win64 Shipping build launches as a standalone `.exe` | **Verified by SP-E's smoke-test** (the launch + survival check) |
| 2 | PIE/standalone: WASD moves the character on a flat level | **Not verifiable** — no level, no player start, no player Blueprint |
| 3 | LMB triggers the attack ability; montage plays | **Not verifiable** — nothing to run |
| 4 | Attack hits a dummy enemy and reduces its Health | **Not verifiable** — no placed enemy |
| 5 | Enemy at Health ≤ 0 is destroyed; a loot pickup spawns | **Not verifiable** — nothing to run |

## Design

### Part 1 — launch smoke-test

A new `e2e/arpg-vertical-slice-sp-e.spec.ts`. It uses Node `child_process`
only — no browser, no `page`, no PoF dev server.

1. Resolve the staged exe path:
   `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\StagedBuilds\Windows\PoF.exe`.
   If it does not exist, fail with a clear message naming the path (SP-C must
   have run first).
2. `spawn` it with `-windowed -ResX=1280 -ResY=720 -log` (windowed so it does
   not fullscreen-grab the screen; `-log` so the engine writes a verbose log).
3. Observe for a fixed window of **25 s**:
   - If the process **exits before 25 s** → **fail**: a startup crash. Record
     the exit code.
   - If the process is **still alive at 25 s** → **pass**: the build is not
     dead-on-arrival. Then terminate it cleanly (`taskkill /T` / `kill`).
4. After termination, read the tail (~80 lines) of
   `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Logs\PoF.log` — the
   engine-init and map-load lines — and attach it to the result.

The pass/fail signal is deliberately minimal and honest: "the packaged process
launches and survives 25 s" is all a smoke-test can claim. The `PoF.log` tail
makes the result *informative* (e.g., it will likely show the engine starting
with no map to load).

`test.setTimeout` is generous (~90 s) to cover spawn + the 25 s window +
teardown.

### Part 2 — honest verdict report

`docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-e-smoke.md`,
written from the actual run. It records:

- The smoke-test outcome: launched yes/no, survived 25 s yes/no, exit code if
  it died, and the `PoF.log` tail.
- The five-criteria disposition table above, filled with the real result for
  #1.
- The concrete content gap: no `.umap`, no `GlobalDefaultGameMode`/default
  map, no Blueprints from the C++ classes, no placed actors.

### Part 3 — next phase: what the full cycle needs

A section of the SP-E findings doc (and mirrored into the scenario report)
that scopes the follow-on work — *scoped, not built*. It enumerates the
artifacts and dependencies required to make the slice actually runnable, as
input to a future brainstorm:

- **A playable level** — a `.umap` with a floor mesh + collision, lighting,
  a `PlayerStart`, and a placed dummy enemy. UE maps are binary assets; this
  cannot be authored as text — it needs an editor commandlet / Python editor
  script, or a C++/`ARPGLevelGenerator`-constructed level loaded at runtime.
- **Blueprints (or C++ defaults)** deriving from `ARPGPlayerCharacter` /
  `ARPGEnemyCharacter` etc., configured with meshes, the `AnimInstance`, GAS
  ability grants, and input mapping context.
- **GameMode + default-map wiring** — `GlobalDefaultGameMode`,
  `GameDefaultMap`/`EditorStartupMap` in `DefaultEngine.ini`, default pawn
  class.
- **Asset dependencies** — at minimum a character skeletal mesh + the existing
  `IMC_Default` input mapping context wired to `IA_Move`/`IA_Attack`.
- **A verification mechanism** — once a slice exists, automated keyboard
  simulation or an in-engine automation test to check criteria #2–#5.

The key open problem to flag for that phase: PoF's autonomous Claude generates
**code** well, but UE **content** (maps, Blueprints, meshes) is binary and
cannot be authored as text — the next phase must decide how content gets
created (editor scripting, procedural C++ construction, or a manual content
checkpoint).

### Part 4 — close the scenario report

Refresh `SCENARIO-REPORT.md`: mark operator-flow steps 22–24, add an SP-E
section, and state the final initiative verdict — PoF drove autonomous Claude
to generate the gameplay **systems** (SP-B) and **package** them (SP-C), the
packaged build launches (SP-E), but assembling **runnable playable content**
was never in the generated scope, so an end-to-end playable slice was not
achieved. The path to close that gap is Part 3.

## Verification

- **Part 1:** `e2e/arpg-vertical-slice-sp-e.spec.ts` runs; its pass/fail
  reflects the real process behaviour. There is no stub — the test is a
  thin process spawn, exercised directly against the real `.exe`.
- **Part 2–4:** the findings doc and scenario-report edits reflect the actual
  smoke-test outcome.

## Cross-cutting

- **Branch:** `master`.
- **No app source change.** New: `e2e/arpg-vertical-slice-sp-e.spec.ts` + a
  findings doc; edits to `SCENARIO-REPORT.md`.
- Launching `PoF.exe` opens a real window briefly (~25 s) — windowed, then
  terminated. No keep-awake needed (the run is short).
- Commit locally only — the user pushes manually.

## Definition of done

1. `e2e/arpg-vertical-slice-sp-e.spec.ts` created; run once against the real
   staged `.exe`; outcome recorded.
2. `2026-05-21-live-sp-e-smoke.md` written with the real result, the
   five-criteria table, and the Part 3 next-phase scope.
3. `SCENARIO-REPORT.md` refreshed — steps 22–24 marked, SP-E section added,
   final verdict stated.
4. Committed to `master`; chat summary.

**Success criterion:** SP-E delivers a truthful verdict — the packaged build's
launch behaviour is established by a real smoke-test, the four gameplay
criteria are honestly recorded as not-verifiable with the exact reason, and
the next phase (assembling a runnable slice) is scoped well enough to brainstorm
directly.

## Risks & mitigations

- **`PoF.exe` exits immediately on launch** (no default map → fatal). This is
  a legitimate **fail** outcome, recorded as-is — the build packages but is not
  runnable. Not worked around; it is itself a finding for Part 3.
- **The launch window grabs focus / is disruptive.** Mitigated by `-windowed`
  at a small resolution and a short 25 s window. If even that is undesirable,
  `-nullrhi` (headless, no rendering) is a fallback noted at plan time.
- **`PoF.log` not found / different path.** The tail read is best-effort; its
  absence is recorded, it does not fail the smoke-test.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: smoke-test spec + run → findings doc → scenario-report close.
5. SP-E complete → the roadmap (SP-A…SP-E) is closed. The next phase —
   assembling and running an actual vertical slice — starts from Part 3 as a
   fresh brainstorm.
