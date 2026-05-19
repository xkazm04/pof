# ARPG Vertical Slice — Readiness Map

> Scenario: drive the PoF UI (via Playwright/MCP) to produce a packaged Win64 build of an ARPG vertical slice — WASD move, melee attack, kill dummy enemy, see loot drop on death. Sub-project A deliverable; feeds B/C/D.

## 1. Vertical-slice success criteria

- [ ] PIE: WASD moves the character on a flat level with collisions.
- [ ] PIE: LMB triggers the attack ability; attack montage plays.
- [ ] PIE: Attack hits a dummy enemy at melee range and reduces its Health attribute.
- [ ] PIE: Enemy with Health ≤ 0 is destroyed; one loot pickup actor spawns at its death location.
- [ ] Packaged Win64 Shipping build launches as a standalone .exe and the player can perform all of the above outside the editor.

## 2. End-to-end Playwright operator flow

> Each numbered step lists: **target PoF screen → testIds clicked → expected PoF outcome → expected UE5 artifact**. testId names are stable and defined in [testid-coverage.md](./testid-coverage.md). Gap references point at remaining blockers; `(deferred to C: GAP-NNN)` means sub-project C will close that gap before sub-project D executes. Sub-project B closed all 11 hard blockers — the remaining annotations are non-blocking quality-of-assertion gaps.

### Phase 0 — Bootstrap (Wave 0, project-setup)

1. **Launch PoF** (`npm run dev` → `http://localhost:3000`). No clicks; assert the app loads. _Blocked by GAP-015/016/017 generally — without sidebar/CLI testIds the operator can't proceed reliably._
2. **Sidebar → Project Setup category.** Click `pof-sidebar-nav-item-project-setup` → expect SidebarL2 to expand showing project-setup sub-items.
3. **Open Setup Wizard.** Click `pof-sidebar-l2-nav-item-project-setup`. Expect SetupWizard rendered.
4. **Select existing project.** Click `pof-setup-wizard-tab-existing` → assert project list visible → click `pof-setup-wizard-project-item-pof` (slugified via slugifyForTestId). **Expected UE5 artifact:** none yet; PoF loads context for the existing UE5 project at `C:\Users\kazda\Documents\Unreal Projects\PoF`.
5. **Wait for status checks.** Assert `pof-setup-wizard-checklist-item-engine` shows ✓, `pof-setup-wizard-checklist-item-uproject` shows ✓, all `pof-setup-wizard-checklist-item-tool-{toolId}` items ✓.
6. **Verify build.** Click `pof-setup-wizard-build-verify-btn` → CLI panel opens → terminal prints UAT Build output → assert success message in `pof-cli-panel-output`. **Expected UE5 artifact:** project rebuilds with no errors.

### Phase 1 — Wave 0 modules (in any order: arpg-character, input-handling)

7. **Navigate to arpg-character.** `pof-sidebar-nav-item-core-engine` → `pof-sidebar-l2-nav-item-arpg-character`. Assert module renders. **Per [modules/arpg-character.md](./modules/arpg-character.md):** no Playwright-touched controls; module is output-focused (UE5 C++). Verification happens in PIE later.
8. **Navigate to input-handling.** `pof-sidebar-nav-item-game-systems` → `pof-sidebar-l2-nav-item-input-handling`. Click `pof-module-input-handling-checklist-item-ih-1` → CLI panel runs ih-1 prompt (now narrowed to IA_Move + IA_Attack — see 0c0274c). After completion, click `pof-module-input-handling-checklist-item-ih-2`. **Expected UE5 artifacts:** `IA_Move`, `IA_Attack`, `IMC_Default` data assets created in `Content/Input/`.

### Phase 2 — Wave 1 modules (arpg-animation, arpg-gas)

