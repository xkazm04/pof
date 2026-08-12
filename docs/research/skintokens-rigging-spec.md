# SkinTokens / TokenRig — local arbitrary-creature auto-rig (spec, not built)

> Status: **SPECCED 2026-08-12** — install is user-gated (venv + flash-attn + multi-GB
> weights). Source run: Obsidian `Research/2026-08-12-complete-ai-3d-workflow.md`
> (Stefan 3D AI, [13:26]). Follow the ARDY precedent
> (`ardy-text-to-motion-spec.md`): spec first, build the runner against a real
> local install, never blind.

## What it is

**SkinTokens** (paper, arXiv 2602.04805) + **TokenRig** (framework) —
VAST-AI-Research (the Tripo org), successor to UniRig. Models the ENTIRE rig
(skeleton hierarchy + skinning weights) as one autoregressive token sequence;
GRPO-post-trained with geometric rewards. Claims 98–133% skinning-accuracy and
17–22% bone-prediction improvement over SOTA (incl. UniRig). Trained on
ArticulationXL 2.0 + VRoid Hub + ModelsResource — stylized characters,
quadrupeds, fantasy creatures.

- Repo: https://github.com/VAST-AI-Research/SkinTokens — **MIT** (commercial-safe,
  passes the CubePart license lesson).
- Weights: HF `articulation_xl_quantization_256_token_4` (TokenRig) +
  `skin_vae_2_10_32768` (FSQ-CVAE skin tokenizer), fetched via `python download.py --model`.
- CLI: `python demo.py --input examples/giraffe.glb --output results/giraffe.glb`
  — **GLB in → rigged GLB out.** Exactly the runner shape PoF already has
  (`triposr-runner.ts` / `hunyuan-runner.ts`).

## Why PoF needs it (the gap)

PoF has **no non-humanoid rig path**:

| Existing path | Limit |
|---|---|
| MetaHuman conform (`metahuman-conform.ts`) | humanoid only; assemble gated on Optional Content; auto-rig is an Epic CLOUD service |
| Tripo `animate_rig` (`pof_tripo_animate.mjs`) | cloud credits, `animate_prerigcheck` returns `rig_type:biped` only; free-tier output non-commercial |
| Dataflow rig-transfer (5.8, spec'd) | needs a DONOR rig of a compatible shape |
| ARDY | motion, not rigging |

Status impact: **powers-engine** for the character-pipeline rig step on
creatures, and directly targets the 2026-08-04 craft finding — bestiary
"3D & Rig" **A1, zero real rigged meshes across 94 entities, 36 swatch-only
candidates**.

## Install (user-gated) — requirements + known risk

- Python ≥ 3.11, CUDA ≥ 12.1, torch 2.7.0, **flash-attn**, `uv`-managed deps.
- GPU ≥ 14 GB VRAM — the 4090 (24 GB) fits.
- **RISK: flash-attn on Windows** is the exact dependency that made TRELLIS
  Windows-hostile (rejected 2026-06-20). Mitigations to try in order:
  1. Prebuilt Windows wheel matching torch 2.7 + cu12x (community wheels exist
     per-version; check before compiling).
  2. WSL2 venv (CUDA passthrough) if no wheel.
  3. If neither lands in ~1h, STOP and record the wheel-availability trigger —
     do not burn a day compiling (TRELLIS lesson).
- Suggested root: `kiro/skintokens` venv, env var `POF_SKINTOKENS_ROOT`
  (mirrors `POF_TRIPOSR_ROOT` / ARDY's layout).

## Build plan (after install proves live)

1. **Smoke by hand:** `demo.py` on one Tripo/Hunyuan-generated creature GLB
   (post `mesh-finish` — feed the CLEAN low-poly, not the 375-component raw
   gen). Inspect bones + weights in Blender.
2. **Runner seam:** `src/lib/visual-gen/skintokens-runner.ts` — pure
   args/parse cores + injectable spawn seam, mirroring `triposr-runner.ts`
   (`runnerBacked` provider entry in `providers.ts`, kind `rig`).
3. **Tier-1 rig gate (free, deterministic):** parse the output GLB — bone
   count > 0, every skinned vertex has ≥1 weight, weights normalized, no
   detached bones; the rig analog of `scoreMesh`. Live check: import to UE
   via `ue-import.ts` and confirm a Skeleton asset materializes.
4. **UE ingest:** glTF skeletal import (AssetImportTask with skeletal mesh) —
   verify against the known Tripo-anim bind-pose-scramble gotcha
   (`project_jinx_standalone`): confirm bind pose survives in UE, not just
   Blender.
5. **Wire to `character-pipeline` rig step / bestiary** once 1–4 prove out;
   flip step-facts like the packaging flip.

## Open questions (answer at install time)

- Does `demo.py` accept a weights/model path flag, or expect the repo-relative
  `download.py` layout? (Determines runner args.)
- Output GLB bone naming — Mixamo-compatible? (Determines whether ARDY's
  `mixamo_retarget.py` chains apply for animation reuse.)
- VRAM headroom beside a resident Qwen3-VL critic (8.9 GB) — sequential, not
  concurrent, if tight.
