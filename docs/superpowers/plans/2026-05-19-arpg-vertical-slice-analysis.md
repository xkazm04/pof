# ARPG Vertical-Slice Analysis — Implementation Plan (Sub-project A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce 13 markdown files under `docs/features/arpg-vertical-slice/` that map the vertical-slice scenario, inventory every gap, and inventory every needed `data-testid` — so sub-projects B (gap-fix), C (testId coverage), and D (Playwright execution) can be sized and planned with full information.

**Architecture:** Skeleton-then-fill. Main thread writes the three top-level skeleton docs (`INDEX.md`, `gap-inventory.md`, `testid-coverage.md`). A single tool-call batch dispatches 10 parallel `Explore` sub-agents — one per game-side module — each producing one short module note. Main thread then consolidates: cross-links from `INDEX.md`, hoists per-module gap bullets into the central inventory, hoists per-module testId rows into the central coverage map. Self-review enforces no dangling refs and ≤100 lines per module file. Single commit lands all 13 files.

**Tech Stack:** Markdown + git only. No source-file edits outside `docs/features/arpg-vertical-slice/`. `Explore` agents are read-only (Glob, Grep, Read, WebFetch, WebSearch).

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-analysis-design.md`

---

## File Structure (what this plan produces)

```
docs/features/arpg-vertical-slice/
├── INDEX.md                       # Main-thread; scenario map + cross-refs to inventory & coverage
├── gap-inventory.md               # Main-thread; populated from agent outputs in Task 7
├── testid-coverage.md             # Main-thread; populated from agent outputs in Task 8
└── modules/
    ├── project-setup.md           # Agent #1
    ├── arpg-character.md          # Agent #2
    ├── input-handling.md          # Agent #3
    ├── arpg-animation.md          # Agent #4
    ├── arpg-gas.md                # Agent #5
    ├── arpg-combat.md             # Agent #6
    ├── arpg-enemy-ai.md           # Agent #7
    ├── arpg-loot.md               # Agent #8
    ├── arpg-ui.md                 # Agent #9
    └── packaging.md               # Agent #10
```

Total: 13 files. Single commit at the end.

---

## Per-module deliverable table

The agent brief in Task 6 substitutes the per-module fields below. Keep this table next to the brief when reading.

| # | Module ID | UE5 deliverable for the vertical slice | Cross-module dep note |
|---|-----------|----------------------------------------|------------------------|
| 1 | `project-setup` | UE5 project at `C:\Users\kazda\Documents\Unreal Projects\PoF` is detected by PoF, build is verified green, project context loaded into the app | — |
| 2 | `arpg-character` | `AARPGCharacterBase` C++ class with `UCharacterMovementComponent` + camera + spring arm; spawns in PIE level | — |
| 3 | `input-handling` | Enhanced Input `IA_Move` + `IA_Attack` actions, `IMC_Default` mapping context, bound to the character | — |
| 4 | `arpg-animation` | `UARPGAnimInstance` with locomotion blend space + one attack montage; AnimBP wired to character | depends on #2 |
| 5 | `arpg-gas` | `UAbilitySystemComponent` on character, `UARPGAttributeSet` with `Health`/`MaxHealth`/`Damage`, `GE_Damage` gameplay effect | depends on #2 |
| 6 | `arpg-combat` | `GA_MeleeAttack` ability: plays montage, hit-detects via trace on notify, applies `GE_Damage` to target's ASC | depends on #4, #5 |
| 7 | `arpg-enemy-ai` | `AARPGEnemyBase` with ASC, no movement — stands still, takes damage, dies (Health ≤ 0 → destroy) | depends on #2, #5; flag if it needs more than minimal AI |
| 8 | `arpg-loot` | One loot-table data asset; on enemy death, spawn one `AARPGWorldItem` pickup at death location | depends on #6; **flag that PoF feature-definitions says this also depends on `arpg-inventory` (out of scope) — note the cheat-path for the primitive slice** |
| 9 | `arpg-ui` | HUD widget with health bar bound to ASC `Health` attribute, plus floating damage numbers on hits | depends on #5; **flag that feature-definitions says this depends on `arpg-inventory` (out of scope) — note we only need the GAS-bound health bar for the slice** |
| 10 | `packaging` | PoF packaging panel can cook + package a Win64 Shipping build that launches the level | — |

---

## Task 1: Create the output directory tree

**Files:**
- Create: `docs/features/arpg-vertical-slice/`
- Create: `docs/features/arpg-vertical-slice/modules/`

- [ ] **Step 1: Create directories**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path "docs\features\arpg-vertical-slice\modules" | Out-Null
Test-Path "docs\features\arpg-vertical-slice\modules"
```
Expected output: `True`

