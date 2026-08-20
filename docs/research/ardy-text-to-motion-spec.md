# ARDY text→motion engine for PoF (PROVEN 2026-07-15 · REINSTALLED 2026-08-19)

> Source: /research run 2026-07-14 (Stefan 3D AI, "NVIDIA ARDY: The Real-Time Leap in AI Animation").
> Verified: [nv-tlabs/ardy](https://github.com/nv-tlabs/ardy) — SIGGRAPH 2026, NVIDIA Toronto AI Lab.
> Status: **END-TO-END PROVEN LIVE 2026-07-15** — text prompt → UE 5.8 AnimSequence, fully headless, $0.

> ## 2026-08-19 — the install VANISHED and was REBUILT the same session
>
> An uncapped search (`find /c/Users/kazda -maxdepth 4 -iname "ardy*"`) returned **nothing**:
> the venv, the weights and the locally-assembled `text_encoders/` were all gone, while the
> committed converters survived. The recipe below still read "PROVEN LIVE" — the docs and the
> machine had silently diverged, and only a filesystem check could tell them apart.
> **A doc claiming a proven pipeline should carry a runnable preflight, not prose.**
>
> **Rebuilt and re-verified 2026-08-19** at `C:/Users/kazda/kiro/ardy`: torch 2.13.0+cu126
> (`cuda_avail True`), ardy 0.2.0 editable, transformers 5.8.1, numpy 1.26.4,
> `motion_correction` 1.0.0 C++ ext, text_encoders reassembled. Generation confirmed on
> `ARDY-Core-RP-20FPS-Horizon40` — 5 clips, <1 s GPU each after load.
>
> ### NEW GOTCHA — `pip install -e .` does NOT build the C++ extension, and the failure is SILENT
>
> This spec previously implied the motion-correction extension comes with the root editable
> install. It does not. `motion_correction` is a **separate package** under `MotionCorrection/`
> with its own `setup.py` + `CMakeLists.txt`, and `ardy/postprocess.py:309` imports it
> lowercase. Two traps:
>
> - `pip install ./MotionCorrection` fails with `RuntimeError: CMake must be installed` even
>   when cmake IS in the venv — pip's **isolated build env** cannot see it. Working command:
>   `pip install ./MotionCorrection --no-cache-dir --no-build-isolation` with the venv's
>   `Scripts/` on PATH (`pip install cmake` first).
> - Without it, `import MotionCorrection` still **succeeds** — Python resolves the repo's
>   source folder as an empty namespace package (`__file__ is None`, `dir()` empty). So the
>   foot-skate post-process is silently absent and clips generate without any error.
>   Verify with `from motion_correction import motion_postprocess`, never `import MotionCorrection`.
>
> ### The gated-Llama workaround still works, and all three repos are UNGATED
>
> `McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp`, its `-supervised` sibling and
> `NousResearch/Meta-Llama-3-8B-Instruct` all report `gated: False`. Assemble by fetching the
> McGill repo whole, then overlaying ONLY `model-*.safetensors` + `model.safetensors.index.json`
> from the Nous mirror — McGill's `config.json` must win (`architectures: ['LlamaEncoderModel']`;
> the Nous one would restore causal-LM behaviour). A single `lm_head.weight UNEXPECTED` in the
> load report is the expected, benign artifact.
>
> Consequence for `/status`: `characters::Combat Anim`, `cutscenes::Blocking / Body Anim` and
> `spellbook::Animation` remain `trueEngine: None, generatorWired: false` — the engine is back
> on disk, but wiring those steps is still unbuilt work.
>
> ### App seam BUILT 2026-08-19 — `src/lib/visual-gen/ardy-runner.ts`
>
> The seam four sessions listed as "remaining" now exists: `runArdy` (pure `buildArdyArgs` /
> `resolveArdyEnv` / `parseArdyOutput` + injectable spawn, triposr/hunyuan shape) and
> **`preflightArdy`**, which makes this recipe re-provable in one command instead of trusting
> the prose above:
>
> ```
> POF_ARDY_ROOT=C:/Users/kazda/kiro/ardy npx vitest run src/__tests__/lib/visual-gen/ardy-runner.live.test.ts
> ```
>
> Env-gated, so it skips in `npm run validate`. Preflight checks the checkout, the encoder
> assembly, CUDA, and imports `motion_correction` **lowercase** (the capitalised import is the
> one that fails open). It distinguishes *gone* from *misconfigured* — the 2026-08-19 failure.
>
> **Gotcha the live smoke caught, which the unit suite structurally could not:** the spawn must
> set `cwd` to the checkout. ARDY resolves a relative `--output` against its own cwd, so without
> it a relative stem writes into the CALLER's directory — it dropped an `outputs/` folder into
> the PoF repo — and a resolver that checks the caller's cwd first will then "find" the stray
> and report success. Resolve reported relative paths against the checkout, never the caller.
>
> ### FULL CHAIN RE-PROVEN 2026-08-20 on freshly generated clips
>
> The UE side never broke — 25 assets plus `IK_ArdyCore` / `IK_Manny` / `RTG_ArdyToManny` all
> survived; only the model install was lost. What was unproven was whether clips from the
> REINSTALLED model still traverse the chain. They do, end to end:
>
> `text prompt → npz → BVH (FK round-trip 0.000 mm ×4) → skinned FBX ×4 → UE 5.8 AnimSequence
> 4/4 → IK-retarget onto SKM_Manny 4/4` (slash 2.45 s, run 3.95 s, roll 2.95 s, idle 3.95 s —
> play lengths match the requested durations).
>
> **The July rig was REUSED, not rebuilt** — that is the actual test, and it passed. This closes
> the "IK-retarget to Manny" item the July sessions listed as remaining.
>
> Scripts: `Content/Python/ardy_verify_import.py` + `ardy_verify_retarget.py` (pof-exp
> `109a0cf`). Both write to `/Game/Generated/ArdyVerify`, NOT `/Game/Generated/Ardy` — the
> latter holds the clips `AM_Dodge_Forward` / `AM_MeleeCombo` reference and that were verified
> in live gameplay, and re-importing over them to prove a pipeline works would risk regressing
> the playable build with un-play-tested motion. The verify assets are deliberately left
> untracked; only the scripts are committed.
>
> **New gotcha (shipped as `plugin-content-not-in-registry-headless`):** engine-PLUGIN content
> (`/MoverTests`, `/MoverExamples`) is absent from the asset registry under
> `-run=pythonscript -nullrhi` until scanned, so `does_asset_exist` returns False for a mesh
> that is on disk with its plugin enabled — surfacing as a misleading "no Manny mesh found".
> `scan_paths_synchronous([...], True)` then `load_asset` directly.
>
> ### Lineage correction — ARDY is the NEWER model, Kimodo is the earlier one
>
> A 2026-08-19 `/research` run initially proposed adopting **NVIDIA Kimodo** as an ARDY
> *successor*. That was backwards, and the correction is recorded here so it is not
> re-proposed. From Kimodo's own README changelog:
>
> > **[2026-07-10]** Released the ARDY project — a *real-time* motion generation model with
> > all the controllability of Kimodo!
>
> | | **ARDY** (this spec) | **Kimodo** |
> |---|---|---|
> | Released | 2026-07-10 | 2026-03-16 |
> | Skeleton | **Core-27** — Mixamo-convention names; UE 5.8's auto-template matched it with **zero manual chains** (`IK_ArdyCore`) | **SOMA-77** since 2026-03-19 (breaking) — would strand the entire Core-27 retarget rig |
> | Training data | Bones Rigplay 1 | Bones Rigplay 1 — **identical**, so there is no quality lever here |
> | Text encoder | gated `meta-llama/Meta-Llama-3-8B-Instruct` via LLM2Vec | **the same** (`kimodo/model/llm2vec/llm2vec.py:173`) — the gating problem is not solved by switching |
> | Constraints | yes — `--constraints <saved list>` | yes |
> | Multi-prompt | **no** (single `--prompt`) | **yes** ("improved multi-prompt generation", 2026-04-24) |
> | Real-time | yes (~33 ms/step) | no |
>
> **Verdict: reinstall ARDY, do not switch to Kimodo.** Same dataset means no quality gain,
> and SOMA-77 would discard a proven retarget rig for nothing.
>
> **The one genuine Kimodo capability PoF lacks is native multi-prompt generation** — a single
> continuous clip from a sequence of prompts ("run forward, then vault over"). PoF fakes this
> today with `scripts/visual-gen/ardy/pof_npz_concat.py`, and session 5 (2026-07-16) found
> that `duplicate_and_retarget` **explodes on the concatenated clip only** (bones at 78 m,
> while individually-retargeted clips sit clean at ~6 cm) — still open and undiagnosed, worked
> around by "retarget clips individually". A model that emits the blend as one take with one
> root track removes the concat step the bug lives in. That is the *only* reason to keep
> Kimodo on the radar, and it is a second engine for combo clips, never a replacement.

