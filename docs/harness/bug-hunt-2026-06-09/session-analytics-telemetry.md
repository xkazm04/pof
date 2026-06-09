# Bug Hunt — Session Analytics & Telemetry
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

## 1. Idempotency key is a check-then-act race that double-executes side effects
- **Severity**: high
- **Category**: race-condition
- **File**: src/lib/request-log.ts:15 (and consumer src/app/api/feature-matrix/import/route.ts:103-182)
- **Scenario**: If a client retries an import (or a double-click / network re-send fires two requests) carrying the same `Idempotency-Key` while the first is still in flight, both requests call `checkIdempotencyKey()` before either has called `saveIdempotencyResult()`. Both see `null` (no cached row yet), both fall through, and both run `upsertFeatures(moduleId, features)` — the real, destructive DB mutation. The cached result is only written *after* the mutation, so the guard window is exactly the duration of the work it is supposed to protect.
- **Root cause**: The design treats idempotency as a read-then-write cache (`checkIdempotencyKey` … do work … `saveIdempotencyResult`) instead of an atomic reservation. There is no row inserted at *check* time to claim the key, and no unique-constraint conflict to lose on, so concurrent in-flight requests with the same key are never serialized. `INSERT OR REPLACE` at the end also means the second writer happily overwrites the first rather than detecting the collision.
- **Impact**: data corruption / duplicate writes — the idempotency contract is silently void under concurrency; the very retries it exists to make safe instead double-import. "Success theater": every response looks fine.
- **Fix sketch**: Reserve the key atomically *before* doing work: `INSERT INTO request_log(idempotency_key, route, status_code, response_body) VALUES (?, ?, 0, '')` with a plain `INSERT` (PK = idempotency_key). If it throws SQLITE_CONSTRAINT, a concurrent request already owns the key → return 409/replay-pending instead of executing. After the work completes, `UPDATE` the reserved row with the real status/body. This makes "two requests, same key, both mutate" impossible regardless of timing.

## 2. Dismissed genre suggestions resurrect as new pending suggestions on every scan
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/genre-evolution-engine.ts:349-359 (with src/app/api/telemetry/route.ts:86-96)
- **Scenario**: If a user dismisses an "Evolve toward Souls-like" suggestion, then runs another project scan (which is the normal loop in `TelemetryEvolution`), the same `dodge-roll-heavy` pattern is re-detected, `generateSuggestions` re-emits the Souls-like suggestion, the scan handler's dedup checks only the *pending* set (`pendingGenres`) — which no longer contains the dismissed one — and re-inserts it with a brand-new `sug-souls-like-${Date.now()}` id. The dismissed card is back, pending again.
- **Root cause**: `generateSuggestions` only skips genres in `acceptedSubGenres` (`getAcceptedSubGenres()` returns `status='accepted'` only). The "dismissed" state is never fed back into suggestion generation, and the route's dedup compares against pending rows rather than against any prior decision. Combined with a fresh `Date.now()` id per scan, `INSERT OR REPLACE` inserts a new row instead of replacing the old one. Dismissal therefore has no durable effect.
- **Impact**: UX degradation / data corruption — "Dismiss" is meaningless; suggestion noise accumulates (multiple rows per sub-genre over time in `genre_suggestions`), and the user is repeatedly nagged with choices they already rejected.
- **Fix sketch**: Make suggestion generation idempotent per sub-genre against *all* prior decisions: pass both accepted and dismissed sub-genres into `generateSuggestions` and skip both, OR give suggestions a stable id (`sug-${template.id}`, no timestamp) so re-emission collides on PK and `INSERT OR REPLACE` updates in place — then have the route refuse to revert a `dismissed`/`accepted` row back to `pending`.

## 3. Unguarded JSON.parse in telemetry row mappers crashes the whole dashboard on one bad row
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/lib/telemetry-db.ts:143-145 (rowToSnapshot) and :155-157 (rowToSuggestion)
- **Scenario**: If any `telemetry_snapshots.signals` / `detected_patterns` or `genre_suggestions.patterns` / `proposed_changes` cell contains malformed JSON — a truncated write, a partial migration, a manually-edited SQLite file, or a future schema change — `JSON.parse` throws. Because `getTelemetryStats` calls `getLatestSnapshot` + `getPendingSuggestions`, a single corrupt row makes `GET /api/telemetry?action=stats` throw, the route returns a 500, and the entire Genre Evolution view fails to load (the hook's `.catch(() => null)` just yields a permanent empty state with no diagnostic).
- **Root cause**: The `|| '{}'` / `|| '[]'` fallbacks only handle a *falsy* column (impossible here — the columns are `NOT NULL DEFAULT`), not an *invalid* JSON string. There is no per-row try/catch, so one poisoned row takes down every query that maps it. The blast radius is the whole feature, not the offending record.
- **Impact**: crash / UX degradation — total loss of telemetry & suggestions UI from a single bad cell, with the real cause hidden behind a generic empty state.
- **Fix sketch**: Wrap each parse in a `safeJsonParse(raw, fallback)` helper that catches and returns the typed fallback (logging once with the row id). Map rows defensively so a corrupt record is skipped/degraded rather than throwing; the dashboard renders the remaining good rows.

## 4. Quality-score "improving/declining" trend reads the wrong rows because ordering has no tiebreaker
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/session-analytics-db.ts:207-228 (getPromptQualityScore)
- **Scenario**: `getPromptQualityScore` orders sessions `ORDER BY completed_at DESC` then slices `[0,10)` as "recent" and `[10,20)` as "older" to compute a trend. `completed_at` is stored at 1-second resolution (`datetime('now')` default, or a client `new Date().toISOString()` that can be skewed/identical for rapid runs). When a burst of sessions shares the same `completed_at` second, SQLite returns them in an arbitrary order, so the 10/20 boundary slices across rows that are not actually time-ordered. The "recent vs older" success-rate comparison — and thus the improving/declining/stable verdict — is computed on a mis-partitioned, run-to-run-unstable window.
- **Root cause**: Recency is inferred from a coarse, non-unique timestamp with no secondary sort key, even though a monotonic `id` (AUTOINCREMENT) exists and is the true insertion order. The slice-based windowing assumes a strict total order that `completed_at` alone does not provide.
- **Impact**: UX degradation — users see a wrong/flapping trend arrow (e.g. "declining" when stable), eroding trust in the analytics and potentially driving bad prompt-strategy changes.
- **Fix sketch**: Make recency deterministic: `ORDER BY completed_at DESC, id DESC` (id as the tiebreaker) here and in `getRecentSessions` / `getSessionLog`. More robustly, window by `id` directly since it already encodes insertion order, removing the dependence on timestamp resolution entirely.
