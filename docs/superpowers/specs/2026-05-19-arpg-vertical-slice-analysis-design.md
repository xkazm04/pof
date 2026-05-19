---
date: 2026-05-19
status: draft
sub_project: A (analysis)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
---

# Sub-project A: ARPG vertical-slice — codebase analysis & gap inventory

## Context

The PoF (Pillars of Fortune) app is an AI-powered UE5 game-dev assistant. The user wants to test whether the app — used end-to-end by an external operator (Claude, driving the UI via Playwright/MCP) — can guide the build of a **packaged playable ARPG vertical slice**: WASD move, melee attack, kill a dummy enemy, see loot drop on death, all in a cooked executable that runs outside the editor.

The total initiative spans four sub-projects:

| Sub-project | Deliverable | Status |
|---|---|---|
| **A** | Codebase analysis + scenario map + gap inventory + testId coverage map | **This spec** |
| B | Implement gaps A flags as blocking the vertical slice | Brainstorm after A |
| C | Add `data-testid` attributes per A's coverage map | Brainstorm after A; can parallel B |
| D | Playwright-drive PoF UI → build the slice → packaged build runs → write findings report | Brainstorm after B+C |

Sub-project A is **pure analysis**. No source files outside `docs/features/arpg-vertical-slice/` are touched.

## Goals

1. Produce an authoritative scenario map (`INDEX.md`) walking the end-to-end user flow as a Playwright operator will experience it: step → screen/module → testIds clicked → expected UE5 artifact.
2. Produce one short readiness note per in-scope game-side module so sub-project B's plan can size its work without re-reading the codebase.
3. Produce a single sortable `gap-inventory.md` table that is the source of truth for sub-project B scoping.
4. Produce a single `testid-coverage.md` table that is the source of truth for sub-project C work.
5. End sub-project A with a one-page chat summary: gap count, blocker count, recommended sub-project B scope.

## Non-goals

- No source-file edits outside `docs/features/arpg-vertical-slice/`.
- No new tests, no new npm scripts, no new harness verifiers.
- No testIds added, no UI changes, no API changes — every finding is documented, not fixed.
- No analysis of out-of-scope modules: progression, save, dialogue/quests, world streaming, multiplayer, materials, audio (each gets a one-line mention in `INDEX.md` only if they show up unexpectedly as dependencies of in-scope work).

## In-scope modules

**Game-side (10):** project-setup, arpg-character, input-handling, arpg-animation, arpg-gas, arpg-combat, arpg-enemy-ai, arpg-loot, arpg-ui, packaging (under game-systems).

**Infrastructure surfaces (covered inside `INDEX.md`):** sidebar / module navigation, project-setup wizard, CLI terminal panel, harness orchestrator UI + API, feature matrix, evaluator (3-pass quality gate).

## Output structure

```
docs/features/arpg-vertical-slice/
├── INDEX.md
├── gap-inventory.md
├── testid-coverage.md
└── modules/
    ├── project-setup.md
    ├── arpg-character.md
    ├── input-handling.md
    ├── arpg-animation.md
    ├── arpg-gas.md
    ├── arpg-combat.md
    ├── arpg-enemy-ai.md
    ├── arpg-loot.md
    ├── arpg-ui.md
    └── packaging.md
```

## Per-module file template (`modules/*.md`)

Each file uses the same 6 sections, hard cap ~100 lines:

1. **One-line purpose** — what this module does in PoF.
2. **Files of record** — main UI component(s), API routes, prompt builders, store slice; with `file:line` citations.
3. **Vertical-slice relevance** — what we need this module to produce for the slice (specific UE5 artifact + acceptance bullet).
4. **Current state** — what already works, briefly. Cite the harness scenario (`docs/harness/harness-scenario.md`) and module-registry checklist completion if known.
5. **Gaps blocking the slice** — bullets, each `(severity: S/M/L)` + one-line "what + why."
6. **testId touchpoints** — components/buttons Playwright must click + target testId names per the convention below.

## `INDEX.md` structure

