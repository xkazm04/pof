---
date: 2026-05-19
status: draft
sub_project: D (scenario execution)
sub_phase: D1 (harness only)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-analysis-design.md
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-gap-fix-design.md
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-testid-coverage-design.md
operator_flow_source: docs/features/arpg-vertical-slice/INDEX.md (§2, 24 steps)
---

# Sub-project D, Phase 1: ARPG vertical-slice — scenario harness

## Context

Sub-projects A, B, and C produced:
- A 24-step operator flow walking the vertical-slice scenario (`INDEX.md §2`).
- All 11 hard blockers + 7 non-blocking testId gaps closed (18/20 total).
- An `e2e/infra-testids.spec.ts` proving the testIds are queryable.

Sub-project D's job is to actually **execute** the flow. Because the full execution involves real Claude Code + real UE5 build + real game launch — none of which can be assumed in a CI-like environment — D is decomposed into three phases:

| Phase | Deliverable | This spec |
|---|---|---|
| **D1** | **Harness** — Playwright spec that walks the 24 steps, with side-effects stubbed; live-mode plumbing wired but inactive | **This spec** |
| D2 | First live run — flip the env flag, address findings | Future spec |
| D3 | Iterate on findings from D2 | Future spec |

D1 produces a runnable, reviewable, repeatable artifact that exercises every navigable step of the flow. The harness intercepts side-effect dispatches (CLI prompts, cook endpoint) via Playwright's `page.route()` in stub mode and records them for inspection. Live mode is a single env flag away (`HARNESS_MODE=live`), but D1 does not exercise it.

## Goals

1. Produce `e2e/arpg-vertical-slice.spec.ts` — single `test()` with 24 ordered `test.step()` blocks matching `INDEX.md §2`.
2. Produce `e2e/helpers/harness-mode.ts` — central helper for stub/live mode routing.
3. Produce `e2e/helpers/dispatch-recorder.ts` — captures intercepted prompts to JSON artifact.
4. Run the spec once in stub mode; commit the resulting findings doc at `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-stub.md`.
5. Findings doc explicitly enumerates "what D2 needs to wire up to run live" — Claude Code auth, UE5 prereqs, etc.

## Non-goals

- **No live mode run in D1.** The env-flag plumbing is included; the actual live execution is D2.
- **No vertical-slice gameplay assertion.** Phase 8 of the flow (.exe launch + WASD + LMB + assert) is skipped in stub mode and deferred to D2/D3.
- **No new PoF source files.** All harness code lives in `e2e/`. PoF source stays untouched.
- **No iteration on what the run surfaces.** That's D3.
- **No real Claude Code dispatches**, no real cook, no real .exe launch.

## Decision record (from brainstorming)

1. **D shape:** D1 builds the harness only; D2/D3 do the live runs + iteration (per "Decompose: D1 = harness" decision).
2. **Form factor:** single Playwright spec at `e2e/arpg-vertical-slice.spec.ts` (per "Single Playwright spec" decision).
3. **Side-effects:** env flag `HARNESS_MODE=stub|live` (defaults to stub). All side-effect routing lives in `e2e/helpers/harness-mode.ts` using `page.route()` — PoF source remains untouched.
4. **Spec structure:** one `test()` block containing 24 ordered `test.step()` blocks (per "Approach 1 — one test with test.step" decision).

## In-scope deliverables

### Files created

- `e2e/arpg-vertical-slice.spec.ts` — the spec; ~300-400 lines
- `e2e/helpers/harness-mode.ts` — env-flag + route() interceptors; ~120 lines
- `e2e/helpers/dispatch-recorder.ts` — captures prompts/cook args; ~50 lines
- `e2e/artifacts/.gitignore` — excludes `dispatched-prompts-*.json` and any HTML report dirs the spec writes there
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-stub.md` — output of the first stub-mode run

### Files NOT touched

- No PoF source files (`src/**`)
- No existing e2e specs (`e2e/infra-testids.spec.ts`, `e2e/dzin-panels.spec.ts`, `e2e/core-engine-modules.spec.ts`)
- No `playwright.config.ts` changes (existing config supports new spec automatically)

## Spec structure

```typescript
import { test, expect, type Page } from '@playwright/test';
import { setupHarnessMode, type HarnessHandle } from './helpers/harness-mode';

// Reuses the enterWorkspace helper from infra-testids.spec.ts pattern.
async function enterWorkspace(page: Page) { /* same shape as e2e/infra-testids.spec.ts */ }

