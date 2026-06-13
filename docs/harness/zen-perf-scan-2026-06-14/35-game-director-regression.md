# Game Director & Regression — zen-perf scan
> Context: Director, Sessions & Autonomy / Game Director & Regression
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Re-processing a session spawns duplicate regression alerts (no dedup on insert)
- **Severity**: high
- **Lens**: both
- **Category**: regression-diffing correctness / data duplication
- **File**: src/lib/regression-tracker.ts:225
- **Scenario**: A user picks a completed session in `RegressionTrackerView` and clicks "Analyze" more than once (the UI imposes no once-only guard — `handleProcess` at RegressionTrackerView.tsx:89 can fire repeatedly), or re-analyzes after a re-run. Any fingerprint whose `prevStatus` is `fixed`/`resolved` and that reappears in the session takes the REGRESSION branch and `INSERT`s a brand-new `regression_alerts` row with a fresh `crypto.randomUUID()`.
- **Root cause**: The regression branch (lines 209-241) has no idempotency key. Unlike `regression_occurrences` (PRIMARY KEY on `fingerprint_id, session_id, finding_id` + `INSERT OR IGNORE` at line 299) and the occurrence guard at line 194-199, the alert insert never checks whether an alert already exists for `(fingerprint_id, reappeared_in_session_id)`. Worse, after the first run the fingerprint status is set to `'regressed'`, so the *next* run takes the else-branch (line 242) and won't re-alert — but a re-run that restamps the build can flip it back through fixed → regressed and duplicate again.
- **Impact**: The nav "Regressions" pill (`getDirectorStats.activeAlerts`, game-director-db.ts:393) and the Alerts tab inflate with duplicate alerts for the same regression event; `getRegressionStats().activeAlerts` over-counts. Erodes trust in the one signal this whole subsystem exists to produce.
- **Effort**: 2 · **Value**: 7
- **Fix sketch**: Add a UNIQUE constraint on `regression_alerts(fingerprint_id, reappeared_in_session_id)` and switch the insert to `INSERT OR IGNORE`, or guard with a `SELECT 1 ... WHERE fingerprint_id=? AND reappeared_in_session_id=?` before inserting (mirroring the occurrence guard already a few lines above).

## 2. FindingsExplorer fan-out: one HTTP request per completed session, re-fired on every refresh
- **Severity**: high
- **Lens**: performance
- **Category**: N+1 fetch / missing batch endpoint
- **File**: src/components/modules/game-director/FindingsExplorer.tsx:52
- **Scenario**: Opening the "All Findings" tab. The effect filters completed sessions and issues `getFindings(s.id)` for each (`Promise.all(completedSessions.map(...))`, line 57) — one `/api/game-director?action=findings&sessionId=…` round-trip per session. Because the effect depends on `sessions` (line 64) and `useGameDirector` hands back a *new* `sessions` array reference after every `refresh()` (e.g. after each triage edit, which calls `void refresh()` in useGameDirector.ts:120), the entire N-request fan-out re-runs on every triage action.
- **Root cause**: No server-side "all findings" aggregation for the explorer; the component reconstructs the global finding list client-side by querying each session. `getAllFindings()` already exists in game-director-db.ts:308 (LIMIT 200) but is unused — there is no API action wired to it.
- **Impact**: With M completed sessions, every overview triage edit triggers M parallel HTTP calls + M SQLite queries, each re-deserializing all findings. Visible latency spike and busy spinner re-flash on what should be a local optimistic update (the optimistic `setAllFindings` at line 75 is immediately clobbered by the refetch storm).
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Add a `?action=all-findings` GET action backed by the existing `getAllFindings()` (or a triage-filtered variant), fetch it once; drop `sessions`/`getFindings` from the effect deps and refetch only on explicit user action. Keeps the optimistic triage update authoritative.

