# HUD/UI (Folder 04) — PoF App Knowledge & Prompt Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the genuinely-remaining HUD/UI gaps in the PoF app repo — finish the pure-C++ widget default across all `arpg-ui` checklist steps, surface the screen-debug-text pitfall at dispatch time, and sharpen the UI evaluator prompt — without re-doing the large portion of `docs/improvements/04-hud-ui/pof-app.md` that is already shipped.

**Architecture:** All Phase 1 work is text/data edits to existing registries plus vitest coverage — no new subsystems. `arpg-ui` checklist prompts live in `src/lib/module-registry.ts`; dispatch-time pitfalls live in `src/lib/knowledge/ue-gotchas.ts` (injected into every `ue-cpp` prompt via `formatGotchas` in `src/lib/prompt-context.ts`); UI evaluator criteria live in `src/lib/evaluator/module-eval-prompts.ts`. The two large greenfield items (in-app screenshot+Gemini dispatch step; WBP-starter tool) are scoped OUT of this plan into Phase 2 because they need their own brainstorming/spec.

**Tech Stack:** TypeScript, Vitest (snapshot + assertion tests), Next.js 16 / React 19 (no runtime code touched in Phase 1).

---

## What folder 04's PoF-app spec already delivered (do NOT redo)

Verified against the current code on 2026-05-23. These items from `docs/improvements/04-hud-ui/pof-app.md` are **already implemented**:

| Spec item | Status | Evidence |
|-----------|--------|----------|
| §1 pure-C++ default — step `au-1` | ✅ done | `module-registry.ts:242` (RebuildWidget, "do not use BindWidget", `FProgressBarStyle`, references `UVSHUDWidget`) |
| §1 pure-C++ default — step `au-7` (damage numbers) | ✅ done | `module-registry.ts:252` (RebuildWidget, `BindWidgetOptional`) |
| §1 covered by tests | ✅ done | `src/__tests__/lib/arpg-ui-prompt.test.ts` (au-1, au-7) |
| §2 "needs binary content" matrix dot | ✅ done | `feature-definitions.ts:537-626` (`BINARY_AUTHORABLE_ONLY`, `moduleNeedsBinaryContent`); `FeatureMatrix.tsx:153,465-468` (badge + tooltip); `feature-definitions-wiring.test.ts` |
| §3 RebuildWidget vs NativeConstruct knowledge entry | ✅ done | `ue-gotchas.ts:24-31` (`umg-rebuildwidget-timing`, `appliesTo:['ue-cpp']`, injected by `prompt-context.ts:381`); also `arpg-ui` `knowledgeTips` `module-registry.ts:512`; covered by `ue-gotchas.test.ts` |
| tests.md §1 pure-C++ prompt test | ✅ done (au-1/au-7) | `arpg-ui-prompt.test.ts` |
| tests.md §2 wiringAssets WBP coverage test | ✅ done | `feature-definitions-wiring.test.ts` |
| E2E gemini `hud-check.txt` fixture | ✅ done | `e2e/fixtures/gemini-prompts/hud-check.txt` |
| The screenshot+Gemini *primitive* | ✅ exists (e2e layer) | `e2e/helpers/ue-verification.ts` (`launchAndScreenshot`, `geminiCheck`) |

**Genuine remaining gaps in this repo (this plan):**
- §1 is only *partially* applied — steps `au-3` (floating enemy bar), `au-4` (ability cooldown bar), `au-8` (pause/settings menu) still emit generic prompts with no pure-C++/no-BindWidget guidance. → **Task 1**
- §4 (screen-debug-text gotcha) exists only as a UI-only `knowledgeTip` — `knowledgeTips` are rendered in `ModuleShell.tsx` but are **never injected into a dispatch prompt**. To "warn at dispatch time" it must be a `UE_GOTCHAS` entry. → **Task 2**
- The README scopes "the UI section of the evaluator prompts"; the `arpg-ui` structure check says only "HUD should use UMG with C++ base classes" — it doesn't encode the RebuildWidget/no-BindWidget rule the slice proved. → **Task 3**

**Scoped OUT to Phase 2 (need their own brainstorm/spec — see end of doc):** pof-app.md §5 (promote screenshot+Gemini to an in-app dispatch step) and §6 (WBP-starter tool). Both are new subsystems with real design questions, not data edits.

