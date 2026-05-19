---
date: 2026-05-19
status: draft
sub_project: D (scenario execution)
sub_phase: D5 (idempotency fix)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d4-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d4.md
---

# Sub-project D5: ARPG vertical-slice — fix harness idempotency

## Context

D4's live run surfaced a regression: all three live steps fast-failed in 7.9s, including Step 8 ih-1 which had passed in D3. The root cause is **server-side persistent state** — D3's successful completion of ih-1 auto-marked the checklist item as `checked=true` in `~/.pof/pof.db` via `useModuleStore`'s `persist` middleware. On D4's run, the persisted state loaded, and `RoadmapChecklist.tsx:648` only renders the "Run Claude" button for `!checked` items. With the button missing from the DOM, the harness's `getByRole` failed and the dispatch never fired.

D5 fixes this by adding a `beforeEach` fixture that resets module progress for the test project before each live run.

The mechanism is straightforward: PoF already exposes `POST /api/project-progress` (`src/app/api/project-progress/route.ts`) which accepts the full progress snapshot and overwrites the existing row (keyed by `sha256(projectPath).slice(0,16)`). Posting empty objects effectively resets all progress for that project.

## Goals

1. Add `resetProgressForTestProject(page)` helper in `e2e/helpers/harness-mode.ts`.
2. Add `test.beforeEach(...)` to the live spec that calls the helper.
3. Bump `filenameSuffix` from `'d4'` to `'d5'`.
4. Re-run the live spec. Step 8 ih-1 should re-pass (idempotency restored). Step 9 aa-1 likely still fails but with its own independent cause exposed.
5. Capture findings at `2026-05-19-live-d5.md`.

## Non-goals

- **No UE5 asset cleanup.** D3's `IA_Move.uasset`/`IA_Attack.uasset` and the `InputAssetCommandlet` source files stay. If Claude's commandlet errors on re-run because files exist, that becomes a D6 finding.
- **No packaging-profile cleanup.** Profiles accumulating in `~/.pof/pof.db` is data hygiene, not a harness blocker.
- **No source-side test-mode flag.** All work in `e2e/`.
- **No new live steps.** Step 10+ still deferred.
- **Finding A (Step 6 build verify) still not fixed.** Same expected-failure as D3 + D4.
- **No new harness helpers** beyond `resetProgressForTestProject`.

## Decision record (from brainstorming)

1. **D5 scope:** Reset checklist progress + re-run D4 to verify (recommended option).
2. **Reset mechanism:** existing `POST /api/project-progress` with empty payload (cleaner than adding a test-only route — the existing endpoint already does what we need).
3. **Fixture choice:** `test.beforeEach` (vs. `beforeAll`) — more conservative; survives adding a second test later.
4. **Helper location:** `e2e/helpers/harness-mode.ts` (consistent with `seedPackagingProfile` already living there).

## In-scope deliverables

### Files modified
- `e2e/helpers/harness-mode.ts` — add `resetProgressForTestProject` export.
- `e2e/arpg-vertical-slice-live-d2.spec.ts` — add `test.beforeEach`; change `filenameSuffix: 'd4'` → `'d5'`; add import.

### Files generated
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d5.md`.

Total: **2 modified, 1 generated doc, 2 commits.**

## The reset helper

In `e2e/helpers/harness-mode.ts`, add as a new module-level export (the file already has a `PROJECT_PATH`-equivalent pattern; if not, define it inline):

```typescript
const TEST_PROJECT_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';

/**
 * Reset all module progress (checklist progress, module health, verification,
 * history) for the PoF UE5 project at the documented path. POSTs an empty
 * progress blob to /api/project-progress — the route accepts the full snapshot
 * and overwrites the existing row keyed by sha256(projectPath).slice(0,16)
 * (per src/app/api/project-progress/route.ts).
 *
 * Call from a beforeEach so each test starts with a clean checklist DB
 * regardless of prior runs. Without this, completing a checklist item in
 * one run hides its "Run Claude" button in the next run because
 * RoadmapChecklist.tsx:648 only renders the AccentButton when !checked.
 * This was D4's regression cause.
 */
