# VFX Assets Pipeline

> Catalog ID `vfx` · Category Audio & FX · `arpg-polish` module · 10 steps · Tracks: vfx, art-3d, audio, test

**Purpose.** Authors a reusable Niagara-based VFX system keyed to an AnimNotify (per canon `art-vfx` / `vfx-budget`): the notify name matches the `NS_` asset slug and fires from an ability montage at the correct bone — never from BeginPlay or a timer. The system ships 3 emitter LOD tiers (full / medium-50% / culled) and targets peak GPU ≤ 0.48 ms (60% headroom of the 0.8 ms per-class budget). It realizes as `NS_<Slug>` (Niagara) + `MI_<Slug>` (material instance) in `DT_VFX`, verified by `VSVFXPerfTest` under `-nullrhi`.

## Target / starter entity
- **Fire Impact Burst** (`vfx-fire-impact`, Impact, tag `fire`) — An impact burst; pairs with Fireball.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 `minLength` brief ≥ 300 chars |
| 2 | Behavior | rules | — | L0 `fieldsPopulated` (emitters/lifetime/spawnRate) |
| 3 | Mesh / Sprite | gallery | SM_\<name\>_Sprite | L1 `selected` (mesh/sprite candidate) |
| 4 | Material | gallery | MI_\<name\> | L1 `selected` (material instance) |
| 5 | Sound Hook | rules | — | L0 `fieldsPopulated` (cues/animNotifyBinding) |
| 6 | GPU / LOD Budget | balance | — | L0 `withinPercent` gpuPct within ±15% of 0.48 ms |
| 7 | Variants | gallery | NS_\<name\>_Small/Med/Large | L1 `selected` (variant candidate) |
| 8 | Icon 2D Art | gallery | T_\<name\>_Icon | L1 `selected` (icon candidate) |
| 9 | Test Gate | checklist | — | L3 `runtimeDeferred` VSVFXPerfTest (RHI+Gemini) |
| 10 | UE Packaging | manifest | NS_\<name\>, NS_\<name\>_Small/Med/Large, MI_\<name\>, SM_\<name\>_Sprite, DT_VFX | L0 `minCount` ≥2 + L2 `cppSymbolExists` UNiagaraComponent, `seedRowPresent` seed_vfx.py |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UNiagaraComponent` (step 10).
- **Assets:** `NS_<Slug>` Niagara system (3 emitter LOD tiers) + small/med/large variants, `MI_<Slug>` material instance, `SM_<Slug>_Sprite`, `DT_VFX` row. Activation is `AnimNotify AN_<Slug>` → `UNiagaraComponent::Activate` at the montage impact frame (the single activation path).
- **Seed script** (`seedRowPresent`): `seed_vfx.py` (UE Packaging).
- **Runtime test** (`runtimeDeferred`): `VSVFXPerfTest` — peak GPU ≤ 0.48 ms at LOD0 under `-nullrhi`, AnimNotify fires at correct bone, LOD transitions verified, plus an RHI+Gemini visual check.
- **Cross-catalog links** (`links:`): none emitted. Wiring contracts depend on `spellbook` (the ability montage hosting `AN_<Slug>`) and on `vfx` itself (the Niagara/material assets). The Sound Hook step deliberately emits **no** `audio::` link — the audio catalog has no seeded entities, so `SC_<Slug>_Impact` is descriptive-only to avoid a dangling reference (ARPG-LAWS §12 / QUALITY-GATE §2 no-gray-box rule).

## Acceptance profile
Uses **L0 (data)** for brief, behavior, sound hook, GPU/LOD budget, and the manifest, **L1 (human-selection)** for four galleries (mesh/sprite, material, variants, icon), **L2 (static UE source)** via the `UNiagaraComponent` symbol check and the `seed_vfx.py` seed-row check, and **L3 (runtime-deferred)** for `VSVFXPerfTest`. Config-complete = all L0/L1/L2 pass and the Test Gate is `deferred` with the GPU-budget/AnimNotify reason.

## Status & notes
The most gallery-heavy pipeline in this batch (4 of 10 steps are `selected`-gated galleries). Strictly obeys `vfx-budget` (AnimNotify-only activation, 3 LOD tiers, ≤0.48 ms peak = 60% of the 0.8 ms class budget) and `art-vfx` (restrained, gameplay-readable). The Test Gate's visual check is the L4-adjacent RHI+Gemini render confirmation folded into the deferred L3 gate. No bridge-driven steps; production is synchronous data + deferred runtime.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
