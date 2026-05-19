# testId Coverage — ARPG Vertical Slice

> Source of truth for sub-project C (testId coverage pass). Populated in Task 8 by hoisting "testId touchpoints" rows out of every `modules/*.md` file plus the infrastructure surfaces section of `INDEX.md`.

## Naming convention

**Pattern:** `pof-<surface>-<element>[-<modifier>]`, lowercase kebab.

| Surface examples | Element examples | Modifier examples |
|---|---|---|
| `sidebar`, `setup-wizard`, `cli-panel`, `harness`, `module-{moduleId}`, `feature-matrix` | `nav-item`, `submit-btn`, `path-input`, `start-btn`, `tab`, `row` | `{moduleId}`, `{rowKey}`, `{tabId}` |

**Rules:**

1. Stable across re-renders.
2. Never contain user data (no file paths, no usernames, no IDs derived from user input).
3. Unique within a page.
4. Existing testIds (≈102 occurrences across 30 files) are left alone unless a *new* testId would collide with one — collisions are logged as gap items, not silently renamed.

## Coverage by file

### `project-setup` (source: [modules/project-setup.md](./modules/project-setup.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/project-setup/SetupWizard.tsx` | Mode selector (Existing/Fresh tabs) | `pof-setup-wizard-tab-existing` | N | Navigate to open existing projects |
| `src/components/modules/project-setup/SetupWizard.tsx` | UE version pill (5.5/5.6/5.7) | `pof-setup-wizard-version-pill-{version}` | N | Select engine version |
| `src/components/modules/project-setup/SetupWizard.tsx` | Project list item button | `pof-setup-wizard-project-item-{projectName}` | N | Click to open detected project |
| `src/components/modules/project-setup/SetupWizard.tsx` | Project name input (Start Fresh) | `pof-setup-wizard-project-name-input` | N | Enter new project name |
| `src/components/modules/project-setup/SetupWizard.tsx` | Create & Launch button | `pof-setup-wizard-create-btn` | N | Submit new project creation |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Checklist container | `pof-setup-wizard-checklist` | N | Scroll/assert visible checklist items |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Engine status item | `pof-setup-wizard-checklist-item-engine` | N | Assert engine ✓ |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Tooling status items | `pof-setup-wizard-checklist-item-tool-{toolId}` | N | Assert tooling status (vs, msvc, wsdk, dotnet) |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Project path status | `pof-setup-wizard-checklist-item-path` | N | Assert project path ✓ |
| `src/components/modules/project-setup/StatusChecklist.tsx` | UE Project status | `pof-setup-wizard-checklist-item-uproject` | N | Assert .uproject found ✓ |
| `src/components/modules/project-setup/StatusChecklist.tsx` | Scan button | `pof-setup-wizard-scan-btn` | N | Trigger manual rescan |
| `src/components/modules/project-setup/CreateProjectPanel.tsx` | Create project button | `pof-setup-wizard-create-project-btn` | N | Trigger project scaffolding prompt |
| `src/components/modules/project-setup/BuildVerifyPanel.tsx` | Build & Verify button | `pof-setup-wizard-build-verify-btn` | N | Trigger build verification prompt |
| `src/components/modules/project-setup/ToolingBootstrapPanel.tsx` | Fix All Missing Tools button | `pof-setup-wizard-fix-tools-btn` | N | Trigger tool installation prompt |

### `input-handling` (source: [modules/input-handling.md](./modules/input-handling.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-1 (Define Enhanced Input Actions) | `pof-module-input-handling-checklist-item-ih-1` | N | Mark item complete after IA_Move + IA_Attack created |
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-2 (Create Input Mapping Context) | `pof-module-input-handling-checklist-item-ih-2` | N | Mark item complete after IMC_Default bound to controller |
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-3 (Implement key rebinding) | `pof-module-input-handling-checklist-item-ih-3` | N | Out of scope for slice; left unchecked |
| `src/components/modules/game-systems/InputView.tsx` | Checklist item ih-4 (Add gamepad support) | `pof-module-input-handling-checklist-item-ih-4` | N | Out of scope for slice; left unchecked |
| `src/components/modules/game-systems/InputView.tsx` | Checklist complete button | `pof-module-input-handling-complete-btn` | N | Submit checklist completion (only if ih-1 & ih-2 done) |

