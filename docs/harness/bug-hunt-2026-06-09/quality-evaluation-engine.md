# Bug Hunt — Quality Evaluation Engine
> Total: 4
> Severity: 0 critical, 3 high, 1 medium, 0 low

## 1. SSE stream parser drops findings on chunk boundaries (no cross-read buffer)
- **Severity**: high
- **Category**: silent-failure
- **File**: src/lib/evaluator/deep-eval-engine.ts:264-288
- **Scenario**: If the `/api/claude-terminal/query` response delivers a `data: {…}` SSE line that happens to be split across two `reader.read()` network chunks (the normal case for any non-trivial eval output — TCP/transform-stream boundaries fall mid-line constantly), the two halves are parsed independently.
- **Root cause**: `collectStreamResponse` does `decoder.decode(value, { stream: true })` per read, then immediately `chunk.split('\n')` and processes each line — but it keeps **no carry-over buffer** between reads. The design assumes every `read()` yields whole, newline-terminated SSE records. It doesn't. A split `data:` line produces one fragment ending mid-JSON and a next fragment that doesn't start with `data: ` at all, so the first fails `JSON.parse` (and the `catch` appends the raw partial JSON as if it were text), and the second is dropped entirely. The collected `output` is silently corrupted, after which `parseFindings` finds garbage and returns `[]` — the pass reports "done" with zero findings.
- **Impact**: data loss / success theater — passes silently lose real findings; the larger the model's output, the more likely the corruption, so the most finding-rich modules are the most damaged. No error is ever surfaced.
- **Fix sketch**: Accumulate decoded text into a persistent `buffer` string across reads; split out only complete lines (`buffer.split('\n')`, keep the trailing partial in `buffer` for the next iteration); flush the remainder after `done`. This makes the entire class of boundary-splitting impossible regardless of how the transport fragments.

## 2. `indexOf('[')`/`lastIndexOf(']')` array extraction is corrupted by prose the prompts explicitly request
- **Severity**: high
- **Category**: silent-failure
- **File**: src/lib/evaluator/finding-collector.ts:84-97
- **Scenario**: If a model's output contains a `[` before the real JSON array or a `]` after it, `parseFindings` slices the wrong substring, `JSON.parse` throws, and the whole pass's findings are discarded (`return []`). This is not hypothetical: the `combat-trace` and `ground-truth` passes (module-eval-prompts.ts:151-159, 52-55) instruct the model to **emit a numbered call graph / prose FIRST, then the JSON array**. Call graphs routinely contain bracketed text ("step [3]", array refs like `HitActors[]`, markdown links `[GE_Damage](…)`), and the closing prose may contain a stray `]`.
- **Root cause**: The extractor assumes the first `[` and last `]` in the output bracket exactly the findings array. That assumption is violated by the very prompt format the engine ships (prose-then-JSON), and by any markdown the CLI emits. There is a single `try/JSON.parse/catch → return []` with no fallback (no brace-matching, no per-object salvage).
- **Impact**: data loss — entire passes (notably the combat-trace pass that is the headline feature for `arpg-combat`) silently yield zero findings whenever the preamble contains a bracket. The UI shows "0 findings / done", indistinguishable from a genuinely clean module.
- **Fix sketch**: Replace naive index slicing with a balanced-bracket scanner that finds the first `[` whose matching `]` parses as a valid array (respecting string literals), and on failure fall back to extracting/parsing individual `{…}` objects. Better still, require a delimited fence (e.g. `<<<FINDINGS>>>…<<<END>>>`) in the schema and parse only between the markers.

## 3. Finding fingerprint collapses distinct findings (severity/category/pass excluded; null-line + general bucket)
- **Severity**: medium
- **Category**: state-corruption
- **File**: src/lib/evaluator/finding-collector.ts:138-178
- **Scenario**: If two genuinely different findings share a file (or both have `file: null`), the same `line` (very common: the model omits line numbers, so both are `null`), and their first 80 description chars collapse to the same normalized key, `deduplicateFindings` discards one of them.
- **Root cause**: `fingerprintFinding` keys only on `moduleId + file + line + first-80-normalized-description`. It deliberately excludes `severity`, `category`, `pass`, and `suggestedFix`. Two findings like "Missing null check before dereferencing the component pointer …" (returned with different remediations from the quality pass vs the ground-truth pass, or two different pointers described with the same opening clause) hash identically. The `file: null` case is worse: every general finding buckets under `__general__` with `__no_line__`, so any two general findings whose descriptions start with the same 80 chars (e.g. boilerplate "This module does not …") are merged. The "keep higher severity" tie-break then throws away the lower-severity one entirely rather than keeping both.
- **Impact**: corruption / data loss in the report — real, distinct issues vanish from the deduplicated set, understating the finding count and severity mix; the dropped finding never reaches the fix-plan generator.
- **Fix sketch**: Include `category` (and ideally a hash of the full `description` + `suggestedFix`) in the dedup fingerprint, and never collapse two findings whose `suggestedFix` differs. Treat truncation as a fuzzy *candidate* match that must additionally agree on category/severity before merging.

## 4. Cancelled or errored scan overwrites the regression baseline with partial/empty findings
- **Severity**: high
- **Category**: data-loss
- **File**: src/components/modules/evaluator/DeepEvalResults.tsx:109-129 (with deep-eval-engine.ts:218-242)
- **Scenario**: If the user cancels a run (or the network/API errors mid-scan), `runDeepEval` does **not** throw — its `catch` block builds a report from whatever partial `allFindings` it has and *returns* it. `handleRunEval` then `await`s that returned value and calls `applyScanResult`, which unconditionally calls `useDeepEvalStore.getState().recordScan({ findings: mergeBaseline(previous, currentFlat, scope) })`.
- **Root cause**: The baseline-persistence path assumes `applyScanResult` only ever runs for a *complete* scan. But the engine's error/cancel branch returns a normal `DeepEvalResult` (so the UI can show partial progress), making cancel/error indistinguishable from success at the call site. `mergeBaseline` then **replaces every in-scope module's stored findings with the partial set** (often empty for modules that hadn't run yet, since they were never reached). The next real scan diffs against this corrupted baseline.
- **Impact**: corruption of the NEW/PERSISTING/RESOLVED regression history — after a cancel, modules that were never re-run get their baselines wiped, so the following scan floods the user with false "New" findings (or hides genuinely resolved ones), defeating the entire regression-tracking feature. The damage persists across reloads (localStorage).
- **Fix sketch**: Make persistence conditional on completion: have `runDeepEval` return `{ status }` (or re-throw on cancel) and only call `recordScan`/`mergeBaseline` when `progress.status === 'completed'`. For partial results, show them in the UI but never write them to the baseline — i.e. separate "display this run" from "commit this run as the new ground truth".