- [ ] **Step 2: Verify**

Run:
```powershell
Get-ChildItem docs\features\arpg-vertical-slice -Recurse
```
Expected: shows `modules` subdirectory, no files.

---

## Task 2: Write `INDEX.md` skeleton

**Files:**
- Create: `docs/features/arpg-vertical-slice/INDEX.md`

- [ ] **Step 1: Write skeleton**

Use the Write tool to create `docs/features/arpg-vertical-slice/INDEX.md` with this exact content:

````markdown
# ARPG Vertical Slice — Readiness Map

> Scenario: drive the PoF UI (via Playwright/MCP) to produce a packaged Win64 build of an ARPG vertical slice — WASD move, melee attack, kill dummy enemy, see loot drop on death. Sub-project A deliverable; feeds B/C/D.

## 1. Vertical-slice success criteria

- [ ] PIE: WASD moves the character on a flat level with collisions.
- [ ] PIE: LMB triggers the attack ability; attack montage plays.
- [ ] PIE: Attack hits a dummy enemy at melee range and reduces its Health attribute.
- [ ] PIE: Enemy with Health ≤ 0 is destroyed; one loot pickup actor spawns at its death location.
- [ ] Packaged Win64 Shipping build launches as a standalone .exe and the player can perform all of the above outside the editor.

## 2. End-to-end Playwright operator flow

> Each numbered step lists: target PoF screen → testIds clicked → expected PoF outcome → expected UE5 artifact. testId names are stable and defined in [testid-coverage.md](./testid-coverage.md).

_(Filled in Task 9.)_

## 3. Module dependency wave order

_(Filled in Task 10.)_

## 4. Infrastructure surfaces

