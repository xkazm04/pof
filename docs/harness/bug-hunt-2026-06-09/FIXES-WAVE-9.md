# Bug Hunter Fix Wave 9 — Final critical (item double-produce)

> 1 commit, 1 critical closed. This closes the last open critical → **18 / 18 criticals**.
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. layout-lab tests 189/190 (the 1 fail is the pre-existing `ChartPanel` jsdom flake, untouched).

## What was fixed

**Stale-closure double-produce dropped a whole generation batch** (`item-pipeline-steps.md` finding #1). In the layout-lab generative steps (Icon / 3D / Material), `useGenerativeStep.generate` read `history` from the render closure and derived the batch id from `history.batches.length`. Two dispatches in the same frame (a double-click on Produce / re-roll) both saw `batches.length === N`, both minted batch `bN`, and the second `produce` overwrote the first's append — silently dropping a kept batch and colliding candidate ids, violating the module's "every re-roll is kept" promise.

**Fix:** a new store method `produceFrom(entityId, step, build)` runs `build(prevData)` *inside* `set((s) => …)` against the step's **live** persisted data, so concurrent dispatches serialize — the second sees the first's appended batch and mints the next `seq`. `generate` and `reselect` now go through it; the batch id derives from live `batches.length`, so duplicate `bN` ids are impossible too.

Files: `src/components/layout-lab/labPipelineStore.ts` (new `produceFrom`), `src/components/layout-lab/steps/ItemArt.tsx` (`useGenerativeStep` rewired). Commit `3d50330`.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors |
| `eslint` (changed files) | 0 errors |
| layout-lab tests (incl. `ItemArt.gallery`, `genHistory`, `labArtifactSync`, `LayoutLab`) | 189/190 — the 1 fail is the known `ChartPanel` flake, not in changed code |

## Final cumulative status — bug-hunt complete

| Wave | Theme | Closed | Crit |
|------|-------|-------:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 |
| 6 | Security hardening | 2 | 2 |
| 4 | Shared-singleton concurrency | 3 | 3 |
| 2 | Atomicity & write races | 3 | 3 |
| 5 | UE5 codegen correctness | 3 | 1 |
| 3 | Silent-failure safety gates | 3 | 1 |
| 7 | Determinism & timestamps | 4 | 1 |
| 8 | Final criticals | 3 | 3 |
| 9 | Item double-produce | 1 | 1 |
| **Total** | | **29 / 140** | **18 / 18 (100%)** |

## Pattern established (catalogue item 25)

25. **Derive next-state from live state inside the updater, not a render closure.** A React handler that reads a value at render time and writes back a derived update loses concurrent dispatches (double-click): both read the same stale snapshot and the second clobbers the first. Compute the new state inside the store's `set((s) => …)` (or `setState(prev => …)`) so sequential dispatches serialize against the latest committed state.

## What remains

29 of 140 closed; **all 18 criticals**. Remaining work is highs/mediums — the deferred items from Waves 2/3/4/5/7 (self-heal tri-state, UE5 connection-manager lifecycle, audio scene lost-update, pipeline rollback, cpp-parser nested-paren regex, bestiary clamp, weekly-digest timezone) plus the lower-severity tail in the INDEX. A future session resumes from the INDEX + these 9 wave summaries.
