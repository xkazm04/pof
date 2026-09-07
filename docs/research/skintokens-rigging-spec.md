# SkinTokens / TokenRig — local arbitrary-creature auto-rig (spec, not built)

> Status: **WORKING ON GPU 2026-09-07 — first real rigged creature produced.**
> Vulkan build done, and `bestiary_grunt.glb` came back with a valid 28-joint skin
> (all 26,788 vertices weighted, weight sums exactly 1.0, no dead joints). The runner
> seam drives it end-to-end. **Caveat: the Vulkan backend crashes nondeterministically
> (~60-80% of invocations); the runner retries, which is cheap and works.**
>
> (Earlier status: **INSTALL BLOCKER REMOVED — the PyTorch route below is superseded
> by a C++/GGML port.**) Source run: Obsidian `Research/2026-09-07-3d-ai-news-19.md`
> (PixelArtistry "3D AI News #19", [06:00]). Original spec 2026-08-12
> (Stefan 3D AI, [13:26]). Follow the ARDY precedent
> (`ardy-text-to-motion-spec.md`): spec first, build the runner against a real
> local install, never blind.

## ✅ WINDOWS BUILD RECIPE (proven 2026-09-07) — use Clang, not MSVC

Installed at `C:/Users/kazda/kiro/skintokens`. The README documents Linux only; this is
what actually works on this machine. **Four things bite, in this order:**

1. **MSVC CANNOT BUILD THIS.** `src/model.cpp:425` hard-`#error`s on
   `#if defined(__SIZEOF_INT128__)` — the NumPy-compatible PCG64 sampler needs 128-bit
   integers and MSVC has none. Not patchable without forking the sampler.
   **Use the Clang that ships with VS 2022:**
   `VC/Tools/Llvm/x64/bin/clang++.exe` (19.1.5, target `x86_64-pc-windows-msvc`) —
   verified to define `__SIZEOF_INT128__` and give `sizeof(unsigned __int128) == 16`.
   (An earlier MSVC attempt also tripped `/sdl` promoting C4996 on `getenv` in
   `src/internal.hpp:33` to an error; `_CRT_SECURE_NO_WARNINGS` clears that one, but the
   128-bit `#error` behind it is fatal, so the whole MSVC lane is a dead end.)
