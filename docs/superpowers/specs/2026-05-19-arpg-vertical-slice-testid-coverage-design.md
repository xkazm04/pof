---
date: 2026-05-19
status: draft
sub_project: C (testId coverage)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-analysis-design.md
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-gap-fix-design.md
inputs:
  - docs/features/arpg-vertical-slice/gap-inventory.md
  - docs/features/arpg-vertical-slice/testid-coverage.md
---

# Sub-project C: ARPG vertical-slice — testId coverage pass

## Context

Sub-project B closed all 11 hard blockers identified by sub-project A. Sub-project D (Playwright-driven scenario execution) can now navigate the PoF UI, drive the cook backend, and exercise the slice-mode prompts. Before D runs, the **9 remaining non-blocking gaps** from A's inventory need attention — most are missing `data-testid` attributes that degrade D's ability to assert state without resorting to fragile DOM-text scraping. This spec covers closing the 7 of those 9 that are pure testId work.

The 2 non-testId gaps (GAP-014 UI surfacing, GAP-018 in-app harness panel) are explicitly **out of scope** for C and deferred to either a follow-up sub-project or to D's "operate-around-it" path.

## Goals

1. Add `data-testid` attributes to every control listed in `testid-coverage.md` with `Currently present? = N`, except the 2 existing non-conforming testIds in arpg-ui design tools.
2. Extend `e2e/infra-testids.spec.ts` with one smoke-test block per module group (6 new tests) to verify the additions render.
3. Update `testid-coverage.md` to flip the "Currently present?" column to `Y` for every added testId; refresh the Summary.
4. Annotate the 7 closed `GAP-NNN` rows in `gap-inventory.md` with their fix SHAs.
5. Remove stale `(deferred to C: GAP-NNN)` annotations from `INDEX.md §2` for now-closed gaps.

## Non-goals

- No new UI components, no API additions, no prompt edits.
- GAP-014 (DamagePipelineDiagram surfacing) — out of scope. Deferred to a possible future sub-project or to D's findings.
- GAP-018 (in-app harness panel) — out of scope. Multi-day work; sub-project D will call `/api/harness` directly.
- 2 existing non-conforming testIds in arpg-ui (`damage-number-palette-panel`, `health-pct-slider`) — left alone per the convention rule "existing testIds are not renamed unless they collide."
- No registry plumbing for testIds (the B brainstorm chose inline component-level testIds; same for C).

## In-scope deliverables

### Gaps closed

| GAP | Module | Category | Severity | Files |
|---|---|---|---|---|
| GAP-009 | input-handling | testId-missing | L | `InputView.tsx` |
| GAP-010 | project-setup | testId-missing | M | `SetupWizard.tsx` |
| GAP-011 | project-setup | testId-missing | M | `StatusChecklist.tsx` |
| GAP-012 | project-setup | testId-missing | M | `CreateProjectPanel.tsx`, `BuildVerifyPanel.tsx`, `ToolingBootstrapPanel.tsx` |
| GAP-013 | arpg-combat | testId-missing | S | `CombatActionMap/index.tsx`, `CombatChoreographyEditor/index.tsx` |
| GAP-019 | infra | testId-missing | M | `FeatureMatrix.tsx` |
| GAP-020 | infra | testId-missing | M | `EvaluatorModule.tsx` |

### Per-module rows from `testid-coverage.md` (not formally numbered as `GAP-NNN`)

- arpg-animation: 8 rows (`AnimationChecklist.tsx`, `AnimationsView.tsx`)
- arpg-enemy-ai: 2 rows (`EnemyBestiaryPanel.tsx`, `EnemyAITreePanel.tsx`)
- packaging: 5 rows (`BuildConfigSelector.tsx`, `PlatformProfileCard.tsx`, `BuildHistoryDashboard.tsx`)
- arpg-loot: 1 optional row (`LootTableVisualizer/design.tsx`) — agent may skip if it determines the component is purely a design tool with no slice-relevant interaction.

**Total: ~32 testId additions across ~17 files.**

## Three parallel streams (file-disjoint)