---

## File Structure (Phase 1)

| File | Responsibility | Change |
|------|----------------|--------|
| `src/lib/module-registry.ts` | `arpg-ui` checklist prompts | Modify `au-3`, `au-4`, `au-8` prompt strings |
| `src/__tests__/lib/arpg-ui-prompt.test.ts` | Asserts arpg-ui prompts carry the pure-C++ default | Add a describe block for au-3/au-4/au-8 |
| `src/lib/knowledge/ue-gotchas.ts` | Dispatch-injected UE pitfalls | Add `umg-debug-text-overlay` gotcha |
| `src/__tests__/knowledge/ue-gotchas.test.ts` | Asserts gotchas render for `ue-cpp` | Add a debug-text assertion |
| `src/__tests__/knowledge/__snapshots__/ue-gotchas.test.ts.snap` | Snapshot of the `ue-cpp` block | Regenerated with `-u` |
| `src/lib/evaluator/module-eval-prompts.ts` | `arpg-ui` eval criteria | Sharpen the first `structureChecks` line |
| `src/__tests__/registry/slice-prompts.test.ts` | Asserts evaluator/checklist prompt edits | Add an `arpg-ui` evaluator assertion |

---

## Task 1: Apply the pure-C++ widget default to `au-3`, `au-4`, `au-8`

**Files:**
- Modify: `src/lib/module-registry.ts` (steps `au-3` line 244, `au-4` line 245, `au-8` line 253)
- Test: `src/__tests__/lib/arpg-ui-prompt.test.ts`

The existing helper `uiItem(id)` at the top of `arpg-ui-prompt.test.ts:5-10` is reused — do not redefine it.

- [ ] **Step 1: Write the failing test**

Append this describe block to `src/__tests__/lib/arpg-ui-prompt.test.ts` (after the existing `describe` at line 34):

```ts
describe('arpg-ui widget-creating HUD steps carry the pure-C++ default', () => {
  for (const id of ['au-3', 'au-4', 'au-8']) {
    it(`${id} instructs RebuildWidget-based tree construction`, () => {
      expect(uiItem(id).prompt).toMatch(/RebuildWidget/);
    });

    it(`${id} forbids BindWidget / a companion WBP`, () => {
      expect(uiItem(id).prompt).toMatch(
        /do not use `?BindWidget`?|don't use `?BindWidget`?|no companion Widget Blueprint/i,
      );
    });
  }

  it('au-3 styles its ProgressBar explicitly (dark track + bright fill)', () => {
    expect(uiItem('au-3').prompt).toMatch(/FProgressBarStyle|dark track/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/arpg-ui-prompt.test.ts`
Expected: FAIL — the new assertions don't match the current generic prompts (no `RebuildWidget` in au-3/au-4/au-8).

- [ ] **Step 3: Rewrite the three prompts in `src/lib/module-registry.ts`**

Replace the `au-3` object's `prompt` (line 244) with:

```ts
    { id: 'au-3', label: 'Create floating enemy health bars', description: 'UWidgetComponent on enemies showing health bar, enemy name, and level.', prompt: `Create the floating enemy health bar as a pure-C++ UUserWidget — no companion Widget Blueprint, and do not use BindWidget. Build its widget tree in RebuildWidget() (before Super::RebuildWidget()), NOT in NativeConstruct() (which runs after the Slate tree is built). Style the UProgressBar with an explicit FProgressBarStyle — a dark track (BackgroundImage) and a bright fill (FillImage) — because an empty ProgressBar is invisible with the engine default. Host the widget on a UWidgetComponent attached to enemy characters, set to Screen space. The widget shows: enemy name, level number, and the health bar that updates on damage. The bar fades in when the enemy takes damage and fades out after 3 seconds of no damage. Hide for dead enemies.` },
```

Replace the `au-4` object's `prompt` (line 245) with:

