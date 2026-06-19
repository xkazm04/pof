# Battle plan — sword lifecycle: concept → in-game damage

**Status:** plan (not started) · **For:** a future session to execute · **Use case 1** of the
"prove the converged tooling end-to-end → autonomous game dev" milestone.

## Goal

Drive a **weapon (sword) from a 2D concept all the way to dealing damage to the opponent in the
live UE project** — autonomously, **controllable by Claude**, **verified at every step**. This
validates that the post-convergence tooling (`:8000` first-party MCP + `PoFToolset` + the `:30040`
bridge/L4 capture + the PoF app/API) reliably produces high-quality assets into the project.

## Strategy: MVP the raw process first, then wire to PoF

Two layers, in order:
1. **MVP (prove feasibility):** run each lifecycle step with **direct tooling** (scripts, `run_python`, Blender, the gen API, the bridge) — no PoF UI required. Goal: prove the whole chain works end-to-end on the new stack and is Claude-drivable.
2. **Wire to PoF (success path):** once a step is proven, **re-home it as a PoF UI/API action** — a step in the catalog **Items/weapon pipeline** (the `StepSpec` View/Produce/Acceptance chassis) and/or an app API route. **Ideal end state: every lifecycle step is performable from PoF's UI or API.**

Each phase below gives **MVP (raw) → Acceptance (an observation) → PoF wiring (the success-path target)**.

## Stack

- **Generation:** PoF `/api/leonardo` (2D), Blender 4.2 headless (3D), numpy (measure). Gemini vision for concept/visual judging.
- **UE control (was `mcp-unreal`, now `:8000`):** `PoFScriptTools.run_python` (= old `execute_script`), `PoFViewportTools.capture_viewport`, Epic `EditorAppToolset.StartPIE`/`StopPIE`, `LogsToolset.GetLogEntries` (= old `get_output_log`), `EditorToolset.actor` (= `get_level_actors`). Launch headless editors via `src/lib/ue-launch`.
- **Verification:** the `:30040` PoF Bridge + `test-gate-runner` — **L3 behavioral** (damage applied/not) and **L4 visual** (autonomous `ScenarioController` capture). No step is "done" without an observation (Tiers of Truth).
- **PoF wiring target:** the catalog **Items pipeline** (the reference `StepSpec` pipeline already does concept→2D→3D→material) + app API routes + `pof-mcp`.

## Reuse — the prior pipeline de-risks most of this

The full chain was **shipped once before** (UE commit `2ec7eb6` on `feature/arpg-movement-feel`, 2026-06-11) — but on the now-retired `mcp-unreal`. The C++ infra it built **already exists in the project** and is reused here (Phase 0 audits it):
- `WeaponMesh` (`UStaticMeshComponent`) on `ARPGCharacterBase` (`hand_r`, `WeaponAttachBone`/`WeaponGripOffset`).
- `AnimNotifyState_HitDetection` — multi-point base→tip swept spheres, dedup, `Event.MeleeHit`; resolves sockets from the owner's `WeaponMesh`.
- `BP_GA_MeleeAttack` (`/Game/Abilities/`) with a `use_animation_driven_damage` switch.
- Player input `LMB → IA_PrimaryAttack → HandlePrimaryAttack` (already bound).
- `BP_VSEnemy` (the opponent, ASC-bearing) in `VerticalSlice`.

This battle plan is therefore mostly **re-homing the proven steps onto the new stack + a quality/precision pass + the PoF wiring** — not inventing the chain.

## Phases

### Phase 0 — Preflight & reuse audit
- **MVP:** launch the 5.8 editor headless (`ue-launch`) with `:8000` + the bridge up; `run_python` probes confirm the C++ infra above + `BP_VSEnemy` are present in the project.
- **Accept:** all infra present (else restore from `2ec7eb6` / rebuild).
- **PoF wiring:** a capability scan (`pof-mcp` `pof_ue_manifest` / `pof_asset_code_oracle`) surfaces the weapon/damage infra in the UI.

