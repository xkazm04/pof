# PoF Improvements — Synthesis of Vertical-Slice Lessons

This folder collects **improvement plans** for both PoF (the Next.js app that
drives autonomous Claude to build UE games) and the UE game project itself,
synthesised from the end-to-end vertical-slice initiative (D1 → SP-A → SP-B →
SP-C → SP-E → Playable Slice PS-1/2/3 → HUD → Characters). Folders 01–08 are
each **one isolated concern**, designed so a separate CLI session can pick it up
and work without conflicting with the others. Folder **09 is the deliberate
cross-cutting exception** — a roadmap layer that unifies 01–08 into a
generation-focused architecture and then *slices back out* into isolated,
single-CLI deliverables for the next rounds.

## Why this structure

The vertical-slice initiative proved the PoF↔game loop *can* produce a
playable slice — but it also surfaced specific, named defects and gaps in
both the app and the game. Concentrating those findings into per-concern
folders turns them into actionable work, parallelisable across CLI sessions.

## Structure (per subfolder)

Each subfolder contains:

- **`README.md`** — scope, current state (what the initiative left), the
  key lessons learned for this concern, and an "isolated-CLI session focus"
  note (what files/scope a session picks up).
- **`pof-app.md`** — feature/design improvements to the PoF Next.js app
  (`src/`, modules, prompts, UIs).
- **`game.md`** — improvements to the UE game project (C++, Content, Python).
- **`tests.md`** — test coverage to add or extend, with the specific session
  lessons that motivate each test.

## The subfolders

| # | Folder | Concern |
|---|--------|---------|
| 01 | [`01-generation-quality/`](01-generation-quality/) | PoF's autonomous-generation quality (prompts, scaffolding, ground-truth guards). The "compiles but never wired" gap class. |
| 02 | [`02-character/`](02-character/) | Characters: meshes, skeletons, animations, enemy AI/behaviour. Closing the "no skeleton / empty anim shells" gap. |
| 03 | [`03-combat/`](03-combat/) | Gameplay abilities (GA_*), damage, hit detection, montages, combat feel. The empty-AM_MeleeCombo gap and the fallback-window pattern. |
| 04 | [`04-hud-ui/`](04-hud-ui/) | UMG widgets, HUDs, UI workflows. The `BindWidget`-vs-pure-C++ wall and the `RebuildWidget` timing trap. |
| 05 | [`05-environment/`](05-environment/) | Levels, level generation, geometry, lighting. The cube-projection-UV grid problem and the static-mesh-no-Lightmass-bake lighting trap. |
| 06 | [`06-textures-materials/`](06-textures-materials/) | Texture and material pipeline (Leonardo, PolyHaven, PBR maps). Includes Leonardo's advanced API (3D-texture endpoint, ControlNet) we have not yet used. |
| 07 | [`07-packaging-build/`](07-packaging-build/) | Cook, package, build-verify. The cook-executor's `cmd.exe` quote/stderr/exe-path defects and the build-environment / ProjectID / WITH_EDITOR-guard class of issues. |
| 08 | [`08-harness-testing/`](08-harness-testing/) | E2E harness, in-engine functional tests, Gemini-vision verification, dispatch reliability. The single-dispatch / fix-and-rerun lessons. |
| 09 | [`09-core-engine-generator/`](09-core-engine-generator/) | **Cross-cutting roadmap** (not an isolated concern): turn PoF into a high-quality *generator* for the 8 Core Engine modules — a scalable catalog/authoring UI (hundreds of assets, deep hierarchy, faceted nav) + a recipe-based generation engine. Consumes 01's wiring/gotchas + 02–06's per-domain panels; slices into the next multi-CLI rounds. |

## How to assign a CLI session to one concern

A session is given the subfolder's `README.md`, `pof-app.md`, `game.md`, and
`tests.md`. Those four files are self-contained: scope, what to change in PoF,
what to change in the UE project, and what tests to add. The session does not
need to read the others. Cross-cutting references are spelled out by path so
nothing is implicit.

## Provenance — the originating session

- Vertical-slice scenario report: [`../features/arpg-vertical-slice/SCENARIO-REPORT.md`](../features/arpg-vertical-slice/SCENARIO-REPORT.md)
- Per-run findings: [`../features/arpg-vertical-slice/scenario-runs/`](../features/arpg-vertical-slice/scenario-runs/)
- Per-sub-project specs + plans: [`../superpowers/specs/`](../superpowers/specs/), [`../superpowers/plans/`](../superpowers/plans/)
- The UE project is at `github.com/xkazm04/pof-exp` (separate repo) — the PoF app repo is this one.
