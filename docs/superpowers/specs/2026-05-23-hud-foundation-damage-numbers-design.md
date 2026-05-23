# HUD Foundation + Damage Numbers — Design

**Date:** 2026-05-23
**Sub-project:** 04-hud-ui (isolated CLI session #4)
**Scope chosen:** Foundation + damage numbers (the slice-verifiable subset of `docs/improvements/04-hud-ui/`)

## Problem

The vertical slice's HUD works (player + enemy health bars render after the
`RebuildWidget` fix), but the lessons that made it work are trapped and
unenforced:

- The `RebuildWidget`-before-`Super` build-timing pattern and the styled-bar
  helpers (`MakeSolidBrush`/`MakeBarStyle`) live in an anonymous namespace
  inside `Source/PoF/UI/VSHUDWidget.cpp` — not reusable, and the next code-only
  widget can re-introduce the invisible-bar / `NativeConstruct`-timing bugs.
- `UBossHealthBarWidget` already demonstrates the latent bug: it builds its tree
  in `NativeConstruct()` (the exact anti-pattern `VSHUDWidget.cpp` warns about).
- Damage numbers are *wired but unverified*. `AARPGPlayerController` already
  creates a `DamageNumberManagerComponent` (ARPGPlayerController.cpp:36), the
  manager auto-subscribes to `UARPGAttributeSet::OnDamageNumberRequestedGlobal`
  in `BeginPlay` and defaults `DamageNumberWidgetClass` to the pure-C++
  `UDamageNumberWidget` (DamageNumberManagerComponent.cpp:12), and the damage
  pipeline broadcasts that delegate on every damage/heal
  (ARPGAttributeSet.cpp:158, 247, 280, 299). But nothing *guarantees* the
  manager exists for the slice (it depends on `BP_VSGameMode`'s
  `PlayerControllerClass`, a binary Blueprint we can't read), and there is no
  test proving numbers appear.

## Goal

1. Turn the HUD lessons into a reusable, regression-proof base class.
2. Guarantee damage numbers in the slice independent of the Blueprint game
   mode's controller choice, and prove they fire with a test.
3. Encode the pure-C++ widget pattern into the PoF app's `arpg-ui` checklist so
   future generated HUD work defaults to it.

## Ground truth (verified this session)

| Fact | Source |
|------|--------|
| Slice game mode is `/Game/VerticalSlice/BP_VSGameMode_C`, global default | `Config/DefaultEngine.ini:15` |
| `AARPGGameMode` sets `PlayerControllerClass = AARPGPlayerController` | `ARPGGameMode.cpp:8` |
| `AARPGPlayerController` creates `DamageNumberManager` + `CombatFeedback` subobjects | `ARPGPlayerController.cpp:36,39` |
| Manager auto-subscribes to global delegate; defaults widget class to `UDamageNumberWidget` | `DamageNumberManagerComponent.cpp:12,20` |
| Damage/heal broadcasts `OnDamageNumberRequestedGlobal` | `ARPGAttributeSet.cpp:158,247,280,299` |
| `UDamageNumberWidget` builds its tree in `RebuildWidget()`, styles in `InitDamageNumber` | `DamageNumberWidget.cpp:15,49` |
| `UVSHUDWidget` is pure-C++, builds in `RebuildWidget()`, has styled-bar helpers in anon namespace | `VSHUDWidget.cpp:13-46` |
| `UBossHealthBarWidget` builds tree in `NativeConstruct()` (latent bug) | `BossHealthBarWidget.h:32,50` |
| `AVSHUD` creates `UVSHUDWidget`, `AddToViewport(30)`, binds player + first enemy ASC | `VSHUD.cpp:16-21` |

**Open uncertainty deliberately designed around:** whether `BP_VSGameMode`
actually uses `AARPGPlayerController` (cannot read the binary asset). The
damage-number guarantee (below) is idempotent so it is correct either way.

## Design

### Game side (UE repo `pof-exp`)

#### 1. `UARPGCodeWidgetBase` — new (`Source/PoF/UI/ARPGCodeWidgetBase.{h,cpp}`)

A `UUserWidget` subclass that owns the build-timing pattern and the styling
helpers so any code-only widget gets them for free.

```cpp
UCLASS()
class POF_API UARPGCodeWidgetBase : public UUserWidget
{
    GENERATED_BODY()
public:
    /** Z-order for slice HUD widgets — above the main ARPG HUD (0-15), below
     *  on-screen debug text (which always draws on top; suppress it in tests). */
    static constexpr int32 DefaultHUDZOrder = 30;

protected:
    /** Build the widget tree here. Runs BEFORE Super::RebuildWidget() constructs
     *  the Slate tree — unlike NativeConstruct(), which runs too late to mutate
     *  WidgetTree visibly. Override this; do NOT override RebuildWidget(). */
    virtual void BuildTree() {}

    virtual TSharedRef<SWidget> RebuildWidget() override; // ensures tree, calls BuildTree(), then Super

    // --- Styling helpers (lifted from VSHUDWidget.cpp's anon namespace) ---
    static FSlateBrush MakeSolidBrush(const FLinearColor& Colour);
    /** Explicit dark track + bright fill — an empty UProgressBar is invisible
     *  with the engine default (transparent background image). */
    static FProgressBarStyle MakeBarStyle(const FLinearColor& Fill,
        const FLinearColor& Track = FLinearColor(0.04f, 0.04f, 0.05f, 0.85f));

    UProgressBar* CreateStyledProgressBar(FName Name, const FLinearColor& Fill);
    UTextBlock*   CreateStyledTextBlock(FName Name, const FSlateFontInfo& Font,
                                        const FLinearColor& Colour);

    // Canvas-slot helpers (return the slot for further tweaks).
    static UCanvasPanelSlot* AnchorTopLeft(UCanvasPanel* Canvas, UWidget* Child,
        FVector2D Position, FVector2D Size);
    static UCanvasPanelSlot* AnchorTopCentre(UCanvasPanel* Canvas, UWidget* Child,
        FVector2D Position, FVector2D Size, bool bAutoSize = false);
};
```

`RebuildWidget()` body: ensure `WidgetTree` exists (`NewObject<UWidgetTree>` if
null, matching `DamageNumberWidget.cpp:18-21`), call `BuildTree()`, then
`return Super::RebuildWidget();`. `CreateStyledProgressBar` constructs into
`WidgetTree`, applies `MakeBarStyle`, sets `FillColorAndOpacity` + initial
percent 1.

#### 2. Reparent `UVSHUDWidget` onto the base

- Change base class `UUserWidget` → `UARPGCodeWidgetBase`.
- Delete the local `RebuildWidget()` override and the anonymous-namespace
  `MakeSolidBrush`/`MakeBarStyle` (now on the base).
- Rename `BuildTree()` to override the base's virtual; construct bars/text via
  the base helpers. Borders/anchors/positions stay byte-for-byte the same so the
  rendered HUD is unchanged.

#### 3. Guarantee damage numbers — `AVSHUD`

In `AVSHUD::BeginPlay` (after `Super`), ensure the owning player controller has
a `UDamageNumberManagerComponent`:

```cpp
if (APlayerController* PC = GetOwningPlayerController())
{
    if (!PC->FindComponentByClass<UDamageNumberManagerComponent>())
    {
        UDamageNumberManagerComponent* Mgr = NewObject<UDamageNumberManagerComponent>(PC);
        Mgr->RegisterComponent();
    }
}
```

Idempotent: if `AARPGPlayerController` already added one, this is a no-op (no
double numbers). If `BP_VSGameMode` uses a minimal controller, this adds it.
The manager's default `DamageNumberWidgetClass` (the pure-C++ widget) means no
further wiring is required.

#### 4. Damage-number legibility polish

In `UDamageNumberWidget`'s default tree (`DamageNumberWidget.cpp` RebuildWidget /
InitDamageNumber), add a text shadow (`SetShadowOffset` + `SetShadowColorAndOpacity`)
so numbers stay readable over bright scenes — the text analogue of the styled-bar
lesson. No behavior change beyond visual contrast.