### Phase 1 — 2D concept
- **MVP:** `POST /api/leonardo` with a sword prompt. Transparency = `foreground_only` (NOT `foreground`); the default Kino model has **no** transparency → use black bg + threshold. Download-then-delete the generation.
- **Accept:** a clean sword silhouette PNG; **Gemini-judged "reads as a sword."**
- **PoF wiring:** the Items pipeline's concept/2D step (`CliProduce` + the gen API) — already the reference shape.

### Phase 2 — Measure → params
- **MVP:** numpy silhouette analysis → proportions (guard ratio ~25%, blade ~75%, span px→cm) + palette (region means) → a params JSON.
- **Accept:** sane proportions in the JSON.
- **PoF wiring:** a derived "measure" step (auto, no human input).

### Phase 3 — 3D mesh (parametric Blender)
- **MVP:** `tools/asset-gen/blender_sword.py` — Blender 4.2 headless (`-b --python … -- --params-file <file>`; pass a FILE, PowerShell strips inline-JSON quotes). Parametric sword (~254 tris), origin at grip, blade +Z, 4 material slots, **`SOCKET_Base`/`SOCKET_Tip` empties** (UE FBX import auto-creates sockets, prefix stripped), export `apply_scale_options="FBX_SCALE_UNITS"` (exact cm).
- **Accept:** FBX with the two sockets + correct cm bounds.
- **PoF wiring:** a 3D-gen step whose Produce shells Blender via an API route. *(Fidelity upgrade for a later pass: Meshy/Tripo image→3D — out of scope this run; parametric chosen for control + proven e2e.)*

### Phase 4 — Import to UE
- **MVP:** `:8000` `run_python` — `AssetImportTask` + `FbxImportUI` (auto collision; materials from the 4 slots).
- **Accept:** a `StaticMesh` in `/Game/…` with sockets (`Base` z≈12, `Tip` z≈94), 4 slots, ~108 cm bounds (a `run_python` probe).
- **PoF wiring:** an import step (Produce → `run_python`; Acceptance reads the asset truth from UE).

### Phase 5 — Equip to the player
- **MVP:** reuse the C++ `WeaponMesh` (`hand_r`). **Solve the grip geometrically:** probe `hand_r` world transform in PIE → corrective quat via cross/dot in pure python → apply live → **persist to the component template** (relative_rotation/location). (`Snap` attach rules ZERO authored relative transforms — use `KeepRelative` + explicit override.)
- **Accept:** **L4 capture** — sword in hand, blade oriented correctly; geometric proof (blade ≈ (0,0,-1), tip +cm).
- **PoF wiring:** an equip step (Produce drives the solve; Acceptance = the L4 verdict).

### Phase 6 — Attack animation
- **MVP:** author `AS_SwordSlash` from scratch — `AnimSequenceFactory` + the animation controller (`set_frame_rate(FrameRate)`, `set_number_of_frames(FrameNumber(n))` — ints throw; `add_bone_curve` + `set_bone_track_keys`; idle frame-0 LOCAL base pose via `AnimPoseExtensions` + parent-space euler-delta keys on the spine/arm chain). Montage via `AnimMontageFactory(source_animation)` + a notify track + an `AnimNotifyState_HitDetection` event (set `weapon_socket_name`). **Polish loop:** capture det-frames across the swing → Gemini-judge → iterate the keys dict. *(The prior swing was FUNCTIONAL but crude — this loop is the quality lever for "high quality.")*
- **Accept:** **L4 multi-frame** capture — the swing reads as a real slash; montage plays. Montage section names MUST match the GA `combo_section_names` (else `JumpToSectionName` fails silently → ability ends instantly).
- **PoF wiring:** an anim-author step (Produce + the polish loop; Acceptance = the L4 multi-frame verdict). Highest-effort step.