export async function resetProgressForTestProject(page: Page): Promise<void> {
  const res = await page.request.post('/api/project-progress', {
    data: {
      projectPath: TEST_PROJECT_PATH,
      checklistProgress: {},
      moduleHealth: {},
      checklistVerification: {},
      moduleHistory: {},
    },
  });
  if (!res.ok()) {
    throw new Error(`resetProgressForTestProject: POST /api/project-progress returned ${res.status()} — ${await res.text()}`);
  }
}
```

If the spec implementation reveals that the POST body shape differs from what `/api/project-progress/route.ts:POST` actually expects (e.g., wraps in `{ progress: {...} }` rather than flat), adapt the helper at write time.

## The spec change

In `e2e/arpg-vertical-slice-live-d2.spec.ts`:

1. Add `resetProgressForTestProject` to the existing import line from `./helpers/harness-mode`.
2. Add a `test.beforeEach` inside the `test.describe(...)` block, before the existing `test(...)`:

```typescript
  test.beforeEach(async ({ page }) => {
    // D5: reset checklist progress so prior-run state doesn't hide
    // already-completed items' "Run Claude" buttons. (D4 finding.)
    await resetProgressForTestProject(page);
  });
```

3. In the `finally` block at the end, change:
```typescript
await harness.writeFindings({ filenameSuffix: 'd4' });
```
to:
```typescript
await harness.writeFindings({ filenameSuffix: 'd5' });
```

## Cross-cutting

- **Branching:** `master`. 2 commits.
- **Validation gate:** `npx tsc --noEmit` after the spec edits.
- **No worktree.**
- **Controller-driven live re-run** (same shape as D3/D4 T2-T3). PoF dev server on port 3010 (verify alive in pre-flight).
- **PoF source untouched.**
- **UE5 project may be modified again** if Step 8 ih-1 re-passes. Existing assets from D3 might:
  - Be skipped by the commandlet (idempotent → success)
  - Be overwritten (regenerated → success)
  - Cause the commandlet to error (failure → D6 finding)

## Definition of done

1. Helper + spec changes committed; typecheck clean.
2. One live-mode re-run executed; `2026-05-19-live-d5.md` exists.
3. Findings doc shows per-step outcomes for Step 6, Step 8 ih-1, Step 9 aa-1, with explicit statement: "Step 8 ih-1: PASS (was FAIL in D4 regression)" — confirming idempotency — OR "Step 8 ih-1: still FAIL because [new reason]" if the fix didn't work.
4. Step 9 aa-1's failure reason captured (should NOT be "Setup Guide tab may not have mounted" if the reset cleared whatever was masking it; if it IS still that reason, the failure is independent of D4's regression and unfixed in D5).
5. `git log --oneline` shows 2 new commits.
6. Chat summary: SHAs, per-step outcomes, **idempotency-confirmed yes/no**, recommended D6 (or wrap).

**Success criterion:** Step 8 ih-1 dispatches and completes (idempotency proven). Even if Step 9 aa-1 still fails for its own reason, that's a separate finding — D5's primary job is closing the regression.

## Risks & mitigations

- **`/api/project-progress` POST body shape differs from helper assumption.** Mitigation: error message includes status + body excerpt; spec author adapts at write time.
- **Reset doesn't clear all relevant state** (e.g., `~/.pof/pof.db` has additional tables affecting Step 8 ih-1's button visibility). Mitigation: if Step 8 ih-1 still fails after reset, the findings doc captures the symptom and D6 expands reset scope.
- **Claude's commandlet errors on pre-existing files.** Likely outcomes: (a) silent skip and success — no problem; (b) overwrite and success — no problem; (c) error and failure — informative for D6. The risk is bounded: the worst case is a clean failure with a useful error message in the captured output excerpt.
- **PoF dev server has died across sessions.** Mitigation: T2 pre-flight checks port 3010 is responsive before firing.
- **`test.beforeEach` runs even for the implicit guard-failure case** (in stub mode). The reset will still POST in stub mode, which actually populates the empty-progress state in the real DB. Mitigation: this is fine — empty progress is the desired state for tests. Stub-mode parse check will fire the reset once then short-circuit on the HARNESS_MODE assertion.

## Hand-off to D6 (or wrap)

If D5 succeeds (Step 8 ih-1 re-passes; idempotency confirmed):

- **D6 brainstorm** picks: investigate Step 9 aa-1's independent failure (likely the testId-not-visible cause), OR add a 3rd live step (e.g., Step 10 ag-1), OR fix Finding A (Step 6 build verify), OR wrap.

If D5 fails (Step 8 ih-1 still fails):

- **D6 first task** = expand reset scope. Could be additional DB tables OR a different idempotency strategy (e.g., crude `rm ~/.pof/pof.db` between runs). Findings doc surfaces the specific next-failure mode.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → minimal plan (3 tasks: edit + commit, live re-run, findings commit).
4. Execute D5 inline (small enough to skip subagent overhead).
5. Brainstorm D6 (or wrap) once D5's findings doc is in hand.