```ts
    { id: 'au-4', label: 'Implement ability cooldown UI', description: 'Ability bar slots show icon, cooldown sweep overlay, mana cost, and keybind label.', prompt: `Implement the ability bar as a pure-C++ UUserWidget — no companion Widget Blueprint, and do not use BindWidget. Build the slot tree in RebuildWidget() (before Super::RebuildWidget()), NOT in NativeConstruct(). Create 4 ability slots along the bottom-centre. Each slot shows: ability icon (UTexture2D from ability data), a cooldown sweep overlay (radial wipe that counts down), the mana cost number, and the keybind label (1/2/3/4). Bind to GAS ability cooldown tags to drive the sweep animation. Anchor the bar at Z-order 30 so it sits above engine debug text.` },
```

Replace the `au-8` object's `prompt` (line 253) with:

```ts
    { id: 'au-8', label: 'Create pause and settings menus', description: 'Pause menu with Resume, Settings (audio/video), Save, Quit. Settings save to GameUserSettings.', prompt: `Create the pause menu as a pure-C++ UUserWidget — no companion Widget Blueprint, and do not use BindWidget. Build the button tree in RebuildWidget() (before Super::RebuildWidget()) and wire each UButton's OnClicked delegate in C++. On ESC press: pause the game (SetGamePaused), show buttons: Resume, Settings, Save Game, Quit to Main Menu. Settings screen with tabs: Graphics (resolution, quality presets, vsync, frame limit), Audio (master/music/sfx volume sliders), Controls (show keybindings). Persist settings using UGameUserSettings.` },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/arpg-ui-prompt.test.ts`