9. **arpg-animation.** Navigate via sidebar. Click `pof-module-arpg-animation-step-aa-1` → run commandlet to generate `BS1D_Locomotion`. Click `pof-module-arpg-animation-step-aa-3` → generate `AM_MeleeCombo` montage shell. **Expected UE5 artifacts:** `UARPGAnimInstance.cpp/h`, `BS1D_Locomotion.uasset`, `AM_MeleeCombo.uasset`.
10. **arpg-gas.** Navigate. Module per [modules/arpg-gas.md](./modules/arpg-gas.md) has no Playwright controls; use CLI panel to dispatch the registry checklist items ag-1, ag-2, ag-4 (`pof-cli-panel-input`) → assert progress in output. **Expected UE5 artifacts:** `UAbilitySystemComponent` on `AARPGCharacterBase`, `UARPGAttributeSet` with `Health`/`MaxHealth`/`Damage`, `GE_Damage` gameplay effect.

### Phase 3 — Wave 2 modules (arpg-combat, arpg-enemy-ai)

11. **arpg-combat.** Navigate. Use CLI panel to run combat checklist items acb-1 + acb-4 (melee attack ability + damage application). **Expected UE5 artifacts:** `GA_MeleeAttack` ability + hit-detection notify. _Verify GAP-002 (hit dedup) and GAP-003 (State.Dead death flow) are satisfied — sub-project B fixes prompts to enforce these._
12. **arpg-enemy-ai.** Navigate. CLI: dispatch a minimal "dummy enemy" prompt (sub-project B should add a slice-mode quick action that asks for `AARPGEnemyBase` with ASC, no movement, no BT — see open question in [modules/arpg-enemy-ai.md](./modules/arpg-enemy-ai.md)). **Expected UE5 artifacts:** `AARPGEnemyBase` C++ class that spawns, takes damage, dies on `Health ≤ 0`.

### Phase 4 — Wave 3 modules (arpg-loot, arpg-ui)

13. **arpg-loot.** Navigate. CLI: dispatch al-5 (drop on death — cheat-path variant per GAP-004) + al-6 (overlap-destroy "+gold" effect, no inventory). **Expected UE5 artifacts:** `UARPGLootTable` data asset, `AARPGWorldItem` spawned at enemy death, overlap effect on player.
14. **arpg-ui.** Navigate. CLI: dispatch au-1, au-2, au-7 (HUD + GAS bind + floating damage). Skip au-5 and au-6 (inventory + character stats — out of scope per GAP-008). **Expected UE5 artifacts:** HUD widget with health bar bound to ASC, floating damage numbers on hits.

### Phase 5 — Feature-matrix verification

15. **Open feature matrix per module.** Navigate to each in-scope module → click `pof-feature-matrix-scan-btn` → assert key rows show `pof-feature-matrix-status-{slugifiedFeatureName} === "implemented"`. Quality stars at `pof-feature-matrix-quality-{slugifiedFeatureName}`.

### Phase 6 — Evaluator gate

