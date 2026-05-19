---
date: 2026-05-19
status: draft
sub_project: D (scenario execution)
sub_phase: D8 (fix dispatch race flake)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d7-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d7.md
---

# Sub-project D8: ARPG vertical-slice — fix dispatch race flake

## Context

D7 + D7.5 together proved all Step 10 components work individually, but never both `success: true` AND artifact-verified in the same run. The root cause is a timing race:

`useModuleCLI.sendPrompt` at `src/hooks/useModuleCLI.ts:122-128` creates/finds the session, sets it active, then waits `UI_TIMEOUTS.mountDelay` (100ms per `src/lib/constants.ts:69`) before dispatching the `pof-cli-prompt` CustomEvent. CompactTerminal needs to mount and register its bubble-phase listener within that window. When mount takes longer than 100ms (variable based on system load), the event is dispatched to a window with no terminal-side listener — the harness's capture-phase listener records it but nothing else processes it. The CLI session never starts, `isRunning` never flips true, the running indicator never renders, `waitForCliComplete` times out.

D8 applies the **double-click pattern** at the spec level: after the dispatch button click, sleep 1s (giving CompactTerminal time to mount), then re-click. The button is `disabled` while `isRunning=true`, so:
- If the 1st click succeeded → button disabled → 2nd click is a safe no-op.
- If the 1st click was lost (the flake) → button still enabled → 2nd click reaches a mounted terminal.

Either way the dispatch eventually succeeds.

## Goals

1. Apply the double-click pattern to Step 8 ih-1, Step 9 commandlet-assets, and Step 10 ag-1 in `e2e/arpg-vertical-slice-live-d2.spec.ts`.
2. Bump `filenameSuffix` to `'d8'`.
3. Re-run live; expect all 3 dispatch steps to consistently succeed.
4. Capture findings.

## Non-goals

- **No helper-level change.** The double-click is a spec pattern, not a `waitForCliComplete` modification. (If D8 fix proves insufficient, D9 would attempt Strategy B — helper-level retry via `page.evaluate`.)
- **No fix for Finding A** (Step 6 build verify).
- **No new live steps.**
- **No helper extraction**, despite the pattern appearing 3 times. YAGNI threshold not met (3 sites, ~3 lines each — extraction would replace 9 lines with a 6-line helper, marginal gain).

## Decision record (from brainstorming)

1. **D8 scope:** fix the running-indicator race (D7's only unresolved item).
2. **Strategy:** Strategy C — spec-level double-click pattern (vs. Strategy A pre-wait — too weak; Strategy B helper retry — too invasive for the gain).
3. **Sleep duration:** 1000ms between clicks (gives CompactTerminal time to mount; based on the observation that mount usually takes <1s).
4. **Idempotency guard:** `await btn.isEnabled().catch(() => false)` before second click. The `.catch` handles button detached/re-rendered cases.

## In-scope deliverables

### Files modified
- `e2e/arpg-vertical-slice-live-d2.spec.ts` — double-click pattern applied 3 times; `filenameSuffix: 'd7'` → `'d8'`.

### Files generated
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d8.md`.

Total: **1 modified, 1 generated doc, 2 commits.**

## The double-click pattern

Generic shape:

```typescript
await dispatchBtn.click();
await page.waitForTimeout(1000); // give CompactTerminal time to mount
// D8: re-click if first dispatch was lost in the mountDelay window.
// Button is disabled if first dispatch succeeded → second click is a safe no-op.
if (await dispatchBtn.isEnabled().catch(() => false)) {
  await dispatchBtn.click();
}
const result = await waitForCliComplete(page, '...', STEP_TIMEOUT_MS);
```

### Per-step applications

**Step 8 ih-1**: `dispatchBtn = claudeBtn` (the Cards-layout `<AccentButton>Claude</AccentButton>` at RoadmapChecklist.tsx:649; `disabled={isRunning}` per line 651).

**Step 9 commandlet-assets**: `dispatchBtn = generateBtn` (AnimationChecklist's "Execute Process" button at AnimationChecklist.tsx:516; `disabled={isGenerating}` per line 518). The `pof-module-arpg-animation-generate-step-commandlet-assets` testId selector unchanged.

**Step 10 ag-1**: same as Step 8 (RoadmapChecklist `claudeBtn`).

Step 6 (build verify) doesn't dispatch (Finding A blocks it earlier in the step body); no change.

## Cross-cutting

- **Branching:** `master`. 2 commits.
- **Validation gate:** `npx tsc --noEmit` after the spec edit.
- **No worktree.**
- **Controller-driven live re-run.** Port 3010.
- **PoF source untouched.**
- **UE5 project may be modified again** if any dispatch produces fresh code/asset changes (Claude's verify-and-skip pattern handles existing artifacts gracefully).

## Definition of done

1. Spec edits committed; typecheck clean.
2. Live re-run produced `2026-05-19-live-d8.md`.
3. Findings doc explicitly states Step 10 outcome: should be `pass` AND artifact-verified — proving D7's two partial successes now line up.
4. Steps 8 + 9 still pass (verify-and-skip pattern unaffected).
5. Dispatch count still 3 (the second click is dropped when the first works; no duplicate Claude sessions spawned).
6. 2 commits; chat summary.

**Success criterion:** Step 10 reports `pass` status with artifact-check `modificationFound=true`. If the flake recurs, D9 attempts Strategy B (helper-level retry via `page.evaluate`).

## Risks & mitigations

- **Both clicks dispatch in some edge case** (e.g., `isEnabled` race), causing duplicate Claude sessions. Mitigation: Claude's verify-and-skip handles this — second session quickly detects the work is done and exits. Wasteful (extra 30-60s) but not wrong. Worst case: dispatch count = 4 instead of 3; harmless.
- **Sleep is too short** (CompactTerminal mount > 1000ms on the system). Mitigation: D9 can bump the sleep to 2s or 5s as a quick follow-up.
- **AccentButton's `disabled` prop is keyed off something different from session-running state**. Mitigation: verified at AccentButton render — input-handling uses `disabled={isRunning}` per `useModuleCLI` hook; animation uses `disabled={isGenerating}` per `AnimationChecklist.tsx:518`. Both reflect "we're currently dispatching/processing" — exactly the state we want to block double-dispatch.
- **The `isEnabled` check itself blocks for too long.** Mitigation: Playwright's `isEnabled` is synchronous DOM read; sub-millisecond. The 1s wait above guarantees stable DOM by then.

## Hand-off to D9 (or wrap)

If D8 succeeds: **harness is production-stable**. Remaining 11 dispatch-triggering steps are mechanical extensions of the proven pattern.

- **D9 candidates**: add Step 11 acb-1 (combat) OR fix Finding A OR wrap.
- **Wrap is now extremely defensible** — the harness is feature-complete AND idempotent AND stable across runs.

If D8 fails (flake persists):

- **D9 first task** = Strategy B (helper-level retry). Modify `waitForCliComplete` to re-dispatch via `page.evaluate` after the appearance grace timeout fails.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → minimal plan (3 tasks: edit + commit, live re-run, findings commit).
4. Execute D8 inline.
5. Brainstorm D9 (or wrap) once D8's findings doc is in hand.
