# Zen-Perf Fix Wave 2 — DB N+1 / Over-fetch (server-side query consolidation)

> 5 atomic commits, 6 findings closed. Single mental model: collapse per-row/per-module/per-job
> query loops into one set-based query, reusing aggregates already computed.
> Baseline preserved: tsc 0→0; tests 15 fail / 3946 pass (identical to pre-wave baseline —
> all 15 are pre-existing catalog/ueStaticCheckers failures); 0 lint errors on changed files.

## Commits

| # | Commit | Finding(s) | File(s) |
|---|---|---|---|
| 1 | `108f775` | #33, #34 (ctx 34) | session-analytics-db.ts |
| 2 | `6252f7a` | #27 (ctx 14) | audio-asset-db.ts, api/audio-gen/route.ts |
| 3 | `4cba3a5` | #29 (ctx 20) | gdd-compliance.ts |
| 4 | `bb83821` | #32 (ctx 23) | packaging/build-history-store.ts |
| 5 | `248fbe0` | #28 (ctx 15) | test-gate-runner/drain.ts |

## What was fixed (each preserves the exact returned shape)

1. **Session-analytics dashboard + quality score (#33, #34).** `getDashboard` discarded its single GROUP BY aggregate and re-queried per module (1 + 2N, incl. an unbounded `SELECT success` full-scan each); now reuses the raw GROUP BY rows and passes them into `generateInsights` via a new optional prefetch arg → 1 + N. `getPromptQualityScore` loaded a module's entire history to read ~20 rows; now a `COUNT/SUM` aggregate for the overall rate + a `LIMIT 20` query for the trend windows.
2. **Audio library N+1 (#27).** `GET /api/audio-gen` called `listAssets()` once per set (1 + N) on every open/refresh. Added `listAllAssets()` (one `SELECT * ... ORDER BY createdAt`); route groups by `setId` client-side. ~41 → 2 statement calls for a 40-set library.
3. **GDD compliance redundant reads (#29).** `runComplianceAudit` read `feature_matrix` twice per module (a discarded pre-read + an unconditional read) plus a per-module `getFeatureSummary` (~2N). Now one `getFeaturesByModule` per module (N), bucketed in JS via a pure `summarizeFeatures()` helper. Scoring unchanged.
4. **Build stats N+1 (#32).** `getBuildStats` ran a per-platform `ORDER BY created_at DESC LIMIT 1` inside a map (6 + N). Replaced with one `ROW_NUMBER() OVER (PARTITION BY platform)` window query joined via a Map → 7 fixed queries regardless of platform count.
5. **Drain-loop per-job probe (#28).** `drainJobs` called `executor.available()` per job — N round-trips to the non-reentrant UE bridge per pass. Lazily-memoized per-executor availability Map → each distinct tier-matched executor probed at most once per pass. Verified availability is not consumed by running a job (stateless `/status` GET; serial drain), so caching is behavior-equivalent.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3946 pass — identical to baseline (no new failures) |
| ESLint (6 changed files) | 0 errors, 0 warnings |

## Patterns established (catalogue, items 6–8)

6. **GROUP BY discarded then re-queried per row** — code computes a single GROUP BY aggregate, ignores it, and re-queries per group inside a loop (classic 1+2N). Reuse the aggregate rows; thread them into downstream helpers via an optional prefetch argument so callers that already hold the data don't re-query.
7. **Unbounded read to compute a windowed metric** — `SELECT col FROM t WHERE … ORDER BY …` with no `LIMIT`, then `.slice(0, N)` in JS. Push the window into SQL: a `COUNT/SUM` aggregate for totals + a `LIMIT N` query for the recent window. Never materialize a whole table to read its tail.
8. **Per-iteration probe of a shared/non-reentrant resource** — calling `available()`/status per loop item against a single external bridge. Probe once per pass and memoize; first verify whether *using* the resource consumes its availability (here it doesn't), else mark-on-dispatch locally instead of re-probing.

## Cumulative status (waves 1–2)

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |

**Total closed: 14 / 176.** Remaining: 162.

## What remains
- **Wave 2b (client-side over-fetch, deferred):** #26 (searchPolyHaven full-catalog fetch), #30/#31 (AIBehaviorView per-keystroke PUT + double refetch, input clobbering), #35 (FindingsExplorer per-session fan-out). More UI/hook-coupled (useCRUD refetch behavior) — a tighter mental model than the server-side set.
- **Recommended index follow-up:** `(module_id, completed_at DESC)` on `session_analytics` (removes the LIMIT-20 sort in getPromptQualityScore + getModuleSessions). Deferred as it's a schema/migration change.
- Per the INDEX: Wave 3 (algorithmic hot loops, 10 high), Waves 4-5 (React re-render, 42), Wave 6 (resource leaks/lifecycle, 13), Wave 7 (correctness + diverged-logic consolidation).