### Stream A' — project-setup + input-handling + infra (closes 5 gaps)

**File scope (8 files):**
- `src/components/modules/project-setup/SetupWizard.tsx`
- `src/components/modules/project-setup/StatusChecklist.tsx`
- `src/components/modules/project-setup/CreateProjectPanel.tsx`
- `src/components/modules/project-setup/BuildVerifyPanel.tsx`
- `src/components/modules/project-setup/ToolingBootstrapPanel.tsx`
- `src/components/modules/game-systems/InputView.tsx`
- `src/components/modules/shared/FeatureMatrix.tsx`
- `src/components/modules/evaluator/EvaluatorModule.tsx`

**testIds (26):** per the `setup-wizard`, `input-handling`, `feature-matrix`, and `evaluator` blocks in `testid-coverage.md`.

**Closes:** GAP-009, GAP-010, GAP-011, GAP-012, GAP-019, GAP-020.

### Stream B' — arpg-combat + arpg-animation + arpg-enemy-ai (closes 1 gap + per-module rows)

**File scope (6 files):**
- `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx`
- `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx`
- `src/components/modules/content/animations/AnimationChecklist.tsx`
- `src/components/modules/content/animations/AnimationsView.tsx`
- `src/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel.tsx`
- `src/components/modules/core-engine/dzin-panels/EnemyAITreePanel.tsx`

**testIds (12):** per the `module-arpg-combat`, `module-arpg-animation`, `module-arpg-enemy-ai` blocks in `testid-coverage.md`.

**Closes:** GAP-013.

**Important note on `CombatChoreographyEditor.tsx`:** It already has `data-testid="combat-choreography-editor"` (non-conforming). GAP-013's spec calls for the **new** testId `pof-module-arpg-combat-choreography-editor` — but per the convention "existing testIds are left alone unless they collide". Agent adds the new conforming testId **alongside** the existing one (both on the same element) rather than renaming. Document this in the test for clarity.

### Stream C' — packaging + arpg-loot + e2e spec extension (per-module rows; closes 0 gaps; verifies all)

**File scope (4 files):**
- `src/components/modules/game-systems/BuildConfigSelector.tsx`
- `src/components/modules/game-systems/PlatformProfileCard.tsx`
- `src/components/modules/game-systems/BuildHistoryDashboard.tsx`
- `e2e/infra-testids.spec.ts` — extension only

**Optional file:** `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/design.tsx` — agent reads + adds 1 row if the component is interactive; skips if purely design-only.

**testIds (6 in packaging + 1 optional in loot):** per `module-packaging` block in `testid-coverage.md`.

**Heads-up:** `BuildConfigSelector.tsx` was modified by sub-project B Stream A (`a8072e6`) — it now uses `useState` to manage `cookRequest` and mounts `<CookProgress />`. Stream C' agent adds testIds to existing JSX without disturbing the CookProgress wiring.

**Spec extension:** add 6 new `test()` blocks to `e2e/infra-testids.spec.ts`, one per module group:
- `project-setup module exposes core testIds`
- `input-handling module exposes core testIds`
- `arpg-combat module exposes core testIds`
- `arpg-animation module exposes core testIds`
- `arpg-enemy-ai module exposes core testIds`
- `feature matrix + evaluator expose core testIds`
- `packaging module exposes core testIds`