### `arpg-animation` (source: [modules/arpg-animation.md](./modules/arpg-animation.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/content/animations/AnimationChecklist.tsx` | Step card (aa-1 through aa-8) | `pof-module-arpg-animation-step-{stepId}` | N | No testIds in StepCard or ANIMATION_STEPS array |
| `src/components/modules/content/animations/AnimationChecklist.tsx` | Expand/collapse chevron | `pof-module-arpg-animation-toggle-{stepId}` | N | |
| `src/components/modules/content/animations/AnimationChecklist.tsx` | "Execute Process" button | `pof-module-arpg-animation-generate-{stepId}` | N | |
| `src/components/modules/content/animations/AnimationChecklist.tsx` | "Verify Complete" checkbox | `pof-module-arpg-animation-mark-{stepId}` | N | |
| `src/components/modules/content/animations/AnimationsView.tsx` | Setup Guide tab | `pof-module-arpg-animation-tab-setup` | N | |
| `src/components/modules/content/animations/AnimationsView.tsx` | State Machine tab | `pof-module-arpg-animation-tab-states` | N | |
| `src/components/modules/content/animations/AnimationsView.tsx` | Combo Designer tab | `pof-module-arpg-animation-tab-combo-ai` | N | |
| `src/components/modules/content/animations/AnimationsView.tsx` | Ask Claude tab | `pof-module-arpg-animation-tab-ask` | N | |

### `arpg-combat` (source: [modules/arpg-combat.md](./modules/arpg-combat.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx` | motion.div root | `pof-module-arpg-combat-choreography-editor` | N (existing `combat-choreography-editor` is non-conforming, see GAP-013) | Rename in sub-project C |
| `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx` | FlowTab / HitsTab / FeedbackTab | `pof-module-arpg-combat-tab-{flow|hits|feedback|metrics}` | N | Tabs lack any testIds today |

### `arpg-enemy-ai` (source: [modules/arpg-enemy-ai.md](./modules/arpg-enemy-ai.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel.tsx` | Archetype list | `pof-module-arpg-enemy-ai-archetype-list` | N | Display-only; useful for integration-test visibility |
| `src/components/modules/core-engine/dzin-panels/EnemyAITreePanel.tsx` | BT state cards | `pof-module-arpg-enemy-ai-bt-states` | N | Display-only |

### `arpg-loot` (source: [modules/arpg-loot.md](./modules/arpg-loot.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/design.tsx` | Loot editor UI root | `pof-module-arpg-loot-editor` | N | Optional — slice does not drive loot UI; pickup is purely UE5-side |

### `arpg-ui` (source: [modules/arpg-ui.md](./modules/arpg-ui.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/content/ui-hud/UIHudView.tsx` | Module root | `pof-module-arpg-ui` | N | Playwright entry point |
| `src/components/modules/content/ui-hud/DamageNumberPalette.tsx:39` | Color swatch panel | `damage-number-palette-panel` | Y | Existing non-conforming testId; design reference only — leave alone |
| `src/components/modules/content/ui-hud/LowHealthPulse.tsx:211` | Health threshold slider | `health-pct-slider` | Y | Existing non-conforming testId; design tool only — leave alone |

### `packaging` (source: [modules/packaging.md](./modules/packaging.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/game-systems/BuildConfigSelector.tsx` | Add-platform button | `pof-module-packaging-add-platform` | N | Adds a Win64/Linux/Mac profile |
| `src/components/modules/game-systems/BuildConfigSelector.tsx` | Config selector (Shipping option) | `pof-module-packaging-config-shipping` | N | Dropdown line 334; needed to ensure Shipping is selected |
| `src/components/modules/game-systems/PlatformProfileCard.tsx:92-99` | Green Package button | `pof-module-packaging-start-cook` | N | Click triggers cook — depends on GAP-001 backend |
| `src/components/modules/game-systems/PlatformProfileCard.tsx` | Cook status badge | `pof-module-packaging-status` | N | Cook output state (idle/running/success/failed) — depends on GAP-007 |
| `src/components/modules/game-systems/BuildHistoryDashboard.tsx:135-139` | Build output path | `pof-module-packaging-exe-path` | N | Playwright reads to launch the .exe in sub-project D |

### `arpg-character`

_(no Playwright-touched controls in this module — vertical-slice deliverable is C++ output verified in UE5, not PoF UI interaction.)_

### `arpg-gas`