1. **Vertical-slice success criteria** — 3-5 concrete bullets (WASD move in PIE, LMB plays attack montage, attack damages enemy, enemy dies + spawns world-item, packaged build launches + does all of the above).
2. **End-to-end user flow** — numbered steps as a Playwright operator experiences them. Each step: screen/module, testIds clicked, expected PoF outcome, expected UE5 artifact.
3. **Module dependency wave order** — small DAG referencing `feature-definitions.ts`.
4. **Infrastructure surfaces** — short subsection per surface: role in the scenario + gap notes (since infra surfaces don't get their own `modules/*.md`).
5. **Open questions surfaced during analysis** — anything flagged for resolution before sub-project B.

## `gap-inventory.md` structure

Single markdown table, append-only, sorted by severity then by module:

| ID | Module | Category | Severity | Blocking? | Title | Notes / file:line |
|----|--------|----------|----------|-----------|-------|---|

**Categories (closed set):** `testId-missing`, `prompt-defect`, `ui-missing`, `api-missing`, `harness-verifier`, `behavior-bug`, `docs-stale`.

**Severity:** S (≤30 min), M (≤2 hrs), L (>2 hrs). Coarse on purpose.

**Blocking?** Y blocks the vertical slice; N is nice-to-have / surfaced for later sub-projects.

## `testid-coverage.md` structure

One table per file path the Playwright flow touches:

| File | Component | Target testId | Currently present? | Notes |

The per-module notes feed this; the `INDEX.md` scenario steps cite specific testId names from this doc.

## testId naming convention

**`pof-<surface>-<element>[-<modifier>]`**, lowercase kebab.

| Surface examples | Element examples | Modifier examples |
|---|---|---|
| `sidebar`, `setup-wizard`, `cli-panel`, `harness`, `module-{moduleId}`, `feature-matrix` | `nav-item`, `submit-btn`, `path-input`, `start-btn`, `tab`, `row` | `{moduleId}`, `{rowKey}`, `{tabId}` |

Examples:
- `pof-sidebar-nav-item-arpg-character`
- `pof-setup-wizard-path-input`
- `pof-harness-start-btn`
- `pof-module-arpg-combat-quick-action-melee`
- `pof-feature-matrix-row-melee-attack`

**Rules:** stable across re-renders, never contain user data (no file paths, no usernames), unique within a page. Existing testIds (102 occurrences across 30 files) don't follow this convention — sub-project C adds new testIds matching the convention and leaves existing ones alone unless they collide.

## Execution plan (process — implementation belongs to sub-project A's plan doc)

1. **Parallel agent dispatch.** Single tool-call batch launches 10 `Explore` agents, one per game-side module. Each receives a self-contained brief embedding the 6-section template, vertical-slice success criteria, and that module's in-scope deliverable. Output: write `docs/features/arpg-vertical-slice/modules/<module-id>.md`. Time budget: ~5 min each.

2. **Main-thread work while agents run.** Write skeletons for `INDEX.md`, `gap-inventory.md`, `testid-coverage.md`.

3. **Consolidation pass after agents return.** Read each produced file. Cross-link from `INDEX.md`. Hoist every "Gaps blocking the slice" bullet into `gap-inventory.md` with a stable `GAP-NNN` ID. Hoist every "testId touchpoints" row into `testid-coverage.md`.

4. **Self-review.** Check no `GAP-NNN` is referenced from `INDEX.md` but missing from `gap-inventory.md`. Check no testId is cited in a scenario step but missing from `testid-coverage.md`. Check each module file is ≤100 lines.

5. **Commit.** Single commit: `docs(features): arpg vertical-slice readiness analysis`.

6. **Chat summary.** One-page summary: N gaps total, X blockers, recommended sub-project B scope.

## Definition of done

1. 13 files exist in `docs/features/arpg-vertical-slice/` (INDEX + inventory + coverage + 10 module notes).
2. `INDEX.md` cites every gap by `GAP-NNN` ID and every testId by name; no dangling references.
3. `gap-inventory.md` has every gap categorized + sized + flagged blocking/non-blocking.
4. `testid-coverage.md` enumerates every control the scenario's Playwright steps will touch.
5. Single commit landed with the message above.
6. Chat summary delivered; user makes the call on whether to proceed to sub-project B.

## Risks & mitigations

- **Agent reports drift from template.** Mitigation: include the full template literally in each agent brief; consolidation pass enforces the structure.
- **Cross-module gaps get double-counted or missed.** Mitigation: consolidation pass owns `gap-inventory.md`; agents only write into their own module files.
- **Infrastructure-surface gaps fall through the cracks.** Mitigation: `INDEX.md` Section 4 explicitly lists infra surfaces and is written in the main thread, not by agents.
- **testId convention conflicts with the 102 existing occurrences.** Mitigation: spec says existing ones are left alone unless they collide; collisions get logged as gap items, not silently renamed.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → produce sub-project A's implementation plan (the actual agent briefs, the skeleton-doc seeds, the consolidation checklist).
4. Execute sub-project A.
5. Brainstorm sub-project B (gap-fix) using A's outputs.