## 3. processSession does per-finding DB round-trips and loads every session into memory
- **Severity**: medium
- **Lens**: performance
- **Category**: query-in-loop / full-table load
- **File**: src/lib/regression-tracker.ts:165
- **Scenario**: Analyzing any session. The per-finding loop (line 165) runs, for each finding: a `SELECT * FROM regression_fingerprints WHERE hash=?` (line 171), an occurrence-existence `SELECT` (line 194), and a `COUNT(DISTINCT session_id)` (line 205). On top of that, `listSessions()` (line 148) loads *all* sessions and sorts them in JS (lines 152-155), and `findLastFixedSession` (line 305) loads every occurrence row for a fingerprint and linearly walks the full sorted session array for each regression.
- **Root cause**: Fingerprint lookup is keyed by `hash` (which has a UNIQUE index, good) but invoked once per finding rather than batched; session ordering is computed in JS instead of via SQL `ORDER BY datetime(created_at)`. Everything is small today (sim generates ~15 findings/session) so it is correct but does not scale and bloats the transaction's lock window.
- **Impact**: O(findings) synchronous prepared-statement executions inside one write transaction; `listSessions()` + in-JS sort is O(S log S) per analyze. Holds the better-sqlite3 write lock longer than necessary. Negligible now, but the design caps how many sessions/findings the tracker can process responsively.
- **Effort**: 5 · **Value**: 4
- **Fix sketch**: Prepare the three statements once outside the loop and reuse; replace `listSessions()`+JS sort with a single `SELECT id FROM game_director_sessions ORDER BY datetime(created_at)` to build the index; in `findLastFixedSession` join occurrences against the ordered session list in SQL (`ORDER BY datetime(created_at) DESC LIMIT 1`) instead of loading all + walking.

## 4. getDirectorStats fires 7 sequential queries; getHealthTrend is N+1 over sessions
- **Severity**: medium
- **Lens**: performance
- **Category**: repeated DB queries / N+1
- **File**: src/lib/game-director-db.ts:370
- **Scenario**: Every Overview load. `useGameDirector` fetches list+stats+trend in parallel (useGameDirector.ts:23-27). `getDirectorStats` (line 370) runs seven independent `db.prepare(...).get()` calls — three of which are `COUNT(*)` over `game_director_findings` with different `WHERE` predicates that could be a single grouped query. `getHealthTrend` (line 429) then runs, *per completed session row*, a critical-count query (line 473) and a regression-count query (line 474) — classic N+1 inside the `.map`.
- **Root cause**: Stats assembled as discrete scalar queries rather than aggregated; trend enriches each row with separate point queries instead of one grouped `JOIN`/`GROUP BY` over findings and alerts.
- **Impact**: ~7 queries for stats + (2 × completed-session-count) for trend on every overview render/refresh. Each triage edit calls `refresh()` → all three endpoints re-run. Cheap individually, but it is the hot path of the module and grows linearly with session history.
- **Effort**: 4 · **Value**: 4
- **Fix sketch**: Collapse the three finding `COUNT`s into one `SELECT SUM(CASE WHEN severity='critical' …)` row. For the trend, pre-aggregate critical counts with one `GROUP BY session_id` query and regression counts with one `GROUP BY reappeared_in_session_id` query, then look up from two `Map`s in the `.map` instead of querying per row.

## 5. SessionDetail recomputes five severity buckets every render
- **Severity**: low
- **Lens**: performance
- **Category**: missing memoization
- **File**: src/components/modules/game-director/SessionDetail.tsx:98
- **Scenario**: Any state change in `SessionDetail` (expanding a finding, switching the findings/timeline/coverage sub-tab via `setActiveTab`) re-runs the component body, which unconditionally rebuilds `criticals`/`highs`/`mediums`/`lows`/`positives` by filtering the full `findings` array five times (lines 98-102), even though only `criticals.length`/`positives.length` are consumed (the summary strip) and `FindingsList` receives the unfiltered array anyway.
- **Root cause**: Derived collections computed inline in render with no `useMemo`; four of the five buckets are never read for their elements, only for the two `.length` reads in the summary strip.
- **Impact**: Five full array scans per render on a view that re-renders on every expand/tab toggle. Trivial cost at current sizes — purely a cleanliness/altitude issue — but it is dead computation: `highs`/`mediums`/`lows` are allocated and discarded.
- **Effort**: 2 · **Value**: 2
- **Fix sketch**: Replace the five `filter`s with a single pass computing the counts actually used (`criticalCount`, `positiveCount`) inside a `useMemo([findings])`, or drop the unused buckets entirely and inline the two `.filter(...).length` reads.
