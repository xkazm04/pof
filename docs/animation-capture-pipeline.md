# Autonomous Animation Capture Pipeline (text → video → motion → Manny → grade)

The pipeline that turns a **text prompt** into a **believable combat AnimSequence on the UE5 Manny skeleton**, fully headless, and grades it against an aesthetic ruler. Proven end-to-end 2026-06-23: a Veo-generated lightsaber strike → MetaHuman markerless body capture → IK-retarget → Manny → rendered filmstrip → VLM score **42/100** (real lunging weight/footwork; weak on wind-up/grip).

This is the backbone for autonomous animation iteration. The design goal is a **fitness loop**: generate a motion source, capture it, put it on the character, *measure* how good it looks, and iterate — with no hand-authoring and no "green checkmark without a rendered frame".

> **Reframe that makes this work:** the two hard halves everyone else lacks — (a) getting arbitrary motion onto the Manny/Mannequin skeleton, and (b) *measuring* whether it looks good — we already own. The only thing we kept getting wrong was the **content source** (hand-FK, then fixed Mixamo). This pipeline swaps in a generative source while keeping our retarget + measurement moat. See [research/animation-alternatives](research/) and the project memory `project-animation-alternatives`.

---

## The chain at a glance

| # | Stage | Tool | Script | Output |
|---|-------|------|--------|--------|
| ① | text → **video** | Google **Veo 3** (via Gemini API) | `shots/veo_gen.mjs` | 8s 720p mp4 |
| ② | video → **clean frames** | `ffmpeg` (+ the plugin's ingest) | `shots/mha_capture.py` (ingest step) | 240 PNG frames on disk |
| ③ | frames → **3D motion** | Epic **MetaHuman Animator – Markerless** (`MetaHumanBodyTracker`) | `shots/mha_capture.py` | `AS_VeoStrike` + `SK_VeoStrike` (MetaHuman skel) |
| ④ | motion → **Manny** | UE **IK Retargeter** (built in Python) | `shots/mha_retarget.py` | `AS_VeoStrike_Manny` (SK_Mannequin) |
| ⑤ | motion → **frames** | PoF **Observation-Spine harness** (`ScenarioController` `play_anim`) | `shots/veo_manny.json` | chase/side filmstrip PNGs |
| ⑥ | frames → **score** | **VLM critique tier** (Gemini vision today) | `scripts/anim-critique.mjs` | 6-dim score + reasons + top-fix |
| ⑦ | (check) **editor preview** | Python | `shots/make_preview.py` | `/Game/Maps/VS_VeoPreview` looping dummy |

All UE steps run headless via `UnrealEditor-Cmd.exe <PoF.uproject> -run=pythonscript -script=<py>` (capture/retarget add **`-AllowCommandletRendering`** — see fixes). All scripts live in the app repo `shots/`; the UE project is the pof-exp `PoF.uproject` (UE 5.8, VerticalSlice arena).

---

## Stage detail

### ① Generate the reference video — Veo 3
- **Where Veo comes from:** it's a model on the **Gemini API** — the same `GEMINI_API_KEY` (billing enabled), via `@google/genai`. No separate service.
- `ai.models.generateVideos({ model:'veo-3.0-fast-generate-001', prompt })` → async op (~52s) → `ai.files.download`.
- **The prompt that produced the current strike** (`shots/veo_gen.mjs:7`):
  > *Full-body wide shot of a single warrior performing one clean, powerful overhead two-handed sword strike: clear anticipation windup, fast downward strike, follow-through. Plain neutral studio background, even lighting, static camera, the entire body visible from head to feet, no other people.*
- **What matters for this pipeline (not cinematics):** one **full-body** human, **head-to-feet in frame**, **plain background**, **static camera**, coherent limbs. MetaHuman's solver explicitly does worse with moving cameras and needs the whole body incl. hands. Anatomy coherence ≫ style.

### ② Clean + extract frames
- UE's mono-video importer cannot read the Veo mp4's metadata directly, so re-encode: `ffmpeg -i strike.mp4 -an -c:v libx264 -pix_fmt yuv420p -r 30 -movflags +faststart strike_clean.mp4`.
- The plugin's `ingest_mono_video_sync` then extracts the clip to **240 PNG frames** at `%LOCALAPPDATA%/CaptureManager/Media/PoF/MonoVideo/<slate>_1/Video/<name>/` + an `ImgMediaSource`. **These frames are the "images" the ML solver consumes** (there is no still-image stage in this pipeline).

### ③ Markerless body capture (the core tool)
- **Plugin:** Epic **MetaHuman Animator – Markerless Motion Capture** (`MetaHumanBodyTracker`, UE 5.8, free on Fab, **local**, commercial-clean under the UE EULA). Internals: **Detectron2** (2D keypoints) + **SAM2** (segmentation) per frame → **SMPL** body fit → baked onto the **MetaHuman base skeleton**. SMPL is internal-only; the deliverable is a native UE AnimSequence (no SMPL in the output = no licensing trap).
- Headless recipe (`shots/mha_capture.py`): `CaptureManagerIngestBlueprintLibrary.ingest_mono_video_sync(...)` → `create_asset(MetaHumanPerformance, FactoryNew)` + `input_type=MONO_FOOTAGE` + `footage_capture_data` → `set_blocking_processing(True); start_pipeline()` (~4 min GPU solve on an RTX 4090) → `MetaHumanPerformanceExportUtils.export_animation_sequence(...)`.
- **Output:** `AS_VeoStrike` (motion) + `SK_VeoStrike` (body mesh), on `/MetaHumanBodyTracker/metahuman_base_skel`.

### ④ Retarget onto Manny
- UE's **IK Retargeter**, built entirely in Python (`shots/mha_retarget.py`): clone `IK_Manny`'s 28 retarget chains onto a new IK rig bound to `SK_VeoStrike` (the MetaHuman base skel shares Manny's bone names) → **add the op stack** (Pelvis Motion + FK Chains) → `auto_map_chains(EXACT)` → `IKRetargetBatchOperation.duplicate_and_retarget([AssetData], SK_VeoStrike, SKM_Manny, RTG, suffix="_Manny", target_path="/Game/MHA")`.
- **Output:** `AS_VeoStrike_Manny` on `/MoverTests/.../SK_Mannequin` — the real PoF Manny skeleton.

### ⑤ Render
- The existing **Observation-Spine harness**: `UnrealEditor-Cmd <uproject> /Game/Maps/VerticalSlice -game -PoFScenario=<json> -RenderOffScreen -windowed -ResX=1280 -ResY=720`. The `play_anim` scenario force-plays an AnimSequence on the player mesh and scrubs it per sample, capturing `frame_NN.png` (chase), `frame_NN_side.png` (side), `shot_NN.png` (game viewport).
- Scenario fields: `{ play_anim, disable_ai, total_seconds, num_samples, settle, out_dir }`.

### ⑥ Grade — the VLM critique tier
- `scripts/anim-critique.mjs --dir <frames> --intent "<expected motion>"` → `POST /api/verify/animation` → vision model scores **anticipation / weight / timing / followThrough / silhouette / believability** (0-100) + reasons + a top-fix. Code: `src/lib/anim-critique/` (pure cores + an **injectable vision seam** `gemini.ts`).
- **This is the only place Gemini is load-bearing for judgement.** It is being replaced — see *Removing Gemini* below.

### ⑦ Editor preview (manual check)
- `shots/make_preview.py` duplicates the arena to `/Game/Maps/VS_VeoPreview` and drops a Manny dummy looping the AnimSequence (saber snapped to `hand_r`, `update-in-editor` on) so a human can eyeball the motion without PIE.

---

## The 5 non-obvious fixes (hard-won — read before touching this)

1. **`-AllowCommandletRendering`** on the capture/retarget commandlet. The GPU SMPL solve needs a real **D3D12 RHI**; a plain `-run=pythonscript` commandlet is null-RHI, so `MetaHumanPerformance.can_process()` (gated on `FMetaHumanSupportedRHI::IsSupported`, plugin src `MetaHumanPerformance.cpp:2570`) silently returns False → `start_pipeline` = `DISABLED`. *(For MonoFootage, CanProcess needs ImageSequences + bBodyTracking + RHI + authoring-objects — **not** a camera calibration. An earlier "needs calibration" theory was wrong.)*
2. **`perf.set_editor_property("face_tracking", False)`.** Face tracking defaults **on**; on a combat clip the face detector fails (*"No face detected in 175/240 frames"*) and gates the whole solve to the few face-frames → a static pose. Body-only (`body=True, face=False`) runs the SMPL solve across all frames.
3. **Force the CD frame rate to 30.** The mono extractor can't read fps from the mp4 (`LogMonoVideoExtractor: Failed to extract video info`) → `metadata.frame_rate=0` blocks processing. Set it on `cd.metadata` *and* the `ImgMediaSource.frame_rate_override`.
4. **The IK Retargeter ships an EMPTY op stack.** A freshly-created UE 5.8 `IKRetargeter` has **0 ops** → it transfers **nothing** (the retargeted anim is static). Add them by struct path (string, not the py class): `controller.add_retarget_op("/Script/IKRig.IKRetargetPelvisMotionOp")` + `("/Script/IKRig.IKRetargetFKChainsOp")`, then `assign_ik_rig_to_all_ops(SOURCE/TARGET, rig)` + `auto_map_chains(EXACT, True)`.
5. **The harness `play_anim` scrub.** The gameplay AnimBP re-asserts AnimationBlueprint mode after BEGIN, dropping the single-node instance, so the per-sample scrub silently no-ops and every frame renders the idle pose. Fix in `ScenarioController::DoSample` re-establishes single-node + `SetPlaying(false)` each sample (rebuilt PoFEditor).

**Verify motion numerically before trusting any render.** Use `AnimationLibrary.get_bone_pose_for_frame(anim, bone, frame, False).rotation.rotator()` and measure each bone's **rotation range** — limb **translation** in local space is always ~0 (bones don't stretch), so measuring translation gave a *false* "static" twice. A good capture shows `upperarm_r` ≈ 55–75° of range.

---

## Cost & licensing (today)

| Stage | Tool | Cost | Commercial |
|-------|------|------|------------|
| Generate | Veo 3 (Gemini API) | ~cents/clip (**paid**) | OK |
| Capture | MetaHuman Markerless | **free / local** | clean (UE EULA, no SMPL in output) |
| Retarget / render / preview | UE + our code | **free** | clean |
| Grade | Gemini vision | ~cents/grade (**paid**) | n/a |

The two paid stages are both **Gemini** (Veo runs *on* the Gemini API). Removing Gemini is the precondition for cheap long-running autonomous loops.

---

## Removing Gemini (the plan)

Researched 2026-06-23 (two cited web sweeps; see project memory `project-animation-alternatives`). Two independent swaps:

### A. Video generation — **DONE: Leonardo Hailuo 2.3 wired + confirmed live (2026-06-23)**
Priority for *this* pipeline is **mocap-trackability**: one coherent full-body human, static camera, clean limbs — **not** cinematics. Hailuo's output is exactly that (verified: photorealistic full-body warrior, plain grey studio, real weight/footwork — better mocap input than the stylized Veo clip).

**Project policy (locked):** text-to-video uses **`hailuo-2_3`**; image-to-video (start frame) uses **`hailuo-2_3-fast`**; the I2V start frame is generated by **GPT Image 2 (`gpt-image-2`)**. All wired in `src/lib/leonardo.ts`:
- **`generateVideo(prompt, opts)`** — T2V, `hailuo-2_3`. **~180 credits / 6s.**
- **`generateVideoFromImage(imageId, prompt, opts)`** — I2V, `hailuo-2_3-fast` + `guidances.start_frame`. **~128 credits / 6s (cheaper + more control — the start frame sets the character).** `imageType` GENERATED (a Leonardo image) or UPLOADED.
- **`generateStartFrame(prompt, opts)`** — GPT Image 2 still via v2 (`model: "gpt-image-2"`). **~66 credits.** Returns `{ imageId, generationId, imageUrl }` (the caller deletes it).
- **`generateVideoFromPrompt(prompt, opts)`** — the one-call chain: GPT Image 2 start frame → Hailuo 2.3 Fast I2V → **deletes both** (the recommended "prompt → video" entry point; ~194 credits total). Confirmed live end-to-end via `shots/leo_video_gen.mjs --mode i2v` (output: a photorealistic full-plate knight doing a real lunging strike on a plain studio — ideal mocap input).
- Everything goes through the shared v2 submit and the **download-then-delete** cleanup — every generation deleted after pulling the bytes (Studio-cleanliness rule, **never leave a mess**; a source-guard test enforces it for every create-site).

**Confirmed API shape (live):** video + GPT Image 2 all use **v2** `/generations` create + **v1** `/generations/{id}` poll + **v1** `/generations/{id}` delete.
- **Create:** `POST /api/rest/v2/generations` → `{ model, public: false, parameters: { prompt, duration, prompt_enhance: "OFF", quantity: 1, width: 1376, height: 768, audio: false, guidances?: { start_frame: [{ image: { id, type } }] } } }` → response `{ generate: { generationId, cost } }`. (GPT Image 2: same create, `model: "gpt-image-2"`, `parameters: { prompt, quantity, width, height, prompt_enhance }` — no `quality` needed; ~66 credits.)
- **Poll:** `GET /api/rest/v1/generations/{id}` → `generations_by_pk.status` PENDING→COMPLETE (~80–96s); mp4 at `generated_images[0].motionMP4URL`.
- **Delete:** `DELETE /api/rest/v1/generations/{id}` → 200.
- **Pipeline script:** `shots/leo_video_gen.mjs --mode t2v|i2v --prompt "…" --out shots/x.mp4` (the Gemini-free replacement for `veo_gen.mjs`; generates an I2V start frame itself unless `--image <id>` given; always deletes after download).
- Gotchas learned the hard way: the v2 endpoint **rejects unknown fields** (a bad `mode`/`guidances` schema → `VALIDATION_ERROR`, but **no tokens spent** — validation precedes generation). The legacy v1 `generations-image-to-video` (Kling/Veo) rejects `public` and constrains width/height to per-model resolution combos — **we don't use it; Hailuo via v2 is the path.**

- **Zero marginal cost for loops (future) → self-host Wan 2.2 (Apache 2.0) on the RTX 4090** (~4.5 min/clip, commercially clean, Wan 2.2 "Animate" = skeleton-driven motion transfer). Faster alt: LTX-Video (~90s).

> Caveat: no public benchmark scores "clean limbs for a solver" — validate candidates by running their clips through MetaHuman Animator and measuring **solve success**, not cinematic Elo.

### B. Recognition (the VLM critique) — **DONE: Qwen wired + confirmed (2026-06-23)**
The vision seam is injectable (`src/lib/anim-critique/gemini.ts: (images, prompt) => Promise<string>`), so the Qwen swap is a drop-in: **`src/lib/anim-critique/qwen.ts` (`makeQwenVision`)**. Select it per-call via the route/CLI **`provider`** field (`'qwen' | 'gemini'`, default gemini):
```
node scripts/anim-critique.mjs --dir <frames> --intent "…" --provider qwen
```
- **Model:** `qwen3.7-plus` (a **thinking** VL model — returns its chain-of-thought in `reasoning_content`, the answer in `content`; we parse `content`).
- **Quota fallback chain (the 1M-tokens / 90-day free cap):** on a quota/throttle error (HTTP 429 or quota markers) the seam transparently falls back **`qwen3.7-plus` → `qwen3.6-flash` → `qwen3.6-plus`** (separate quota per model, so the loop keeps running). A real (non-quota) error throws immediately without burning the fallbacks. Configurable via `fallbackModels`. (4 unit tests in `qwen.test.ts`.)
- **Endpoint:** Alibaba Model Studio **DashScope intl**, OpenAI-compatible: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`, `Authorization: Bearer $QWEN_API_KEY`. Images sent as OpenAI `image_url` data-URI blocks. ~17s/call (10 frames). Env: `QWEN_API_KEY` (or `DASHSCOPE_API_KEY`), optional `QWEN_CRITIQUE_MODEL` / `QWEN_BASE_URL`.
- **Confirmed equivalent to Gemini** — A/B on the same Veo-strike filmstrip:

  | | Gemini 2.5-flash | Qwen 3.7-plus |
  |---|---|---|
  | overall | WARN 50 | WARN 47 |
  | anticipation / weight / timing | 40 / 40 / 45 | 40 / 50 / 30 |
  | followThrough / silhouette / believability | 55 / 75 / 45 | 40 / 75 / 45 |

  Same verdict, identical on 3 of 6 dims, same diagnosis (weak anticipation/weight, planted feet, strong silhouette). Qwen's prose was arguably sharper (caught the sampled-frame "slideshow effect"; gave physically-grounded notes on saber momentum). **Qwen is a usable Gemini replacement for this task.**
- **Alternatives if needed:** free local on the 4090 → Qwen3-VL-8B (Thinking) GGUF / Qwen2.5-VL-7B-AWQ via vLLM; A/B comparator → InternVL3 (MIT); free-cloud fallback → GLM-4.6V-Flash. Exclude Llama 3.2 Vision / Moondream (single-image).

**Honest limitation (high-confidence, unchanged by the swap):** fine-grained *motion* / *physical-plausibility* judgement is an open frontier — **every** VLM is unreliable here. So keep the VLM as an **advisory WARN signal, not a hard gate**; keep the **numeric FK bone-rotation measurement** as the ground-truth gate. Supported mitigations (our `filmstrip.ts` already half-implements): **stitch ≤6 frames into one contact-sheet image**, **score pairwise vs a reference "good" clip**, anchor the rubric with exemplars, reason-free-form-then-JSON.

---

## File / script index

| Path | Role |
|------|------|
| `shots/veo_gen.mjs` | Veo generation (legacy; superseded by Leonardo below) |
| `shots/leo_video_gen.mjs` | **Leonardo Hailuo 2.3 video gen** (t2v / i2v), download-then-delete — the Gemini-free generator |
| `src/lib/leonardo.ts` | `generateVideo` (hailuo-2_3 T2V) + `generateVideoFromImage` (hailuo-2_3-fast I2V) + cleanup |
| `src/lib/anim-critique/qwen.ts` | Qwen vision seam + quota fallback chain (qwen3.7-plus→3.6-flash→3.6-plus) |
| `shots/mha_capture.py` | ingest + body-only solve + export (the 5 fixes #1–3 here) |
| `shots/mha_retarget.py` | IK rig + retargeter (op stack) + batch retarget (fix #4) |
| `shots/veo_manny.json` | render scenario (`play_anim`) |
| `shots/make_preview.py` | editor preview map builder |
| `scripts/anim-critique.mjs` | CLI grader → `/api/verify/animation` |
| `src/lib/anim-critique/` | critique cores + injectable vision seam (`gemini.ts` → clone as `qwen.ts`) |
| `src/app/api/verify/animation/route.ts` | the grade route |
| pof-exp `Source/PoF/Testing/ScenarioController.cpp` | the harness `play_anim` + scrub fix (#5) |

## Running it / extending to a loop
1. Generate: `node shots/veo_gen.mjs` (or Leonardo/Wan once swapped).
2. Capture: `UnrealEditor-Cmd … -run=pythonscript -script=shots/mha_capture.py -AllowCommandletRendering`.
3. Retarget: same, `shots/mha_retarget.py`.
4. Render: `UnrealEditor-Cmd … /Game/Maps/VerticalSlice -game -PoFScenario=shots/veo_manny.json -RenderOffScreen`.
5. Grade: `node scripts/anim-critique.mjs --dir shots/veo_manny_strip --intent "…"`.

For an autonomous loop: vary the generation prompt, run 2–4 end-to-end, keep the highest-scoring AnimSequence, and (next milestone) wire the winner into the duel as a real attack montage (currently render-only via `play_anim`). Gate on the numeric bone measurement; use the VLM score as the tie-breaker / advisory.
