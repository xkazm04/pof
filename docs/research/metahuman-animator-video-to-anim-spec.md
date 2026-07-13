# Spec — Video → Animation via MetaHuman Animator (headless, no mocap gear)

> **Status:** feasibility GROUND-TRUTHED on the installed UE 5.8.0 (live headless API probe, 2026-07-13). Not built. XL — a new **animation engine** for PoF, the app's weakest generative domain.
>
> **Source:** `/research` run on Curtis Holt, *"I'm Building a Human Animation Pipeline!"* (`Yi-VKdmRlOA`) — a solo artist building plain-video → MetaHuman markerless mocap → Blender in ~4 days. **North-star fit:** this is the "extract animation from ordinary video, no mocap suit/markers/capture volume" capability the user explicitly wants PoF to master. The only hardware is a camera.

## Why this matters for PoF

PoF's animation story today is thin and non-generative:
- Tripo cloud `animate_retarget` applies **preset** clips (run/idle/walk/slash) to a generated character — you cannot get an *arbitrary* motion, only the preset library.
- Code-authored slashes (`anim_authoring/`) are hand-numeric FK, one motion at a time.
- `project_animation_alternatives` memory concluded there is **no turnkey AI→combat-animation** path; the hybrid was DeepMotion + Motion Warping + VLM critique.
- `/status` step-facts: the animation pipeline steps have **no true generator engine** — they are among the "unpowered" cells.

MetaHuman Animator changes the input surface from "a mocap rig" to "any video clip", and — decisively for PoF — **its solve pipeline is Python-scriptable and runs headless** (below). That makes it an *automatable engine*, not a GUI tool, which is what clears PoF's standing "GUI-only / manual tools are off-domain" rule.

## Ground-truthed API surface (live probe, UE 5.8.0)

Probe: `UnrealEditor-Cmd PoF.uproject -ExecutePythonScript=<probe> -EnablePlugins=MetaHuman -EnablePlugins=MetaHumanAnimationTools -nullrhi -unattended -nopause -nosplash -NoLiveCoding -abslog=<log>`, then grep `POF_PROBE` markers. All of the following **resolved and loaded headless** (no editor GUI, `-nullrhi` did not block them):

| Class | Headless-exposed methods (probed) | Role |
|-------|-----------------------------------|------|
| `unreal.MetaHumanPerformance` | `can_process`, `start_pipeline`, `set_blocking_processing`, `set_processing_range`, `is_processing`, `get_number_of_processed_frames`, `contains_animation_data`, `contains_animation_data_type`, `can_export_animation`, `export_animation`, `get_animation_data`, `on_processing_finished_dynamic`, `cancel_pipeline`, `diagnostics_indicates_processing_issue` | **The solver.** Runs the markerless solve over footage; `set_blocking_processing(True)` = unattended/batch; `set_processing_range` = window the solve; diagnostics = built-in verdict hook. |
| `unreal.MetaHumanPerformanceExportUtils` | `export_animation_sequence`, `export_level_sequence`, `get_export_animation_sequence_settings`, `get_export_level_sequence_settings` | Export the solved take to a UE **AnimSequence** (the PoF-native output; feeds retarget/montage). |
| `unreal.MetaHumanIdentity` | `start_frame_tracking_pipeline`, `export_dna_data_to_files`, `is_frame_tracking_pipeline_processing`, `set_blocking_processing`, `diagnostics_indicates_processing_issue` | Face identity solve + DNA export (the face-rig data). |
| `unreal.FootageCaptureData` | `image_sequences`, `depth_sequences` | The input footage container (image + optional depth). |

Not found (so NOT part of the automatable surface as-probed): `MetaHumanPipeline`, `MetaHumanBatchOperation`, `MetaHumanPerformanceEditorSubsystem`, `MetaHumanCaptureManager`. Epic's 5.8 release notes separately claim an "improved API for batch processing large volumes of captured performance data" with reference Blueprint examples — reconcile against these class names when building.

Plugins are **installed** on our engine (`C:/Program Files/Epic Games/UE_5.8/Engine/Plugins/MetaHuman/…`): `MetaHumanAnimator`, `MetaHumanAnimationTools`, `MetaHumanCoreML`, `MetaHumanLiveLink`, plus the Fab `MetaHumanBodyTracker_5.8` (markerless BODY). They are **not enabled** in `PoF.uproject` — enable via `-EnablePlugins=MetaHuman -EnablePlugins=MetaHumanAnimationTools` (as the conform work enabled `MetaHumanCharacter`).

## Open questions to settle before building

