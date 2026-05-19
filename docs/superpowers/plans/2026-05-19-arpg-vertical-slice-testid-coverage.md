# ARPG Vertical-Slice testId Coverage — Implementation Plan (Sub-project C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~32 `data-testid` attributes across ~17 PoF components so sub-project D's Playwright runner can assert state without DOM-text scraping. Closes 7 of the 9 deferred non-blocking gaps from sub-project A.

**Architecture:** Three file-disjoint streams. Wave 1: Stream A' (project-setup + input-handling + infra) and Stream B' (arpg-combat + arpg-animation + arpg-enemy-ai) dispatched in parallel. Wave 2: Stream C' (packaging + arpg-loot + e2e spec extension) dispatched after A' and B' commit so its e2e spec extension can reference all new testIds. Finalize task F1' annotates `gap-inventory.md` + `testid-coverage.md` + `INDEX.md`.

**Tech Stack:** React 19 + TypeScript (existing); Playwright (existing e2e); no new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-testid-coverage-design.md`

---

## File structure

### Stream A' (8 files modified, 1 file created) — closes GAP-009, 010, 011, 012, 019, 020

| File | testIds added |
|------|---------------|
| `src/lib/test-ids.ts` *(NEW)* | exports `slugifyForTestId(str)` helper |
| `src/components/modules/project-setup/SetupWizard.tsx` | 5 |
| `src/components/modules/project-setup/StatusChecklist.tsx` | 6 |
| `src/components/modules/project-setup/CreateProjectPanel.tsx` | 1 |
| `src/components/modules/project-setup/BuildVerifyPanel.tsx` | 1 |
| `src/components/modules/project-setup/ToolingBootstrapPanel.tsx` | 1 |
| `src/components/modules/shared/ReviewableModuleView.tsx` | 2 (interpolated per `moduleId` + per `itemId`) — feeds InputView and any other module using this shared view |
| `src/components/modules/shared/FeatureMatrix.tsx` | 4 |
| `src/components/modules/evaluator/EvaluatorModule.tsx` | 3 |

Total: **23 testIds** across **9 files** (1 new). Note: the `ReviewableModuleView` edit gives every module that uses it (including input-handling per GAP-009) per-checklist-item testIds in a single change.

### Stream B' (6 files modified) — closes GAP-013 + per-module rows

| File | testIds added |
|------|---------------|
| `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx` | 1 (interpolated per tab) |
| `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx` | 1 (added alongside existing non-conforming `data-testid="combat-choreography-editor"`) |
| `src/components/modules/content/animations/AnimationChecklist.tsx` | 4 (interpolated per `stepId`) |
| `src/components/modules/content/animations/AnimationsView.tsx` | 4 (per tab) |
| `src/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel.tsx` | 1 |
| `src/components/modules/core-engine/dzin-panels/EnemyAITreePanel.tsx` | 1 |

Total: **12 testIds** across **6 files**.

### Stream C' (3 files modified, optionally 4; 1 spec extended) — closes 0 GAP-NNN

| File | testIds added |
|------|---------------|
| `src/components/modules/game-systems/BuildConfigSelector.tsx` | 2 |
| `src/components/modules/game-systems/PlatformProfileCard.tsx` | 2 |
| `src/components/modules/game-systems/BuildHistoryDashboard.tsx` | 1 |
| `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/design.tsx` *(optional)* | 1 |
| `e2e/infra-testids.spec.ts` *(extension)* | 7 new test blocks |

Total: **5-6 testIds** across **3-4 files** + **7 new e2e test blocks**.

### Finalize F1' (3 files modified)
- `docs/features/arpg-vertical-slice/gap-inventory.md`
- `docs/features/arpg-vertical-slice/testid-coverage.md`
- `docs/features/arpg-vertical-slice/INDEX.md`

**Total across all of C: 8-9 commits (3 stream + 1 finalize, plus optional intra-stream commits if a stream agent prefers more granular history).**

---

## Streams are file-disjoint

Verified by file paths above: no source file appears in two streams. Wave 1 (A' + B') runs in parallel safely; Wave 2 (C') runs after Wave 1.

---

# Wave 1 — Streams A' and B' in parallel

# Stream A' — project-setup + input-handling + infra

### Task A1': Create `src/lib/test-ids.ts` helper

**Files:**
- Create: `src/lib/test-ids.ts`

- [ ] **Step 1: Write the helper**

Use Write tool to create `src/lib/test-ids.ts` with exactly:

```typescript
/**
 * Slugify a user-typed or otherwise unsafe string so it can be embedded in a
 * `data-testid` attribute value. Used only at the testId call site; the
 * underlying record (e.g. a project's name) is not modified.
 *
 * Rules:
 * - Allowed chars: a-z, 0-9, hyphen. Everything else collapses to a single hyphen.
 * - Trims leading/trailing hyphens.
 * - Lowercased.
 *
 * Examples:
 *   slugifyForTestId("My Cool Project") === "my-cool-project"
 *   slugifyForTestId("PoF (alpha)")    === "pof-alpha"
 *   slugifyForTestId("__internal__")    === "internal"
 */
