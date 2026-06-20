# VLM critique-tier experiment — Qwen3-VL-4B vs Gemma 4 12B (2026-06-20)

**Question:** can a free local VLM be the aesthetic/fidelity critic for the zero-budget
3D pipeline (the tier CLIP couldn't discriminate)? Is the full pipeline feasible? Is a
12B too much, and can a 4B produce anything useful? Run identical: critique the same
TripoSR chair render (`*.preview.png`) + the input reference, on a 24 GB RTX 4090.

Driver: `scripts/visual-gen/pof_vlm_critique.py` — one model-agnostic code path
(transformers `AutoModelForImageTextToText` + unified `apply_chat_template`).

## Results

| Model | License | VRAM | Load | Infer | Output | transformers | Coexists w/ TripoSR? |
|---|---|---|---|---|---|---|---|
| **Qwen3-VL-4B-Instruct** | Apache-2.0 | **8.9 GB** | 11 s | **3.1 s** | ✅ `SCORE=7; DEFECTS=warped legs, inconsistent stitching, texture mismatch; VERDICT=partially accurate but structural/detail flaws` | works on **4.57 AND 5** | ✅ (shares the 4.57 venv) |
| **Gemma 4 12B-it** | Apache-2.0 | 8.3 GB (4-bit) / 13.1 (8-bit) | ~30 min dl | ❌ crash | ❌ `LayerNormKernelImpl not implemented for 'Byte'/'Char'` (4-bit & 8-bit) | **needs 5** (released 2026-06-03) | ❌ |

## Findings

1. **The 4B (Qwen3-VL-4B) is the clear winner — and genuinely useful.** It returned a
   structured, *specific* verdict (named the real TripoSR artifact — warped legs) that
   CLIP's single cosine (0.97) could never give. 8.9 GB, 3 s inference. This is the
   discriminating critic the pipeline needed, and the lever that could break the
   best-of-N tie CLIP couldn't.

2. **The 12B is NOT usable today — but not because of VRAM.** It *fits* the 4090
   quantized (8.3 GB @ 4-bit). Three compounding blockers:
   - **transformers-version conflict:** Gemma 4 needs transformers ≥ 5; **transformers 5
     breaks TripoSR generation** — the ViT image-encoder keys were renamed
     (`encoder.layer.N.attention.attention.query` → `layers.N.attention.q_proj`), so the
     TripoSR checkpoint won't load. TripoSR needs v4, Gemma 4 needs v5 → can't share one venv.
   - **quantized-inference bug:** bitsandbytes 4-bit *and* 8-bit both crash in a LayerNorm
     (`int dtype` not supported) — a library-immaturity issue (Gemma 4 was 17 days old).
   - **fp16 doesn't fit:** the non-quantized path (~24 GB) OOMs the 4090.

3. **Full pipeline IS feasible — with the 4B critic.** Qwen3-VL-4B works on transformers
   4.57 (TripoSR's version) AND 5, so it coexists with the generator. No env split needed.

4. **Env-entanglement cost (real, recorded):** wiring a VLM pulled `torchvision`
   (Qwen-VL's processor needs it) which bumped torch 2.10 → 2.11, and Gemma 4 forced
   transformers 5 (broke TripoSR, since restored to 4.57.3). Lesson: keep the VLM critic
   **transformers-4-compatible (Qwen3-VL-4B)** or run it in a **separate venv** so it can
   never break the generator.

## Recommendation

Productize **Qwen3-VL-4B-Instruct** as the Tier-3 critic (structured score + named
defects → feeds the scorecard and gives best-of-N something real to rank on). Park
**Gemma 4 12B**: revisit when bitsandbytes/transformers patch the new arch, or run it in
an isolated venv at fp16 on a >24 GB GPU. Both are Apache-2.0 (commercial-safe).

> Env note: the shared TripoSR venv (`POF_TRIPOSR_ROOT`) was restored to
> `transformers==4.57.3` (+ torch 2.11, torchvision, bitsandbytes) — TripoSR + Qwen-VL-4B
> both run; the cached Gemma 4 weights (~24 GB in the HF cache) can be deleted.
