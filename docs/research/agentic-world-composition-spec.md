# Agentic World Composition — prompt → populated scene (spec)

> **Status: PARTLY BUILT (2026-09-07). Step 2 (the planner) shipped, via an IMAGE input.**
> See the update at the end of this file. Steps 1 (UE spawn script), 3 (source from library)
> and 4 (render → critique → re-plan) remain unbuilt.
> Source: *"One Prompt to 3D World…"* (Stefan 3D AI, 3D AI News #18, youtube `7W1Am-ry0DM`,
> [02:11]) — "Tencent releases Hunyuan World Claw … an agentic 3D that combines different
> models and some knowledge about how to build 3D worlds into a tool that can turn a prompt
> into a world populated with different 3D objects."
> Web-augmented 2026-08-23: [WorldClaw project page + paper](https://arxiv.org/html/2608.05248v1)
> (arXiv 2608.05248, announced 2026-08-11).

## The one fact that reframes this

**WorldClaw is not a model. It is an agent harness, and the agent is Claude Opus 4.8.**
Planning agents translate a text prompt into a *structured specification* of regions, terrain,
assets, materials and spatial relations; generator tools fill it in; the claim is "editable,
game-ready 3D assets with high-quality geometry and textures."

Two consequences, and they point opposite ways:

1. **There is nothing to integrate.** As of 2026-08-11 there is a project page and a paper —
   no repository, no weights, no demo, no API. Adoption is not on the table and will not be
   for some time. *This is a pattern finding, not a provider finding.*
2. **PoF is the same species of system.** PoF already *is* a bounded, governed Claude harness
   that orchestrates generator tools and gates their output. The architectural distance
   between PoF and WorldClaw is much smaller than the video's framing suggests — and this
   spec's job is to name the one piece PoF is actually missing.

This extends [`agentic-3d-asset-generation.md`](./agentic-3d-asset-generation.md), which
mapped the same generate → observe → critique → refine loop at **asset** scale and concluded
"the research frontier is converging on the architecture PoF already has". WorldClaw is that
finding at **world** scale, from a product lab rather than a paper.

## What PoF already has (verified 2026-08-23)

| Capability | PoF implementation | LOC |
|---|---|---|
| Deterministic prop **placer** with real support semantics | `src/lib/visual-gen/generators/composition.ts` — `generateComposition(config)`: seeded, largest-first fill, **support footprint ≥ prop footprint**, children laid across a support's top, run height capped by the floor prop's `maxStack`, yaw jitter, and `unplaced[]` **with a reason** rather than silent drops | 252 |
| **Affordance contract** that round-trips to the engine | `generators/placement-tags.ts` — `place: floor\|surface\|any`, `stackable`, `copies`, `maxStack`; `toUeActorTags` / `parseUeActorTags` map to real UE actor tags (`place_floor`, `stack_true`, `copy_3`, `max_stack_10`), so editor-authored props are readable and generated compositions are spawnable | 147 |
| Procedural terrain / dungeon / vegetation | `generators/{terrain,dungeon,vegetation}.ts` | 125 / 229 / 168 |
| Three 3D asset engines | Tripo (cloud), TripoSR + TRELLIS.2 (local), Hunyuan3D (via blender-mcp) | — |
| A critic that can look at a render | L4 visual gate (`test-gate-runner/visualExecutor.ts`) + the Qwen VLM seam (`anim-critique/qwen.ts`, `visual-gen/input-gate.ts`, `footage-gate.ts`) | — |
| Bounded, cost-governed iteration | `harness/claude-session.ts` (budget + timeout) — the termination criterion the papers leave open | — |

## The gap — PoF has the placer, not the planner

`generateComposition` takes `assets: CompositionAsset[]` as **input**. Nothing in PoF turns
a sentence into that list. There is no component that decides *which* props a "ruined
apothecary" contains, how many, at what size class, or how they relate — that judgement is
exactly the "planning agent" half of WorldClaw, and it is the half PoF is best equipped to
build, because it is a Claude call with a schema, not a diffusion model.

Second, load-bearing fact from the impact-map: the composition solver's **consumers were
never wired** — "a set-dressing catalog step, and the UE-side spawn script that reads the
manifest" are both listed as not built. So the placer is a tested pure function with no
path to the engine. **Any world-scale ambition is blocked behind that wiring, not behind
model access.**

## Build order (each step independently valuable)

1. **(S–M) Wire the existing solver to UE.** A spawn script that reads a
   `CompositionResult` manifest and spawns the placed props with their `toUeActorTags`
   tags, plus a set-dressing catalog step that calls `generateComposition`. This is
   the honest first move: it turns a pure function into an engine, and it is required by
   every later step. Acceptance is already shaped — `unplaced[]` carries reasons.
2. **(M) The planner.** `prompt → SceneSpec` as a *schema-constrained Claude call*:
   region/theme, an asset list with size classes and counts, and spatial relations. Reuse
   the established PoF runner shape (pure core + injectable seam) so it is unit-testable
   against a recorded fixture. Feed its asset list to `generateComposition`. **Do not
   invent the schema from this spec** — derive it from what `CompositionAsset` already
   requires plus what the UE spawn script consumes.
3. **(M) Source the assets.** Resolve each planned asset against the local
   `asset_library` first, then generate the misses through the existing 2D→3D chain.
   Reuse, don't regenerate — this is where PoF's library beats a from-scratch world model.
4. **(L) Close the loop.** Render the composed scene, run the VLM critic on it, and feed
   defects back as a corrective re-plan. This is the WorldClaw/SAGE loop, and PoF already
   owns every piece except the wiring.

## Honest limits to record

- **Object placement is the acknowledged weak point**, by the source's own admission:
  "plenty of imperfections in object placement" ([02:36]). PoF's `composition.ts` support-
  footprint rule is a *stronger* placement guarantee than a learned placer gives you, and
  should not be replaced by one.
- **Physics settle remains impossible in the commandlet** (ground-truthed 2026-07-28, two
  live probes; gotcha `headless-physics-needs-ticking-world`). A composed scene can be
  baked headlessly but not settled — settling needs the `-game` scenario path.
- This spec claims **no** capability PoF has today. Nothing here is verified beyond the
  file-level facts in the table above.

## status_impact

`powers-engine` on the world/level-design catalog steps, which today have no engine for
"populate this space" — and `raises-tier` on the set-dressing path, which currently cannot
reach L3 because the manifest never reaches UE.


---

## Update 2026-09-07 — step 2 shipped, reached from an image

Run `2026-09-07-rodin-worldgen` (Rodin WorldGen, Stefan 3D AI, youtube `KlzzBa1sZX0`) built the
planner this spec asked for, with one substitution: the input is a scene **image**, not a
sentence. The source's mechanism — "it detected one object and started to generate a 3D
model, then it creates another" — is scene decomposition, and PoF already had the VLM seam
to do it.

**Shipped** (all with a production consumer, census-checked):
- `src/lib/visual-gen/generators/scene-decompose.ts` — image → prop rows (name, normalized
  box, size estimate, count, material) over the injectable Qwen vision seam.
- `src/lib/visual-gen/generators/physical-tags.ts` — the physical half of a spawnable prop
  (`MATERIAL_DENSITIES`, `massForSize`, `physicalForSize`, `phys_`/`sim_`/`mass_kg_` tags).
  This is what a **physics settle** needs, and the settle is what this spec's own "honest
  limits" section and the `prop-placement-affordances-not-bounds` gotcha both call for.
- `src/lib/visual-gen/scene-crop.ts` — real sharp bbox crops, which is what makes the
  existing Tier-0 `gateInputImage` usable per prop (its "one subject, plain background"
  premise cannot hold on a whole scene).
- `POST /api/visual-gen/scene-decompose` — the wiring. **This is the load-bearing part:**
  `generateComposition` and `placement-tags` had zero importers in `src/` before it.

**The spec was right about the blocker and slightly wrong about the order.** It said step 1
(the UE spawn script) was "required by every later step". In practice step 2 could ship
first and independently, because the manifest is verifiable on its own; step 1 remains the
gap between this manifest and an L3, and it is external (`ue/PoFToolset/**`).

**What the live runs added that no fixture could.** Three defects surfaced only by running
real images through real Qwen calls: the route passed no material so every prop was
`phys_default` (the density table was inert in the only wired path); `readMaterial`
depluralized `glass` into `glas`; and the first prompt classified **stairs and a bush** as
extractable props, after which the solver stacked the bush on the stairs. The prompt now
excludes architecture and vegetation and states that returning no rows is a valid answer —
and on the ravaged-courtyard arena art it correctly returns nothing at all.

**New honest limit, inherited from this spec's own warning.** Affordances remain
size-class-only. The decomposer now knows each prop's NAME and material, but nothing uses
the name to place it, so the bush-on-stairs *class* of error survives anywhere the exclusion
list misses. A name/semantics-aware affordance pass is the natural next step and is cheaper
than it looks — the judgement is already a Claude call with a schema.