2. **`-DGGML_OPENMP=OFF` is required.** Otherwise `ggml-base.dll` fails to link with
   `lld-link: error: undefined symbol: __kmpc_dispatch_deinit` (clang's OpenMP runtime
   isn't on the link line). ggml's own thread pool still runs.
3. **`nlohmann_json` is a `find_package(... REQUIRED)`.** No vcpkg here, so build and
   install v3.11.3 to a prefix and point `CMAKE_PREFIX_PATH` at it.
4. **Run from `dist/`, not `build/`.** `skintokens.dll` is emitted to the build root, not
   beside the CLI, so `build/clang/bin/skintokens-cli.exe` dies with `0xc0000135`
   (STATUS_DLL_NOT_FOUND) — which also makes 2 of the 4 ctest cases *spuriously* fail.
   `cmake --install <build> --prefix ./dist` puts the DLLs beside the exe; **all 4 ctest
   cases pass** once they can find them.

```bat
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
set "LLVM=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\Llvm\x64\bin"
REM flip SKINTOKENS_ENABLE_VULKAN to ON once the Vulkan SDK is installed
cmake -S . -B build\clang -G Ninja ^
  -DCMAKE_C_COMPILER="%LLVM%\clang.exe" -DCMAKE_CXX_COMPILER="%LLVM%\clang++.exe" ^
  -DCMAKE_BUILD_TYPE=Release -DGGML_OPENMP=OFF ^
  -DSKINTOKENS_ENABLE_VULKAN=OFF ^
  -DCMAKE_PREFIX_PATH=C:\Users\kazda\kiro\deps
cmake --build build\clang -j 12
cmake --install build\clang --prefix ./dist
hf download LocalAI-io/SkinTokens-GGUF --include "F16/*" --local-dir models/SkinTokens-GGUF
dist\bin\skintokens-cli.exe inspect models\SkinTokens-GGUF\F16
```

Weights are 1.25 GB (`mesh-encoder.gguf` 58 MB, `skin-vae.gguf` 244 MB,
`tokenrig.gguf` 949 MB). `inspect` reports `backend: AMD Ryzen 7 7800X3D`.

**CLI contract, read from `src/cli.cpp`'s own `usage()` — not the README:**

```
skintokens-cli rig   MODEL_DIR MESH.{glb,t2mesh} OUTPUT.glb [--device auto|cpu|vulkan]
                     [--postprocess] [--beams N] [--temperature F] [--max-tokens N]
skintokens-cli skin  MODEL_DIR MESH SKELETON.glb OUTPUT.glb [--fit none|global|articulated]
                     [--retarget-soma-to-mixamo52] ...
skintokens-cli bind  MODEL_DIR MESH MOTION.glb OUTPUT.glb [--target-rig soma30|mixamo52] ...
skintokens-cli inspect MODEL_DIR | glb-info FILE.glb | retarget-check | prepare-mixamo | ...
```

Two corrections to the secondary source that prompted this: `--retarget-soma-to-mixamo52`
is a **flag on `skin`**, not a subcommand; and there is a `bind` subcommand that takes a
**Kimodo motion GLB** directly — the Kimodo bridge is in this binary, not a separate tool.
Success is stdout `... written to <path>` with exit 0; exit 2 is a usage error (our argv
is wrong); errors go to stderr with exit 1.

## ✅ GPU RESULT — the CPU/GPU comparison, measured

Vulkan build: add `-DSKINTOKENS_ENABLE_VULKAN=ON` and append the SDK to
`CMAKE_PREFIX_PATH` (`...;C:\VulkanSDK\1.4.357.0`), with the SDK's `Bin` on PATH so CMake
finds `glslc`. The SDK is needed only at **build** time — the Vulkan *runtime* ships with
the NVIDIA driver and was already present (`vulkaninfo` reported Vulkan 1.4.325 on the
4090 before anything was installed). Backend selected:
`NVIDIA GeForce RTX 4090 | fp16: 1 | bf16: 1 | matrix cores: NV_coopmat2`.

**Use a current `glslc`** (SDK 1.4.357 ships shaderc v2026.3). An older one — e.g. the
Android NDK r23c copy already on this machine — fails ggml's extension probes and
silently compiles the cooperative-matrix fast paths out, so a benchmark taken with it
would understate the GPU without saying so.

Same mesh (`bestiary_grunt.glb`, 26,788 verts / 39,735 faces), same command:

| | CPU device | **GPU (Vulkan)** |
|---|---|---|
| Wall clock | 24 m 01 s | **44 s** (including 5 crashed retries) |
| **CPU time consumed** | ~11,650 s | **10.89 s** |
| **Average cores busy** | ~5.5 of 8 | **0.25** |
| Peak RSS | 2.6 GB | negligible host-side |
| Output | **none** | **valid 28-joint rig** |

~**1,000× less CPU time** and a **22× drop in core contention**. That was the whole point:
the GPU sits idle during development while the CPU is contended, so this moves the work
off the resource that was blocking the machine — the win is the freed CPU at least as
much as the wall clock.

**Rig quality verified structurally** (not just "a file appeared"): 28 joints with
`inverseBindMatrices`, all 26,788 vertices skinned, weight sums `min = max = mean =
1.0000`, **0** zero-weight vertices, **0** unreferenced joints.

## ⚠ THE VULKAN BACKEND IS NONDETERMINISTICALLY UNSTABLE

It segfaults (`0xC0000005` / SIGSEGV) on **identical input, run to run**. This is not
input-dependent and not a size ceiling: a 20,480-face mesh succeeded once and then crashed
three times in a row, a 5,120-face mesh succeeded twice then crashed, and a 12-face cube
always worked. Measured over 10 identical runs each:

| config | ok / 10 |
|---|---|
| baseline | 2 |
| `GGML_VK_DISABLE_COOPMAT2=1` | 2 |
| `GGML_VK_DISABLE_COOPMAT2=1 GGML_VK_DISABLE_COOPMAT=1` | 5 |
| `GGML_VK_DISABLE_ASYNC=1` | 4 |
| all three | 4 |

No knob makes it stable, and the rate is roughly flat across kernel paths — which points
at skin-tokens.cpp's own Vulkan usage rather than a specific ggml kernel.

**Mitigation, which works:** a crash costs ~0.4 s against ~10 s for a success, so
`skintokens-runner.ts` retries **crashes only** (`maxAttempts`, default 8). A usage error
(exit 2) or a real error (exit 1) is deterministic and is never retried — repeating those
would just run our own bug eight times and bury the message. Observed successes on
attempt 3/3, 6/6 and 3/3. Worth reporting upstream with the table above.

## ⛔ THE CPU DEVICE IS NOT VIABLE — measured, not estimated

`rig` on `generated/meshes/bestiary_grunt.glb` (26,788 verts / 39,735 faces),
`--device cpu`:

| | |
|---|---|
| Wall clock | **24 min 01 s** |
| CPU time | ~11,650 s (≈5.5 of 8 cores held) |
| Working set | 2.6 GB |
| Output | **none — no file was ever written** |
| Side effect | the workstation was unusable for the duration |

So the "runs on CPU" headline is technically true and practically worthless for a
pipeline step. `skintokens-runner.ts` therefore defaults `device` to `vulkan` and
**refuses `cpu` and `auto`** unless the caller passes `allowCpu: true`, with the refusal
quoting this measurement. That is deliberate: the failure mode being prevented is a
catalog step silently freezing the machine for half an hour per creature.

## ✅ TIER-1 RIG GATE — built against the captured rig (`rig-gate.ts`)

`parseGlbRig(buffer) → RigFacts` + pure `scoreRig(facts) → RigVerdict` + `gateRig(path)`.
Parsing is done in TypeScript straight off the GLB (container → JSON chunk → the
`WEIGHTS_0`/`JOINTS_0` accessors) rather than through Blender or trimesh: a rig lives
entirely in the JSON chunk plus two accessors, so a spawn would cost seconds and a
dependency to read a few hundred bytes.

**The fixtures are real output, not hand-written glTF** — `skintokens_cube_rigged.glb`
(5 KB, an actual `rig` result) and `unrigged_sphere.glb` (an actual static input), both
committed under `src/__tests__/fixtures/rig/`. A guard written against imagined data
passes its own test and never fires in production.

**FAIL (the rig cannot deform the mesh — definitional, not tuned):** no skin · no joints
declared · no joint referenced by any weighted vertex · any vertex whose weights sum to 0
· weights not normalized · negative or non-finite weights.
**WARN (real defect, still usable, −10 score each):** orphan joints (declared, deforming
nothing) · missing inverse bind matrices · a suspiciously thin skeleton (≤2 joints).

**Wired, not merely available:** `runSkintokens` gates its own output and returns
`rig` + `facts`; a failed gate fails the run (the path is still reported so the caller can
look at what was rejected), and an UNREADABLE output fails too — ungated is not passed.
`skipGate: true` opts out and then makes **no** rig claim at all, rather than an
assumed-good one.

**Live proof, full chain on the GPU:**
`ok: true, attempts: 1, durationMs: 36982, rig: { pass: true, score: 100, failures: [],
warnings: [] }, facts: { jointCount: 28, referencedJoints: 28, vertexCount: 26788,
zeroWeightVertices: 0, maxInfluences: 4, ... }`.

**Tolerance lesson worth keeping:** the earlier Python capture reported weight sums of
"exactly 1.0" because it rounded to 6 decimals. Read at full float32 precision the real
rig sums to `0.99999982–1.00000018` — ~1.8e-7 of drift. A gate asserting `== 1.0` would
have rejected every genuine rig; the shipped tolerance is 1e-3, loose enough to survive
8/16-bit weight quantization too.

## ▶ NEXT STEPS

1. ~~**Tier-1 rig gate**~~ — **DONE** (`src/lib/visual-gen/rig-gate.ts`, 17 tests). See below.
2. **Wire to the bestiary rig step** — the target that motivated all of this
   ("3D & Rig" A1, zero real rigs across 94 entities).
3. **Rig QUALITY is still unmeasured.** The rig is structurally valid; whether those 28
   joints are *anatomically* sensible for a given creature is a separate judgement
   (posed render + mesh critique). Structural validity is not rig quality, and this
   spec should not be read as claiming it.
4. **Report the Vulkan crash upstream** with the 10-run tables above.
5. Optional levers, both unexplored: `--postprocess` (surface-locality heuristic) and
   `--beams`.

## ⚠ READ FIRST — build against `skin-tokens.cpp`, not the PyTorch repo

The 2026-08-12 descope reason was **flash-attn on Windows + 14 GB VRAM** — the exact
dependency pair that made TRELLIS Windows-hostile. **Both are gone.**

[`localai-org/skin-tokens.cpp`](https://github.com/localai-org/skin-tokens.cpp) is a
C++/GGML conversion of VAST-AI SkinTokens (verified 2026-09-07):

| | PyTorch repo (original spec) | `skin-tokens.cpp` (build this) |
|---|---|---|
| Licence | MIT | **Apache-2.0** (NOTICE carries the upstream MIT attribution) |
| Compute | CUDA ≥ 12.1, **flash-attn**, ≥ 14 GB VRAM | **CPU or Vulkan** — `--device vulkan\|cpu\|auto`. **No CUDA, no flash-attn.** |
| Toolchain | Python 3.11 + torch 2.7 + `uv` | C++23, CMake ≥ 3.25, Ninja, `nlohmann-json`; Vulkan optional (`-DSKINTOKENS_ENABLE_VULKAN=OFF`) |
| Weights | HF `articulation_xl_quantization_256_token_4` + `skin_vae_2_10_32768` | `hf download LocalAI-io/SkinTokens-GGUF --include "F16/*" --local-dir models/SkinTokens-GGUF` (F32 is for numerical-parity checks only) |
| Entry point | `python demo.py --input x.glb --output y.glb` | `rig` (skeleton + weights from a static mesh), `skin` (weights for an existing skeleton), plus flags `--fit global\|none\|articulated`, `--postprocess`, `--beams` |
| I/O | GLB in → rigged GLB out | **same** — GLB in, rigged GLB out with a one-frame rest pose so it opens as a conventional skinned glTF. Also reads TRELLIS.2 `.t2mesh`. |

**Bonus capability, unasked-for and load-bearing:** the binary ships
`retarget-soma-to-mixamo52`. That dissolves the *other* half of the 2026-08-19 Kimodo
descope — whose stated blocker was that Kimodo's SOMA-77 skeleton "would strand PoF's
Core-27 rig (`IK_ArdyCore` auto-matched Mixamo names with zero manual chains)". A
SOMA→Mixamo retargeter in the same toolchain removes that objection; the sibling
[`localai-org/kimodo.cpp`](https://github.com/localai-org/kimodo.cpp) runs Kimodo's five
motion checkpoints from GGUF on **CPU or Vulkan**, which also removes the ~17 GB
CUDA-install objection. Evaluate the two together — and note that with ARDY's install
still absent from this machine (2026-08-19 regression), a CPU-only motion engine is no
longer merely a second option.

**Two things the ported route does NOT change:** the model's *quality* on PoF's actual
creature meshes is still unmeasured, and building the binary + downloading GGUF weights
is still a **user action**. The reconsider trigger has fired; the smoke run has not.

## (superseded) Original PyTorch install route

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

1. **Smoke by hand:** `skintokens rig --input <mesh>.glb --output <rigged>.glb
   --device auto` (or, on the superseded PyTorch route, `demo.py`) on one
   Tripo/Hunyuan-generated creature GLB
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

- Does the `rig` subcommand accept a weights/model path flag, or expect the
  `models/SkinTokens-GGUF` layout the README's `hf download` produces?
  (Determines runner args.)
- `--fit global|none|articulated` and `--beams` are undocumented in the summary —
  measure their effect on one creature before picking a default.
- CPU-vs-Vulkan wall-clock on a real creature mesh: is CPU-only fast enough to run
  in the pipeline, or is Vulkan required in practice?
- Output GLB bone naming — Mixamo-compatible? (Determines whether ARDY's
  `mixamo_retarget.py` chains apply for animation reuse.)
- VRAM headroom beside a resident Qwen3-VL critic (8.9 GB) — sequential, not
  concurrent, if tight.