Expected: PASS (existing au-1/au-7 tests + the 7 new assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/module-registry.ts src/__tests__/lib/arpg-ui-prompt.test.ts
git commit -m "feat(arpg-ui): apply pure-C++ widget default to au-3/au-4/au-8 HUD prompts"
```

---

## Task 2: Surface the screen-debug-text pitfall at dispatch time (pof-app.md §4)

**Why:** `knowledgeTips` (where this currently lives, `module-registry.ts:521-525`) are only rendered in `ModuleShell.tsx` — they are never concatenated into a dispatch prompt. `UE_GOTCHAS` with `appliesTo:['ue-cpp']` ARE injected into every `ue-cpp` prompt by `formatGotchas` (`prompt-context.ts:381`, default `promptKind = 'ue-cpp'` at `prompt-context.ts:329`). So the warning must be a gotcha to reach Claude at dispatch.

**Files:**
- Modify: `src/lib/knowledge/ue-gotchas.ts` (add to `UE_GOTCHAS` array)
- Test: `src/__tests__/knowledge/ue-gotchas.test.ts`
- Snapshot: `src/__tests__/knowledge/__snapshots__/ue-gotchas.test.ts.snap` (regenerated)

- [ ] **Step 1: Write the failing test**

Add this `it` block inside the existing `describe('formatGotchas', ...)` in `src/__tests__/knowledge/ue-gotchas.test.ts`:

```ts
  it('includes the debug-text overlay pitfall for ue-cpp', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toContain('AddOnScreenDebugMessage');
    expect(out).toMatch(/DisableAllScreenMessages/);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/knowledge/ue-gotchas.test.ts`
Expected: FAIL — `AddOnScreenDebugMessage` is not yet in any `ue-cpp` gotcha. (The existing `toMatchSnapshot` test still passes at this point.)

- [ ] **Step 3: Add the gotcha**

In `src/lib/knowledge/ue-gotchas.ts`, add this object to the `UE_GOTCHAS` array (e.g. immediately after the `umg-rebuildwidget-timing` entry, before the closing `];` at line 72):

```ts
  {
    id: 'umg-debug-text-overlay',
    summary: 'AddOnScreenDebugMessage debug text draws over UMG and pins to the top-left',
    detail:
      'GEngine->AddOnScreenDebugMessage prints above all UMG and pins to the top-left corner, colliding with anything placed there and confounding screenshot/vision HUD checks. Either offset HUD elements down (the slice put the player health bar at y=90) or disable it in dev with the DisableAllScreenMessages console command.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: HUD',
  },
```

- [ ] **Step 4: Run the assertion test to verify it passes, then update the snapshot**

Run: `npx vitest run src/__tests__/knowledge/ue-gotchas.test.ts`
Expected: the new `it` PASSES, but the `snapshot of the ue-cpp block` test now FAILS (the rendered block gained a line) — this is expected.

Update the snapshot:

Run: `npx vitest run src/__tests__/knowledge/ue-gotchas.test.ts -u`
Expected: PASS — the regenerated snapshot now contains the `AddOnScreenDebugMessage` line. Confirm the diff added exactly one bullet for the new gotcha.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/ue-gotchas.ts src/__tests__/knowledge/ue-gotchas.test.ts src/__tests__/knowledge/__snapshots__/ue-gotchas.test.ts.snap
git commit -m "feat(knowledge): inject screen-debug-text HUD pitfall into ue-cpp prompts"
```

---

## Task 3: Encode the pure-C++ HUD rule in the UI evaluator prompt

**Files:**
- Modify: `src/lib/evaluator/module-eval-prompts.ts` (`arpg-ui` `structureChecks`, line 203)
- Test: `src/__tests__/registry/slice-prompts.test.ts` (`MODULE_CONTEXTS` is already imported at line 3)

- [ ] **Step 1: Write the failing test**

Append this describe block to `src/__tests__/registry/slice-prompts.test.ts` (after the `arpg-combat evaluator prompts` describe at line 88):

```ts
describe('arpg-ui evaluator prompts', () => {
  it('structure pass requires the pure-C++ RebuildWidget pattern for code-only HUDs', () => {
    const ui = (MODULE_CONTEXTS as Record<string, { structureChecks?: string }>)['arpg-ui'];
    expect(ui?.structureChecks ?? '').toMatch(/RebuildWidget/);
    expect(ui?.structureChecks ?? '').toMatch(/BindWidget/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/registry/slice-prompts.test.ts`
Expected: FAIL — the current `arpg-ui` `structureChecks` mentions neither `RebuildWidget` nor `BindWidget`.

- [ ] **Step 3: Sharpen the structure check**

In `src/lib/evaluator/module-eval-prompts.ts`, replace the first line of the `arpg-ui` `structureChecks` (line 203, `- HUD should use UMG with C++ base classes for game UI`) so the block reads:

```ts
    structureChecks: `- Code-only HUD widgets should be pure-C++ UUserWidgets that build their tree in RebuildWidget() (not NativeConstruct) — a UPROPERTY(meta=(BindWidget)) member requires a companion WBP that cannot be authored from code
- Health/mana bars should bind to GAS attribute delegates
- Inventory screen should not duplicate inventory logic (use component)
- Floating damage numbers should use a widget pool
- Menus should handle input mode switching properly`,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/registry/slice-prompts.test.ts`
Expected: PASS (existing assertions + the new `arpg-ui` evaluator assertion).

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluator/module-eval-prompts.ts src/__tests__/registry/slice-prompts.test.ts
git commit -m "feat(evaluator): require pure-C++ RebuildWidget HUD pattern in arpg-ui structure check"
```

---

## Final verification (Phase 1)

- [ ] **Run the full validation suite**

Run: `npm run validate`
Expected: typecheck + lint + all tests PASS. No console/hex/timing lint regressions (Phase 1 touches only string/data and tests).

- [ ] **Confirm the dispatch prompt actually carries the new gotcha** (manual spot-check, no code)

The `umg-debug-text-overlay` gotcha is injected because `buildProjectContextHeader` defaults `promptKind` to `'ue-cpp'` and `formatGotchas('ue-cpp')` includes every gotcha whose `appliesTo` contains `ue-cpp`. No further wiring is needed for Task 2 to take effect at dispatch.

---

## Phase 2 — scoped OUT, needs its own brainstorm + plan

These two `pof-app.md` items are **new subsystems**, not data edits. Per the writing-plans Scope Check, each should get its own brainstorming session and plan rather than speculative steps here. Open design questions are listed so a follow-up spec can start cleanly.

### Phase 2a — pof-app.md §5: promote screenshot+Gemini to a standard in-app dispatch step

The capability already exists at the **e2e layer** (`e2e/helpers/ue-verification.ts`: `launchAndScreenshot()` + `geminiCheck()` + `hud-check.txt`), and the harness has a Playwright `visual-gate.ts`. What's missing is making it a **standard step of the in-app CLI dispatcher** (`src/lib/cli-task.ts` / `src/hooks/useModuleCLI.ts`), which is text/callback-only today.

Open design questions to resolve in brainstorming:
- Who launches UE and captures the screenshot from inside the running Next.js app? Reuse `e2e/helpers/ue-verification.ts` via a new `/api/...` route, call the harness, or have the dispatched Claude CLI run it? (`ue-verification.ts` hardcodes engine/uproject paths from `process.env` — they'd need to come from `projectStore`'s dynamic UE context.)
- Is the Gemini check synchronous (blocks the dispatch "done" state) or an async follow-up event on the `eval.*`/`build.*` bus?
- Where does the Gemini verdict surface in the UI, and does a "reads as empty/zero-width" verdict mark the checklist item failed vs. advisory (mirroring `visual-gate.ts`'s `required:false`)?
- Which `CLITask` types get the step auto-appended — only `arpg-ui`, or any UI-producing dispatch?

Dependent test (tests.md PoF-app §3, "screenshot-and-describe step injection") and the E2E `hud-from-scratch.spec.ts` (tests.md E2E §1) belong with this item — both presuppose the step's design.

### Phase 2b — pof-app.md §6: WBP-starter PoF tool

Generate a stub `WBP_<name>` at a known path via Python plus a sibling README listing which `BindWidget` properties on the parent C++ class need which child widgets at which names (the `UARPGHUDWidget` family's 8 children).

Open design questions:
- How does the app execute Python against the UE project — dispatch a Claude CLI task that runs `UnrealEditor.exe -ExecutePythonScript=` (note the `interchange-fbx-commandlet-crash`/`-run=pythonscript` caveat already in `UE_GOTCHAS`), or a dedicated route?
- Where do the required-children lists come from — parsed from the C++ headers' `BindWidget` UPROPERTYs, or authored as data alongside `MODULE_WIRING_ASSETS`?
- New module surface (`src/components/modules/core-engine/arpg-ui/`) vs. a quick action on the existing panel.

---

## Cross-repo dependency note (not a Phase 1 task)

`pof-app.md §1` wants generated widgets to extend a new `UARPGCodeWidgetBase`. That class is a **`game.md §1` deliverable in the separate `xkazm04/pof-exp` UE repo** and does not exist yet. The Phase 1 prompts therefore keep the generic pattern wording (RebuildWidget + no BindWidget) and the `UVSHUDWidget` reference that `au-1` already uses. Once `UARPGCodeWidgetBase` lands in the UE repo, a one-line follow-up updates the `arpg-ui` prompts to name it as the parent class.

## Optional / deferred (low value, do only if asked)

- **Granular WBP family in the matrix:** `pof-app.md §2` mentions the whole `UARPGHUDWidget` family lighting up. Today `arpg-ui` lists one wiring asset (`WBP_ARPGHUD`), which already makes `moduleNeedsBinaryContent('arpg-ui')` true and shows the red dot. Enumerating all family WBPs is finer-grained but the indicator already fires — defer unless the operator wants per-WBP detail.

---

## Self-Review (run by author)

**Spec coverage** (`pof-app.md` §1–§6 + tests.md PoF-app side):
- §1 → Task 1 (au-3/au-4/au-8) + already-done au-1/au-7. ✅
- §2 → already done (verified). ✅
- §3 → already done (verified). ✅
- §4 → Task 2. ✅
- §5 → Phase 2a (scoped out, justified). ✅
- §6 → Phase 2b (scoped out, justified). ✅
- README "UI section of evaluator prompts" → Task 3. ✅
- tests.md PoF §1 → extended by Task 1's test. ✅  §2 → already done. ✅  §3 → Phase 2a. ✅

**Placeholder scan:** No TBD/"handle edge cases"/"similar to" — every step has the exact prompt string, gotcha object, or test code. ✅

**Type consistency:** New gotcha object matches the `Gotcha` interface (`id/summary/detail/appliesTo/source`, `ue-gotchas.ts:7-13`). Test helper `uiItem` reused, not redefined. `MODULE_CONTEXTS` already imported in `slice-prompts.test.ts`. The test regexes (`RebuildWidget`, `no companion Widget Blueprint`, `FProgressBarStyle`, `AddOnScreenDebugMessage`, `DisableAllScreenMessages`) each appear verbatim in the corresponding implementation strings. ✅
