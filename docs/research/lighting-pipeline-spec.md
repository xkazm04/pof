# Spec — Environment Lighting catalog pipeline (Lumen)

> Research-originated **design spec** (not yet built). From run `lumen-best-practices` (Karim Yasser, *How I Use Lumen in AAA Projects*) — the K4 candidate. Effort **L/XL**; this is the spec per the `/research` action-by-effort rule (don't half-build a pipeline in one run).
>
> Goal: a catalog pipeline that takes an environment toward a **tier-appropriate, best-practice Lumen setup**, with each Produce step pulling from PoF's new lighting knowledge so the *automated* output quality matches what a lighting artist would do by hand.

## Why a pipeline (not just presets)

K1 (gotchas) + K3 (`lighting-presets.ts`) gave the automation the *knowledge*. A pipeline gives it a **gated, verifiable sequence** — the same StepSpec chassis the 30+ catalog pipelines use — so a scene is driven from "pick a tier" to "GI reads correctly on a captured frame", with acceptance derived from UE truth (not a manual toggle).

## Fit / anchors

- Chassis: `src/components/layout-lab/` (StepSpec, `ArchetypeStep`, `getStepComponent`, `CliProduce`, `StepFrame`); registry under `src/lib/catalog/`. Authoring rules: `docs/catalog/AUTHORING.md`, `docs/catalog/WIRING-AND-ACCEPTANCE.md`, `docs/catalog/PIPELINE_REVIEW.md`, CLAUDE.md *Catalog Pipeline Step Authoring*.
- Knowledge it consumes (the quality lever): `src/lib/visual-gen/lighting-presets.ts` (`LightingPreset.notes`) + `src/lib/knowledge/ue-gotchas.ts` (`lumen-*` entries). Each Produce `buildPrompt(direction)` injects the chosen preset's config + notes + the relevant Lumen gotchas.
- Verification: the existing L3/L4 runner (`src/lib/test-gate-runner/visualExecutor.ts` → `/pof/snapshot/capture` → Gemini) for the visual gate; the `:30040` PoF Bridge for applying settings.

## Steps (View / Produce / Acceptance)

| # | Step | Produce | Acceptance (tier) |
|---|------|---------|-------------------|
| 1 | **Tier & Mode select** | pick a `LightingPreset` (AAA-balanced / hero-reflections / interior-detail / open-world-global) | L1 human-selection → `pass` (a preset is chosen) |
| 2 | **Project Lumen config** | apply RT mode + SWRT mode + reflection method from the preset (project settings + post-process volume); prompt injects preset notes | L2 static `pass` (config written) · L3 `deferred` (bridge sets it live) |
| 3 | **Mesh distance-field readiness** | ensure Generate Mesh Distance Fields on; flag thin-geo meshes → raise Distance Field Resolution Scale (gotcha `lumen-swrt-thin-geometry`) | L2 `pass` (DF enabled + thin-geo list resolved) · L3 `deferred` (visualize MDF via bridge) |
| 4 | **Sky / directional / exposure balance** | golden-hour-style setup: sky + directional light + exposure to the preset's target | L2 `pass` (values set) · L4 `deferred` (visual) |
| 5 | **Verify lighting** | capture viewport, Gemini checks: GI present, no black reflections on smooth surfaces, exposure balanced | L4 visual via `visualExecutor` → `pass`/`fail` with reason |

Config-complete (parallel-CLI "done") = L0–L2 `pass`; L3/L4 carry `deferred` + reason until the live runner drains them — same contract as every other pipeline.

## Catalog seeding

Add an `environment-lighting` catalog to `CATALOG_SECTIONS` / `NEW_CATALOGS` with ≥1 seeded entity (a sample environment) so the data-driven e2e walker auto-covers it (CLAUDE.md Rule 5). Step files mirror the UI hierarchy: `.../environment-lighting/lumen/` camelCase per the authoring rules.

## The quality mechanism (the point)

Every Produce prompt for steps 2–4 is built from the selected preset's `notes` + the `lumen-*` gotchas, so the LLM emits a *tier-correct* Lumen config instead of the engine defaults — e.g. it won't leave surface-cache reflections on a water scene, won't use detail tracing on a huge open world, and won't ignore thin-geo distance fields. This is the "internal knowledge base → higher-quality automation output" loop the run targeted.

## Effort / risk / non-goals

- **Effort:** L/XL — a new catalog + 5 steps + bridge lighting ops + the visual gate.
- **Depends on:** bridge endpoints for project/post-process settings + per-mesh distance-field config (some may need adding to the PoF Bridge plugin — *external*, gate on availability).
- **Non-goals:** building it now; new C++ where Python/bridge suffices; touching the verification spine contract.

## Next step

When picked up: scaffold the `environment-lighting` catalog + step 1 (Tier select, pure L1) first — it needs no bridge — then steps 2–4 as config-complete L2, deferring L3/L4 until the bridge lighting ops exist.