## Proven pipeline (2026-07-15)

Install at `C:/Users/kazda/kiro/ardy` (`.venv`, torch 2.13+cu126, transformers 5.8.1; `pip install -e .
--no-cache-dir`, THEN `pip install ./MotionCorrection --no-cache-dir --no-build-isolation` — see the
2026-08-19 gotcha above; the root editable install does NOT build the C++ extension and its absence
is silent).
Four game verbs generated and imported end-to-end:

1. **Generate** — `TEXT_ENCODERS_DIR=<root>/text_encoders TEXT_ENCODER_MODE=local .venv/Scripts/python
   scripts/generate.py "<prompt>" --model core --duration 4 --seed 0 --output <name>` (~1 s of GPU compute
   per 4 s clip after load). Gated-Llama workaround: the LLM2Vec base is assembled locally under
   `text_encoders/McGill-NLP/...-mntp/` = McGill config/tokenizer/adapter + Llama-3-8B-Instruct weights
   from the public NousResearch mirror (byte-identical, same Llama 3 Community License) — no code edits,
   `TEXT_ENCODERS_DIR` handles the rest. VRAM ~15 GB total on the 4090.
2. **Verify** — `scripts/visual-gen/ardy/pof_filmstrip.py` (stick-figure strip from `posed_joints`; Y-up,
   root-centered) + numeric gates (slash in place, run 8.3 m @ 5.1 m/s peak w/ flight phases, roll 2.4 m
   w/ full tuck, idle static — all coherent on first try, seed 0).