test.describe('ARPG vertical slice — operator flow', () => {
  test.setTimeout(120_000); // 24 steps × ~5s each + overhead

  test('walks all 24 steps from INDEX.md §2', async ({ page }) => {
    const harness = await setupHarnessMode(page);

    // Phase 0: Bootstrap (Steps 1-6)
    await test.step('Step 1: Launch PoF', async () => { /* page.goto('/') */ });
    await test.step('Step 2: Sidebar → Project Setup', async () => { /* ... */ });
    await test.step('Step 3: Open Setup Wizard', async () => { /* ... */ });
    await test.step('Step 4: Select existing PoF project', async () => { /* slugifyForTestId('PoF') */ });
    await test.step('Step 5: Wait for status checks', async () => { /* assert checklist visible */ });
    await test.step('Step 6: Verify build (dispatches CLI)', async () => { /* button click, stub returns success */ });

    // Phase 1: Wave 0 (Steps 7-8)
    await test.step('Step 7: Navigate to arpg-character (no CLI dispatch)', async () => { /* ... */ });
    await test.step('Step 8: Navigate to input-handling, run ih-1 + ih-2 via checklist', async () => { /* ... */ });

    // Phase 2: Wave 1 (Steps 9-10)
    await test.step('Step 9: arpg-animation aa-1 + aa-3', async () => { /* ... */ });
    await test.step('Step 10: arpg-gas via CLI (ag-1, ag-2, ag-4)', async () => { /* ... */ });

    // Phase 3: Wave 2 (Steps 11-12)
    await test.step('Step 11: arpg-combat acb-1 + acb-4', async () => { /* ... */ });
    await test.step('Step 12: arpg-enemy-ai minimal-dummy (ae-1 only)', async () => { /* ... */ });

    // Phase 4: Wave 3 (Steps 13-14)
    await test.step('Step 13: arpg-loot cheat-path (al-5, al-6)', async () => { /* ... */ });
    await test.step('Step 14: arpg-ui HUD-only (au-1, au-2, au-7)', async () => { /* ... */ });

    // Phase 5: Feature-matrix verification (Step 15)
    await test.step('Step 15: Per-module feature-matrix scan', async () => { /* iterate over in-scope modules */ });

    // Phase 6: Evaluator gate (Step 16)
    await test.step('Step 16: Deep Eval on slice modules', async () => { /* run-btn, assert result-summary appears */ });

    // Phase 7: Packaging (Steps 17-21)
    await test.step('Step 17: Navigate to packaging', async () => { /* ... */ });
    await test.step('Step 18: Select Win64 Shipping', async () => { /* ... */ });
    await test.step('Step 19: Trigger cook (POST /api/packaging/execute, stubbed)', async () => { /* ... */ });
    await test.step('Step 20: Wait for cook to finish via CookProgress', async () => { /* poll pof-cook-progress-phase until "done" */ });
    await test.step('Step 21: Read .exe path', async () => { /* assert pof-cook-progress-exe-path or pof-module-packaging-exe-path-* visible */ });

    // Phase 8: Slice verification (Steps 22-24) — live-only
    await test.step('Steps 22-24: Launch .exe + WASD + LMB + assert', async () => {
      test.skip(harness.mode !== 'live', 'Phase 8 (.exe launch + gameplay assert) requires HARNESS_MODE=live + real UE5 install');
      // Implementation deferred to D2/D3.
    });

    // Findings emission (always runs)
    await harness.writeFindings();
  });
});
```

Each `test.step` block:
- Has its own scoped Playwright assertions.
- Shows in HTML report as a collapsible tree node.
- Failure short-circuits subsequent steps with clear visual indicator.

## `harness-mode.ts` helper interface

```typescript
import { type Page } from '@playwright/test';

export type DispatchKind = 'cli-session-create' | 'cli-prompt-send' | 'cook-execute' | 'unknown';

export interface DispatchRecord {
  kind: DispatchKind;
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
  stepLabel?: string;  // populated from the surrounding test.step
}

