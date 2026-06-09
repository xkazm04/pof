# Bug Hunt — Prompt Evolution & A/B Testing
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. Trial recording is read-modify-write with no transaction — concurrent trials are silently lost
- **Severity**: critical
- **Category**: race-condition
- **File**: src/lib/prompt-evolution/engine.ts:232-260 (with src/lib/prompt-evolution/evolution-db.ts:231-270)
- **Scenario**: Two CLI runs for the same A/B test finish at nearly the same moment. Both POST `record-trial`. Request 1 calls `getABTestById` and reads `variantATrials = 4`. Before it writes, request 2 also reads `variantATrials = 4`. Request 1 writes `5`; request 2 writes `5`. One real trial (and its success/duration) has vanished.
- **Root cause**: `recordTestTrial` implements an increment as a full read (`getABTestById`) → spread-and-add in JS → full-row `upsertABTest`. The mutation is *computed from a snapshot* rather than applied in the database. better-sqlite3 is synchronous per call, but a single logical increment spans three separate DB calls plus arbitrary async/await scheduling in the Next.js route, so there is no atomicity across the read and the write. The whole row is overwritten with last-writer-wins, so the loser's increment to trials, successes, and `variantATotalDurationMs` is dropped. Because `evaluateTest`/`concludeTest` decide the winner from these exact counters, lost trials directly skew which prompt variant is declared "better" — the engine's entire purpose.
- **Impact**: data loss (trial/success/duration counters undercount) → corruption of the statistical verdict; a worse prompt can win an A/B test. Silent — no error surfaces.
- **Fix sketch**: Make the increment atomic in SQL: a single `UPDATE prompt_ab_tests SET variant_a_trials = variant_a_trials + 1, variant_a_successes = variant_a_successes + ?, ... WHERE id = ?`, then re-`SELECT` the row and run `evaluateTest` on the freshly-read values inside one `db.transaction(...)`. Never compute counter deltas in JS from a stale snapshot.

## 2. Two concurrent first-variant creates both become `active` → two "current" versions corrupt rollback state
- **Severity**: high
- **Category**: state-corruption
- **File**: src/lib/prompt-evolution/engine.ts:49-76 (with evolution-db.ts:204-211)
- **Scenario**: A checklist item has no variants yet. A user double-clicks "Create", or the UI fires create + a mutate that also creates, near-simultaneously. Both calls run `hasActiveVariant(...)` → both get `false` → both insert with `active = 1`.
- **Root cause**: `createVariant` derives `active = !hasActiveVariant(...)` as a check-then-act sequence with no uniqueness constraint backing the invariant "at most one active version per (module, item)". The DB schema (`prompt_variants`) has no partial unique index on `(module_id, checklist_item_id) WHERE active = 1`, so nothing prevents two active rows. Downstream, `getVersionHistory` computes `activeVariantId` via `versions.find(v => v.isActive)` (engine.ts:173) — it silently picks whichever sorts first, and the store's `restoreVariant` optimistic flip assumes a single active row. The timeline UI then shows an "active" marker that disagrees with what `setActiveVariant` would clear.
- **Impact**: corruption — ambiguous "current prompt" for a checklist item; rollback/restore targets the wrong version; UX shows two highlighted-as-active versions.
- **Fix sketch**: Enforce the invariant in the database, not in app logic: add a partial unique index `CREATE UNIQUE INDEX ... ON prompt_variants(module_id, checklist_item_id) WHERE active = 1`, and perform the "is this the first/active one" decision inside the same transaction as the insert (or always insert inactive and call `setActiveVariant` transactionally). The "at most one active" rule should be impossible to violate regardless of concurrency.

## 3. Manual `concludeTest` overwrites a real z-test confidence with a crude trial-count heuristic
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/prompt-evolution/engine.ts:262-281
- **Scenario**: An A/B test runs long enough that `evaluateTest` computes a statistically significant winner with `confidence = 0.95` (z ≥ 1.96) but does NOT auto-conclude (e.g. `shouldConclude` was false on the trial that produced it, or the user clicks "Finish & pick a winner" at `totalTrials >= 2`, well before significance). The user clicks Conclude. `concludeTest` overwrites `confidence` with `Math.min(0.7, (A+B trials)/20)` and recomputes the winner by raw `rateA >= rateB`.
- **Root cause**: `concludeTest` ignores the test's already-computed statistical fields and substitutes a heuristic capped at 0.7 that is purely a function of trial volume, not of the actual effect size or z-score. It also breaks ties with `rateA >= rateB` (A-biased) instead of the faster-variant tiebreak that `evaluateTest` uses (engine line 276 vs ab-testing.ts:111-118), so the same data yields a *different* winner depending on whether the test auto-concluded or was concluded by hand. With ≤19 total trials a genuinely significant result is reported as <70% confidence, undermining trust; the UI shows this number verbatim ("won with X% confidence", engine.ts:419).
- **Impact**: UX degradation / misleading output — a real 95%-confident result is downgraded to ≤70%, and the declared winner can flip versus the automatic path for identical data.
- **Fix sketch**: Make manual conclude reuse the single source of truth: call `evaluateTest`-style scoring (z-test confidence + faster-variant tiebreak) and only fall back to the heuristic when trials are below `minTrials`. One winner/confidence function, used by both the automatic and manual conclude paths, so the verdict can't depend on which button fired.

## 4. `swapOrdering` mutation corrupts prompts via literal-string `replace` (duplicate blocks + `$` substitution patterns)
- **Severity**: medium
- **Category**: data-loss
- **File**: src/lib/prompt-evolution/mutations.ts:142-159
- **Scenario A**: A prompt contains two textually identical numbered blocks (e.g. two `1. Create the header file.` lines). The placeholder loop `result.replace(numbered[i], '__SWAP_i__')` uses a *string* pattern, which replaces only the FIRST match — so the second identical block is never tokenized, one placeholder maps to two source spans, and the reassembled prompt loses a block / duplicates another. **Scenario B**: A block's text contains `$1`, `$&`, `` $` `` or `$'` (e.g. a shell var `$PATH`, a regex example, or a cost like `$5`). In the second loop, `reversed[i]` is passed as the *replacement* string to `String.prototype.replace`, where those `$`-sequences are interpreted as special replacement patterns and the literal text is mangled.
- **Root cause**: `String.prototype.replace(searchString, replacement)` is being used as if both arguments were literal, but the search uses first-match-only semantics and the replacement honors `$`-dollar escapes. The algorithm assumes (a) every numbered block is unique and (b) block content is inert when used as a replacement — neither holds for arbitrary user prompts.
- **Impact**: data loss / corruption of the user's prompt text in the saved variant (the mutated prompt is persisted via `createVariant`), silently producing a broken prompt.
- **Fix sketch**: Avoid string-`replace` round-tripping entirely: split the prompt into ordered segments by index ranges, reverse the array of segment *strings*, and re-join — no placeholder substitution and no regex/dollar interpretation. If substitution is kept, use a replacer *function* (`() => reversed[i]`) so `$` is treated literally, and key placeholders by capture position rather than by matching block text.