3. **Convert** — `scripts/visual-gen/ardy/pof_npz_to_bvh.py`: ARDY's FK is exactly BVH semantics
   (`global = parent ∘ [R_local | rest-offset]`), so BVH is a faithful re-parameterization; the script
   FK-round-trips against `posed_joints` and refuses to write on mismatch (**0.000 mm** on all 4 clips —
   the anti-scramble gate).
4. **FBX** — `scripts/visual-gen/ardy/pof_bvh_blender.py` (Blender 4.2 headless): BVH import → render
   verification tiles → **skinned proxy mesh** (box per bone, 100% weight) → FBX (no leaf bones). The
   skinned mesh is REQUIRED — armature-only FBX fails UE skeletal import.
5. **UE import** — `Content/Python/ardy_import.py` via the proven `-run=pythonscript` commandlet, with
   `Interchange.FeatureFlags.Import.FBX 0` forced (5.8 Interchange otherwise ignores FbxImportUI —
   see the updated `interchange-fbx-commandlet-crash` gotcha). Result: SkeletalMesh + Skeleton +
   AnimSequence per clip under `/Game/Generated/Ardy/<name>/` (verified 3.95 s each).

## Retarget to Manny — DONE 2026-07-15 (session 2, pof-exp `efd64c9`)

`Content/Python/ardy_retarget.py`: shared-skeleton re-import (anim-only onto slash's skeleton) →
`IK_ArdyCore` (the 5.8 **auto-template matched** the Mixamo-convention Core-27 — zero manual chains) →
`RTG_ArdyToManny` (existing `IK_Manny` target, `add_default_ops` + FUZZY auto-map) →
`duplicate_and_retarget` → `/Game/Generated/Ardy/Manny/*_Anim_Manny`. **Numerically verified**
(`ardy_anim_probe.py`, `AnimPoseExtensions.get_anim_pose_at_time(seq, t, AnimPoseEvaluationOptions())`):
the **dodge roll retargets clean** — full inversion (head 6 cm off ground, feet airborne at t≈1.1 s) →
recovery, 2.3 m forward — the clip the old Mixamo pipeline could never carry. Headless pitfalls learned:
anim-FBX export with `export_preview_mesh=True` asserts under both `-nullrhi` and `-RenderOffScreen`
(anim-only export works); judge retargets by the AnimPose probe + Persona, not Blender box-proxy renders.

## In-game — DONE 2026-07-15 (session 3, pof-exp `70be0e8`): the FULL loop is closed

`ardy_montage.py`: `AM_Dodge_Forward` turned out to be an **EMPTY placeholder** (0.00 s, no
skeleton/deps — the roll never had a real animation); replaced with a montage built from
`roll_Anim_Manny` (root motion on, DefaultSlot; original backed up `_PreArdy`). BP_VSPlayer's
skeleton (`/MoverTests` SK_Mannequin) = the retarget target, so the swap is direct.
**Proven live through the scenario harness** (experiment API, walk + `activate_ability
Ability.Dodge`): behavioralVerdict **PASS** — montage played, 766 u displacement, the speed
profile shows root motion driving the roll (600 walk → 61–264 during the montage → rest); the
peak-action frame shows the player mid-tumble in the VerticalSlice arena.

**text prompt → ARDY → BVH → FBX → UE import → IK retarget to Manny → GAS dodge montage →
observed + rendered in live gameplay.** Headless, $0, one session per hop.

Scenario-harness notes: injected input ACTIONS need an explicit `value` (`[1,0]` for buttons —
a value-less action injects (0,0) and never triggers); the `activate_ability` event verb
(gameplay tag) is the reliable path for firing abilities.

## Melee combo — DONE 2026-07-15 (session 4, pof-exp `2658fee`)

Three generated slash variants (overhead / horizontal sweep / rising diagonal, 2.5 s each, all
coherent at seed 3) → **concatenated at the npz level** (`pof_npz_concat.py` — root re-anchored
per clip, section starts 0/2.5/5.0) → one 7.45 s clip through BVH→FBX→import→retarget
(`ardy_combo2.py`) → montage installed at `AM_MeleeCombo` (also an empty placeholder; backup
`_PreArdy`). **Live scenario PASS** (`activate_ability Ability.Melee.LightAttack`): montage
played, 26° body swing, standing (dist=0) — one attack press plays the full 3-hit chain.

Hard-won import knowledge (now the `fbx-animsequence-import-fresh-folder` gotcha): the automated
FBX importer's REIMPORT path silently skips AnimSequence creation — fresh folder (filesystem rm;
stale .uasset survives `delete_directory`), `replace_existing=False`, `save=False` + explicit
`save_asset` (task.save covers the mesh only; unsaved skeletons/anims vanish with the session —
which is how the first shared-skeleton import broke). 5.8 Python walls: `CompositeSection.start_time`
+ `AnimMontage.notifies` are not scriptable — hence upstream concatenation; input-gated combo
branching (sections + ComboWindow/HitDetection notify states) needs a short editor pass or a C++
helper.

