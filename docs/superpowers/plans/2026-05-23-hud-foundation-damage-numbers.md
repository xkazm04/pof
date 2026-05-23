# HUD Foundation + Damage Numbers — Status & Forward Plan

> **Status (2026-05-23):** The "Foundation + damage numbers" slice is **implemented, tested, and committed**. The original task-by-task implementation steps have been removed — the work is in git (SHAs below). What remains here is the record of what shipped, the parts of `docs/improvements/04-hud-ui/` deliberately left for later, and proposed next directions.

**Spec:** `docs/superpowers/specs/2026-05-23-hud-foundation-damage-numbers-design.md`
**Source scope:** `docs/improvements/04-hud-ui/{README,game,pof-app,tests}.md`

**Repos:**
- UE project — `C:\Users\kazda\Documents\Unreal Projects\PoF` (remote `xkazm04/pof-exp`; pushes 403 for `kazimi66` — **user pushes manually**).
- PoF app — `C:\Users\kazda\kiro\pof` (**commit locally only**; user pushes manually).

---

## Shipped (this slice)

**Game side (UE repo, commits on `main`):**
- `5be678c` — `UARPGCodeWidgetBase` (`Source/PoF/UI/ARPGCodeWidgetBase.{h,cpp}`): reusable pure-C++ `UUserWidget` base. Owns the `RebuildWidget()`→`BuildTree()`→`Super::` ordering and the styling helpers (`MakeSolidBrush`, `MakeBarStyle` dark-track+bright-fill, `CreateStyledProgressBar`, `CreateStyledTextBlock`, `AnchorTopLeft/Centre`, `DefaultHUDZOrder = 30`). *(04-hud-ui game.md §1)*
- `fa5bafb` — reparented `UVSHUDWidget` onto the base; removed its local `RebuildWidget` override + anonymous-namespace bar helpers. Layout/visuals unchanged.
- `005425d` — drop shadow on `UDamageNumberWidget` text for legibility. *(spec §4)*
- `97b7e90` — `AVSHUD::BeginPlay` idempotently ensures a `UDamageNumberManagerComponent` on the owning controller, so floating numbers fire regardless of `BP_VSGameMode`'s `PlayerControllerClass`. *(04-hud-ui game.md §2)*
- `d51dd4b`, `51f5a72` — `AVSHUDFunctionalTest` (`Source/PoF/Test/HUD/`) placed in `/Game/Maps/VerticalSlice` via `Content/Python/place_hud_test.py`. **Passes headless: `Result={Success}`, 8/8 assertions** across phases HUDStructure / HUDBinding / DamageNumbers. *(04-hud-ui tests.md UE §2, §3, §4 — folded into one placed test)*

**PoF app side (commit, local only):**
- `94bcb55` — `arpg-ui` `au-1`/`au-7` checklist prompts now default to the pure-C++ widget pattern (`RebuildWidget` timing, explicit `FProgressBarStyle`, forbid `BindWidget`, `BindWidgetOptional` for damage text); `arpg-ui` `knowledgeTips` capture the `RebuildWidget`-vs-`NativeConstruct`, invisible-`UProgressBar`, and `AddOnScreenDebugMessage`-overlay gotchas; new `src/__tests__/lib/arpg-ui-prompt.test.ts` guards it. *(04-hud-ui pof-app.md §1, §3, §4; tests.md PoF §1)*

**Verification:** the in-engine functional test is the gate — it proves the reparent preserved the widget tree (HUDStructure), GAS attribute changes still drive the bars (HUDBinding), and floating damage numbers spawn end-to-end on enemy hits (DamageNumbers). PoF app: full `npm run validate` (926 tests) green.

---

## Still planned (deferred from this slice)

These were in `04-hud-ui` but intentionally out of scope for "foundation + damage numbers." Listed with their source section so they remain traceable.

