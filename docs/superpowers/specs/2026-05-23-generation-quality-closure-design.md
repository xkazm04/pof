# Generation-Quality (Improvements §01) — Closure Design

**Date:** 2026-05-23
**Source concern:** `docs/improvements/01-generation-quality/` (`README.md`, `pof-app.md`, `tests.md`)
**Repo:** PoF app (this repo). The UE game project (`xkazm04/pof-exp`) is **not** touched — per the folder's README, §01's UE-side output is "better prompts, not new game code."

## Context — what already exists

A prior session implemented most of §01 (commits `6a490d8`, `0ddb76c`, `6a0451e`,
`e4dc5c3`, `8249c7f`, `e8edf5c`) with 41 passing tests. Confirmed present and
active:

| §01 item | State |
|---|---|
| #2 Binary-content tripwire | Done — `src/lib/knowledge/binary-content.ts`, injected in `buildProjectContextHeader` |
| #3 UE-API gotchas pack | Done — `src/lib/knowledge/ue-gotchas.ts` (7 gotchas), injected for `ue-cpp`/`ue-python` prompts |
| #4 Ground-truth Pass 0 | Done — `src/lib/evaluator/module-eval-prompts.ts` 4-pass, with test |
| #5 Wiring assets (data) | Done — `WiringAsset` type + `MODULE_WIRING_ASSETS` + helpers in `feature-definitions.ts`; module-level "needs binary content" badge in `FeatureMatrix` |
| #1 Wiring Requirements (method) | **Inert** — `PromptBuilder.withWiringRequirements()` exists + is unit-tested, but no production code path calls it |
| #6 LRU eviction guard | **Not started** |

**The headline gap:** §01's central lesson is "compiles but never wired." The
mechanism to fix it (`withWiringRequirements`) exists but is **never invoked by
the real dispatch path**, so no dispatched prompt actually carries a Wiring
Requirements section. The real assembler is `buildTaskPrompt()` in
`src/lib/cli-task.ts`, which concatenates strings and calls
`buildProjectContextHeader()` (where gotchas + tripwire inject) — it never
touches `PromptBuilder`.

Worse, the **binary-content tripwire already references a section that doesn't
exist**: its text tells the model to "declare un-authorable assets in a Wiring
Requirements section." Item A makes that reference real, so the tripwire stops
pointing at a phantom heading.

## Scope

Four work items (A–D). The user selected "full closure."

