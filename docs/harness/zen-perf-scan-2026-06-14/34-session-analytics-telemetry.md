# Session Analytics & Telemetry — zen-perf scan
> Context: Director, Sessions & Autonomy / Session Analytics & Telemetry
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. `getDashboard()` issues 1 + 2N queries, two of which full-scan every row per module
- **Severity**: high
- **Lens**: performance
- **Category**: N+1 / redundant DB work
- **File**: src/lib/session-analytics-db.ts:392-429
- **Scenario**: Every dashboard load (`useSessionDashboard` fires on mount of `SessionAnalyticsDashboard`). Cost grows linearly with module count and total session rows.
- **Root cause**: `getAllModuleStats()` already computes the full per-module aggregate in ONE `GROUP BY` query (lines 183-190) — including `avg_success_prompt_len`/`avg_fail_prompt_len`. But the loop at 406-409 throws that away and re-derives per module: `generateInsights(mid)` calls `getModuleStatsRaw(mid)` (line 246 → 193-199), re-running the same aggregate `WHERE module_id = ?` once per module; and `getPromptQualityScore(mid)` (line 408 → 203-209) runs `SELECT success FROM session_analytics WHERE module_id = ?` which **loads every row** for that module into JS just to slice the first 20 (lines 217-221). So a 12-module / 5k-row table does ~25 queries and materializes all 5k `{success}` rows.
- **Impact**: O(rows) memory + O(modules) round-trips on every dashboard open; the per-module raw aggregate is pure duplicate work since the GROUP BY row already has every field.
- **Effort**: 4 · **Value**: 8
- **Fix sketch**: (a) Have `getAllModuleStats()` return the raw rows (keep `avg_*_prompt_len`) and pass each module's already-computed `RawModuleStatsRow` into `generateInsights` instead of re-querying. (b) For quality score, compute recent/older windows in SQL (`LIMIT 20 ORDER BY completed_at DESC` returning only `success`) or add an aggregate window — never `SELECT success` for the whole module then `.slice()`.

## 2. `getPromptQualityScore` loads the entire module history to read 20 rows
- **Severity**: high
- **Lens**: performance
- **Category**: full-table read / missing LIMIT
- **File**: src/lib/session-analytics-db.ts:207-209
- **Scenario**: Called once per module inside `getDashboard` (and standalone). Only the newest 20 rows are ever used (recent=10, older=10..20) plus an overall success ratio.
- **Root cause**: The query is `SELECT success ... ORDER BY completed_at DESC` with no `LIMIT`; `total`/`overallSuccess` are derived from the full array (lines 211, 216) while everything else uses only `slice(0,10)`/`slice(10,20)`. The overall rate could come from a cheap `COUNT(*)`+`SUM(success)` aggregate, and the recent windows from a `LIMIT 20`. As written, a heavily-used module materializes thousands of rows per dashboard render.
- **Impact**: Memory + GC churn scaling with session count; combined with finding #1 this is the dominant analytics cost as the table grows.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Replace with two queries: an aggregate (`COUNT(*) total, SUM(success) succ`) for the overall rate, and `SELECT success ... ORDER BY completed_at DESC LIMIT 20` for the recent/older trend windows. Note `completed_at` is **not indexed** (only `module_id` is, db.ts:343-344) — the `ORDER BY completed_at DESC` sorts; a `(module_id, completed_at DESC)` index removes the sort for both this and `getModuleSessions`.

## 3. `recordSession` / `logSessionEvent` do an INSERT then a redundant SELECT round-trip
- **Severity**: medium
- **Lens**: both
- **Category**: redundant query / write-path overhead
- **File**: src/lib/session-analytics-db.ts:73-77 (and src/lib/session-log-db.ts:60-62)
- **Scenario**: Every CLI task completion POSTs to `/api/session-analytics` (and session-log). The write path runs `INSERT` then immediately `SELECT * WHERE id = lastInsertRowid` to rebuild the row object it just had in hand.
- **Root cause**: The function returns a fully-hydrated `SessionRecord`/`SessionLogEntry`, but the caller (route POST, lines 66-77 / 56-66) only needs to echo it back — and `recordSessionOutcome` in the hook (useSessionAnalytics.ts:104-125) is fire-and-forget and ignores the body entirely. The SELECT exists only to map snake_case→camelCase for data already known.
- **Impact**: Doubles DB round-trips on the hot write path; the extra SELECT is wasted whenever the caller discards the result (the common case).
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Build the return object from the input data + `lastInsertRowid` + computed `preview`/`promptLength` instead of re-SELECTing. If a guaranteed-canonical row is ever needed, keep a separate `getRecord` for that path only.

## 4. `extractSignals` rescans the same class-name arrays ~25 times
- **Severity**: medium
- **Lens**: performance
- **Category**: repeated iteration / O(n·k)
- **File**: src/lib/genre-evolution-engine.ts:142-198
- **Scenario**: Runs on every "Scan Project" (telemetry POST `action=scan`). Each `.filter`/`.some` walks the full `classNames` array; there are ~20 `classNames.some(...)`/`.filter(...)` passes plus `headerPaths`/`depModules` passes.
- **Root cause**: Every signal is its own independent full pass over `classNames` (lines 142-198). For a large UE5 project (hundreds–thousands of class names) this is ~20× O(n) substring scans where one pass accumulating all counters/flags would suffice. `headerPaths` (line 139) is computed but never used.
- **Impact**: Scan latency scales as O(classes × signals); wasteful for the one heavy operation in this module. Also `headerPaths` is dead code.
- **Effort**: 4 · **Value**: 4
- **Fix sketch**: Single `for (const n of classNames)` loop that increments the count buckets and sets the boolean flags via a few `includes` checks; drop the unused `headerPaths`. Keeps behavior identical with one pass instead of ~20.

## 5. `cancelOpenSessions` uses a correlated subquery per open row over an unindexed shape
- **Severity**: low
- **Lens**: both
- **Category**: query shape / coupling
- **File**: src/lib/session-log-db.ts:88-96
- **Scenario**: Called on project switch (`action=cancel-open`). For each `started` row it runs a correlated `MAX(id)` subquery keyed on `tab_id` + `event IN (...)`.
- **Root cause**: The `idx_session_log_module`/`idx_session_log_project` indexes (db.ts:263-269) don't cover `tab_id`, so the correlated subquery falls back to scanning `session_log` per candidate row. Fine at small volumes, but the per-row correlated MAX is the kind of shape that degrades to O(open × rows). It also encodes "open = latest started has no later completed/cancelled" implicitly rather than a status column.
- **Impact**: Acceptable today (project switch is rare, log is bounded by the 30/50-row read limits in practice) — flagged as low because the table has no purge and can grow unbounded over a long-lived install.
- **Effort**: 3 · **Value**: 3
- **Fix sketch**: Either add a `(tab_id, event, id)` index to support the subquery, or restructure as a single `GROUP BY tab_id HAVING MAX(...)` pass. Longer-term, a terminal-state/`status` column on the latest row per tab removes the self-join entirely.
