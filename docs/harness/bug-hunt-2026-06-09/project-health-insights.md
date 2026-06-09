# Bug Hunt — Project Health & Insights
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. Weekly digest daily buckets are keyed by UTC-shifted local-midnight dates, silently dropping sessions
- **Severity**: high
- **Category**: edge-case
- **File**: src/lib/weekly-digest.ts:8-15, 88-104
- **Scenario**: A user in any non-zero UTC offset (e.g. UTC+2 Europe, or any negative offset in the Americas) runs a CLI session. `getWeekStart` builds the week boundary in LOCAL time (`getDay()`, `setHours(0,0,0,0)`), then `toISODate(d)` keys each of the 7 day-buckets via `d.toISOString().slice(0,10)` — i.e. the UTC calendar date of a LOCAL midnight, which is the *previous* day for positive offsets. Meanwhile rows are bucketed by `row.completed_at.slice(0,10)`, the true UTC date of the stored `new Date().toISOString()` value. The two date spaces don't line up.
- **Root cause**: The module mixes local-time week math (`getDay`/`setHours`) with UTC string extraction (`toISOString().slice(0,10)`) and assumes the resulting day keys match the UTC date prefix of stored timestamps. For any offset where local midnight and UTC midnight fall on different calendar dates, the seven generated bucket keys are shifted by one day relative to the data.
- **Impact**: UX degradation / silent data loss in the view. `dailyMap.get(day)` returns `undefined` for the mismatched dates, so the `if (entry)` guard at line 98 silently discards those sessions from the daily-activity sparkline and the PNG export, while `totalSessions` (computed from the same rows) still counts them — producing a digest where "12 sessions this week" coexists with a near-empty daily chart. Streak/most-active stats stay correct, making the discrepancy look like a rendering glitch rather than a timezone bug.
- **Fix sketch**: Pick ONE time basis for the whole pipeline. Either do all bucketing in UTC (`getWeekStart` should use `getUTCDay`/`setUTCHours`, and compare against `toISOString` windows), or convert `completed_at` to local before slicing. Make the day key derivation and the row-to-day mapping share a single helper so they cannot diverge.

## 2. Resolved regressions are never cleared — the alert banner shows stale, already-fixed regressions
- **Severity**: high
- **Category**: state-corruption
- **File**: src/components/modules/evaluator/ProjectHealthDashboard.tsx:104-137
- **Scenario**: Scan N drops a module's score, raising a regression alert. The user fixes the issue; scan N+1 restores the score. The effect recomputes `alerts` (now empty) but the guard `if (alerts.length > 0)` (line 133) skips `setRegressionAlerts`, so the previous, now-false alert array stays in state and on screen. Conversely, a user-dismissed alert reappears the next time `scanHistory` mutates and the same regression is recomputed.
- **Root cause**: The effect treats alert state as append-only/conditional ("only set when there is something to show") instead of as a pure derivation of the latest scan pair. Whenever the comparison yields no regressions, the component must reset to empty, but the early skip leaves the prior render's alerts intact.
- **Impact**: UX degradation / false reporting. The dashboard claims an active health regression after it has been resolved, eroding trust in the signal and potentially triggering redundant "Fix with Claude" work on a non-issue.
- **Fix sketch**: Always call `setRegressionAlerts(alerts)` unconditionally (empty array clears the banner), or derive the alerts with `useMemo` from `scanHistory` so the rendered set is always a pure function of current data. Dismissal should be tracked by a separate dismissed-id set keyed to the scan id, not by mutating the derived list.

## 3. Velocity cap leaks phantom items into avgVelocity and milestone predictions
- **Severity**: medium
- **Category**: logic-error
- **File**: src/lib/health-engine.ts:96-118, 427-434
- **Scenario**: `generateVelocityHistory` accumulates `itemsThisWeek` into `cumulative` and caps `cumulative` at `completedItems` (lines 108-110), but it still records the *uncapped* `itemsThisWeek` on each point. Once the cap is hit (common, since the ramp+variance routinely overshoots the real total), later weeks report positive `itemsCompleted` while `cumulativeCompleted` is frozen. `avgVelocity` is then computed from the last 3 weeks' `itemsCompleted` (line 429-431), including those phantom items that never moved the cumulative total.
- **Root cause**: Two quantities that must stay consistent — per-week throughput and its running sum — are clamped independently. The cap is applied only to the cumulative field, so the invariant `sum(itemsCompleted) == cumulativeCompleted(last)` is broken, and downstream consumers that read `itemsCompleted` see fabricated work.
- **Impact**: Corrupted derived metrics. Inflated `avgVelocity` feeds `predictMilestones` (line 434), so `weeksNeeded = remaining / avgVelocity` underestimates time-to-milestone, surfacing optimistic ETAs in the Milestones tab; the velocity bar chart also shows weeks of "completed items" that contradict the flat burnup line in the adjacent chart.
- **Fix sketch**: Clamp `itemsThisWeek` to the remaining headroom before adding it (`itemsThisWeek = Math.min(itemsThisWeek, completedItems - cumulative)`), so the per-week value and the cumulative stay mutually consistent. Then compute `avgVelocity` from the same clamped series.

## 4. Mixed timestamp formats in completed_at make string-range week filtering fragile (latent landmine)
- **Severity**: critical
- **Category**: data-loss
- **File**: src/lib/weekly-digest.ts:42-58 (with src/lib/db.ts:295)
- **Scenario**: The week queries select rows via `WHERE completed_at >= ? AND completed_at < ?` using full ISO strings (`weekStart.toISOString()` → `"2026-06-08T00:00:00.000Z"`). This is a lexicographic string comparison. Today every insert goes through `recordSession`, which writes `new Date().toISOString()` (T-separated, `Z`-suffixed), so it works. But the schema column defaults to `datetime('now')` (line 295), which produces a SPACE-separated value `"2026-06-08 12:00:00"`. The moment any future insert path, migration backfill, or manual/imported row uses the default, those rows carry a format whose space char (0x20) sorts *below* `T` (0x54).
- **Root cause**: The week boundary is enforced by lexicographic comparison of timestamp strings, which is only correct if every stored value shares the exact same canonical ISO format. The table simultaneously sanctions a second, incompatible format via its column default, so correctness depends on an unenforced "everyone must pass completed_at explicitly" convention.
- **Impact**: Silent data loss. Space-format rows compare as strictly less than any `T`-format week-start boundary, so they fall outside `>= weekStartISO` and vanish from the current-week aggregate, daily chart, streaks, and module activity — with no error. The defect is invisible until a second writer appears, at which point digests silently undercount.
- **Fix sketch**: Make the format impossible to diverge: store all timestamps via a single canonical writer (or a `CHECK`/trigger that rejects non-ISO values), and align the column default with the app format (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`). Better, store epoch-millis integers and compare numerically so range filters never depend on string shape.
