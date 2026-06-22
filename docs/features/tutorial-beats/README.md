# Tutorial Beats Pipeline

> Catalog ID `tutorial-beats` · Category Onboarding · `arpg-ui` module · 13 steps · Tracks: logic, art-2d, vfx, audio, test

**Purpose.** A tutorial beat is a single scripted teaching moment that locks all inputs outside the taught mechanic within a named, scoped sandbox, advancing linearly by default (canon `tutorial-sandbox`: branching requires an explicit flag + reachability check). Wiring: `BP_TutorialBeat_*` extends the base tutorial-beat BP; on `OnEnterZone` it fires `beat_started`, locks irrelevant inputs via the `UARPGInputSandboxSubsystem`, and steps through the sequence; on completion/skip/fail it fires the matching telemetry event and unlocks inputs.

## Target / starter entity
- **Learn to Dodge** (`tutorial-dodge`, Combat) — teaches the dodge input in a sandbox.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Trigger | rules | — | L0 · `fieldsPopulated(event/condition/resetOn)` |
| 3 | Lock / Sandbox | rules | — | L0 · `fieldsPopulated(lockedInputs/sandboxScope/branchingEnabled)` |
| 4 | Step Sequence | rules | — | L0 · `fieldsPopulated(steps/advanceOn/timeoutPerStep)` |
| 5 | Success / Skip / Fail | rules | — | L0 · `fieldsPopulated(success/skip/fail)` |
| 6 | Pointer / Highlight 2D | gallery | `T_<slug>_Pointer` | L1 · `selected(pointer)` |
| 7 | VFX / Audio Cue | rules | — | L0 · `minCount(cues, ≥1)` |
| 8 | VO | checklist | — | L0 · `minCount(lines, ≥1)` |
| 9 | Telemetry | rules | — | L0 · `fieldsPopulated(events/comprehensionMetric)` |
| 10 | Icon 2D Art | gallery | `T_<slug>_Icon` | L1 · `selected` |
| 11 | Localization | checklist | — | L0 · `minCount(keys, ≥1)` |
| 12 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSTutorialComprehensionTest)` |
| 13 | UE Packaging | manifest | `DT_TutorialBeats::<slug>`, `BP_TutorialBeat_<slug>`, `T_<slug>_Pointer`, `T_<slug>_Icon`, `NS_TutorialGlow` | L0 · `minCount(assets, 2)` |

## UE wiring
- **C++ / BP symbols** (in wiring contracts): `AARPGTriggerBox` (`OnBeginOverlap` → `BeginBeat()`), `UARPGInputSandboxSubsystem::LockInputs()`, `UARPGGameplayTagComponent`, `UAbilitySystemComponent` (tag grants), `UARPGTelemetrySubsystem::RecordBeatEvent()`.
- **Assets:** `DT_TutorialBeats` (row keyed by entity slug), `BP_TutorialBeat_<slug>`, `T_<slug>_Pointer`, `T_<slug>_Icon`, `NS_TutorialGlow`. Gameplay tags: `Tutorial.Dodge.Introduced/Skipped/Failed/Executed` (`GameplayTags.ini`).
- **Seed script:** `seed_tutorial_beats.py` (seeds the `DT_TutorialBeats` row; referenced in the packaging wiring contract).
- **Runtime test:** `VSTutorialComprehensionTest` (triggers, teaches dodge, fires all 4 telemetry events, records `dodge_success_rate`).
- **Cross-catalog links (real seeded ids only):** `hud-elements::hud-health-bar` (pointer-overlay), `icon-sets::iconset-abilities` (input-highlight), `vfx::vfx-fire-impact` (success-highlight; `NS_TutorialGlow` recolors `NS_FireImpactBurst`). Also depends on `input-schemes` (IA_* actions) and `spellbook` (`GA_Dodge`). Audio cue `SC_TutorialPrompt` is descriptive data only — no audio entity seeded yet (`seed-audio.ts` returns `[]`), so no dangling audio link.

## Acceptance profile
Heavily **L0 (data)** — eleven of thirteen steps assert populated/min-count fields. **L1 (human selection)** for the Pointer/Highlight and Icon galleries. One **L3 runtime-deferred** gate (`VSTutorialComprehensionTest`). No L2 static-source checks in this pipeline. Config-complete = all data/selection steps pass and the comprehension runtime test sits `deferred` until a UE bridge runs.

## Status & notes
Largest step count in this batch (13). All three outcome terminals (success / skip / fail) are explicit per QUALITY-GATE §1 (a beat with no fail terminal can silently block). Fires all four required events per `tutorial-telemetry` canon plus a `comprehensionMetric` (`dodge_success_rate`). Cross-catalog links use only real seeded ids; flavor names and the pending audio cue live in data, not links.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