## Qwen-VLM validation loop — OPERATIONAL 2026-07-16 (session 5, pof-exp `f430c2a`)

The pipeline was "half blind" — numeric gates (montage✓, swing°, displacement) passed while PIE
showed a destroyed mesh. The fix: **the existing `/api/verify/animation` route with
`provider:"qwen"` judges the scenario harness's saved frames** (`frameDir` = the run's
`pof_exp_scn_*` temp dir, `cam:"side"`, name+intent). Proven discriminating on first contact:

- **Combo (concat clip): fail 15/100** — named the static freezes (montage died early) and the
  collapsed rigging pose. Root cause chased with AnimPose probes: the CONCATENATED clip's
  retarget explodes (bones at 78 m!) while its source anim AND the three individually
  retargeted clips are clean (feet ~6 cm) — `duplicate_and_retarget` breaks specifically on the
  concatenated clip (open question: not root travel alone — run_Anim retargets fine at 8.3 m).
  → `AM_MeleeCombo` rebuilt from the clean single `combo1_Anim_Manny`; post-fix **Qwen 45 warn**
  (silhouette 30→70), scenario PASS.
- **Roll: fail 35/100** with generation-level feedback numeric gates can't produce: entry reads
  as a hand-plant vault (not shoulder-led), stiff angular tuck, recovery snaps without momentum.
  → these become the next generation prompt ("shoulder-led tuck", shorter duration, momentum
  carry-out), not a retarget fix.