export interface HarnessHandle {
  mode: 'stub' | 'live';
  dispatched: DispatchRecord[];
  /**
   * Writes the findings markdown + the dispatches JSON artifact.
   * Markdown → docs/features/arpg-vertical-slice/scenario-runs/{YYYY-MM-DD}-{mode}.md
   * JSON     → e2e/artifacts/dispatched-prompts-{timestamp}.json
   */
  writeFindings(): Promise<void>;
}

export async function setupHarnessMode(page: Page): Promise<HarnessHandle>;
```

### Stub-mode behavior

For each intercepted endpoint, the stub:
1. Records the request to `dispatched: DispatchRecord[]`.
2. Returns a synthetic success response.

The endpoints to intercept (verified by reading `src/components/cli/*` + `src/app/api/*` during implementation; falsey assumptions about endpoint shape get adapted at write time):
- **CLI prompt dispatch** — likely `POST /api/cli/sessions` (create) + dispatch via `useModuleCLI.sendPrompt()` (need to identify the underlying transport — REST or in-process). Pattern: stub both with mock-success.
- **Cook execute** — `POST /api/packaging/execute` (created in sub-project B, a8072e6). Synthetic SSE stream: phase=cook → progress=50 → done with fake exePath.

### Live-mode behavior

`page.route()` is not installed; all requests pass through. The spec still records dispatches via response listeners (for the findings doc) but does not interfere with them.

### Why route() and not source-side stub flags

The harness must not require PoF source changes. Putting the stub flag inside PoF (e.g., reading `process.env.HARNESS_STUB`) would couple the runtime app to its tests. `page.route()` keeps the abstraction clean.

## `dispatch-recorder.ts` helper

Single-purpose utility consumed by `harness-mode.ts`:

```typescript
import type { DispatchRecord } from './harness-mode';

export class DispatchRecorder {
  private records: DispatchRecord[] = [];
  record(r: Omit<DispatchRecord, 'timestamp'>): void;
  all(): DispatchRecord[];
  byKind(kind: DispatchRecord['kind']): DispatchRecord[];
  async writeJSON(path: string): Promise<void>;
}
```

Kept as its own file so it's unit-testable (can construct a recorder, call `record()`, assert `all()` returns the right shape).

## Findings artifact format

After every spec run, `harness.writeFindings()` produces:

**Markdown** at `docs/features/arpg-vertical-slice/scenario-runs/YYYY-MM-DD-{stub|live}.md`:

```markdown
# Scenario Run — YYYY-MM-DD ({stub|live} mode)

**Result:** N/24 steps passed. M skipped. K failed.

## Per-step results
| # | Step | Status | Duration | Notes |
|---|------|--------|----------|-------|

## Captured dispatches
- N CLI session creates
- M CLI prompt sends (see `e2e/artifacts/dispatched-prompts-{timestamp}.json`)
- K cook dispatches

## Findings for sub-project D2 (live-mode prerequisites)
- [ ] Claude Code CLI authenticated (`claude --version` should work in PoF's shell environment)
- [ ] UE5 5.7 installed at expected engine path (verify via project-setup status checks)
- [ ] Visual Studio 2022 + Windows SDK + .NET tools installed
- [ ] UE5 project at `C:\Users\kazda\Documents\Unreal Projects\PoF` builds clean (the build-verify step would catch this)
- [ ] `~/.pof/pof.db` initialised (CRUD test in some pre-existing test suite covers this; harness can assert presence)

## Findings for sub-project D3 (iteration)
- _[empty in D1's stub run; D2 will populate]_
```

**JSON** at `e2e/artifacts/dispatched-prompts-{timestamp}.json`:

```json
{
  "runMode": "stub",
  "startedAt": "...",
  "finishedAt": "...",
  "dispatches": [
    { "kind": "cli-prompt-send", "url": "...", "method": "POST", "body": {...}, "timestamp": 1234567890, "stepLabel": "Step 8: input-handling ih-1" }
  ]
}
```

## Step-by-step testId reference

Each `test.step` block uses the testIds documented in [docs/features/arpg-vertical-slice/testid-coverage.md](../../features/arpg-vertical-slice/testid-coverage.md). Key fact discovered during sub-project C: the arpg-animation **sub-module id is `animations`, not `arpg-animation`** (registry id vs. testId prefix mismatch). The spec must use `pof-sidebar-l2-nav-item-animations` for navigation while testIds on the page use `pof-module-arpg-animation-*` prefix.

Other quirks the spec must handle (from sub-project C run):
- Project Setup category is default-active; SidebarL2 doesn't render sub-module list (only one sub-module exists).
- ReviewableModuleView defaults to Overview tab; checklist items live on the Roadmap sub-tab.
- CombatActionMap testIds live on a "Combat Map" extra tab inside arpg-combat.
- AnimationsView tab testIds are on render-output wrappers, not the actual tab buttons (use `getByRole('tab', { name: ... })` for clicking).
- arpg-enemy-ai dzin panels render under `/prototype` only; standard module page exposes the ReviewableModuleView root testId.
- BuildConfigSelector lives on the "Pipeline" extra tab inside packaging.
- FeatureMatrix lives on the "Features" sub-tab inside each core-engine module.

## Cross-cutting

- **Branching:** `master`. Two commits: (1) harness spec + helpers + `.gitignore`; (2) first stub-mode run's findings doc.
- **Validation:** `npx playwright test e2e/arpg-vertical-slice.spec.ts` (default mode = stub) must pass cleanly. `npm run validate` stays green.
- **No worktree.**
- **Existing e2e specs untouched** (`infra-testids.spec.ts`, `dzin-panels.spec.ts`, `core-engine-modules.spec.ts`).
- **Live mode is intentionally a one-line change for D2**: `HARNESS_MODE=live npx playwright test e2e/arpg-vertical-slice.spec.ts`.

## Definition of done

1. `e2e/arpg-vertical-slice.spec.ts` exists; runs in stub mode with all non-skipped steps passing (~21/24 expected; Phase 8 skipped).
2. `e2e/helpers/harness-mode.ts` and `e2e/helpers/dispatch-recorder.ts` exist with the documented interfaces.
3. `e2e/artifacts/.gitignore` excludes generated artifacts.
4. First stub-mode run committed at `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-stub.md`.
5. CLI dispatch endpoints correctly identified by reading `src/components/cli/*` + `src/app/api/*` (spec author verifies at implementation time; falsey assumption adapted).
6. Findings doc lists D2 prerequisites and stays empty on D3 findings.
7. Single chat summary: SHAs, step pass count, dispatch counts, recommended D2 scope.

## Risks & mitigations

- **CLI dispatch is not over HTTP** (it could be in-process via Zustand store + Agent SDK directly). Mitigation: `page.route()` only catches network requests; if dispatch is in-process, the stub helper falls back to overriding the relevant store method via `page.evaluate()` to no-op in stub mode. Spec author identifies the real transport during implementation and adapts.
- **The cook endpoint exists but the spec needs the real route pattern**. Mitigation: it's `POST /api/packaging/execute` per a8072e6 — verified by `git show a8072e6 --stat | grep packaging/execute`.
- **Spec is slow** (24 steps × waits + animations). Mitigation: `test.setTimeout(120_000)`; reuse the `enterWorkspace` helper pattern that batches sidebar discovery; aggressive use of `waitForLoadState('domcontentloaded')` instead of `'networkidle'`.
- **State pollution between runs** (PoF persists to `~/.pof/pof.db`, localStorage, IndexedDB). Mitigation: spec is a single ordered test; runs are independent so pollution between runs is acceptable. Document as "tests are not idempotent across multiple sequential runs without DB reset."
- **Live-mode plumbing untested in D1.** Mitigation: explicit non-goal; D2 will exercise live mode and surface live-specific issues.
- **Findings doc grows stale.** Mitigation: it's named by date + mode so each run produces a new file; the spec writes it fresh each time.

## Hand-off to D2 and D3

After D1 lands:

- **D2** brainstorm picks: which prerequisites to validate before flipping the flag, how to handle live cook failures gracefully, whether to wire the Phase 8 .exe launch via `child_process.spawn` + a Node-side wait-for-window scheme.
- **D3** brainstorm picks: which findings from D2 to fix in PoF (likely new gaps), which to defer, whether to wire a second sub-project for Phase 8 (gameplay assertion is its own beast — would need `nut.js` / `robotjs` / `iohook` for keyboard simulation + pixel-diff or vision for assertion).

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → per-task implementation plan with full code bodies.
4. Execute D1 — likely as one subagent (the spec + helpers form one cohesive unit; the work doesn't decompose into file-disjoint streams).
5. Brainstorm D2 once D1's stub-mode findings doc is in hand.