_(Filled in Task 11. Covers cross-cutting PoF surfaces — sidebar, project-setup wizard, CLI panel, harness UI/API, feature matrix, evaluator — that don't get their own `modules/*.md`.)_

## 5. Open questions for sub-project B

_(Filled in Task 12. Anything the per-module agents surfaced that needs a human call before B's brainstorm.)_

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
````

- [ ] **Step 2: Verify file exists**

Run:
```powershell
Test-Path "docs\features\arpg-vertical-slice\INDEX.md"
```
Expected: `True`

---

## Task 3: Write `gap-inventory.md` skeleton

**Files:**
- Create: `docs/features/arpg-vertical-slice/gap-inventory.md`

- [ ] **Step 1: Write skeleton**

Use the Write tool to create `docs/features/arpg-vertical-slice/gap-inventory.md` with exactly this content:

````markdown
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

_(Rows added in Task 7.)_

## Summary

_(Filled in Task 12 — totals by category, by severity, by blocking.)_
````

- [ ] **Step 2: Verify**

Run:
```powershell
Test-Path "docs\features\arpg-vertical-slice\gap-inventory.md"
```
Expected: `True`

---

## Task 4: Write `testid-coverage.md` skeleton

**Files:**
- Create: `docs/features/arpg-vertical-slice/testid-coverage.md`

- [ ] **Step 1: Write skeleton**

Use the Write tool to create `docs/features/arpg-vertical-slice/testid-coverage.md` with exactly this content:

````markdown
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

_(Tables added in Task 8 — one block per touched file.)_

## Summary

_(Filled in Task 12 — counts by surface, missing vs. present.)_
````

- [ ] **Step 2: Verify**

Run:
```powershell
Test-Path "docs\features\arpg-vertical-slice\testid-coverage.md"
```
Expected: `True`

---

## Task 5: Verify all three skeleton files render & link correctly

- [ ] **Step 1: Check files exist + line counts are sensible**

Run:
```powershell
Get-ChildItem docs\features\arpg-vertical-slice -File | Select-Object Name, Length
```
Expected: 3 files (`INDEX.md`, `gap-inventory.md`, `testid-coverage.md`), each > 500 bytes.

- [ ] **Step 2: Spot-check that INDEX.md links to the other two**

Run:
```powershell
Select-String -Path "docs\features\arpg-vertical-slice\INDEX.md" -Pattern "gap-inventory.md|testid-coverage.md" | Format-Table LineNumber, Line -Wrap
```
Expected: at least 2 matches (one for each file).

---

## Task 6: Dispatch 10 parallel module-analysis agents

**This is the heavy lifting. Use a single message containing 10 `Agent` tool calls in parallel, all with `subagent_type: "Explore"`.**

The brief template below is used for every agent. Substitute the four `{{...}}` fields per row of the per-module deliverable table at the top of this plan.

### Agent brief template

```
ROLE: You are dispatched as an Explore-type sub-agent to perform read-only analysis of one PoF module. Your output is a single markdown file. You write code? No — you only Glob/Grep/Read and produce one markdown file via the Write tool.

CONTEXT: PoF (Pillars of Fortune) is a Next.js 16 web app that helps a developer build a UE5 ARPG. The parent task is preparing a vertical-slice scenario where Claude drives PoF's UI via Playwright/MCP to produce a packaged UE5 build. You are analyzing module `{{moduleId}}` to produce its readiness note. Other agents are doing the same for 9 other modules in parallel — do not analyze anything outside `{{moduleId}}`.

VERTICAL-SLICE SUCCESS CRITERIA:
- PIE: WASD moves the character on a flat level with collisions.
- PIE: LMB triggers the attack ability; attack montage plays.
- PIE: Attack hits a dummy enemy at melee range and reduces its Health attribute.
- PIE: Enemy with Health ≤ 0 is destroyed; one loot pickup actor spawns at its death location.
- Packaged Win64 Shipping build launches as a standalone .exe and the player can perform all of the above outside the editor.

YOUR MODULE'S IN-SCOPE UE5 DELIVERABLE:
{{deliverable}}

CROSS-MODULE DEPENDENCY NOTE:
{{depNote}}

YOUR TASK: Write the file `docs/features/arpg-vertical-slice/modules/{{moduleId}}.md` using the 6-section template below. Hard cap: ~100 lines. Use the Write tool, not just summary text.

TEMPLATE (copy literally, fill bracket placeholders):

---START-OF-FILE---
# `{{moduleId}}` — vertical-slice readiness

## 1. One-line purpose

[What this module does inside PoF, in one sentence.]

## 2. Files of record

- **UI:** `src/components/modules/.../[Component].tsx:Lstart-Lend` — [one-line role]
- **API routes (if any):** `src/app/api/.../route.ts` — [one-line role]
- **Prompt builders (if any):** `src/lib/prompts/[file].ts` — [one-line role]
- **Module registry entry:** `src/lib/module-registry.ts:Lstart-Lend` (checklist items, quick actions)
- **Store slice (if any):** `src/stores/[store].ts:Lstart-Lend` — [one-line role]
- **Feature definitions:** `src/lib/feature-definitions.ts:Lstart-Lend`
- **Evaluator prompts (if any):** `src/lib/evaluator/module-eval-prompts.ts:Lstart-Lend`

Cite `file:line` for every claim. If a category does not apply to this module, write "_(none)_".

## 3. Vertical-slice relevance

Required UE5 artifact: **{{deliverable}}**

Acceptance bullets for this module specifically:
- [ ] [bullet 1 — concrete check the operator can verify in UE5]
- [ ] [bullet 2]
- [ ] [bullet 3 — if more needed]

## 4. Current state

[2-4 sentences: what already works in PoF for this module. Reference module-registry checklist completion percentage if visible; reference the harness scenario doc (`docs/harness/harness-scenario.md`) for any "Current Project State" notes about this module.]

## 5. Gaps blocking the slice

Format: `(severity: S|M|L) (blocking: Y|N) (category: testId-missing|prompt-defect|ui-missing|api-missing|harness-verifier|behavior-bug|docs-stale) — title. Notes: file:line.`

- (severity: ?) (blocking: ?) (category: ?) — [first gap]. Notes: [path:line].
- [add as many as found; if none, write a single line "_(no gaps blocking the vertical slice)_"]

## 6. testId touchpoints

Per row: `pof-<surface>-<element>[-<modifier>]` per the convention.

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/.../X.tsx` | `<Button>Submit</Button>` | `pof-...` | N | [why needed] |

If the operator will not interact with anything in this module's UI surface (e.g., the module is purely backend-driven), write "_(no Playwright-touched controls in this module)_" and skip the table.
---END-OF-FILE---

CONSTRAINTS:
- Hard cap ~100 lines. If you blow past 110, trim the lowest-value content.
- Every claim about behavior must cite `file:line`. No "the registry probably does X" — Read it and cite.
- Do NOT modify any source file. Do NOT add testIds. Do NOT fix gaps you find. You are producing a *report*; sub-project B fixes things.
- testIds you propose follow the convention exactly. If a testId currently exists on a target component with a non-conforming name, log it as a `testId-missing` gap with `category` note "exists but non-conforming" instead of marking it present.
- The `Currently present?` column is `Y` only when the *exact* proposed testId string already appears at the target file. Otherwise `N`.

OUTPUT: Use the Write tool to create `docs/features/arpg-vertical-slice/modules/{{moduleId}}.md`. Return a short (<10 line) chat summary: number of gaps found, number of testId rows proposed, any cross-module surprises.
```

### Dispatch matrix

Substitute these into the template (`{{moduleId}}`, `{{deliverable}}`, `{{depNote}}` from the per-module deliverable table at the top of this plan):

| Agent | moduleId | deliverable | depNote |
|---|---|---|---|
| 1 | `project-setup` | UE5 project at `C:\Users\kazda\Documents\Unreal Projects\PoF` is detected by PoF, build is verified green, project context loaded into the app | none |
| 2 | `arpg-character` | `AARPGCharacterBase` C++ class with `UCharacterMovementComponent` + camera + spring arm; spawns in PIE level | none |
| 3 | `input-handling` | Enhanced Input `IA_Move` + `IA_Attack` actions, `IMC_Default` mapping context, bound to the character | none |
| 4 | `arpg-animation` | `UARPGAnimInstance` with locomotion blend space + one attack montage; AnimBP wired to character | depends on `arpg-character` |
| 5 | `arpg-gas` | `UAbilitySystemComponent` on character, `UARPGAttributeSet` with `Health`/`MaxHealth`/`Damage`, `GE_Damage` gameplay effect | depends on `arpg-character` |
| 6 | `arpg-combat` | `GA_MeleeAttack` ability that plays the attack montage, hit-detects via trace on notify, applies `GE_Damage` to target's ASC | depends on `arpg-animation`, `arpg-gas` |
| 7 | `arpg-enemy-ai` | `AARPGEnemyBase` with ASC, no movement — stands still, takes damage, dies (Health ≤ 0 → destroy) | depends on `arpg-character`, `arpg-gas`; flag explicitly if it requires more than minimal AI for the slice |
| 8 | `arpg-loot` | One loot-table data asset; on enemy death, spawn one `AARPGWorldItem` pickup at the death location | depends on `arpg-combat`; **`feature-definitions.ts` also lists `arpg-inventory` as a dep (out of scope) — explicitly flag the minimal cheat-path that avoids needing a full inventory system** |
| 9 | `arpg-ui` | HUD widget with health bar bound to ASC `Health` attribute, plus floating damage numbers on hits | depends on `arpg-gas`; **`feature-definitions.ts` also lists `arpg-inventory` as a dep (out of scope) — explicitly flag that for the slice we only need GAS-bound HUD elements, no inventory screen** |
| 10 | `packaging` | PoF packaging panel can cook + package a Win64 Shipping build that launches the level | none |

- [ ] **Step 1: Dispatch all 10 agents in one tool-call batch**

Send a single message with 10 `Agent` tool calls. Each call:
- `subagent_type`: `"Explore"`
- `description`: `"Analyze <moduleId> for vertical slice"` (short)
- `prompt`: the template above with the four `{{...}}` fields substituted

All 10 are independent — do not chain.

- [ ] **Step 2: Wait for all 10 to return**

Each returns a short chat summary. Capture them — they'll inform Task 12.

- [ ] **Step 3: Verify all 10 files exist**

Run:
```powershell
Get-ChildItem docs\features\arpg-vertical-slice\modules -File | Select-Object Name, Length | Format-Table
```
Expected: 10 files, each between ~2 KB and ~6 KB (≤100 lines).

- [ ] **Step 4: If any agent failed, re-dispatch just that one**

For any missing or zero-byte file, re-run the same brief for that module only. Do not move on with missing files.

---

## Task 7: Hoist module gap bullets into `gap-inventory.md`

**Files:**
- Modify: `docs/features/arpg-vertical-slice/gap-inventory.md`

- [ ] **Step 1: Read every module file's Section 5 ("Gaps blocking the slice")**

Run:
```powershell
Get-ChildItem docs\features\arpg-vertical-slice\modules\*.md | ForEach-Object { Write-Output "=== $($_.Name) ==="; Get-Content $_ | Select-String -Pattern '^## 5\. Gaps blocking the slice$' -Context 0,40 }
```
Captures section 5 of every module file.

- [ ] **Step 2: Build the row list mentally**

For every bullet found, build a row:
- `ID` = next free `GAP-NNN` starting at `GAP-001`
- `Module` = source module ID
- `Category`, `Severity`, `Blocking?`, `Title`, `Notes` = parsed from the bullet's `(category: ...) (severity: ...) (blocking: ...) — title. Notes: ...` format

Sort the resulting rows by `Blocking?` (Y first), then `Severity` (L > M > S), then `Module` alphabetical.

- [ ] **Step 3: Replace the `_(Rows added in Task 7.)_` placeholder**

Use the Edit tool on `docs/features/arpg-vertical-slice/gap-inventory.md`. Replace:

```
| ID | Module | Category | Severity | Blocking? | Title | Notes / file:line |
|----|--------|----------|----------|-----------|-------|-------------------|

_(Rows added in Task 7.)_
```

…with the same header + the sorted row list (no `_(Rows added in Task 7.)_` line).

- [ ] **Step 4: Verify**

Run:
```powershell
Select-String -Path "docs\features\arpg-vertical-slice\gap-inventory.md" -Pattern "^\| GAP-" | Measure-Object | Select-Object -ExpandProperty Count
```
Expected: ≥ number of gap bullets across module files (sanity check — the count should match the number of `- (severity:` bullets you found in Step 1).

---

## Task 8: Hoist module testId rows into `testid-coverage.md`

**Files:**
- Modify: `docs/features/arpg-vertical-slice/testid-coverage.md`

- [ ] **Step 1: Read every module file's Section 6 ("testId touchpoints")**

Run:
```powershell
Get-ChildItem docs\features\arpg-vertical-slice\modules\*.md | ForEach-Object { Write-Output "=== $($_.Name) ==="; Get-Content $_ | Select-String -Pattern '^## 6\. testId touchpoints$' -Context 0,40 }
```

- [ ] **Step 2: Replace the `_(Tables added in Task 8 — one block per touched file.)_` placeholder**

Build one markdown block per module that has any testId rows. Skip modules that wrote "_(no Playwright-touched controls in this module)_".

Each block uses this format:

````markdown
### `{moduleId}` (source: [modules/{moduleId}.md](./modules/{moduleId}.md))

| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| ... rows verbatim from the module file ... |
````

Use the Edit tool on `docs/features/arpg-vertical-slice/testid-coverage.md` to replace `_(Tables added in Task 8 — one block per touched file.)_` with the concatenated blocks.

- [ ] **Step 3: Verify**

Run:
```powershell
Select-String -Path "docs\features\arpg-vertical-slice\testid-coverage.md" -Pattern "^\| `pof-" | Measure-Object | Select-Object -ExpandProperty Count
```
Expected: ≥ number of testId rows across module files.

---

## Task 9: Fill `INDEX.md` Section 2 — End-to-end Playwright operator flow

**Files:**
- Modify: `docs/features/arpg-vertical-slice/INDEX.md`

- [ ] **Step 1: Draft the numbered flow from the per-module deliverable table + the agents' testId rows**

The flow walks a single PoF session end-to-end. Approximate skeleton (refine using actual testIds from `testid-coverage.md`):

1. Open PoF → click sidebar nav to **Project Setup** (testId: `pof-sidebar-nav-item-project-setup`)
2. Setup Wizard: enter UE5 project path (testId: `pof-setup-wizard-path-input`) → click "Verify" (testId: `pof-setup-wizard-verify-btn`) → expect green status badge.
3. Navigate to **arpg-character** module (testId: `pof-sidebar-nav-item-arpg-character`); run checklist items via CLI panel (testId: `pof-cli-panel-send-btn`) → expect new C++ class files in UE5 project.
4. Repeat for: input-handling, arpg-animation, arpg-gas, arpg-combat, arpg-enemy-ai, arpg-loot, arpg-ui (each step lists the module's primary checklist items + expected UE5 artifacts).
5. Navigate to **Evaluator** (testId: `pof-sidebar-nav-item-evaluator`) → run 3-pass evaluation on character → quality ≥ 3/5 expected.
6. Navigate to **packaging** → configure Win64 Shipping (testId: `pof-module-packaging-platform-win64`) → click "Cook & Package" (testId: `pof-module-packaging-cook-btn`) → wait for completion → verify .exe at expected path.
7. Launch packaged build → verify vertical-slice criteria (Section 1).

- [ ] **Step 2: Replace the `_(Filled in Task 9.)_` placeholder**

Use the Edit tool. Replace `_(Filled in Task 9.)_` under "## 2. End-to-end Playwright operator flow" with the numbered list. For every testId cited, ensure it appears in `testid-coverage.md`; for every gap blocking a step, cite its `GAP-NNN` from `gap-inventory.md`.

- [ ] **Step 3: Verify cross-refs**

Run:
```powershell
$index = Get-Content docs\features\arpg-vertical-slice\INDEX.md -Raw
$coverage = Get-Content docs\features\arpg-vertical-slice\testid-coverage.md -Raw
[regex]::Matches($index, "pof-[a-z0-9\-]+") | Select-Object -ExpandProperty Value -Unique | ForEach-Object {
    if ($coverage -notmatch [regex]::Escape($_)) { Write-Output "MISSING IN COVERAGE: $_" }
}
```
Expected: no output (every testId cited in INDEX.md is in testid-coverage.md).

---

## Task 10: Fill `INDEX.md` Section 3 — Module dependency wave order

**Files:**
- Modify: `docs/features/arpg-vertical-slice/INDEX.md`

- [ ] **Step 1: Build the DAG from `src/lib/feature-definitions.ts`**

Use Grep on `src/lib/feature-definitions.ts` to get the `arpg-*` and `input-handling`, `packaging` entries (already known from analysis):

```
arpg-character: []
input-handling: []
packaging: []
arpg-animation: [arpg-character]
arpg-gas: [arpg-character]
arpg-combat: [arpg-gas, arpg-animation]
arpg-enemy-ai: [arpg-character, arpg-gas]
arpg-loot: [arpg-inventory, arpg-combat]  ← arpg-inventory out of scope; note
arpg-ui: [arpg-gas, arpg-inventory]       ← arpg-inventory out of scope; note
```

Compute topological waves (in-scope only, ignoring `arpg-inventory`):

- **Wave 0:** project-setup, arpg-character, input-handling, packaging *(no in-scope deps)*
- **Wave 1:** arpg-animation, arpg-gas *(depend on arpg-character)*
- **Wave 2:** arpg-combat, arpg-enemy-ai *(depend on Wave 0/1)*
- **Wave 3:** arpg-loot, arpg-ui *(depend on Wave 2 + flagged inventory cheat-path)*

- [ ] **Step 2: Replace placeholder**

Use the Edit tool. Replace `_(Filled in Task 10.)_` under "## 3. Module dependency wave order" with the wave list above, plus a short paragraph noting the `arpg-inventory` exclusion and pointing at the relevant `arpg-loot.md`/`arpg-ui.md` "open question" entries.

---

## Task 11: Fill `INDEX.md` Section 4 — Infrastructure surfaces

**Files:**
- Modify: `docs/features/arpg-vertical-slice/INDEX.md`

- [ ] **Step 1: Inventory the cross-cutting surfaces**

For each surface, write a 2-4 sentence subsection covering: role in the scenario, files of record (with `file:line`), any gap items that should be added to `gap-inventory.md` with `Module = infra`.

Surfaces to cover:
- **Sidebar / module navigation** — `src/components/Sidebar*.tsx` (Glob to find).
- **Project-setup wizard** — `src/components/modules/project-setup/SetupWizard.tsx`.
- **CLI terminal panel** — `src/components/cli/*.tsx` (Glob).
- **Harness orchestrator** — `src/lib/harness/` + `src/app/api/harness/route.ts`.
- **Feature matrix** — `src/components/modules/shared/FeatureMatrix.tsx`.
- **Evaluator** — `src/components/modules/evaluator/EvaluatorModule.tsx`.

- [ ] **Step 2: Replace placeholder**

Use the Edit tool. Replace `_(Filled in Task 11. ...)_` with the 6 subsections.

- [ ] **Step 3: Add any new `infra`-category gaps to `gap-inventory.md`**

If Step 1 surfaced gaps not already in the inventory (e.g., "sidebar nav items have no testIds at all"), Edit `gap-inventory.md` to append them with `Module = infra` and the next free `GAP-NNN`.

---

## Task 12: Fill `INDEX.md` Section 5 + summaries

**Files:**
- Modify: `docs/features/arpg-vertical-slice/INDEX.md`
- Modify: `docs/features/arpg-vertical-slice/gap-inventory.md`
- Modify: `docs/features/arpg-vertical-slice/testid-coverage.md`

- [ ] **Step 1: Aggregate "open questions"**

Read each module file's bottom for any explicit "open question" call-outs (especially `arpg-loot.md` and `arpg-ui.md` re: the inventory dep). Edit `INDEX.md`, replace `_(Filled in Task 12. ...)_` under "## 5. Open questions for sub-project B" with the bulleted list.

- [ ] **Step 2: Fill `gap-inventory.md` summary**

Compute totals from the rows:
- Total gaps: N
- By category: `testId-missing`: X, `prompt-defect`: Y, etc.
- By severity: S: X, M: Y, L: Z
- Blocking: Y count vs. N count

Edit `gap-inventory.md`, replace `_(Filled in Task 12 — totals ...)_` with a small markdown list of these counts.

- [ ] **Step 3: Fill `testid-coverage.md` summary**

Compute totals:
- Total proposed testIds: N
- By surface (`sidebar`, `setup-wizard`, `cli-panel`, `harness`, `module-*`, `feature-matrix`, `infra`): counts
- Currently present (Y count) vs. missing (N count)

Edit `testid-coverage.md`, replace `_(Filled in Task 12 — counts ...)_` with the list.

---

## Task 13: Self-review

- [ ] **Step 1: Line-count check**

Run:
```powershell
Get-ChildItem docs\features\arpg-vertical-slice\modules\*.md | ForEach-Object {
    $count = (Get-Content $_).Count
    if ($count -gt 110) { Write-Output "OVER: $($_.Name) = $count" }
}
```
Expected: no output (every module file ≤ 110 lines).

If any file is over, dispatch an `Explore` agent to trim it: brief = "Trim `<path>` to ≤100 lines by tightening prose. Preserve all `file:line` citations, all gap bullets in Section 5, and all testId rows in Section 6. Use the Edit tool."

- [ ] **Step 2: Dangling `GAP-NNN` references in `INDEX.md`**

Run:
```powershell
$index = Get-Content docs\features\arpg-vertical-slice\INDEX.md -Raw
$inv = Get-Content docs\features\arpg-vertical-slice\gap-inventory.md -Raw
[regex]::Matches($index, "GAP-\d{3}") | Select-Object -ExpandProperty Value -Unique | ForEach-Object {
    if ($inv -notmatch [regex]::Escape($_)) { Write-Output "DANGLING IN INDEX: $_" }
}
```
Expected: no output.

- [ ] **Step 3: Dangling testId references in `INDEX.md`**

Already run in Task 9 Step 3 — re-run to confirm nothing regressed:
```powershell
$index = Get-Content docs\features\arpg-vertical-slice\INDEX.md -Raw
$coverage = Get-Content docs\features\arpg-vertical-slice\testid-coverage.md -Raw
[regex]::Matches($index, "pof-[a-z0-9\-]+") | Select-Object -ExpandProperty Value -Unique | ForEach-Object {
    if ($coverage -notmatch [regex]::Escape($_)) { Write-Output "MISSING IN COVERAGE: $_" }
}
```
Expected: no output.

- [ ] **Step 4: File count**

Run:
```powershell
$top = (Get-ChildItem docs\features\arpg-vertical-slice -File).Count
$mods = (Get-ChildItem docs\features\arpg-vertical-slice\modules -File).Count
Write-Output "top=$top expected=3 ; modules=$mods expected=10"
```
Expected: `top=3 expected=3 ; modules=10 expected=10`.

If any check fails, fix the issue, then re-run that step before continuing.

---

## Task 14: Commit

- [ ] **Step 1: Stage only the new analysis directory**

Run:
```bash
git add docs/features/arpg-vertical-slice/
```

- [ ] **Step 2: Verify staged file list**

Run:
```bash
git status --short docs/features/arpg-vertical-slice/
```
Expected: 13 lines all starting with `A ` (added).

- [ ] **Step 3: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
docs(features): arpg vertical-slice readiness analysis

Sub-project A of the end-to-end ARPG scenario. Produces 13 files under
docs/features/arpg-vertical-slice/: INDEX scenario map, gap-inventory,
testid-coverage map, and 10 per-module readiness notes.

Pure analysis — no source edits. Feeds sub-projects B (gap-fix),
C (testId coverage), and D (Playwright execution).

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-analysis-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify commit landed**

Run:
```bash
git log --oneline -1
```
Expected: one new commit titled "docs(features): arpg vertical-slice readiness analysis".

---

## Task 15: Chat summary

- [ ] **Step 1: Post the summary to the user**

Send a single chat message (no tool calls) containing:

```
Sub-project A complete. Committed at <SHA>.

Gap inventory:
- Total gaps: N
- Blocking the vertical slice: X
- By severity: S=a, M=b, L=c
- Top blocker categories: <cat>: n, <cat>: n

testId coverage:
- Total proposed testIds: N
- Currently present: P
- Missing (work for sub-project C): N-P

Open questions surfaced for sub-project B:
- [bullet 1]
- [bullet 2]

Recommended sub-project B scope: <2-3 sentences>.
Recommended sub-project C scope: <2-3 sentences>.

Ready to brainstorm sub-project B (gap-fix) when you are.
```

Numbers and bullets come from `gap-inventory.md` summary section + `testid-coverage.md` summary section + `INDEX.md` Section 5.

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every spec section is covered — output structure (Tasks 1-4), per-module template (Task 6 brief), INDEX structure (Tasks 9-12), gap-inventory schema (Task 3), testid-coverage schema (Task 4), testId convention (Task 4), execution plan (Tasks 5-14), DoD (Task 13's checks match the 6 DoD items in the spec).
- [x] **Placeholder scan:** the only `_(...)_` markers in the plan are *intentional* placeholders *inside the deliverable files themselves*, removed by later tasks (Task 9 removes `_(Filled in Task 9.)_`, etc.). The plan itself has no TBDs.
- [x] **Type consistency:** module IDs match `feature-definitions.ts` exactly; testId convention is identical in plan + spec + skeleton docs.
- [x] **Bite-sized:** each task is 1-6 short steps. Task 6 (10-agent dispatch) is the largest single action by wall-clock but is one tool-call batch.
