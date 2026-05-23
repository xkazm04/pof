# 04 · HUD / UI — PoF App Improvements

## Goals

PoF's UI/HUD module should produce UI Claude can autonomously deliver as a
visible, working overlay — by defaulting to the pure-C++ widget pattern and
flagging UMG-WBP dependencies as binary content the operator must provide.

## Improvements

### 1. The `arpg-ui` checklist defaults to pure-C++ widgets

`src/lib/module-registry.ts` `arpg-ui` checklist items currently emit
`BindWidget`-coupled widgets (the `UARPGHUDWidget` family). Default the
generation prompt to the **pure-C++ widget pattern** instead:

- Generated widget extends a new project `UARPGCodeWidgetBase`
  ([[../01-generation-quality/game.md]] §2) — pre-supplies the
  `RebuildWidget()` override, the styled-ProgressBar helper, and the
  CanvasPanel-slot anchoring helpers.
- Generation prompt explicitly forbids `UPROPERTY(meta=(BindWidget))` in
  the default mode; if BindWidget is requested it must come with the
  acknowledgment "this requires a companion `WBP_<name>` Widget Blueprint
  authored in the UMG editor — Python cannot create it."

The HUD sub-project's `UVSHUDWidget.cpp` is the reference; ship it as a
template prompt fragment.

### 2. A "UMG asset dependency" surface in the matrix

When a checklist item *does* depend on a Widget Blueprint (or any binary
content asset), the feature matrix surfaces it as a distinct red dot:
"compiled, needs binary content." The HUD widgets (`UARPGHUDWidget`,
`UARPGMainHUDWidget`, etc.) all light up immediately. The operator sees
the gap without running anything.

This rides on [[../01-generation-quality/pof-app.md]] §5's
`wiringAssets` array — UMG WBPs go in that array.

### 3. A `RebuildWidget` vs `NativeConstruct` knowledge entry

Add to the gotchas pack ([[../01-generation-quality/pof-app.md]] §3): "For
a code-only `UUserWidget`, build the widget tree in `RebuildWidget()`
before calling `Super::RebuildWidget()`. Building in `NativeConstruct()`
is too late — the Slate tree was already constructed from the empty
`WidgetTree`." Every C++ widget prompt includes this.

### 4. Surface the screen-debug-text gotcha

PoF's `arpg-ui` module should warn at dispatch time: "Engine debug messages
(`AddOnScreenDebugMessage`) draw on top of UMG and pin to the top-left.
If your HUD places elements there, either offset (the HUD sub-project
placed the player bar at y=90 to clear them) or disable debug messages
in dev with `DisableAllScreenMessages 1`."

### 5. A "screenshot + Gemini check" promoted to a standard step

The HUD sub-project's verification was: launch the slice, screenshot,
Gemini-vision check. Same as Characters. Promote to a standard
`screenshot-and-describe` step in the dispatcher — every UI dispatch ends
with a Gemini check that the new element is visible on screen and reads
as intended. This catches the empty-`UProgressBar` invisibility, the
behind-debug-text overlap, and the wrong-pin-name-material-renders-black
class of failure.

### 6. A "WBP starter" PoF tool (for when the operator IS at the editor)

When the operator is willing to do a one-time manual UMG-editor pass, PoF
can help: generate a *stub* `WBP_<name>` (an empty WBP at a known path
via Python) with a README sibling explaining which `BindWidget` properties
on the parent C++ class need which child widgets at which names. The
operator opens the WBP in the editor, drags in the children — PoF tells
them exactly what to drag and where. The `UARPGHUDWidget` family's 8
named children get their checklist.

This is the documented path to "use the project's real HUD widgets" when
the autonomous-only path is insufficient.

## Verification this work succeeded

- A fresh dispatch of `arpg-ui` produces a new pure-C++ widget that
  renders correctly on first launch (Gemini-confirmed via the standard
  screenshot step) — no `RebuildWidget`/invisible-bar regression.
- The matrix surfaces every BindWidget widget in the project as a "needs
  binary content" dot.
- A WBP-starter dispatch for `UARPGHUDWidget` produces a stub WBP + a
  README listing the 8 required children.
