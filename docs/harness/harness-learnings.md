# pof — harness learnings (Items, Loot & Economy run, 2026-06-03)

> This branch (`vibeman/economy-loot-fixes`) was cut from `master`, so it doesn't carry the
> harness-learnings from the `catalog-ue-hardening` / `ai-build-packaging-hardening` branches.
> Consolidate the three on merge.

## Structural facts
- **The economy/loot subsystems have multiple engines with diverging constants** — this is the dominant theme of the group. The same concept is defined more than once: rarity→gold (`DEFAULT_RARITY_GOLD` in `sub_loot/_shared/data-binding.ts` vs per-item buy/sell in `economy/definitions.ts`), item power (`calcItemPower`/`POWER_WEIGHTS` vs threat-score weights in `balance/threat-score.ts`), and the affix pool itself (triplicated across `item-economy-engine.ts`, `loot-designer/drop-simulator.ts`, and `sub_loot/_shared` — each with a DIFFERENT RNG: mulberry32 / xorshift32 / Math.random).
- **`drop-simulator.rollSingleItem` selects affixes WITHOUT replacement** (a `chosen` Set), so each affix lands ≤1× per item — affix `frequency = count/itemsWithAffixes` can never exceed 1.0.
- **The XP curve is indexed identically by both economy engines.** `generateXPCurve` returns points where `xpCurve[idx].level === idx+1` and `xpRequired` is the XP to reach that level. `simulation-engine` reads `xpCurve[agent.level]`; `item-economy-engine` reads `xpNeeded(agent.level+1)` where `xpNeeded(lvl)=xpCurve[lvl-1]` — both resolve to `xpCurve[agent.level]` for the level→level+1 transition.
- **`auto-balancer` `A` is sum-100-scaled** (`toSum100`), so its `d/100·A` exactly equals `economy.ts computeExpectedValue`'s `dropChance·expectedItemGold`. The `/100` compensates for the ×100 scaling — not a unit bug.
- **`runSimulation` applies `applyFlowOverrides` (now exported) to faucets/sinks; codegen now reuses it** so the emitted DataAsset matches the simulated economy. Note `runSimulation` itself uses raw `DEFAULT_ITEMS` — it ignores `config.itemOverrides` (separate latent issue).

## Anti-patterns to avoid
- **`Math.min(...arr)` / `Math.max(...arr)` on arrays sized by `rollCount`** — spreading tens/hundreds of thousands of elements throws `RangeError: Maximum call stack size exceeded`. Use a single-pass `minMax()`.
- **`React.memo` without stabilizing inline-closure props is performance theater** — `CatalogItemGrid` passes `onFocus={() => setFocusedIndex(index)}` (new identity per render), so memoizing `TradingCard` alone never skips a render.

## Scanner-quality note (important for future runs on this group)
- The `bug_hunter` Idea scanner produced **3 false positives out of 5** on this group's subtle probability/economy math (auto-balancer "100× EV", affix frequency ">100%", XP "off-by-one between engines"). Each was a plausible "two expressions disagree" claim that dissolved once the expressions were fully resolved (sum-100 scaling, without-replacement selection, `xpNeeded`'s `+1` argument). **Verify economy/probability findings by resolving the actual math before implementing** — and reject with a recorded reason (done via `user_feedback`) so the scanner can learn.

## Open follow-ups (from the 2026-06-03 run — accepted but deferred)
These were accepted but deferred because they either change balance VALUES (a design decision needing playtest/validation I can't run) or are app-context infra I can't runtime-verify:
- **#7 catalog grid** — needs virtualization (react-window is already a dep) + stabilized `onFocus`/`ref` props + gating the `AnimatePresence popLayout` layout animation. Memo alone is ineffective (see anti-pattern).
- **#10 drop-sim Web Worker** — move `runDropSimulation` off the render thread; needs Next.js worker bundling + a runtime check.
- **#14 unify rarity gold** — pick a canonical source (e.g. derive `DEFAULT_RARITY_GOLD` from `DEFAULT_ITEMS` sell prices) and validate the loot-EV balance shift.
- **#12 shared threat/power scale** — define one stat-weight map (or adapter) so threat-score and item power are comparable; validate baseline-drift impact.
- **#11 catalog binding re-seed** — add a source-version stamp on seeded entities + a diff/re-seed path so binding edits propagate past the one-time seed.
- **#13 consolidate the 3 affix pools + standardize on one seeded RNG** — large cross-system reshape; validate that unified weights/power don't shift balance.
- **#8 (asymptotic) / #9 (Fenwick)** — the contained dedup/precompute shipped; the O(P log P + L) sorted-suffix (#8) and Fenwick-tree weighted selection (#9) remain, but the Fenwick variant must preserve the exact selection sequence.

## Implemented this run (6, behaviour-verified)
#4 drop-sim large-rollCount crash · #1 weighted godroll % · #6 loot-editor undo cap+coalesce · #9 precompute affix weight pool (behaviour-identical) · #8 dedupe per-level agent filter · #15 codegen applies flowOverrides.

## From the 2026-06-12 bug+ui dual-lens scan + fix wave 1 (CLI lifecycle)
- **Structural fact** — `src/lib/process-tree-kill.ts` (added 2026-06-12) is the canonical kill primitive. On Windows, `ChildProcess.kill()` never cascades: any spawn via `shell:true`, a `.cmd` shim, or a launcher (RunUAT/UBT) tracks a wrapper PID and a plain kill orphans the real workers. Use `killProcessTree()` at every kill site (adopted in cli-service, cook-executor, ue5-bridge build-pipeline).
- **Structural fact** — interactive CLI runs (`submitPrompt`) have NO queued task id; `onTaskComplete` fires with the sentinel id `'interactive'` (`useTaskQueue.ts`). Never re-introduce an `if (tid)` gate around a latch-releasing callback.
- **Structural fact** — `/api/ai-testing` POST now has `record-run-results` and `apply-stimuli` actions (the @@CALLBACK write-back targets of the `run-ai-tests` / `detect-stimuli` CLITask types).
- **Environment trap** — a Node upgrade silently breaks `better-sqlite3` (ERR_DLOPEN_FAILED / NODE_MODULE_VERSION mismatch) and turns ~26 unrelated tests red, looking exactly like a code regression. Fix: `npm rebuild better-sqlite3`. Check this FIRST when many DB-touching tests fail at import.
- **Context drift** — six file paths referenced by Vibeman contexts no longer exist on disk (`item-dna/index.ts`, `auto-rig/index.ts`, `asset-browser/index.ts`, `useBuildPipeline.ts`, `ResizeHandle.tsx`, `knowledge/index.ts`). Refresh the contexts in Vibeman before the next scan.
- **Open follow-ups** — 317 of 323 scan findings remain in `docs/harness/scan-bug-ui-2026-06-12/INDEX.md`; next themed waves: B fix-the-fixes (7), D destructive-write data loss (6). The user's uncommitted `src/lib/leonardo.ts` change breaks `leonardo-client.test.ts` (1 of the 15 standing test failures).