(7 blocks total in C; one per module-group. The "infra" group is split into FeatureMatrix + Evaluator which appear inside other modules' views.)

Each block: `enterWorkspace`, navigate via sidebar, assert 1-3 representative testIds. ~10-15 lines per block.

**Stream serialization:** C' dispatches **only after A' and B' commit**, because the e2e spec extension references testIds from all three streams. A' and B' run in parallel; C' is sequential after them.

## testId naming conventions

All follow `pof-<surface>-<element>[-<modifier>]` from sub-project B.

**Interpolation rule:** Never include user-typed strings raw in a testId. If the modifier comes from a user-typed source (e.g., project name), pass it through a slugify helper:

```typescript
const slug = (s: string) => s.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
```

For C's scope, the only at-risk interpolation is `pof-setup-wizard-project-item-${projectName}`. Stream A' creates `src/lib/test-ids.ts` if it has not been created already, exports `slugifyForTestId`, and uses it at the call site.

**Registry-derived IDs** (e.g., `cat.id`, `mod.id`, `tab.id`, `stepId`, `toolId`) are already kebab-case throughout the codebase (verified in sub-project A). No slugging needed.

## Verification strategy

After all three streams + Finalize commit:

1. `npx tsc --noEmit` — clean (verified per stream by the implementer too).
2. `npm run validate` — typecheck + lint + unit tests all green.
3. `npx playwright test e2e/infra-testids.spec.ts` — 3 original tests + 6 new module-group tests = **9 tests, all green**.
4. Grep verification: `grep -rn "pof-" src/components/ | wc -l` should show ~32 more `pof-…` occurrences than before C started.

## Finalize task (F1')

After all 3 streams commit, single Finalize commit:

1. **Update `testid-coverage.md`:**
   - For each row whose testId was actually added, flip `Currently present?` from `N` to `Y`.
   - Refresh the Summary section: present count ≈ 32 (was 2), missing count = 1 (the optional arpg-loot row, if skipped) or 0.
2. **Annotate `gap-inventory.md`:**
   - Add `(closed in <SHA>)` to rows for GAP-009, 010, 011, 012, 013, 019, 020.
   - Update the blocker summary section to reflect "all 11 hard blockers + 7 non-blocking testId gaps closed across sub-projects B and C."
3. **Update `INDEX.md §2`:**
   - Remove `(deferred to C: GAP-NNN)` annotations for the 7 closed gaps.
   - Remaining annotations (if any) reference GAP-014 or GAP-018 explicitly, with a note that those are deferred entirely.

## Cross-cutting

- **Branching:** `master`. Three stream commits + one Finalize commit = **4 commits**.
- **Validation gate:** controller runs `npm run validate` + e2e spec after all streams commit.
- **No worktree.** Per project pattern.
- **No new tests beyond the e2e spec extension** — testIds are mechanically verified by typecheck (interpolations are typed) and the spec extension at runtime.

## Definition of done

1. All 7 in-scope `GAP-NNN` rows in `gap-inventory.md` annotated with `(closed in <SHA>)`.
2. `testid-coverage.md` Summary shows ~32 testIds present.
3. `npm run validate` green.
4. `npx playwright test e2e/infra-testids.spec.ts` shows 9 passing tests.
5. `INDEX.md §2` `(deferred to C: ...)` annotations removed for closed gaps.
6. Chat summary: SHAs, testIds-added count, coverage delta, recommended sub-project D scope.

## Risks & mitigations

- **JSX edit conflicts inside a stream's file scope.** Unlikely — each stream owns its own files end-to-end; subagent's diff stays contained.
- **`BuildConfigSelector.tsx` recently rewritten by B-Stream-A.** Stream C' agent is told this in its brief and works around the `CookProgress` block.
- **Project-list testId interpolation includes user data.** Mitigated by the `slugifyForTestId` helper rule above.
- **The C' agent might add testIds to `LootTableVisualizer/design.tsx` even though it's a design tool.** Mitigated by the spec marking that row optional.
- **e2e spec timing flakiness** (similar to B's sidebar issue). Mitigated by reusing the proven `enterWorkspace` helper + generous timeouts (15s) on the first selector wait.

## Hand-off to sub-project D

After C lands:

- All 11 hard blockers closed (in B).
- 7 of 9 non-blocking testId gaps closed (in C).
- 2 remaining open: GAP-014 (UI integration, low-impact for D), GAP-018 (no in-app harness panel — D calls `/api/harness` directly).

D can begin: design Playwright runner, decide execution mode (per open question 5 from sub-project A: scripted vs. vision-assisted vs. hybrid), run the 24-step operator flow from `INDEX.md §2`, produce findings doc.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan: per-stream task list with full file-edit snippets.
4. Execute C under `subagent-driven-development` — three streams in two waves (A'+B' parallel; C' after).
5. Brainstorm sub-project D once C lands.