### Tests (UE — `Source/PoF/Test/HUD/`)

1. **`AVSHUDTreeStructureTest`** — construct a `UVSHUDWidget`, force
   `RebuildWidget`, assert the named children (`PlayerHealthBar`,
   `EnemyHealthBar`, `PlayerHealthText`, `EnemyHealthText`, `EnemyNameText`)
   exist and are non-null. Proves the build-timing pattern survives the
   reparent.
2. **`AVSHUDBarBindingTest`** — bind a mock/real ASC with a `UARPGAttributeSet`,
   set Health to 50% of MaxHealth, assert `PlayerHealthBar->GetPercent()` ≈ 0.5.
   Proves the GAS-delegate binding.
3. **`AVSHUDDamageNumberTest`** — `AFunctionalTest` in the slice map: ensure a
   manager exists, broadcast `OnDamageNumberRequestedGlobal` (or apply a damage
   GE to the enemy), tick a frame, assert an active `UDamageNumberWidget` exists
   (manager's `ActiveNumbers` grew / a `UDamageNumberWidget` is in the viewport).
   Proves end-to-end spawning, headless (`-nullrhi`).

Tests use `LogWarningHandling = OutputIgnored` (the convention the Characters
sub-project landed on) to tolerate gray-box anim warnings.

### PoF app side (`C:\Users\kazda\kiro\pof` — commit locally only, do not push)

- **`src/lib/module-registry.ts`, `arpg-ui` checklist:**
  - `au-1` ("Set up HUD framework"): rewrite the prompt to default to the
    pure-C++ pattern — a `UUserWidget`/code-only widget that builds its tree in
    `RebuildWidget()` (before `Super::`), styles each `UProgressBar` with an
    explicit dark track + bright fill, and **must not use `BindWidget`** (no
    companion Widget Blueprint). Reference `UVSHUDWidget` as the canonical
    example.
  - `au-7` ("Implement floating damage numbers"): note the reference
    implementation — a `UDamageNumberManagerComponent` on the player controller
    auto-subscribing to a global delegate + a `UDamageNumberWidget` using
    `BindWidgetOptional` + `RebuildWidget` so it works pure-C++.
  - Add knowledge tips for the module: (a) `RebuildWidget` not `NativeConstruct`
    for code-built trees; (b) empty `UProgressBar` is invisible without an
    explicit `FProgressBarStyle`; (c) `AddOnScreenDebugMessage` overlays
    everything — confounds Gemini reads; use Z-order 30 + suppress in tests.
- **`src/__tests__/lib/arpg-ui-prompt.test.ts`** (vitest): assert the `arpg-ui`
  `au-1` prompt contains the pure-C++ guidance (`RebuildWidget`, explicit
  `ProgressBar` style) and does NOT recommend `BindWidget`. Regression guard.

## Out of scope (not verifiable in this isolated slice)

- Player-damage HUD reactions (hit-direction indicator, low-health pulse) —
  depend on folders 02/03 (enemy AI dealing damage to the player).
- `UBossHealthBarWidget` reparent / its `NativeConstruct` bug fix — out of slice
  (user decision: slice widgets only).
- The broader `UARPGHUDWidget` `BindWidget` family / WBP authoring.

## Verification

- `AVSHUDTreeStructureTest`, `AVSHUDBarBindingTest`, `AVSHUDDamageNumberTest`
  pass headless via `Automation RunTests`.
- A real-launch screenshot of the slice still shows both health bars (the HUD
  didn't regress through the reparent) and shows a floating number when the
  player hits the enemy — confirmed with a discriminating Gemini prompt.
- `npm run validate` passes in the PoF app (the new vitest included).