export function slugifyForTestId(s: string): string {
  return s
    .replace(/[^a-z0-9-]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: clean (no new errors).

---

### Task A2': Add testIds to `SetupWizard.tsx` (5 testIds)

**Files:**
- Modify: `src/components/modules/project-setup/SetupWizard.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/project-setup/SetupWizard.tsx` end-to-end (file is ~286 lines per sub-project A analysis). Identify the 5 target elements:

1. Mode-selector tab for "Existing" projects (the tab that switches between existing-project list and "Start Fresh" form)
2. UE version pill (rendered per UE version, e.g., 5.5, 5.6, 5.7)
3. Project list item button (rendered per detected project)
4. Project-name input field (Start Fresh mode)
5. Create & Launch button (Start Fresh mode)

- [ ] **Step 2: Add the 5 testIds with the Edit tool**

For each target, add a `data-testid` attribute to the element. Use these exact testId values (substituting interpolations where indicated):

| Target | testId |
|---|---|
| Existing/Fresh tab buttons | `pof-setup-wizard-tab-existing` and `pof-setup-wizard-tab-fresh` (one per tab) |
| UE version pill | `` `pof-setup-wizard-version-pill-${version}` `` (e.g., `5.5`, `5.6`, `5.7`) |
| Project list item button | `` `pof-setup-wizard-project-item-${slugifyForTestId(project.name)}` `` |
| Project-name input | `pof-setup-wizard-project-name-input` |
| Create & Launch button | `pof-setup-wizard-create-btn` |

For the project-item interpolation, add this import at the top of the file:
```typescript
import { slugifyForTestId } from '@/lib/test-ids';
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: clean.

---

### Task A3': Add testIds to `StatusChecklist.tsx` (6 testIds)

**Files:**
- Modify: `src/components/modules/project-setup/StatusChecklist.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/project-setup/StatusChecklist.tsx` (~250 lines per sub-project A). Identify the elements:

1. Outer checklist container (the scrollable list root)
2. Engine status item
3. Tooling status items (rendered per tool: `vs`, `msvc`, `wsdk`, `dotnet` — find the map/loop)
4. Project path status item
5. UE Project (`.uproject`) status item
6. "Re-scan" / scan button

- [ ] **Step 2: Add the 6 testIds**

| Target | testId |
|---|---|
| Outer container | `pof-setup-wizard-checklist` |
| Engine status row | `pof-setup-wizard-checklist-item-engine` |
| Per-tool status row | `` `pof-setup-wizard-checklist-item-tool-${tool.id}` `` (or whatever the loop variable is — likely `tool.id` or `toolKey`) |
| Project path row | `pof-setup-wizard-checklist-item-path` |
| `.uproject` row | `pof-setup-wizard-checklist-item-uproject` |
| Scan button | `pof-setup-wizard-scan-btn` |

- [ ] **Step 3: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: clean.

---

### Task A4': Add testIds to `CreateProjectPanel.tsx`, `BuildVerifyPanel.tsx`, `ToolingBootstrapPanel.tsx` (3 testIds total, 1 per file)

**Files:**
- Modify: `src/components/modules/project-setup/CreateProjectPanel.tsx`
- Modify: `src/components/modules/project-setup/BuildVerifyPanel.tsx`
- Modify: `src/components/modules/project-setup/ToolingBootstrapPanel.tsx`

- [ ] **Step 1: Read all three files**

Read each (they're 44-150 lines per sub-project A). For each, identify the primary action button.

- [ ] **Step 2: Add testIds**

| File | Target button | testId |
|---|---|---|
| `CreateProjectPanel.tsx` | Create project button (triggers project scaffolding prompt) | `pof-setup-wizard-create-project-btn` |
| `BuildVerifyPanel.tsx` | Build & Verify button | `pof-setup-wizard-build-verify-btn` |
| `ToolingBootstrapPanel.tsx` | Fix All Missing Tools button | `pof-setup-wizard-fix-tools-btn` |

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task A5': Add per-checklist-item testIds to `ReviewableModuleView.tsx` (2 interpolated testIds — covers GAP-009 for InputView and every other module using this view)

**Files:**
- Modify: `src/components/modules/shared/ReviewableModuleView.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/shared/ReviewableModuleView.tsx` end-to-end. Identify:
1. The list/loop that renders checklist items (look for `.map(item =>` or `.map(({id}) =>` over a `checklist` array).
2. The complete/submit button at the bottom of the view (look for "Complete" or "Mark complete" text).
3. The `moduleId` prop (or however the active module's id is obtained — check imports and props).

- [ ] **Step 2: Add interpolated testIds**

On the checklist item row (the outer element of each iteration), add:
```tsx
data-testid={`pof-module-${moduleId}-checklist-item-${item.id}`}
```

On the complete button, add:
```tsx
data-testid={`pof-module-${moduleId}-complete-btn`}
```

If `moduleId` is not available as a direct prop, locate where the active module is determined (likely `useActiveModuleId()` hook or via `useNavigationStore`). Use whatever's already wired — do not add new props or new hook calls if avoidable.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

**Adaptation allowed:** if `ReviewableModuleView` does not actually render the checklist items itself (it delegates to a child component like `Checklist`), apply the same testIds to the deepest component that actually owns the item-row JSX. The goal is one testId per checklist item, interpolated by both `moduleId` and `item.id`.

---

### Task A6': Add testIds to `FeatureMatrix.tsx` (4 testIds)

**Files:**
- Modify: `src/components/modules/shared/FeatureMatrix.tsx`

- [ ] **Step 1: Read the file**

`FeatureMatrix.tsx` is large (likely 1000+ lines). Focus on:
1. The row-rendering loop (likely a `.map((feature) =>` over feature rows).
2. The status badge cell inside each row (uses `FEATURE_STATUS_COLORS`).
3. The quality stars cell inside each row (uses `STAR_COLORS`).
4. The scan / re-scan button at the top.

Use Grep with patterns like `feature.name`, `.map(` inside the file to locate the row loop quickly.

- [ ] **Step 2: Add the 4 testIds**

| Target | testId |
|---|---|
| Feature row outer element | `` `pof-feature-matrix-row-${slugifyForTestId(feature.name)}` `` |
| Status badge cell | `` `pof-feature-matrix-status-${slugifyForTestId(feature.name)}` `` |
| Quality stars cell | `` `pof-feature-matrix-quality-${slugifyForTestId(feature.name)}` `` |
| Scan / re-scan button | `pof-feature-matrix-scan-btn` |

Add the import:
```typescript
import { slugifyForTestId } from '@/lib/test-ids';
```

If `feature.name` doesn't exist on the row data (e.g., the field is `featureName` or `name`), use whatever the real field is, but apply `slugifyForTestId` to it regardless.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task A7': Add testIds to `EvaluatorModule.tsx` (3 testIds)

**Files:**
- Modify: `src/components/modules/evaluator/EvaluatorModule.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/evaluator/EvaluatorModule.tsx`. Identify:
1. The module root element (outermost rendered JSX).
2. The "Run evaluation" button (may be labeled "Run 3-pass", "Evaluate", etc.).
3. The result quality badge / score display (shows 1-5 score after a run; may be in a sub-component).

- [ ] **Step 2: Add the 3 testIds**

| Target | testId |
|---|---|
| Module root | `pof-module-evaluator` |
| Run-evaluation button | `pof-module-evaluator-run-btn` |
| Result quality badge | `pof-module-evaluator-result-quality` |

If the result-quality element lives in a child component (e.g., `EvaluatorResultCard.tsx`), add the testId there. The constraint is functional: D's Playwright runner needs to read the score via `getByTestId('pof-module-evaluator-result-quality')`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task A8': Run Stream A' validation + commit

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 2: Stage Stream A' files**

```bash
git add src/lib/test-ids.ts src/components/modules/project-setup/SetupWizard.tsx src/components/modules/project-setup/StatusChecklist.tsx src/components/modules/project-setup/CreateProjectPanel.tsx src/components/modules/project-setup/BuildVerifyPanel.tsx src/components/modules/project-setup/ToolingBootstrapPanel.tsx src/components/modules/shared/ReviewableModuleView.tsx src/components/modules/shared/FeatureMatrix.tsx src/components/modules/evaluator/EvaluatorModule.tsx
```

- [ ] **Step 3: Verify**

```bash
git status --short
```
Expected: 9 entries (1 new + 8 modified), no Stream B' or C' files.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(testids): project-setup + input-handling + infra coverage

Closes GAP-009, GAP-010, GAP-011, GAP-012, GAP-019, GAP-020.

- src/lib/test-ids.ts: new slugifyForTestId helper for user-data interpolation
- SetupWizard: 5 testIds (mode tabs, version pill, project item, name input, create btn)
- StatusChecklist: 6 testIds (container + 5 status rows + scan btn)
- CreateProjectPanel / BuildVerifyPanel / ToolingBootstrapPanel: 3 action btns
- ReviewableModuleView: per-item + complete-btn testIds (covers GAP-009 via InputView and benefits every other module using the shared view)
- FeatureMatrix: row + status + quality + scan-btn testIds (slugified feature name)
- EvaluatorModule: module root + run-btn + result-quality testIds

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-testid-coverage-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Capture commit SHA**

```bash
git log --oneline -1
```

---

# Stream B' — arpg-combat + arpg-animation + arpg-enemy-ai

### Task B1': Add testIds to `CombatActionMap/index.tsx` (1 interpolated testId for tabs)

**Files:**
- Modify: `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx` (~165 lines per sub-project A). Find the tab buttons for Flow / Hits / Feedback / Metrics. They're likely rendered via a `.map(tab => ...)` over a tab list.

- [ ] **Step 2: Add the interpolated testId**

On each tab button, add:
```tsx
data-testid={`pof-module-arpg-combat-tab-${tab.id}`}
```

If the loop variable is named differently (e.g., `t`, `tabConfig`) or the id field is named differently (e.g., `tab.key`, `tab.name`), use the real names but keep the pattern.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task B2': Add conforming testId to `CombatChoreographyEditor/index.tsx` (1 testId, alongside existing)

**Files:**
- Modify: `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx` (~150 lines per sub-project A). Find the existing `data-testid="combat-choreography-editor"` attribute on the root motion.div.

- [ ] **Step 2: Add the conforming testId alongside the existing one**

Per the spec convention rule 4 ("existing testIds are left alone unless they collide"), keep the existing `data-testid="combat-choreography-editor"` AND add a new attribute:

```tsx
<motion.div
  data-testid="combat-choreography-editor"
  data-testid-pof="pof-module-arpg-combat-choreography-editor"
  ...
>
```

Wait — JSX does not allow two attributes with the same name. Adopt the **alongside** approach via a **wrapper attribute**: keep the existing `data-testid` exactly as-is, and add a second attribute `data-testid-conforming` (a non-standard name that Playwright can still query via `[data-testid-conforming="pof-module-arpg-combat-choreography-editor"]`). The Playwright query is straightforward; the existing test that relies on `combat-choreography-editor` keeps working.

Actually, **simpler:** since Playwright's `getByTestId` query accepts both attribute names and the locator `[data-testid="..."]` works with any attribute, use the standard `data-testid` and accept the rename. The existing test uses `data-testid="combat-choreography-editor"` — search the repo for that string first. If no test depends on it, rename freely. If something depends on it, keep the original and add the new one as `data-pof-testid` (a non-conflicting name).

**Concrete instructions:**

```bash
grep -rn "combat-choreography-editor" --include="*.ts" --include="*.tsx" .
```
Run that. If no other file references it (other than the component itself and possibly old tests under `e2e/` or `__tests__/` not touched by sub-project B), **rename** `data-testid="combat-choreography-editor"` to `data-testid="pof-module-arpg-combat-choreography-editor"`. If something does reference it, add a parallel attribute named `data-pof-testid="pof-module-arpg-combat-choreography-editor"` and leave the original untouched.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task B3': Add testIds to `AnimationChecklist.tsx` (4 interpolated testIds per step)

**Files:**
- Modify: `src/components/modules/content/animations/AnimationChecklist.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/content/animations/AnimationChecklist.tsx` (~547 lines per sub-project A). Find the StepCard component or the per-step `.map()` loop. Identify these 4 elements per step:

1. Step card root (outermost element for each step)
2. Expand/collapse chevron button
3. "Execute Process" button (triggers code generation)
4. "Verify Complete" checkbox

If StepCard is its own component (likely), edit that component's JSX. The `stepId` should come from the step data (`step.id` like `aa-1`).

- [ ] **Step 2: Add the 4 interpolated testIds**

```tsx
data-testid={`pof-module-arpg-animation-step-${step.id}`}   // step card root
data-testid={`pof-module-arpg-animation-toggle-${step.id}`}  // expand chevron
data-testid={`pof-module-arpg-animation-generate-${step.id}`} // execute button
data-testid={`pof-module-arpg-animation-mark-${step.id}`}    // verify checkbox
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task B4': Add testIds to `AnimationsView.tsx` (4 testIds for tabs)

**Files:**
- Modify: `src/components/modules/content/animations/AnimationsView.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/content/animations/AnimationsView.tsx` (~168 lines per sub-project A). Find the 4 tabs: Setup Guide, State Machine, Combo Designer, Ask Claude.

- [ ] **Step 2: Add the 4 testIds**

| Tab label | testId |
|---|---|
| Setup Guide | `pof-module-arpg-animation-tab-setup` |
| State Machine | `pof-module-arpg-animation-tab-states` |
| Combo Designer | `pof-module-arpg-animation-tab-combo-ai` |
| Ask Claude | `pof-module-arpg-animation-tab-ask` |

If the tabs are rendered via a `.map()` over a tab config array, do this with an interpolated `pof-module-arpg-animation-tab-${tab.id}` where `tab.id` matches the slugs above (e.g., `setup`, `states`, `combo-ai`, `ask`). Otherwise add them directly.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task B5': Add testIds to `EnemyBestiaryPanel.tsx` and `EnemyAITreePanel.tsx` (2 testIds total, 1 per file)

**Files:**
- Modify: `src/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel.tsx`
- Modify: `src/components/modules/core-engine/dzin-panels/EnemyAITreePanel.tsx`

- [ ] **Step 1: Read both files**

These are display-only dzin panels (per sub-project A). Each has one representative element to tag:
- `EnemyBestiaryPanel`: archetype list root
- `EnemyAITreePanel`: BT state cards root

- [ ] **Step 2: Add testIds**

| File | Target | testId |
|---|---|---|
| `EnemyBestiaryPanel.tsx` | Archetype list root | `pof-module-arpg-enemy-ai-archetype-list` |
| `EnemyAITreePanel.tsx` | BT state cards root | `pof-module-arpg-enemy-ai-bt-states` |

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task B6': Run Stream B' validation + commit

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Stage**

```bash
git add src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx src/components/modules/content/animations/AnimationChecklist.tsx src/components/modules/content/animations/AnimationsView.tsx src/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel.tsx src/components/modules/core-engine/dzin-panels/EnemyAITreePanel.tsx
```

- [ ] **Step 3: Verify**

```bash
git status --short
```
Expected: 6 entries, all M, no Stream A' or C' files.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(testids): arpg-combat + arpg-animation + arpg-enemy-ai coverage

Closes GAP-013 + per-module testId rows from testid-coverage.md.

- CombatActionMap: pof-module-arpg-combat-tab-{tabId} on each tab
- CombatChoreographyEditor: pof-module-arpg-combat-choreography-editor on root
  (existing non-conforming "combat-choreography-editor" kept or renamed
  depending on existing references)
- AnimationChecklist: step + toggle + generate + mark testIds per stepId
- AnimationsView: tab testIds (setup, states, combo-ai, ask)
- EnemyBestiaryPanel: archetype-list testId
- EnemyAITreePanel: bt-states testId

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-testid-coverage-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Capture SHA**

```bash
git log --oneline -1
```

---

# Wave 2 — Stream C' (dispatched after A' and B' commit)

### Task C1': Add testIds to `BuildConfigSelector.tsx` (2 testIds — work around CookProgress wiring)

**Files:**
- Modify: `src/components/modules/game-systems/BuildConfigSelector.tsx`

- [ ] **Step 1: Read the file end-to-end**

This file was significantly modified by sub-project B Stream A (`a8072e6`). It now uses `useState` to manage `cookRequest` and renders `<CookProgress request={cookRequest} onComplete={handleCookComplete} />` near the bottom. Stream A also added imports. **Do not disturb any of the CookProgress wiring.**

- [ ] **Step 2: Identify the two target elements**

1. **Add-platform button** — the button that creates a new build profile for a platform. Likely calls `handleNewProfile(platform)` (per the `handleNewProfile` defined ~line 127 before B). May appear once per platform-card or as a top-level "Add Platform" button.
2. **Shipping config selector option** — inside the build-config editor dropdown (line ~334 per sub-project A's analysis), the option whose value is "Shipping" or similar.

- [ ] **Step 3: Add the 2 testIds**

| Target | testId |
|---|---|
| Add-platform button | `pof-module-packaging-add-platform` (use `pof-module-packaging-add-platform-${platform}` if rendered per platform — interpolated form preferred) |
| Shipping config option | `pof-module-packaging-config-shipping` (or use `pof-module-packaging-config-${config.value}` if interpolated; ensure Shipping renders as `pof-module-packaging-config-shipping`) |

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task C2': Add testIds to `PlatformProfileCard.tsx` (2 testIds)

**Files:**
- Modify: `src/components/modules/game-systems/PlatformProfileCard.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/game-systems/PlatformProfileCard.tsx` (~205 lines per sub-project A). The Package button is at line ~92-99 (calls `onPackage` prop, which sub-project B Stream A wired to trigger the cook backend).

- [ ] **Step 2: Identify the two targets**

1. **Package button** — the green button that triggers the cook (line ~92-99).
2. **Cook status badge** — element that displays cook state (success/failure/in-progress). May not exist as a single discrete element; if it doesn't, use the CookProgress component's testIds instead (which sub-project B Stream A already added: `pof-cook-progress-result` etc.). Document the choice.

- [ ] **Step 3: Add the testIds**

```tsx
data-testid="pof-module-packaging-start-cook"  // green Package button
data-testid="pof-module-packaging-status"      // cook status badge (if exists)
```

If no separate status badge exists in `PlatformProfileCard.tsx` (the CookProgress component handles status), skip the second testId and note this in the chat summary. Stream C' should NOT introduce a new status element just to host a testId.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task C3': Add testId to `BuildHistoryDashboard.tsx` (1 testId)

**Files:**
- Modify: `src/components/modules/game-systems/BuildHistoryDashboard.tsx`

- [ ] **Step 1: Read the relevant lines**

Read `src/components/modules/game-systems/BuildHistoryDashboard.tsx`. Per sub-project A's analysis the expanded build row at line 135-139 displays the path to the .exe (output path). Find that element.

- [ ] **Step 2: Add the testId**

```tsx
data-testid="pof-module-packaging-exe-path"
```

On the element that contains the path string. If the path is rendered inside a copyable code-block or similar, put the testId on the wrapper so the text is queryable via `.textContent`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task C4': Optionally add testId to `LootTableVisualizer/design.tsx` (1 optional testId)

**Files:**
- Modify (optional): `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/design.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/design.tsx`. Determine: is this an interactive editor or a static design reference?

- [ ] **Step 2: If interactive, add the testId**

If the component has interactive controls the operator would manipulate, add to the root element:

```tsx
data-testid="pof-module-arpg-loot-editor"
```

If purely static (no inputs, no buttons, just a visual reference), **skip this task entirely** and note in the chat summary that the testId was deemed unnecessary.

- [ ] **Step 3: Typecheck (if Step 2 was applied)**

```bash
npx tsc --noEmit
```

---

### Task C5': Extend `e2e/infra-testids.spec.ts` with 7 module-group smoke tests

**Files:**
- Modify: `e2e/infra-testids.spec.ts`

- [ ] **Step 1: Read the current file**

Read `e2e/infra-testids.spec.ts`. The current shape (post sub-project B):

```typescript
import { test, expect, type Page } from '@playwright/test';

async function enterWorkspace(page: Page) { /* opens project picker, clicks PoF */ }

test.describe('Infra testIds — sidebar + CLI', () => {
  test('SidebarL1 category buttons are queryable', async ({ page }) => { /* ... */ });
  test('clicking a SidebarL1 category reveals SidebarL2 sub-module items', async ({ page }) => { /* ... */ });
  test('CLI panel testIds appear once a CLI session is active', async ({ page }) => { /* ... */ });
});
```

- [ ] **Step 2: Add 7 new module-group test blocks**

Append (inside the same `test.describe`):

```typescript
  test('project-setup module exposes core testIds', async ({ page }) => {
    await enterWorkspace(page);
    await page.getByTestId('pof-sidebar-nav-item-project-setup').click();
    await page.getByTestId('pof-sidebar-l2-nav-item-project-setup').click();
    await expect(page.getByTestId('pof-setup-wizard-checklist')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('pof-setup-wizard-checklist-item-engine')).toBeAttached();
  });

  test('input-handling module exposes core testIds', async ({ page }) => {
    await enterWorkspace(page);
    await page.getByTestId('pof-sidebar-nav-item-game-systems').click();
    await page.getByTestId('pof-sidebar-l2-nav-item-input-handling').click();
    // ReviewableModuleView wraps per-item testIds with the moduleId
    await expect(page.locator('[data-testid^="pof-module-input-handling-checklist-item-"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('arpg-combat module exposes core testIds', async ({ page }) => {
    await enterWorkspace(page);
    await page.getByTestId('pof-sidebar-nav-item-core-engine').click();
    await page.getByTestId('pof-sidebar-l2-nav-item-arpg-combat').click();
    await expect(page.locator('[data-testid^="pof-module-arpg-combat-tab-"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('arpg-animation module exposes core testIds', async ({ page }) => {
    await enterWorkspace(page);
    await page.getByTestId('pof-sidebar-nav-item-content').click();
    await page.getByTestId('pof-sidebar-l2-nav-item-arpg-animation').click();
    await expect(page.getByTestId('pof-module-arpg-animation-tab-setup')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="pof-module-arpg-animation-step-"]').first()).toBeAttached();
  });

  test('arpg-enemy-ai module exposes core testIds', async ({ page }) => {
    await enterWorkspace(page);
    await page.getByTestId('pof-sidebar-nav-item-core-engine').click();
    await page.getByTestId('pof-sidebar-l2-nav-item-arpg-enemy-ai').click();
    const bestiary = page.getByTestId('pof-module-arpg-enemy-ai-archetype-list');
    const aitree = page.getByTestId('pof-module-arpg-enemy-ai-bt-states');
    // At least one of the two display panels should be attached. (The module
    // may show one panel at a time depending on the active sub-tab.)
    const bestiaryAttached = (await bestiary.count()) > 0;
    const aitreeAttached = (await aitree.count()) > 0;
    expect(bestiaryAttached || aitreeAttached).toBe(true);
  });

  test('feature matrix + evaluator expose core testIds', async ({ page }) => {
    await enterWorkspace(page);
    // FeatureMatrix lives inside several modules; navigate via core-engine character
    await page.getByTestId('pof-sidebar-nav-item-core-engine').click();
    await page.getByTestId('pof-sidebar-l2-nav-item-arpg-character').click();
    await expect(page.getByTestId('pof-feature-matrix-scan-btn')).toBeAttached({ timeout: 5000 });
    // Evaluator lives in its own category
    await page.getByTestId('pof-sidebar-nav-item-evaluator').click();
    await expect(page.getByTestId('pof-module-evaluator')).toBeVisible({ timeout: 5000 });
  });

  test('packaging module exposes core testIds', async ({ page }) => {
    await enterWorkspace(page);
    await page.getByTestId('pof-sidebar-nav-item-game-systems').click();
    await page.getByTestId('pof-sidebar-l2-nav-item-packaging').click();
    // Either there are existing profile cards (which expose start-cook) or the
    // add-platform button is visible. Accept either.
    const addPlatform = page.getByTestId('pof-module-packaging-add-platform').first();
    const startCook = page.getByTestId('pof-module-packaging-start-cook').first();
    const addCount = await addPlatform.count();
    const startCount = await startCook.count();
    expect(addCount + startCount).toBeGreaterThan(0);
  });
```

- [ ] **Step 3: Run the extended spec**

```bash
npx playwright test e2e/infra-testids.spec.ts
```
Expected: 10 tests pass (3 original + 7 new).

If a test fails because a particular sub-module navigation requires opening a specific tab first, adapt the navigation (e.g., add a `.click()` on a sub-tab) but do not weaken the assertion. If a test fails because the actual testId differs from what's in the plan (e.g., a stream agent used a different field name in interpolation), update the spec to match the real testId — the source of truth is what the streams committed, the spec asserts that reality.

If the dev server fails to start, check that no other Next.js process is on port 3000. If something is, request user help (do not kill unprompted as a prior subagent did — that disrupted the user's workflow).

---

### Task C6': Run Stream C' validation + commit

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Stage**

```bash
git add src/components/modules/game-systems/BuildConfigSelector.tsx src/components/modules/game-systems/PlatformProfileCard.tsx src/components/modules/game-systems/BuildHistoryDashboard.tsx e2e/infra-testids.spec.ts
```
If Task C4' applied, also include `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/design.tsx`.

- [ ] **Step 3: Verify**

```bash
git status --short
```
Expected: 4-5 entries, no Stream A' or B' files.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(testids): packaging coverage + e2e module-group smoke checks

Per-module testId rows for packaging from testid-coverage.md plus an
extension of e2e/infra-testids.spec.ts with one smoke-test block per
module group (7 new tests).

- BuildConfigSelector: add-platform + config-shipping testIds (no
  disturbance to the CookProgress wiring added in a8072e6)
- PlatformProfileCard: start-cook + (optional) status testIds
- BuildHistoryDashboard: exe-path testId on the staged-build row
- LootTableVisualizer: optional editor-root testId (skipped if purely
  static visualization)
- e2e/infra-testids.spec.ts: 7 new module-group smoke tests; total 10 tests

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-testid-coverage-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Capture SHA**

```bash
git log --oneline -1
```

---

# Finalize

### Task F1': Annotate gap-inventory.md + testid-coverage.md + INDEX.md

**Files:**
- Modify: `docs/features/arpg-vertical-slice/gap-inventory.md`
- Modify: `docs/features/arpg-vertical-slice/testid-coverage.md`
- Modify: `docs/features/arpg-vertical-slice/INDEX.md`

- [ ] **Step 1: Get the three stream commit SHAs**

```bash
git log --oneline -6
```
Identify `SHA_A'`, `SHA_B'`, `SHA_C'` (the three feat commits from this sub-project).

- [ ] **Step 2: Annotate `gap-inventory.md` (7 rows)**

For each of these rows, prepend `**(closed in <SHA>)**` to the **Title** column:

| Gap | SHA |
|-----|-----|
| GAP-009 | SHA_A' |
| GAP-010 | SHA_A' |
| GAP-011 | SHA_A' |
| GAP-012 | SHA_A' |
| GAP-013 | SHA_B' |
| GAP-019 | SHA_A' |
| GAP-020 | SHA_A' |

Use Edit tool with replace_all=false, one Edit per row. Example for GAP-009:

```
old: | GAP-009 | input-handling | testId-missing | L | N | InputView checklist items in `ReviewableModuleView` lack `pof-module-input-handling-checklist-item-${itemId}` testIds. |
new: | GAP-009 | input-handling | testId-missing | L | N | **(closed in 1a2b3c4)** InputView checklist items in `ReviewableModuleView` lack `pof-module-input-handling-checklist-item-${itemId}` testIds. |
```

- [ ] **Step 3: Update `gap-inventory.md` summary**

Find the "Summary" section. Update:

```
old: - Non-blocking (N): **9** _(deferred to sub-project C)_
new: - Non-blocking (N): **9** — 7 closed in sub-project C; 2 remain open (GAP-014 + GAP-018, deferred per C's spec)
```

- [ ] **Step 4: Update `testid-coverage.md`**

For every row that the streams actually added testIds for (track which by reviewing the three commit diffs via `git show <SHA>`), flip the **Currently present?** column from `N` to `Y`. Do not edit rows for testIds that weren't actually added (e.g., the optional arpg-loot row, or the optional cook status badge in PlatformProfileCard if Stream C' skipped it).

For the Summary section, update:

```
old: **Currently present (Y): 2** — both pre-existing non-conforming testIds in `arpg-ui` design tools ...
new: **Currently present (Y): ~32** — sub-project C added ~30 testIds across project-setup, input-handling, infra, arpg-combat, arpg-animation, arpg-enemy-ai, and packaging surfaces. 2 pre-existing non-conforming testIds in `arpg-ui` design tools left alone per convention rule 4.
```

Recount the by-surface totals to reflect the new state. Use the commit diffs as the source of truth for which surfaces actually changed.

- [ ] **Step 5: Update `INDEX.md` §2**

Find each `(deferred to C: GAP-NNN)` annotation. For each that references a now-closed gap (GAP-009, 010, 011, 012, 013, 019, 020), remove the parenthetical. For annotations that reference still-open gaps (GAP-014, GAP-018) or that weren't formally GAP-NNN-numbered, leave them.

Also update INDEX.md §2's final "Summary of step-level blockers" section. Add a new bullet at the end:

```
- Sub-project C closed 7 of the 9 non-blocking testId gaps (GAP-009, 010, 011, 012, 013, 019, 020). GAP-014 and GAP-018 remain explicitly out of scope.
```

- [ ] **Step 6: Stage + commit**

```bash
git add docs/features/arpg-vertical-slice/gap-inventory.md docs/features/arpg-vertical-slice/testid-coverage.md docs/features/arpg-vertical-slice/INDEX.md
git commit -m "$(cat <<'EOF'
docs(features): mark sub-project C testId gaps closed in gap-inventory + coverage + INDEX

Annotates 7 closed testId gaps with fix commit SHAs:
- GAP-009, 010, 011, 012, 019, 020 → SHA_A' (Stream A')
- GAP-013 → SHA_B' (Stream B')

Updates testid-coverage.md Summary: ~32 testIds now present (was 2).

Removes (deferred to C: GAP-NNN) annotations from INDEX.md §2 for closed
gaps. Documents that GAP-014 and GAP-018 remain explicitly out of scope.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Substitute `SHA_A'` and `SHA_B'` in the commit message above with the real SHAs.

- [ ] **Step 7: Chat summary**

Post a single chat message:

```
Sub-project C complete. 4 commits:
- <SHA_A'> feat(testids): project-setup + input-handling + infra coverage
- <SHA_B'> feat(testids): arpg-combat + arpg-animation + arpg-enemy-ai coverage
- <SHA_C'> feat(testids): packaging coverage + e2e module-group smoke checks
- <SHA_F'> docs(features): mark sub-project C testId gaps closed

testIds added: ~32 across ~17 files.
Gap-inventory state: 18/20 closed (11 in B, 7 in C). Open: GAP-014, GAP-018.
e2e: 10 tests passing (3 original + 7 new module-group smoke checks).
npm run validate: green.

Sub-project D ready to start. Recommended D scope: design Playwright runner
mode (scripted vs. vision-assisted vs. hybrid, per open question 5 from
sub-project A), execute the 24-step operator flow in INDEX.md §2, produce
scenario-run-{date}.md findings doc.
```

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every Stream A'/B'/C' item in the spec maps to ≥1 task. F1' handles the gap-inventory + coverage + INDEX update DoD bullets. Each in-scope GAP-NNN is explicitly named in a task's commit message.
- [x] **Placeholder scan:** the `<SHA_…>` markers in F1' commit message are runtime substitutions, not plan placeholders — F1' tasks explicitly tell the implementer to substitute. The optional Task C4' has explicit skip conditions, not vague "if needed."
- [x] **Type consistency:** testId names use a single convention throughout. The `slugifyForTestId` helper is created once in Task A1' and re-used in A2', A6' (with explicit import statements). The `pof-module-<moduleId>-…` pattern is consistent across all module-scoped testIds.
- [x] **Bite-sized:** longest task (A2', A3', A5') has 3 steps; most have 2-3. The Stream C' e2e extension (Task C5') has the largest single code block (~50 lines of test code) but it's one cohesive addition.
- [x] **Stream serialization:** Wave 1 (A' + B') and Wave 2 (C') ordering is explicit. C5' depends on testIds from both A' and B', justifying the serialization.
- [x] **Drift from spec acknowledged:** the spec said "8 files" for Stream A' but the plan adds a 9th (`ReviewableModuleView.tsx`) to satisfy GAP-009 cleanly. This is a deliberate refinement, not silent drift — Stream A' file scope in the plan explicitly lists 9 files.