### Phase 7 — Hit spacing, collision & damage (the crux)
- **MVP:** reuse the swept-sphere `AnimNotifyState_HitDetection` + `BP_GA_MeleeAttack`; flip `use_animation_driven_damage=true` on the **BP-asset CDO** then **save** (BP recompile-on-save regenerates the CDO → author on the asset CDO / component template, not an in-memory edit). Drive a **`ScenarioController`** scenario: position the player + `BP_VSEnemy` at a precise distance, fire `LMB → IA_PrimaryAttack`, sample. **Precision:** tune the hit-window (notify-state start/end) + spacing so damage fires exactly when the blade overlaps the enemy.
- **Accept (L3 behavioral):** in-range swing → `[GA_MeleeAttack] Applied damage to BP_VSEnemy…: Base=20.0` (read via Epic `LogsToolset` / the bridge); out-of-range swing → activation logged, **NO damage**. **(L4):** a captured frame at the damage instant shows blade-on-enemy. **Resolve the prior 2×-damage anomaly** (2 damage lines for 1 swing — investigate the notify/hit dedup).
- **PoF wiring:** register the damage scenario as a `GateScenario`; the `test-gate-runner` runs it as an **L3 behavioral gate** + the **L4 visual gate** in the pipeline (already the mechanism).

## Verification spine (cross-cutting)

Tiers of Truth — no phase passes on a symbolic claim:
- **L4 visual** (autonomous `ScenarioController`/viewport capture) at equip, swing, and the hit instant.
- **L3 behavioral** (damage applied vs not) via the bridge + `LogsToolset`, **positive AND negative**.
- The L4 capture mechanism + the L3 runner already exist (`src/lib/ue-launch/capture.ts`, `test-gate-runner`).

## Banked gotchas (carry forward)

- `unreal.Rotator(roll, pitch, yaw)` ctor order (NOT pitch,yaw,roll).
- BP recompile-on-save REGENERATES the CDO → in-memory CDO edits wiped; author on the **component template** or **BP-asset CDO** then save.
- `FAttachmentTransformRules::Snap*` ZEROES authored relative transforms → use `KeepRelative` + explicit override.
- `StaticMesh`/`Skeleton` `sockets` property is protected from python read → use `find_socket`.
- Montage section names must match GA `combo_section_names` (silent `JumpToSectionName` failure).
- Enemy `Health` is not readable via `get_editor_property` (the enemy lacks the player's mirror UPROPERTY) → use GAS attribute libs or logs.
- **New-stack:** `:8000` is live only when a 5.8 editor is up with `ModelContextProtocol.StartServer` (unlike `mcp-unreal`'s on-demand Go proc) → the pipeline must ensure the editor is up for UE-side steps. `PoFScriptTools.run_python` returns `str(result)` (verified) — set `result = …` in the probe.
- Headless bash launches: Git Bash MSYS mangles `/Game/…` args → `MSYS_NO_PATHCONV=1` + a Windows-form uproject (Node `spawn` is unaffected). See [l4-autonomous-visual-capture.md](l4-autonomous-visual-capture.md).

## Sequencing for the next session

1. **MVP track:** execute Phases 0→7 in order, each gated by its acceptance (an observation). Hard parts: **Phase 6** (swing quality — the polish loop) and **Phase 7** (hit-spacing precision + the damage anomaly).
2. **PoF-wiring track:** once the MVP proves the chain, fold each phase into the catalog **Items/weapon pipeline** as a `StepSpec` (tiers: L2 static for import/equip config, L3 runtime for damage, L4 visual for swing/hit) so the whole lifecycle runs from PoF's UI/API.
3. Likely a **fresh session** (this milestone is large). Update this doc with as-built notes per phase.

## References

- Prior run recipe + grades: memory `project_sword_pipeline_e2e` (UE commit `2ec7eb6`).
- Tooling: `tools/asset-gen/blender_sword.py`, `src/lib/ue-launch/`, `src/lib/test-gate-runner/`, `PoFToolset` (`:8000`).
- Verification architecture: [l4-autonomous-visual-capture.md](l4-autonomous-visual-capture.md); the catalog pipeline: `docs/catalog/`.
