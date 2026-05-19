# Gap Inventory — ARPG Vertical Slice

> Source of truth for sub-project B (gap-fix). Populated in Task 7 by hoisting "Gaps blocking the slice" bullets out of every `modules/*.md` file.

## Schema

| Column | Values |
|---|---|
| **ID** | `GAP-NNN`, monotonic, never reused |
| **Module** | One of: `project-setup`, `arpg-character`, `input-handling`, `arpg-animation`, `arpg-gas`, `arpg-combat`, `arpg-enemy-ai`, `arpg-loot`, `arpg-ui`, `packaging`, `infra` (cross-cutting) |
| **Category** | `testId-missing`, `prompt-defect`, `ui-missing`, `api-missing`, `harness-verifier`, `behavior-bug`, `docs-stale` |
| **Severity** | `S` (≤30 min), `M` (≤2 hrs), `L` (>2 hrs) |
| **Blocking?** | `Y` blocks vertical slice; `N` nice-to-have for later |
| **Title** | one-line "what + why" |
| **Notes / file:line** | citations into source |

## Gaps

| ID | Module | Category | Severity | Blocking? | Title | Notes / file:line |
|----|--------|----------|----------|-----------|-------|-------------------|
| GAP-001 | packaging | api-missing | L | Y | **(closed in a8072e6)** No `/api/packaging/execute` endpoint — cook can only run via CLI/Bash; Playwright cannot automate. Sub-project B must add backend route to spawn UAT, stream output, persist .exe path. | `src/app/api/packaging/route.ts` *(missing)*; current trigger at `src/components/modules/game-systems/BuildConfigSelector.tsx:120-124` dispatches via `useModuleCLI.sendPrompt()` |
| GAP-002 | arpg-combat | behavior-bug | M | Y | **(closed in 0c0274c)** Hit deduplication may not persist across the swing window if the TSet is cleared mid-notify. | `src/lib/evaluator/module-eval-prompts.ts:123` |
| GAP-003 | arpg-combat | behavior-bug | M | Y | **(closed in 0c0274c)** Death flow must use `State.Dead` tag to block all abilities — current spec only disables input. | `src/lib/evaluator/module-eval-prompts.ts:122`, `src/lib/feature-definitions.ts:209` |
| GAP-004 | arpg-loot | prompt-defect | M | Y | **(closed in 0c0274c)** Checklist items al-5/al-6 assume `arpg-inventory` (out of scope). Need cheat-path variant: spawn `AARPGWorldItem` with auto-cleanup timer + overlap-destroy "+gold" effect, no inventory call. | `src/lib/module-registry.ts:231-232`, `src/lib/feature-definitions.ts:14` |
| GAP-005 | input-handling | prompt-defect | M | Y | **(closed in 0c0274c)** Checklist ih-1 prompt over-scopes inputs (`IA_Jump`/`IA_Interact`/`IA_Dodge`/`IA_Sprint`/`IA_Pause`/`IA_ToggleInventory`); slice needs only `IA_Move` + `IA_Attack`. | `src/lib/module-registry.ts:862` |
| GAP-006 | input-handling | prompt-defect | M | Y | **(closed in 0c0274c)** Checklist ih-2 prompt references "all gameplay actions" + features (Jump, Interact, Sprint, Dodge) not in slice scope. | `src/lib/module-registry.ts:863` |
| GAP-007 | packaging | ui-missing | M | Y | **(closed in a8072e6)** No real-time cook output / CookProgress component in `PackagingView` — cook status (phase, %, warnings, .exe path) is invisible to Playwright. | `src/components/modules/game-systems/PackagingView.tsx:26-43` |
| GAP-008 | arpg-ui | prompt-defect | S | Y | **(closed in 0c0274c)** Confirm whether checklist au-1/au-2/au-3/au-4/au-7 (HUD + GAS-bound + floating damage) can be completed without doing au-5/au-6 (inventory + character stats, which depend on `arpg-inventory` — out of scope). If prompts can't isolate, upgrade severity. | `src/lib/feature-definitions.ts:15`, `src/lib/module-registry.ts:237-246` |
| GAP-009 | input-handling | testId-missing | L | N | **(closed in 0ebc6f2 + 78963e8)** InputView checklist items in `ReviewableModuleView` lack `pof-module-input-handling-checklist-item-${itemId}` testIds. — Actually applied in shared `RoadmapChecklist.tsx` (both Cards + Compact layouts) since that's where rows render. | `src/components/modules/shared/RoadmapChecklist.tsx` |
| GAP-010 | project-setup | testId-missing | M | N | **(closed in 0ebc6f2)** SetupWizard tabs (Existing/Fresh), version pills, project list items, name input, and Create/Launch button all lack testIds. | `src/components/modules/project-setup/SetupWizard.tsx:144-230` |
| GAP-011 | project-setup | testId-missing | M | N | **(closed in 0ebc6f2)** StatusChecklist items (engine, tooling, path, .uproject) and Scan button lack testIds for assertion. | `src/components/modules/project-setup/StatusChecklist.tsx:50-160` |
| GAP-012 | project-setup | testId-missing | M | N | **(closed in 0ebc6f2)** CreateProjectPanel, BuildVerifyPanel, and ToolingBootstrapPanel action buttons lack testIds. | `src/components/modules/project-setup/CreateProjectPanel.tsx:46-65`, `src/components/modules/project-setup/BuildVerifyPanel.tsx:21-150`, `src/components/modules/project-setup/ToolingBootstrapPanel.tsx:1-44` |
| GAP-013 | arpg-combat | testId-missing | S | N | **(closed in bbca96c)** CombatActionMap interactive elements lack `pof-module-arpg-combat-*` testIds. Existing `data-testid="combat-choreography-editor"` is non-conforming. — Tab testIds added via locally-cloned SubTabNavigation; CombatChoreographyEditor root renamed to conforming name. | `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx`, `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx` |
| GAP-014 | arpg-combat | ui-missing | S | N | DamagePipelineDiagram exists but is not surfaced inside the `arpg-combat` module tabs — only referenced generically in core-engine. | `src/components/modules/core-engine/unique-tabs/DamagePipelineDiagram/index.tsx` |
| GAP-015 | infra | testId-missing | M | Y | **(closed in 3e3df3f)** SidebarL1 category nav buttons have no testIds — Playwright can't reliably click into a category. | `src/components/layout/SidebarL1.tsx:30-44` |
| GAP-016 | infra | testId-missing | M | Y | **(closed in 3e3df3f)** SidebarL2 sub-module nav buttons have no testIds — Playwright can't navigate to a sub-module page. | `src/components/layout/SidebarL2.tsx` |
| GAP-017 | infra | testId-missing | M | Y | **(closed in 3e3df3f)** CLI panel (`TerminalInput`, send button, `TerminalOutput`, tab bar) has no testIds — Playwright can't drive CLI prompts or read responses. | `src/components/layout/CLIBottomPanel.tsx`, `src/components/layout/CLITabBar.tsx`, `src/components/cli/TerminalInput.tsx`, `src/components/cli/TerminalOutput.tsx`, `src/components/cli/TerminalHeader.tsx` |
| GAP-018 | infra | ui-missing | L | N | No in-app harness orchestrator panel — only the standalone CLI runner and the POST `/api/harness` endpoint exist. Sub-project D can call the API directly; non-blocking but limits non-CLI usage. | `src/lib/harness/`, `src/app/api/harness/route.ts` |
| GAP-019 | infra | testId-missing | M | N | **(closed in 0ebc6f2)** FeatureMatrix rows, status badges, quality-star cells, scan button lack testIds — needed for assertion of "slice features are now implemented." | `src/components/modules/shared/FeatureMatrix.tsx` |
| GAP-020 | infra | testId-missing | M | N | **(closed in 0ebc6f2 + 78963e8)** Evaluator module nav, run-evaluation button, result-quality badge lack testIds. — Module root in EvaluatorModule.tsx; run-btn + result-summary + result-findings-count in DeepEvalResults.tsx (the actual eval is severity/findings-based, not a 1-5 quality score; substituted result-summary + findings-count for what the spec called result-quality). | `src/components/modules/evaluator/EvaluatorModule.tsx`, `src/components/modules/evaluator/DeepEvalResults.tsx` |