1. **License clearance (BLOCKING, non-technical).** The video's premise is that the MetaHuman license *changed* to allow MetaHuman-derived data **outside** Unreal. Epic's 5.8 release-notes page did not restate license terms in the fetch. **Confirm the current MetaHuman EULA** covers using solved animation data (a) inside a shipped PoF-driven UE game (almost certainly yes) and (b) exported to Blender/other tools (the video's claim). This gates whether the Blender-export half of the spec is even permitted. → treat as a required check, like the Tripo non-commercial finding.
2. **Full solve entry point.** The probe confirms the *methods* load; it did not run an end-to-end solve. Need: does `start_pipeline` run to completion headless with `set_blocking_processing(True)`, or does the ML solve require GPU/RHI that `-nullrhi` starves? (The conform work ran real ops headless, so promising, but the CoreML solve may need a real RHI → run with `-RenderOffScreen` instead of `-nullrhi`.)
3. **Identity requirement.** Face solve needs a `MetaHumanIdentity` (a tracked neutral frame). Body solve (`MetaHumanBodyTracker`) may not. Determine the minimum asset prerequisites for a body-only clip (PoF's likely first use: locomotion/combat body motion, not facial).
4. **Optional Content dependency.** The conform work found `build_meta_human` gated on Epic-Launcher "MetaHuman Optional Content." Verify the *Animator solve/export* path does NOT share that gate (it should be independent of character assembly).

## Proposed PoF integration shape (mirror the proven seams)

Reuse the exact pattern that landed TripoSR / Hunyuan / conform, so this is incremental, not greenfield:

1. **`src/lib/visual-gen/metahuman-animator.ts`** — pure cores (`buildSolvePython(footageAsset, range, outAnimSeq)`, arg/marker parsing) + a spawn seam, dispatched through the existing `runExperiment` (`ue-experiment` runner) exactly like `metahuman-conform.ts` / `ue-import.ts`. Unit-testable with an injected spawn.
2. **Memory-bounded solve (folds in the RAM + stitch gotchas):** loop `set_processing_range` windows with `set_blocking_processing(True)`; after export, run a **stitch/re-anchor pass** (per-window root offset correction, quaternion rotation composition) — the animation analog of `mesh-critique.ts`'s geometry gate. Both gotchas are already in `UE_GOTCHAS` (`metahuman-animator-headless-memory-window`, `metahuman-animator-window-root-stitch`).
3. **Acceptance / critique tier:** wire `diagnostics_indicates_processing_issue()` as the L2 gate, and reuse the **anim-critique VLM tier** (`src/lib/anim-critique/`, `POST /api/verify/animation` — filmstrip → scored dims) as the L4 aesthetic gate on the exported take. This closes the "generated animation is reference, not final" loop that `arpg-animation` eval criteria already demand (`module-eval-prompts.ts:110`).
4. **Blender export half (license-gated, optional):** if the EULA clears external use, the exported AnimSequence / DNA can drop into the existing **Blender 4.2 headless** filmstrip path. **Rotation-representation caveat (from the source):** a MetaHuman/DNA rig authored in **Euler** must be composed as **quaternions** when transferring keyframes into a Blender rig (e.g. via the Poly Hammer Character DNA add-on) or the pelvis rotation silently breaks — captured in the `metahuman-animator-window-root-stitch` gotcha.

## Effort & recommendation

**XL** — spec-and-handoff (this doc), not a one-run build. The highest-value **next step** is a single **live end-to-end solve probe** (question 2 above) on a short test clip to confirm the headless solve actually produces an AnimSequence — that flips this from "API loads" to "engine works", the same way the conform run went from probe → `metahuman-conform.ts`. Do the license check (question 1) in parallel since it can hard-block the Blender half. If both clear, build `metahuman-animator.ts` as the first slice (solve + export a single window), then add windowing + stitch, then the critique gate.

## Related PoF anchors
- Proven seam to copy: `src/lib/visual-gen/metahuman-conform.ts`, `src/lib/visual-gen/ue-import.ts`; runner `src/lib/ue-experiment/runner.ts`.
- Critique gates: `src/lib/anim-critique/` (`POST /api/verify/animation`), `src/lib/visual-gen/mesh-critique.ts`.
- Eval criteria already anticipating this: `src/lib/evaluator/module-eval-prompts.ts` `arpg-animation` (AI-mocap-needs-cleanup, line ~110).
- Knowledge injected: `UE_GOTCHAS` `metahuman-animator-headless-memory-window`, `metahuman-animator-window-root-stitch`.
- Memory: `[[project_animation_alternatives]]`, `[[project_anim_critique]]`, `[[project_code_authored_animation]]`, `[[project_blender_mcp]]`.