Loop recipe: scenario run (frames auto-saved) → POST `/api/verify/animation`
`{provider:"qwen", frameDir, cam:"side", maxFrames:10, name, intent}` → structured card
(6 dims + reasons + topFix). Refinement noted: match the capture window to the montage span,
else Qwen dings pre/post-montage idle frames as "static holds".

## Remaining build (the productization, not the proof)

- **Roll v2:** regenerate with Qwen's feedback in the prompt (shoulder-led, ~1.5 s, momentum
  recovery) + dodge play-rate tuning; re-validate through the loop.
- **Concat-retarget explosion:** diagnose why `duplicate_and_retarget` breaks on concatenated
  clips (compare FBX bind/anim stacks vs single clips); until then, retarget clips individually.
- **Input-gated combo branching:** add Combo1/2/3 sections + `AnimNotifyState_ComboWindow` /
  `AnimNotifyState_HitDetection` to `AM_MeleeCombo` in the editor (30-second manual pass), or ship
  a tiny PoFEditor C++ helper exposing section/notify authoring to Python.
- **`ardy-runner.ts`** seam + job store (mirror hunyuan-runner) + provider registration so the app can
  dispatch prompts; Tier-1 motion-sanity gate from the npz (foot contacts + root continuity — the
  numeric gate above, productized); Qwen filmstrip critique via `anim-critique/`.
- **License check** before shipping generated motion: ARDY weights = NVIDIA Open Model license; the
  encoder base = Llama 3 Community License (also: request official meta-llama HF access to retire the
  mirror workaround).

## What ARDY is (verified against the repo, not just the video)

Autoregressive **diffusion for interactive human motion generation** — a real-time (~33 ms/step,
4-step diffusion) **text→full-body-motion** model with streaming controls:

- **Inputs:** online text prompts + kinematic constraints — root waypoints/trajectories, full-body
  keyframes, sparse joint positions/rotations, keyboard/mouse steering (target velocity, waypoints).
- **Outputs:** `.npz` per clip — world-space joints `[T, J, 3]`, rotations, root, **foot contacts**,
  fps, prompt text. Skeletons: **Core (27-bone)** and **Unitree G1** (SOMA announced). No FBX/BVH.
- **Headless:** `scripts/generate.py` CLI batch generation + Python API (`load_model()`,
  `Ardy.autoregressive_step()`). Passes the automation-loop bar (no GUI dependency).
