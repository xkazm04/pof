# Open-weights world generators — evaluation note (do not adopt as an engine yet)

> **Status: EVALUATED, not adopted. Recorded so this is not re-proposed.**
> Source: *"One Prompt to 3D World…"* (Stefan 3D AI, 3D AI News #18, youtube `7W1Am-ry0DM`,
> [08:07]) — "fully open-source world generator named EVO … another cool model with 14 billion
> parameters which is also open source … code is already released on github and you can also
> find all weights available on huggingface."
> Companion to [`agentic-world-composition-spec.md`](./agentic-world-composition-spec.md).

## The source's own verdict

Worth quoting, because it sets the expected value honestly: *"from what you can see it's quite
good examples but I cannot say that there is anything like crazy impressive"* [08:32]. The
speaker's framing is that this **shows the trend** — "I've been talking to a lot of people in
industry and they also confirm that this is where they imagine it all goes" [08:07] — not that
this specific model is production-grade.

## Identification is UNRESOLVED — do not build against "EVO"

One bounded web search did **not** resolve the video's "EVO" to a specific repository. The
plausible referents, none confirmed as the one demoed:

| Candidate | What it is | Emits |
|---|---|---|
| [EvoWorld](https://github.com/JiahaoPlus/EvoWorld) | Panoramic world generation with an explicit 3D memory; weights on HF | Egocentric **video frames**, conditioned on a projected point cloud |
| [HunyuanWorld-1.0](https://github.com/Tencent-Hunyuan/HunyuanWorld-1.0) | First open-source immersive 3D world model (2025-07) | Panorama → scene mesh / splat |
| [HY-World-2.0](https://huggingface.co/tencent/HY-World-2.0) | Tencent SOTA world model, weights + code released (2026-04) | Explorable 3D scene |
| [WorldGen](https://github.com/ZiYang-xie/WorldGen) | "Generate any 3D scene in seconds" | Scene geometry |

**The transcript is auto-generated and mis-hears proper nouns** (it renders Hunyuan3D as
"high-term 3D" and Tripo as "3POP"), so "EVO" may well be one of the above rather than a
distinct product. Resolving it costs one web call; do that *before* any build, not after.

## Why this is not a PoF engine — the structural reason

PoF's 3D path has a hard output contract. A generated asset must survive `mesh-critique`
(watertightness, component count, face budget via `polycount-presets.ts`, world scale via
`world-scale.ts`), carry UVs and materials, and import to UE as a **discrete, named,
collision-ready asset**.

World models of this class do not emit that. They emit an *experience* — a panorama, a
gaussian splat, a video, or a single fused scene mesh. Those are excellent for exploration
and terrible for a pipeline that needs "the crate" as its own asset with its own budget and
its own acceptance verdict. The same objection already retired 4D Gaussian splats
([00:25] in this source) and, earlier, Roblox CubePart's latent-resampling reconstruction.

This is the same boundary `agentic-world-composition-spec.md` argues from the other side:
PoF's win condition is **composing library assets it can verify individually**, not
generating one unverifiable monolith.

## The honest role, if PoF ever wants it

**Concept/previz input, not asset output.** A generated panorama or scene render is a
*reference image* — and PoF already has a strong pipeline for turning reference images into
verified assets (`reference-roles.ts` → 2D→3D chain → mesh gates), plus `style-dna.ts` to
distil a look from a mood board. In that role a world model competes with Leonardo, which is
already wired, cheaper to call, and needs no local VRAM.

That makes the adoption bar high: a local 14B-class model must beat an already-integrated 2D
provider *at producing reference images*, which is not what it is built for.

## Reconsider triggers

Re-open **only** when one of these is true:

1. An open-weights world model emits **per-object, named, UV'd meshes** (not a fused scene) —
   i.e. it clears PoF's asset contract rather than the experience contract. This is the real
   trigger; everything else is noise.
2. PoF builds the planner in `agentic-world-composition-spec.md` and wants a *layout prior*
   — a world model's region/asset arrangement could seed the plan even if its geometry is
   discarded.
3. Licensing and VRAM are checked and cheap. Neither was verified here; TRELLIS.2's local
   install (`trellis-runner.ts`) is the precedent for what that costs in practice, including
   the gated-DINOv3 lesson from `[[project_trellis2_local_stack]]`.

## status_impact

`none` today — deliberately. Recording this as a boundary is the value: it stops a future run
proposing "add an open-source world generator" without first answering *what it emits*.
