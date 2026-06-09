# Bug Hunt — GDD Compliance & Design Doc
> Total: 4
> Severity: 1 critical, 1 high, 2 medium, 0 low

Scope: the GDD synthesizer, the compliance audit engine, their store/types, the two
viewer components, the two API routes, and the two hooks (10 files). The findings
below are ordered by severity. Line numbers reference the files as read on
2026-06-09.

---

## 1. Out-of-range room difficulty throws RangeError and kills the entire GDD
- **Severity**: critical
- **Category**: edge-case
- **File**: src/lib/gdd-synthesizer.ts:379
- **Scenario**: If a `level_design_docs` row has a room whose `difficulty` is anything other than an integer in `[0,5]` — e.g. `6` (a designer typed it), `0`, `null`/`undefined` (field omitted), or a non-integer — then `synthesizeGDD` evaluates `'●'.repeat(r.difficulty)` and `'○'.repeat(5 - r.difficulty)`. `String.prototype.repeat` throws `RangeError: Invalid count value` for any negative argument (`5 - 6 = -1`) and for `NaN` (`repeat(undefined)`). The throw propagates out of `buildLevelDesignSection` → `synthesizeGDD` → the `GET /api/game-design-doc` handler, so the *whole* document fails to generate, not just one room.
- **Root cause**: The synthesizer treats `rooms[].difficulty` as a trusted `1..5` value, but it is free-form JSON parsed straight out of SQLite. The DB schema (`level-design-db.ts`) stores `rooms` as an opaque `TEXT '[]'` blob with **no** bound on `difficulty`, and there is no write-time validation in the create/update path. The sibling code that consumes the same field — `getSummary` in `level-design-db.ts:135` — *defensively* guards with `if (room.difficulty >= 1 && room.difficulty <= 5)`, which is direct evidence that out-of-range values are expected in the wild. The synthesizer simply forgot that guard.
- **Impact**: crash — a single bad room (one out-of-range or missing difficulty, easily produced by AI-generated level docs or hand edits) takes down GDD generation entirely. The viewer (`GameDesignDocView`) shows the error state with a Retry button that can never succeed, because the data is bad, not transient.
- **Fix sketch**: Make the star/dot rendering total-invariant and clamp at the trust boundary: `const d = Math.max(0, Math.min(5, Math.round(Number(r.difficulty) || 0))); '●'.repeat(d) + '○'.repeat(5 - d)`. Better, add a shared `clampDifficulty()` used by both the synthesizer and `getSummary`, and validate `difficulty` on write so the stored data can never be out of range in the first place. The same defensive clamp should wrap every `.repeat()` fed by stored data.

---

## 2. Resolved compliance gaps silently vanish — no persistence + shared in-memory cache
- **Severity**: high
- **Category**: data-loss
- **File**: src/app/api/gdd-compliance/route.ts:6
- **Scenario**: A reviewer audits, then clicks "Resolve" on several gaps to triage them. `resolveGap` mutates a module-scoped `let cachedReport` and returns it, so the UI updates *this session*. But (a) `GDDComplianceView` auto-runs an audit on every mount (`useEffect(..., [])`, line 187) and on every "Re-audit" click, and `runComplianceAudit` recomputes **every gap fresh with `resolved: false`** — there is no DB column or store that records resolutions. So the moment the user navigates away and back, or re-audits, all resolved flags reset. (b) Because `cachedReport` is a single module-level variable shared across *all* requests/tabs/users, a second tab's audit overwrites the first tab's cache; a `resolve-gap` from tab A then targets tab B's report. (c) After a serverless cold start or dev HMR reload between audit and resolve, `cachedReport` is `null` and resolve returns `400 "No audit report available"`.
- **Root cause**: "Resolution" is modeled as transient state living only in a process-global cache, but the audit is a pure recompute from `feature_matrix` + checklist progress with no notion of previously-resolved gaps. The design assumes one report exists at a time and survives between the audit call and the resolve call — neither holds under navigation, re-audit, concurrency, or process recycling.
- **Impact**: data loss / UX degradation — triage work is silently discarded; a counter shows "resolved" then it reappears with no error. Under concurrency, resolves can hit the wrong report (success theater: the call returns 200 having found nothing to resolve, because gap IDs differ).
- **Fix sketch**: Persist resolutions in a table keyed by a stable gap fingerprint (moduleId + category + feature/checklist id, not the volatile `gap-...` id), and have `runComplianceAudit` mark a freshly-computed gap `resolved` if a matching resolution row exists. Drop the module-global `cachedReport` entirely; resolve should write to the DB, not mutate process memory. If a transient cache is kept, key it per-session.