- **License:** code **Apache-2.0**; weights under the **NVIDIA Open Model** license (re-check the
  HF model cards for redistribution/commercial terms before shipping generated motion — the
  CubePart license lesson).
- **Hardware:** tested on RTX 4090; ~24 GB for real-time (this machine qualifies). Text encoder is
  the **HF-gated `meta-llama/Meta-Llama-3-8B-Instruct`** (~14 GB bf16) — needs an approved HF token.
  TensorRT path wants driver ≥ 575; build needs CMake ≥ 3.15 + C++17.

## Why it matters to PoF

Animation is PoF's weakest domain and the largest remaining unpowered `/status` class after the
packaging engine shipped: animation steps have **no true generative engine** — Tripo preset
retargets (run/idle/walk) are the only motion source, and the MetaHuman Animator video→anim path
is XL-descoped on the footage-ingest blocker.

ARDY changes the strategy:

1. **No footage needed at all.** MetaHuman Animator needs a monocular clip + identity ingest (the
   real blocker); the V3 generated-video path measured a hard quality ceiling (fused feet). ARDY
   goes **prompt→skeletal motion directly** — it deletes the footage problem for BODY motion
   instead of solving it. (MHA remains the *face* path; ARDY has no face channel.)
2. **Constraint channel = scenario-driven authoring.** Root trajectories + keyframes + streaming
   text is exactly the shape of PoF's scenario specs — "run to (x,y), slash, recoil" could compile
   to ARDY constraints (the candidate #5 capability, folded in here).
3. **Foot contacts in the export** feed the anim-critique foot/contact-coherence criterion directly
   (no VLM inference needed for that check).

## Design (mirror the proven runner pattern)

- **`src/lib/visual-gen/ardy-runner.ts`** — pure cores (`buildGenerateArgs`, `parseNpzManifest`
  summary) + injectable spawn seam, exactly like `triposr-runner.ts`/`hunyuan-runner.ts`; env
  `POF_ARDY_ROOT` (+ `POF_ARDY_VENV`); job store mirroring `hunyuan-job-store.ts` with auto-critique.
- **`scripts/visual-gen/pof_ardy.py`** — thin wrapper over `scripts/generate.py`: prompt (+ optional
  constraint JSON) → `.npz` under `generated/ardy/`.
- **`scripts/visual-gen/pof_npz_to_fbx.py` (Blender 4.2 headless)** — the missing hop: build an
  armature from npz joints/rotations, bake keyframes, export FBX. Reuse the proven Blender headless
  recipe + the `ai-motion-generator-ue-ingestion` gotcha (disable Add Leaf Bones, axis/scale checks,
  validate in Blender FIRST — the Tripo bind-pose-scramble failure mode).
- **UE ingestion:** proven `-run=pythonscript` FBX skeletal-import commandlet → IK Retargeter to the
  UE5 Mannequin (the `mixamo_*` tooling is the precedent). Judge by Blender filmstrip + UE rendered
  frame (L4), never by import success.
- **Acceptance:** Tier-1 = motion sanity from the npz itself (foot-contact coherence, root
  continuity, joint-velocity spikes — pure math, $0, the mesh-critique analog for motion);
  Tier-2 = Qwen filmstrip critique via the existing `anim-critique/` seam.

## Gates (why not built this run)

1. **Local install is user-gated:** HF gated-Llama approval + ~16 GB+ downloads + CMake/C++ build
   + driver check. One-command-away once done: `pof_ardy.py --prompt "…" --output generated/ardy/…`.
2. **Weights license** (NVIDIA Open Model) — confirm generated-motion usage terms.
3. **npz→FBX hop is unproven** — build it against a real ARDY export, not blind (the first live
   export defines the exact npz schema).

**Reconsider trigger:** user installs ARDY (or asks to push the animation engine) → build the
runner + Blender converter, prove one prompt→UE-retargeted AnimSequence end-to-end, then flip the
animation steps' step-facts (`trueEngine`) the way packaging was flipped.
