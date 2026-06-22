# Input Schemes Pipeline

> Catalog ID `input-schemes` · Category Input & Platform · `input-handling` module · 12 steps · Tracks: logic, art-2d, test

**Purpose.** Represents the full lifecycle of a single input-device scheme (gamepad by default): action bindings, context stacks, rebinding UI, accessibility options, and platform-cert compliance. Wiring: `AARPGPlayerController` owns the `UEnhancedInputComponent` and the active `UInputMappingContext` stack; `WBP_InputRebind` calls `FindConflictingAction` on `UEnhancedInputLocalPlayerSubsystem` before committing any user binding. Governed by canon `input-remap-conflict` (conflict check + reserved system buttons never remappable) and `input-a11y` (hold-to-toggle, no chord-only actions, tunable saved deadzone).

## Target / starter entity
- **Gamepad Default** (`input-gamepad`, Gamepad) — the default gamepad binding scheme.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Action Mapping | schema | `DA_InputSchemes`, `IMC_Gameplay` | L0 + L2 · `fieldsPopulated(move/attack/dodge/interact/ability1–4)`; `cppSymbolExists(AARPGPlayerController)` |
| 3 | Context Stack | rules | — | L0 · `fieldsPopulated(gameplay/menu/dialogue)` |
| 4 | Rebinding UI | rules | `WBP_InputRebind`, `DA_InputSchemes` | L0 + L2 · `fieldsPopulated(widget/conflictCheck/reservedButtons/reset)`; `cppSymbolExists(AARPGPlayerController)` |
| 5 | Deadzone & Haptics | rules | — | L0 · `fieldsPopulated(deadzone/rumble)` |
| 6 | Accessibility | checklist | — | L0 · `minCount(checks, ≥3)` (input-a11y) |
| 7 | Input Glyphs | gallery | `T_<slug>_Glyphs_Atlas` | L1 · `selected(glyphSet)` |
| 8 | Tutorial Prompts | rules | — | L0 · `fieldsPopulated(promptStyle)` |
| 9 | Localization | checklist | — | L0 · `minCount(keys, ≥1)` |
| 10 | Platform Cert | checklist | — | L0 · `minCount(checks, ≥1)` |
| 11 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSInputRebindTest)` |
| 12 | UE Packaging | manifest | `DA_InputSchemes_<slug>`, `IMC_Gameplay/Menu/Dialogue_<slug>`, `T_<slug>_Glyphs_Atlas`, `WBP_InputRebind` | L0 + L2 · `minCount(assets, 2)`; `cppSymbolExists(AARPGPlayerController)` |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `AARPGPlayerController` (Enhanced Input owner / rebind host). Also referenced: `UARPGSaveGame` (remap + a11y persistence), `UEnhancedInputLocalPlayerSubsystem::FindConflictingAction`, `AARPGInputRebindConfig::IsRemappable()`.
- **Assets:** `DA_InputSchemes` DataAsset referencing `IMC_Gameplay` (pri 0), `IMC_Menu` (pri 10), `IMC_Dialogue` (pri 5); `IA_*` actions (`IA_Move/Attack/Dodge/Interact/Ability1–4`); `WBP_InputRebind`, `WBP_AccessibilitySettings`; `T_<slug>_Glyphs_Atlas`.
- **Runtime tests:** `VSInputRebindTest` (rebind persists, conflicts rejected, a11y functional in PIE); also references `VSInputBindTest`, `VSInputA11yTest` in wiring contracts.
- **Cross-catalog note:** Input Glyphs step deliberately carries **no** live `icon-sets` link — a dedicated device-glyph seed row (e.g. `iconset-gamepad-glyphs`) is pending, so glyphs are descriptive data with no dangling link.

## Acceptance profile
Predominantly **L0 (data)** across brief/mapping/context/feel/a11y/tutorial/localization/cert steps, **L1 (human selection)** for the Input Glyphs gallery, **L2 (static UE source)** on Action Mapping / Rebinding UI / UE Packaging (`cppSymbolExists(AARPGPlayerController)`), and one **L3 runtime-deferred** gate (`VSInputRebindTest`). Config-complete = every data/static step passes and the rebind/persist/a11y runtime cycle sits `deferred` until a UE bridge runs.

## Status & notes
Longest of this batch at 12 steps. Accessibility-first and platform-cert-driven: conflict check before every remap, reserved platform buttons (Guide/Share/Options) excluded by a static allowlist, vibration OFF by default, tunable saved deadzone (0.10–0.25, default 0.15). The Input Glyphs cross-catalog gap is documented in-source rather than masked with a fake link.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