---

## 3. The same missing feature is reported as two separate gaps
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/gdd-compliance.ts:95
- **Scenario**: If a feature has `status === 'missing'` *and* its name fuzzy-matches a **checked** checklist item (the 20-char `includes` heuristic at lines 30–31), `detectFeatureGaps` pushes it once in loop #1 as a `checklist-vs-scan` "marked done but scan shows missing" gap (severity `major`), and again in loop #3 as a `missing-feature` "not implemented" gap (severity `major`). Two gaps, two distinct IDs, one underlying feature.
- **Root cause**: The three detection loops are written as independent passes with overlapping predicates and no de-duplication. `status === 'missing'` is a trigger in both loop #1 (when checklist-matched) and loop #3 (unconditionally), so any missing feature that also matches a checklist item is double-emitted by design.
- **Impact**: corruption of the metrics that drive the whole view — `totalGaps` and `criticalGaps` are inflated, the gap penalty in `calculateModuleScore` (`Math.min(gapCount * 2, 10)`) is double-charged so module scores read artificially low, and `generateSuggestions` can emit redundant reconciliation items for the same feature. Decisions are made on inflated gap counts.
- **Fix sketch**: De-duplicate by the underlying entity: build gaps into a `Map` keyed by the feature/checklist id (or a normalized fingerprint) and let a later, more specific category win over a generic one, instead of pushing into a flat array across three loops. At minimum, skip loop #3 for any feature already emitted by loop #1.

---

## 4. Markdown table cells are dropped, misaligning every column after an empty cell
- **Severity**: medium
- **Category**: logic-error
- **File**: src/components/modules/evaluator/GameDesignDocView.tsx:488
- **Scenario**: If any GDD table row contains an empty interior cell, `MarkdownTable.parseRow` does `line.split('|').map(c => c.trim()).filter(Boolean)`. The `.filter(Boolean)` is meant to drop the empty strings from the leading/trailing `|`, but it *also* drops legitimately-empty interior cells. A row like `|  | ✅ implemented | ★★★☆☆ |` (a feature with a blank `feature_name` — the scan-import path validates status/quality but not a non-empty name) parses to `['✅ implemented', '★★★☆☆']`: two values under three headers. The status renders under the "Feature" column and the quality under "Status", with the "Quality" column blank — every cell after the empty one is shifted left.
- **Root cause**: Column alignment is derived by *filtering* rather than by *position*. Markdown table cells are positional; collapsing out empty cells destroys the header↔cell correspondence. The parser conflates "outer padding from leading/trailing pipes" with "an empty cell".
- **Impact**: UX degradation / data misrepresentation — the synthesized GDD (a document users export and share as the source of truth) shows values under the wrong columns whenever any cell is empty (blank feature names, `—` placeholders that happen to be trimmed elsewhere, empty descriptions). Silent: no error, just wrong data.
- **Fix sketch**: Parse cells by position. Strip exactly one leading and one trailing pipe, then `split('|')` and `map(trim)` **without** `.filter(Boolean)`, so an empty interior cell is preserved as `''`. Then pad/truncate the row to `headers.length`. This makes column misalignment impossible regardless of empty cells.