16. **Run Deep Eval on arpg-combat.** Navigate to `pof-module-evaluator` → switch to "Deep Eval" tab → select arpg-combat in the module selector → click `pof-module-evaluator-run-btn`. Wait for `pof-module-evaluator-result-summary` to render; assert `pof-module-evaluator-result-findings-count` is below the regression threshold (e.g., no critical findings). Repeat for arpg-gas, arpg-enemy-ai, arpg-loot, arpg-ui. _(Note: the actual evaluator is severity/findings-based, not a 1-5 quality score; the spec's original "result-quality" was replaced with "result-summary" + "result-findings-count" during sub-project C.)_

### Phase 7 — Packaging

17. **Navigate to packaging.** `pof-sidebar-nav-item-game-systems` → `pof-sidebar-l2-nav-item-packaging`.
18. **Select Win64 Shipping.** Click `pof-module-packaging-add-platform-win64` (or select existing Win64 profile via `pof-module-packaging-start-cook-{profileId}`) → click `pof-module-packaging-config-shipping` in the config dropdown.
19. **Trigger cook.** Click `pof-module-packaging-start-cook` → POST `/api/packaging/execute` returns SSE stream; CookProgress mounts. **(Backend now exists per a8072e6.)**
20. **Wait for cook to finish.** Watch `pof-cook-progress-phase` advance through Cooking → Staging → Packaging → Finished; `pof-cook-progress-percent` reaches 100. **(CookProgress UI added in a8072e6.)**
21. **Read .exe path.** Read `pof-cook-progress-exe-path` text content (CookProgress component) OR `pof-module-packaging-exe-path-{buildId}` from BuildHistoryDashboard after the cook finishes. **Expected UE5 artifact:** `Saved/StagedBuilds/Windows/PoF.exe` (or similar path).

### Phase 8 — Slice verification (outside PoF)

22. **Launch the packaged .exe.** Playwright spawns the .exe via Node `child_process`. Assert process starts.
23. **Drive WASD + LMB.** Either via `robotjs`/`@nut-tree/nut-js` (keyboard simulation) or by snapshotting frames and checking pixel deltas. Verify the five vertical-slice success bullets (Section 1) one by one.
24. **Capture findings.** Sub-project D's report records: which bullets passed, which testIds were used, which gaps blocked, which were worked around. Final deliverable: `docs/features/arpg-vertical-slice/scenario-run-{date}.md`.

### Summary of step-level blockers

- ~~**Phase 0-1 navigation blocked by GAP-015, GAP-016, GAP-017** (infra testIds).~~ **CLOSED in sub-project B (3e3df3f).**
- ~~**Phase 2-4 prompt scoping blocked by GAP-004, GAP-005, GAP-006, GAP-008** (prompt-defects re: inventory dep + over-scoped inputs).~~ **CLOSED in sub-project B (0c0274c).**
- ~~**Phase 3 combat correctness blocked by GAP-002, GAP-003** (behavior bugs in hit dedup + death flow).~~ **CLOSED in sub-project B (0c0274c — evaluator-level checks).**
- ~~**Phase 5-6 assertions still degraded by GAP-019, GAP-020** (non-blocking but degrade assertion quality — deferred to sub-project C).~~ **CLOSED in sub-project C (0ebc6f2 + 78963e8).**

- **Sub-project C closed 7 of the 9 deferred non-blocking testId gaps** (GAP-009, 010, 011, 012, 013, 019, 020). GAP-014 (DamagePipelineDiagram surfacing) and GAP-018 (in-app harness panel) remain explicitly out of scope.
- ~~**Phase 7 packaging blocked by GAP-001 (critical), GAP-007** (no backend cook, no progress UI).~~ **CLOSED in sub-project B (a8072e6).**

8 module-side blockers + 3 infra blockers = **11 blockers total — all closed in sub-project B.** Sub-project D can now execute the unmodified flow once sub-project C closes the remaining 9 non-blocking testId/UI gaps.

## 3. Module dependency wave order

Source of truth: `src/lib/feature-definitions.ts:9-35`. In-scope-only, topologically sorted, ignoring `arpg-inventory` (which is out of scope but transitively listed as a hard dep of `arpg-loot` and `arpg-ui` — see GAP-004 and GAP-008).

- **Wave 0 (no in-scope deps):** `project-setup`, `arpg-character`, `input-handling`, `packaging`
- **Wave 1 (depend on `arpg-character`):** `arpg-animation`, `arpg-gas`
- **Wave 2 (depend on Wave 0/1):** `arpg-combat` (needs `arpg-animation` + `arpg-gas`), `arpg-enemy-ai` (needs `arpg-character` + `arpg-gas`)
- **Wave 3 (depend on Wave 2 + flagged inventory cheat-path):** `arpg-loot`, `arpg-ui`

**Inventory exclusion note.** `feature-definitions.ts` declares `arpg-loot: [arpg-inventory, arpg-combat]` and `arpg-ui: [arpg-gas, arpg-inventory]`, but `arpg-inventory` is out of scope for the vertical slice. Both downstream modules must take a documented cheat-path that avoids the inventory dependency — see [modules/arpg-loot.md §5](./modules/arpg-loot.md) (GAP-004) and [modules/arpg-ui.md §5](./modules/arpg-ui.md) (GAP-008).

**`packaging` placement.** Although packaging has no formal feature-graph deps, in practice the operator runs it **last** (after all gameplay waves) — it's a Wave-0 module in the graph but a Wave-N+1 module in the operator flow.

## 4. Infrastructure surfaces

These cross-cutting PoF surfaces don't have dedicated `modules/*.md` files but are critical to the operator flow. Gaps prefixed `GAP-015..GAP-020`; testIds in [testid-coverage.md](./testid-coverage.md) under the **infra** block.

### Sidebar / module navigation

- **Files:** `src/components/layout/SidebarL1.tsx:24-67` (category buttons), `src/components/layout/SidebarL2.tsx` (sub-module buttons), `src/components/layout/Sidebar.tsx`
- **Role:** Operator clicks SidebarL1 to expand a category, then SidebarL2 to navigate to a sub-module.
- **State:** **Zero `data-testid` anywhere in the three sidebar files** (verified via Grep). Buttons identify category via `cat.id` and `aria-label` only.
- **Gaps:** GAP-015 (SidebarL1 buttons), GAP-016 (SidebarL2 buttons). Both blocking — without them Playwright cannot navigate.

### Project-setup wizard

Covered in [modules/project-setup.md](./modules/project-setup.md). 14 testIds proposed; gaps GAP-010..GAP-012 (all non-blocking — the wizard is reachable via sidebar even without testIds, but assertion of status state requires them).

### CLI terminal panel

- **Files:** `src/components/layout/CLIBottomPanel.tsx`, `src/components/layout/CLITabBar.tsx`, `src/components/cli/*.tsx` (11 files: `TerminalInput`, `TerminalOutput`, `TerminalHeader`, `CompactTerminal`, `InlineTerminal`, etc.)
- **Role:** Operator types prompts (TerminalInput), watches output for `@@CALLBACK:<id>` markers signalling task completion. Sessions live in `useCLIPanelStore` per `src/components/cli/store/cliPanelStore.ts`.
- **State:** **Zero `data-testid` across all 13 CLI/layout files** (verified via Grep).
- **Gaps:** GAP-017 — input textarea, send button, output container, active-session indicator, tab buttons. Blocking.

### Harness orchestrator

- **Files:** `src/lib/harness/*` (engine), `src/app/api/harness/route.ts` (API). Standalone runner: `npx tsx src/lib/harness/run-harness.ts`.
- **Role:** Autonomous batch execution of module checklists, useful as an alternative to clicking each module by hand.
- **State:** **No in-app UI panel.** The harness is invoked via the standalone CLI runner or by POSTing to `/api/harness { action: "start", projectPath, projectName, ueVersion }`.
- **Gaps:** GAP-018 — no in-app harness UI panel. Non-blocking for the slice (sub-project D can call the API directly), but limits usability of the app for non-CLI users.

### Feature matrix

- **Files:** `src/components/modules/shared/FeatureMatrix.tsx`
- **Role:** Per-module dashboard showing feature `implemented`/`partial`/`missing` status + per-feature quality stars + blocker chain. Used to assert "the slice features are now `implemented`."
- **State:** Spotty testIds. Heavy component, scan didn't find `data-testid` in the first 50 lines.
- **Gaps:** GAP-019 — row, status badge, quality-stars cell, scan button. Non-blocking but needed for clean assertions.

### Evaluator

- **Files:** `src/components/modules/evaluator/EvaluatorModule.tsx` + 25 sibling files in `src/components/modules/evaluator/`.
- **Role:** Runs 3-pass quality evaluation (structure → quality → performance) per `src/lib/evaluator/module-eval-prompts.ts`. Operator uses it to gate "module done" at quality ≥ 3/5.
- **State:** Many components; testId coverage spotty.
- **Gaps:** GAP-020 — module entry, run-evaluation button, result quality badge. Non-blocking but needed to assert "quality gate passed" without parsing DOM text.

## 5. Open questions for sub-project B

The per-module analysis agents surfaced these decisions for the user to make before sub-project B's brainstorm. Each blocks at least one gap-fix design choice.

1. **Inventory cheat-path strategy.** `arpg-loot` and `arpg-ui` formally depend on `arpg-inventory` per `src/lib/feature-definitions.ts:14-15`. Three options for sub-project B:
   - (a) Patch the prompts (GAP-004, GAP-008) to inline a no-inventory variant.
   - (b) Implement a minimal `UARPGInventoryComponent` stub so the existing prompts work unmodified — pulls `arpg-inventory` into the slice scope.
   - (c) Patch `feature-definitions.ts` to make `arpg-inventory` a soft dep when an "MVP" flag is set.

2. **Dummy-enemy mode (`arpg-enemy-ai`).** The module's prompts over-engineer the slice's needs (full BT + EQS + perception + 3 archetypes + waves). Two options:
   - (a) Add a "minimal dummy" quick action that asks for `AARPGEnemyBase` + ASC only — leaves the existing prompts intact.
   - (b) Refactor the enemy-ai checklist to expose per-feature toggles so the operator can skip BT/EQS/perception.

3. **Packaging cook execution (`GAP-001`).** This is the largest single piece of B work. Three options:
   - (a) Add `/api/packaging/execute` that spawns `RunUAT.bat` via `child_process.spawn`, streams stdout/stderr via Server-Sent Events to the UI.
   - (b) Reuse the existing CLI/harness pattern — push a synthetic CLI task that runs UAT, capture output back via the same `@@CALLBACK` mechanism.
   - (c) Skip the in-app cook entirely for sub-project D; spawn UAT from the Playwright runner directly, treat in-app cook as a non-slice gap.

4. **Sidebar testId convention.** The proposed `pof-sidebar-nav-item-{categoryId}` and `pof-sidebar-l2-nav-item-{subModuleId}` patterns interpolate IDs from the registry. Two design choices for sub-project C:
   - (a) Add testIds directly in `SidebarL1.tsx` + `SidebarL2.tsx` (centralised, ~6 lines).
   - (b) Lift to the registry so each entry carries its own testId — more invasive but lets module owners override.

5. **Sub-project D execution mode.** Once B + C close the blockers, D's harness can be:
   - (a) Pure scripted Playwright run (predictable, brittle if UI shifts).
   - (b) Exploratory crawl that takes screenshots at each step and uses vision to assert outcomes (resilient, slower).
   - (c) Hybrid: scripted for navigation, vision for "did the .exe actually run."

## 6. Per-module notes

- [project-setup](./modules/project-setup.md)
- [arpg-character](./modules/arpg-character.md)
- [input-handling](./modules/input-handling.md)
- [arpg-animation](./modules/arpg-animation.md)
- [arpg-gas](./modules/arpg-gas.md)
- [arpg-combat](./modules/arpg-combat.md)
- [arpg-enemy-ai](./modules/arpg-enemy-ai.md)
- [arpg-loot](./modules/arpg-loot.md)
- [arpg-ui](./modules/arpg-ui.md)
- [packaging](./modules/packaging.md)

## 7. Related documents

- Spec: [`docs/superpowers/specs/2026-05-19-arpg-vertical-slice-analysis-design.md`](../../superpowers/specs/2026-05-19-arpg-vertical-slice-analysis-design.md)
- Harness scenario context: [`docs/harness/harness-scenario.md`](../../harness/harness-scenario.md)
- Gap inventory: [gap-inventory.md](./gap-inventory.md)
- testId coverage: [testid-coverage.md](./testid-coverage.md)