**Game side:**
- **Reparent `UBossHealthBarWidget`** onto `UARPGCodeWidgetBase` — fixes its latent `NativeConstruct`-timing bug. *(game.md §1; deferred by explicit decision — "slice widgets only.")*
- **Ability hotbar** — `UVSAbilityBarWidget` (+ slots) on the new base, driven off `ARPGPlayerCharacter::AbilityLoadout`. *(game.md §3)*
- **Central-screen hit indicator** — red edge-vignette flash on `OnHealthChanged`. **Blocked:** needs the player-takes-damage path from folders 02/03 (enemy AI dealing damage) before it's verifiable. *(game.md §4)*
- **Resolve the two-HUDs situation** — choose between the editor-WBP path and the reparent-to-code path for the `UARPGHUDWidget` family, then retire `UVSHUDWidget`. *(game.md §5)*
- **Gate debug text behind a cvar** (`ARPG.ShowDebugStats`) — we documented the gotcha in `arpg-ui` knowledge, but the actual engine-code gate on `AddOnScreenDebugMessage` is unbuilt. *(game.md §6)*

**PoF app side:**
- **"UMG asset dependency" matrix dot** — surface every `BindWidget`-coupled class as "compiled, needs binary content," riding `wiringAssets`. *(pof-app.md §2)*
- **`screenshot-and-describe` standard dispatch step** — every `arpg-ui` dispatch ends with a Gemini visibility check. *(pof-app.md §5)*
- **WBP-starter tool** — generate a stub `WBP_<name>` + README listing the required `BindWidget` children, for the operator's one-time editor pass. *(pof-app.md §6)*

**Tests:**
- `AVSHUDPresenceTest` — assert exactly one `UVSHUDWidget` is in the viewport. *(tests.md UE §1)*
- `wiringAssets` UMG-WBP coverage test; `screenshot-and-describe` step-injection test. *(tests.md PoF §2, §3)*
- `e2e/hud-from-scratch.spec.ts` + `e2e/fixtures/gemini-prompts/hud-check.txt`. *(tests.md E2E §1, §2)*

---

## Proposed next development directions

Ordered by value-now that the pure-C++ base + the placed-functional-test harness exist.

1. **Retire the two-HUDs trap (game.md §5) — highest priority.** Having both `UVSHUDWidget` and the unused `UARPGHUDWidget` family is an active maintenance hazard. Now that `UARPGCodeWidgetBase` exists, the **reparent-to-code path** is the cheaper, fully AI-author-able option: reparent the `UARPGHUDWidget` family onto the base, build their trees in `BuildTree()`, drop the `BindWidget`s, and delete `UVSHUDWidget` once the real HUD renders. Extend `AVSHUDFunctionalTest` to assert the successor's named children. *(Editor-WBP path only if a designer wants to hand-author layouts.)*

2. **Ability hotbar (game.md §3).** Self-contained, visible, and fully verifiable in the current slice — it reads the existing `AbilityLoadout` and needs no cross-folder dependency. Build `UVSAbilityBarWidget` on the base; add a `HotbarPresence` phase to the functional test, and a Gemini check that N slots render bottom-centre with the active slot highlighted.

3. **Debug-text cvar gate (game.md §6).** Small, and it directly improves every future Gemini/screenshot verification (the debug overlay is a known confounder). Add `ARPG.ShowDebugStats` (default 0), gate the `AddOnScreenDebugMessage` calls in `ARPGCharacterBase`/`ARPGPlayerCharacter`. The knowledge tip already warns generators; this makes the slice itself clean.

4. **Reparent `UBossHealthBarWidget` (game.md §1).** Quick win that closes the latent `NativeConstruct` bug using machinery already in place. Bundle with a tree-structure assertion.

5. **Hit indicator + low-health pulse (game.md §4).** Park until folders 02/03 deliver the player-takes-damage path, then implement together with a functional test asserting the vignette opacity spikes >0 briefly after a player-damage event.

6. **PoF-app verification tooling (pof-app.md §2, §5, §6 + tests).** Promote `screenshot-and-describe` to a standard `arpg-ui` dispatch step, add the `wiringAssets` "needs binary content" matrix dot, and ship the `hud-check.txt` Gemini fixture + `hud-from-scratch.spec.ts`. This is the app-side counterpart that makes future autonomous HUD work self-verifying — best done once the game-side HUD shape (item 1) stabilises.

**Pending manual action:** push both repos — UE `main` (HUD commits + other sessions') to `pof-exp`, and the PoF app commits — once the parallel-session batch is ready.
