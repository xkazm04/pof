# 04 · HUD / UI — Game Improvements

## Goals

Grow the HUD from a minimal player-bar + target-bar to a real combat HUD
(ability hotbar, damage numbers, hit indicator) — and resolve the
project's "two HUDs in parallel" situation (the substantial but unused
`UARPGHUDWidget` family vs the working `UVSHUDWidget`).

## Improvements

### 1. `UARPGCodeWidgetBase` — generalise the pure-C++ pattern

Add `Source/PoF/UI/ARPGCodeWidgetBase.{h,cpp}` — a minimal `UUserWidget`
that:

- Overrides `RebuildWidget()` with the correct ordering (build tree
  *before* calling `Super::RebuildWidget()`).
- Provides protected helpers: `CreateStyledProgressBar(FName, FLinearColor
  Fill, FVector2D Size)`, `CreateStyledTextBlock(FName, int FontSize)`,
  `AnchorTopLeft(UWidget*, FVector2D Offset, FVector2D Size)`,
  `AnchorTopCentre(UWidget*, FVector2D Offset, FVector2D Size)`, etc.
- Sets sensible defaults: dark track + bright fill on bars, font scale
  fixed for 1080p, `AddToViewport` with `ZOrder = 30` to clear engine
  debug text.

`UBossHealthBarWidget` and `UVSHUDWidget` reparent to it; future widgets
just override `BuildTree()` and call the helpers.

### 2. Damage numbers — wire the existing classes

The project has generated `DamageNumberWidget` + `DamageNumberManagerComponent`
(SP-B). They are not wired. Once `UARPGCodeWidgetBase` exists, port
`DamageNumberWidget` to it (drop the BindWidget on its text/icon, build
them in `BuildTree`). The manager listens to
`UARPGAttributeSet::OnDamageNumberRequested` (already broadcast by the
damage execution). Wire `DamageNumberManagerComponent` onto the player
controller and the slice gets floating damage numbers on every hit.

### 3. An ability hotbar — pure-C++ slots

`UAbilityBarWidget` + `UAbilitySlotWidget` are BindWidget-coupled. A
pure-C++ replacement `UVSAbilityBarWidget` (extending `UARPGCodeWidgetBase`)
draws N hotbar slots along the bottom-centre. Each slot renders an
ability's icon (a single-channel ASCII letter for the slice; a real icon
in a follow-up), its cooldown overlay, and a key hint (`1`/`2`/`3`/`4`).
Drives off the existing `ARPGPlayerCharacter::AbilityLoadout` map.

The slice goes from "one ability binding" to a visible hotbar.

### 4. A central-screen hit indicator

When the player takes damage, flash a quick red vignette on the edges of
the screen — a `UCodeImage` (pure-C++ helper) of a red border, opacity
animated from 0.7 → 0 over 250 ms. Bound to
`AARPGPlayerCharacter::OnHealthChanged` (delegate exists, currently
unused). Cheap, visible, ties the new "player takes damage" path
([[../03-combat/game.md]] §3 / [[../02-character/game.md]] §3) to player
feedback.

### 5. Resolve the `UARPGHUDWidget` family

The existing HUD widget classes are real, rich C++ — they just need WBPs.
Two paths, document the decision per project state:

- **Editor-pass path:** author the 5–7 WBPs in the UMG editor; assign
  them as the various `*Class` properties on `AARPGHUD`; set `HUDClass =
  AARPGHUD` on `BP_VSGameMode`. The project then uses the "real" HUD with
  XP / Stamina / minimap placeholder / ability hotbar, replacing
  `UVSHUDWidget`. PoF's WBP-starter dispatch ([[pof-app.md]] §6) primes
  this.
- **Reparent-to-code path:** rewrite each of the BindWidget classes to
  reparent on `UARPGCodeWidgetBase` and build the tree in C++. More work
  but stays fully Python/AI-author-able. Recommended when the project's
  HUD design stabilises.

Either way, retire `UVSHUDWidget` when the chosen path lands — having
both is a maintenance trap.

### 6. Disable debug text in non-dev

`AddOnScreenDebugMessage` from `ARPGCharacterBase`/`ARPGPlayerCharacter`
fires every tick in `#if !UE_BUILD_SHIPPING`. Either:
- gate behind a cvar (`ARPG.ShowDebugStats 1`) so it's off by default and
  on in dev sessions; or
- remove entirely once the real HUD has the stats.

The HUD sub-project's screenshot was cluttered by this text — the slice
will look more "shipped" without it.

## Verification this work succeeded

- A new ability-hotbar widget shows 4 slots on screen, the slot for the
  active ability lights when triggered (verified by Gemini).
- Floating damage numbers appear on every enemy hit during the functional
  test re-run.
- The hit indicator flashes when the player takes damage (a new
  functional test verifies the widget's opacity > 0 briefly after a
  damage event).
- One of the two `UARPGHUDWidget`-family paths is chosen, documented, and
  the slice uses the chosen HUD (with `UVSHUDWidget` retired).

## Implementation status (2026-05-24)

Plan: `docs/superpowers/plans/2026-05-24-hud-ui-04-game-reparent.md`. Game C++
written to `xkazm04/pof-exp`; **uncommitted pending the operator's
`Build.bat PoFEditor`** (the editor module build is monolithic + shared).

- **§1 `UARPGCodeWidgetBase`** — already shipped (`5be678c`); `UVSHUDWidget`
  reparented (`fa5bafb`).
- **§2 damage numbers** — already shipped (`97b7e90`/`005425d`).
- **§5 (chosen: reparent-to-code)** — `UARPGHUDWidget`, `UAbilityBarWidget`,
  `UAbilitySlotWidget`, `UEnemyHealthBarWidget` reparented onto
  `UARPGCodeWidgetBase`: `meta=(BindWidget)` dropped, each builds its named
  children in a `BuildTree()` override; all existing bind/tick/fade logic kept.
  `AARPGHUD` now defaults `HUDWidgetClass`/`AbilityBarClass` to the C++ classes
  so it needs no WBP.
- **§3 ability hotbar** — delivered *as* the reparented `UAbilityBarWidget` +
  `UAbilitySlotWidget` (bottom-centre `SlotContainer`, default
  `SlotWidgetClass`), **not** a throwaway `UVSAbilityBarWidget` (which §5 would
  have immediately retired).
- **§4 hit indicator** — full-screen `HitVignette` `UImage` on
  `UARPGHUDWidget`, flashed (peak 0.7, ~250 ms decay) from the existing GAS
  `OnHealthChanged` callback when health drops.
- **§6 debug text** — gated behind the `ARPG.ShowDebugStats` cvar (off by
  default) in `ARPGCharacterBase`/`ARPGPlayerCharacter`.
- **§5 retire (GATED — not yet done):** switching `BP_VSGameMode.HUDClass` to
  `AARPGHUD` (needs an in-editor Python BP edit) and deleting `UVSHUDWidget`/
  `AVSHUD` is deferred until the operator confirms the reparented HUD renders
  (build + launch/Gemini). Until then the slice stays on the known-good
  `UVSHUDWidget`; `AVSHUDFunctionalTest` is untouched.