_(no Playwright-touched controls in this module — GAS authoring UI is design/debug only; deliverable is C++ output verified in packaged build.)_

### `infra` — cross-cutting surfaces (source: [INDEX.md §4](./INDEX.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/layout/SidebarL1.tsx:30-44` | Category nav button (one per CATEGORIES entry) | `pof-sidebar-nav-item-{categoryId}` | N | Operator clicks to expand a category (GAP-015) |
| `src/components/layout/SidebarL2.tsx` | Sub-module nav button (one per sub-module) | `pof-sidebar-l2-nav-item-{subModuleId}` | N | Operator clicks to navigate to module page (GAP-016) |
| `src/components/cli/TerminalInput.tsx` | Prompt textarea | `pof-cli-panel-input` | N | Where operator types module prompts (GAP-017) |
| `src/components/cli/TerminalInput.tsx` | Send/submit button | `pof-cli-panel-send-btn` | N | Submits the prompt (GAP-017) |
| `src/components/cli/TerminalOutput.tsx` | Output stream container | `pof-cli-panel-output` | N | Operator reads for `@@CALLBACK:<id>` markers (GAP-017) |
| `src/components/layout/CLITabBar.tsx` | Tab buttons | `pof-cli-panel-tab-{tabId}` | N | Switch between CLI sessions (GAP-017) |
| `src/components/cli/TerminalHeader.tsx` | Running indicator | `pof-cli-panel-running-indicator` | N | Read to know when a session finished (GAP-017) |
| `src/app/api/harness/route.ts` | (API only — no UI) | _(POST endpoint)_ | N/A | Sub-project D calls `/api/harness` directly until GAP-018 is closed |
| `src/components/modules/shared/FeatureMatrix.tsx` | Feature row | `pof-feature-matrix-row-{featureName}` | N | Identify a single feature row (GAP-019) |
| `src/components/modules/shared/FeatureMatrix.tsx` | Status badge cell | `pof-feature-matrix-status-{featureName}` | N | Read implemented/partial/missing (GAP-019) |
| `src/components/modules/shared/FeatureMatrix.tsx` | Quality stars cell | `pof-feature-matrix-quality-{featureName}` | N | Read quality 1-5 (GAP-019) |
| `src/components/modules/shared/FeatureMatrix.tsx` | Scan/refresh button | `pof-feature-matrix-scan-btn` | N | Trigger feature-matrix scan (GAP-019) |
| `src/components/modules/evaluator/EvaluatorModule.tsx` | Module root | `pof-module-evaluator` | N | Playwright entry (GAP-020) |
| `src/components/modules/evaluator/EvaluatorModule.tsx` | Run-evaluation button | `pof-module-evaluator-run-btn` | N | Triggers 3-pass eval (GAP-020) |
| `src/components/modules/evaluator/EvaluatorModule.tsx` | Result quality badge | `pof-module-evaluator-result-quality` | N | Read the 1-5 score for assertion (GAP-020) |

## Summary

**Total proposed testIds: 55** (40 per-module + 15 infra)

**Currently present (Y): 2** — both pre-existing non-conforming testIds in `arpg-ui` design tools (`damage-number-palette-panel`, `health-pct-slider`); left alone per convention rule 4.

**Currently missing (N): 53** — sub-project C's work.

**By surface:**
- `setup-wizard`: 14 testIds, all missing
- `module-input-handling`: 5 testIds, all missing
- `module-arpg-animation`: 8 testIds, all missing
- `module-arpg-combat`: 2 testIds, both missing (1 has non-conforming existing testId — see GAP-013)
- `module-arpg-enemy-ai`: 2 testIds, both missing
- `module-arpg-loot`: 1 testId, missing (optional)
- `module-arpg-ui`: 3 testIds (1 missing, 2 existing non-conforming — left alone)
- `module-packaging`: 5 testIds, all missing
- `sidebar`: 1 pattern (interpolated per category, all missing)
- `sidebar-l2`: 1 pattern (interpolated per sub-module, missing)
- `cli-panel`: 5 testIds, all missing
- `feature-matrix`: 4 testIds, all missing
- `module-evaluator`: 3 testIds, all missing

**Cross-references:** Each row notes the related `GAP-NNN` from [gap-inventory.md](./gap-inventory.md). Sub-project C closes the testId-missing gaps; sub-project B closes the prompt/api/ui gaps.