- **A** — Activate Wiring Requirements in the real dispatch path. *(#1)*
- **B** — Don't clobber a running CLI session at the cap. *(#6)*
- **C** — Per-module wiring-asset breakdown in `FeatureMatrix`. *(#5 UI)*
- **D** — Tests: a deterministic registry-wide wiring-smoke test + unit tests. *(`tests.md`)*

### Explicitly out of scope

- **`game.md`** UE C++ conventions (DefaultAbilities interface, `ARPGCodeWidgetBase`,
  lifecycle log header, `WITH_EDITOR` audit, `ARPG.SelfCheck.*`) — these are UE
  project changes owned by folders 02–08, not this repo.
- **D2 "gemini-recognize.mjs plumbing test"** — **dropped.** That CLI does not
  exist in this repo. The PoF "Gemini" code is the in-app voice advisor
  (`live-token`, `forge-ability`, `useMultimodalInput`); the harness visual gate
  (`src/lib/harness/visual-gate.ts`) uses Playwright screenshots + React-error
  detection, not Gemini vision. `gemini-recognize.mjs` belongs to the
  UE/vertical-slice tooling, so there is nothing in this repo to plumb-test.
- **A literal `HARNESS_MODE=wiring-smoke`** — the harness has no mode switch; it
  is config-driven. The deterministic vitest in D1 is the honest realization of
  that item's intent (guard the wiring injection across all modules) without
  spawning Claude or requiring a UE project.

## A · Activate Wiring Requirements in the dispatch path

### A.1 Extract a shared formatter

New module `src/lib/knowledge/wiring-requirements.ts`, mirroring the shape of
`ue-gotchas.ts`/`binary-content.ts`:

```ts
import type { WiringAsset } from '@/lib/feature-definitions';

export interface WiringRequirement {        // moved here from prompt-builder.ts
  artifact: string;
  grantedBy?: string;
  activatedBy?: string;
  dependencies?: string[];
  verification?: string;
}

export interface WiringRequirementsOptions {
  /** Known per-artifact wiring hints (rendered as a table). */
  reqs?: WiringRequirement[];
  /** Module's known editor-authored dependencies (from MODULE_WIRING_ASSETS). */
  moduleAssets?: WiringAsset[];
}

/** Returns the full "## Wiring Requirements" markdown block. */
export function formatWiringRequirements(opts?: WiringRequirementsOptions): string;
```

The static four-point body (granting/registration, activation, dependencies,
verification) and the `wiring` output-field instruction are exactly the text
already in `PromptBuilder.withWiringRequirements()` (lines 117–123) — moved
verbatim so there is **one source of truth**. When `moduleAssets` is non-empty,
append a distinct sub-list: `Known editor-authored dependencies for this module:`
followed by `- {name} ({kind}): {note}` per asset. `WiringRequirement` and
`WiringAsset` keep their separate shapes; assets are *not* coerced into the
requirement table.

### A.2 `PromptBuilder.withWiringRequirements()` delegates

`withWiringRequirements(reqs)` becomes a thin wrapper that calls
`formatWiringRequirements({ reqs })` and stores the result. `WiringRequirement`
is re-exported from `prompt-builder.ts` for back-compat so existing imports and
the `wiring-section.test.ts` snapshot keep working. Behavior is unchanged for
that test (it tests the no-asset path).

### A.3 Inject in `buildTaskPrompt`

In `src/lib/cli-task.ts`, append the formatted block for **UE generation task
types only**:

- Eligible types: `checklist`, `quick-action`, `feature-fix`.
- Excluded: `ask-claude` (free-form Q&A, not generation — note it shares the
  `quick-action` switch branch, so gate on `task.type === 'quick-action'`
  inside that branch), `feature-review` (read-only inventory), `module-scan`.
- Guard on `isUE5` (already computed at the top of `buildTaskPrompt`).

Each eligible branch fetches `getWiringAssets(task.moduleId)` and inserts
`formatWiringRequirements({ moduleAssets })` after the task/instructions body
and before the callback section where one exists (`quick-action` has no
callback, so it is simply appended after the task) — so the wiring expectations
precede the output-contract. A small local helper keeps the three branches
consistent:

```ts
const wiringBlock =
  isUE5 && WIRING_TASK_TYPES.has(task.type)
    ? '\n\n' + formatWiringRequirements({ moduleAssets: getWiringAssets(task.moduleId) })
    : '';
```

`WIRING_TASK_TYPES = new Set(['checklist', 'quick-action', 'feature-fix'])`.

### A.4 Result

Every dispatched gameplay generation/fix prompt now carries: project context →
gotchas → tripwire (already there) **+ Wiring Requirements with module-specific
known dependencies** → task → callback. The headline "compiles but never wired"
gap is closed at generation time, and #5's data feeds #1's prompt.

## B · Don't clobber a running session at the cap (#6)

`src/components/cli/store/cliPanelStore.ts` `createSession()` currently does, at
the 8-tab cap: `return tabOrder[tabOrder.length - 1]` — handing back an existing
tab that **may be `isRunning`**, so a fresh dispatch overwrites a live one.

**Fix:** at the cap, pick the **least-recently-active idle** session to reuse
(lowest `lastActivityAt` among sessions where `isRunning === false`). If **every**
session is running, **exceed the cap** and create a new session rather than
clobber any live dispatch (per user decision). Concretely:

```ts
if (tabOrder.length >= MAX_SESSIONS) {
  const idle = tabOrder
    .map((tid) => sessions[tid])
    .filter((s) => s && !s.isRunning)
    .sort((a, b) => a.lastActivityAt - b.lastActivityAt);
  if (idle.length > 0) return idle[0].id;   // reuse stalest idle tab
  // else fall through and create a new session (temporary over-cap)
}
```

`MAX_SESSIONS = 8` becomes a named constant. The "5-session terminal LRU" in the
spec text predates the current 8-cap store; this is the real, testable
manifestation of its intent ("a session with `isRunning` is pinned").

No change to suspend/`useSuspendableEffect`: the CLI panel is a global shell
component, not part of a suspended module subtree, so module suspension does not
lose a dispatch — the cap-reuse path is the real risk.

## C · Per-module wiring-asset breakdown in FeatureMatrix (#5 UI)

`src/components/modules/shared/FeatureMatrix.tsx` shows only a module-level
"needs binary content" badge (≈ line 457, gated on `moduleNeedsBinaryContent`).

**Upgrade:** keep the badge as a click/hover affordance that reveals an
expandable **Wiring Assets** list of the module's `getWiringAssets(moduleId)`,
each row showing `name · kind · note`, with binary-authored kinds
(`WidgetBlueprint`, `AnimBlueprint`, `BehaviorTree`) visually flagged
(`STATUS_WARNING` from `@/lib/chart-colors`, no raw hex). When a module has no
wiring assets, render nothing (unchanged). This makes "compiled, not wired"
visible per dependency, not just as a single badge.

Wiring assets are keyed **per-module** in the data model
(`MODULE_WIRING_ASSETS: Partial<Record<SubModuleId, WiringAsset[]>>`), so this is
a per-module panel, not a per-feature table column — matching the actual data.
Implemented as a small presentational subcomponent (e.g. `WiringAssetsPanel`) to
keep `FeatureMatrix` focused.

## D · Tests

All vitest unless noted. New/extended files under `src/__tests__/`.

1. **`formatWiringRequirements` unit test** (`src/__tests__/knowledge/wiring-requirements.test.ts`)
   — asserts the four sub-points + `wiring` output-field instruction are present
   with no assets; asserts the module-asset sub-list renders `name (kind): note`
   when `moduleAssets` is supplied; snapshot for stability.
2. **Dispatch-injection test** (`src/__tests__/prompts/wiring-dispatch.test.ts`)
   — builds prompts via `buildTaskPrompt` for a synthetic `checklist`,
   `quick-action`, and `feature-fix` task (UE5 ctx) and asserts the Wiring
   Requirements heading is present; builds a `feature-review` and an `ask-claude`
   task and asserts it is **absent**; builds a non-UE5 (web) ctx checklist and
   asserts it is absent.
3. **D1 — registry-wide wiring-smoke** (`src/__tests__/registry/wiring-smoke.test.ts`)
   — iterates **every** sub-module in the registry, builds a `checklist`
   dispatch prompt via `buildTaskPrompt`, and asserts the Wiring Requirements
   block is present for each. Deterministic; no Claude/UE/dev-server. This is the
   honest realization of `tests.md`'s "wiring-smoke harness mode."
4. **`createSession` cap-guard test** (`src/__tests__/stores/cliPanelStore.test.ts`,
   extend if present) — at cap with one idle session: reuses the idle tab; at cap
   with all running: creates a new session (length grows past cap); reuse picks
   the stalest idle by `lastActivityAt`.
5. **`PromptBuilder` regression** — confirm `wiring-section.test.ts` still passes
   after the delegation refactor (no behavior change on the no-asset path).

## Verification this work succeeded

- `npm run validate` (typecheck + lint + test) is green, including the new tests.
- A grep of the dispatch output for any gameplay module's checklist prompt shows
  a `## Wiring Requirements` block with that module's known editor-authored
  dependencies.
- `withWiringRequirements` and `formatWiringRequirements` share one text source
  (no duplicated body string).
- `FeatureMatrix` for a binary-content module (e.g. `arpg-character`) shows the
  per-asset breakdown, not just the badge.
- Creating sessions past the cap while one is running does not reset/clobber the
  running session's `currentExecutionId`/`isRunning`.

## File-change summary

| File | Change |
|---|---|
| `src/lib/knowledge/wiring-requirements.ts` | **New** — `formatWiringRequirements`, `WiringRequirement`, options type |
| `src/lib/prompts/prompt-builder.ts` | `withWiringRequirements` delegates to formatter; re-export `WiringRequirement` |
| `src/lib/cli-task.ts` | Inject wiring block in `buildTaskPrompt` for `checklist`/`quick-action`/`feature-fix` (UE5 only) |
| `src/components/cli/store/cliPanelStore.ts` | Cap-guard in `createSession`; `MAX_SESSIONS` constant |
| `src/components/modules/shared/FeatureMatrix.tsx` | Expandable wiring-asset breakdown (new `WiringAssetsPanel` subcomponent) |
| `src/__tests__/knowledge/wiring-requirements.test.ts` | **New** |
| `src/__tests__/prompts/wiring-dispatch.test.ts` | **New** |
| `src/__tests__/registry/wiring-smoke.test.ts` | **New** |
| `src/__tests__/stores/cliPanelStore.test.ts` | **New/extend** |