## Summary

**Total gaps: 20** (14 module + 6 infra)

**By blocking status:**
- Blocking the vertical slice (Y): **11** _(all closed in sub-project B)_
- Non-blocking (N): **9** — 7 closed in sub-project C (GAP-009, 010, 011, 012, 013, 019, 020); 2 remain open: GAP-014 (DamagePipelineDiagram surfacing) and GAP-018 (in-app harness panel), both explicitly out of C's scope.

**Initiative status: 18/20 gaps closed (11 in B, 7 in C). 2 deferred non-blockers remain.**

**By severity:**
- L (>2 hrs): 3
- M (≤2 hrs): 15
- S (≤30 min): 2

**By category:**
- `testId-missing`: 10 (3 blocking, 7 non-blocking)
- `prompt-defect`: 4 (all blocking)
- `behavior-bug`: 2 (both blocking)
- `ui-missing`: 3 (1 blocking — packaging CookProgress)
- `api-missing`: 1 (blocking — packaging cook endpoint)
- `harness-verifier`: 0
- `docs-stale`: 0

**By module (count, then blockers):**
- `infra`: 6 gaps / 3 blockers
- `packaging`: 2 gaps / 2 blockers
- `arpg-combat`: 4 gaps / 2 blockers
- `input-handling`: 3 gaps / 2 blockers
- `project-setup`: 3 gaps / 0 blockers
- `arpg-loot`: 1 gap / 1 blocker
- `arpg-ui`: 1 gap / 1 blocker
- `arpg-animation`: 0 gaps
- `arpg-character`: 0 gaps
- `arpg-gas`: 0 gaps
- `arpg-enemy-ai`: 0 gaps (1 open question — see INDEX §5 item 2)
