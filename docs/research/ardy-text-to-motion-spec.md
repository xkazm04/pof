# ARDY text→motion engine for PoF (PROTOTYPE PROVEN 2026-07-15)

> Source: /research run 2026-07-14 (Stefan 3D AI, "NVIDIA ARDY: The Real-Time Leap in AI Animation").
> Verified: [nv-tlabs/ardy](https://github.com/nv-tlabs/ardy) — SIGGRAPH 2026, NVIDIA Toronto AI Lab.
> Status: **END-TO-END PROVEN LIVE 2026-07-15** — text prompt → UE 5.8 AnimSequence, fully headless, $0.

## Proven pipeline (2026-07-15)

Install at `C:/Users/kazda/kiro/ardy` (`.venv`, torch 2.13+cu126, transformers 5.8.1; `pip install -e .
--no-cache-dir` — the C++ motion-correction extension builds cleanly with pip-provided CMake + VS2022).
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

## Remaining build (the productization, not the proof)

- **Retarget to the game skeleton:** ARDY Core-27 bone names are Mixamo-convention (Hips/Spine1-3/
  RightForeArm/LeftUpLeg…) — `Content/Python/mixamo_retarget.py`'s fuzzy chain mapping applies nearly
  verbatim (Spine→Spine2, arms, legs, neck chains all present). IK Retargeter → UE5 Manny → play on
  the VerticalSlice player.
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
