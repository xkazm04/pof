# Visual Asset Generation — zen-perf scan
> Context: Visual Content Generation / Visual Asset Generation
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. MCP poll callback overlaps itself — concurrent in-flight requests on a single job
- **Severity**: high
- **Lens**: performance
- **Category**: async / re-entrant timer
- **File**: src/components/modules/visual-gen/asset-forge/useForgeStore.ts:157
- **Scenario**: `submitMcpJob` schedules `setInterval(async () => {...}, 5000)` (UI_TIMEOUTS.blenderGenPollInterval = 5_000). The callback `await`s a status fetch, and on completion `await`s a second `/import` POST that can take many seconds. `setInterval` does NOT wait for the previous async callback to settle — it fires every 5s regardless. If the status endpoint (or the dev server) is slow, two or three poll requests for the same job stack up concurrently; worse, after `status === 'completed'` fires, the long `await tryApiFetch('/import')` runs while the interval is *still scheduled* (it isn't cleared until after the import resolves at line 198), so additional status polls fire during import.
- **Root cause**: `setInterval` with an `async` body never serializes; cleanup (`clearInterval`) happens only after the trailing `await`s resolve, leaving a window of overlapping ticks.
- **Impact**: Duplicate provider/status calls per job (extra network + provider-side load), redundant `updateJob` writes re-rendering the whole queue, and a race where a late status poll can flip a job that already entered `importing` back to `generating` via the `updateJob({ progress })` tail at line 225.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Replace `setInterval` with a self-scheduling `setTimeout` loop (poll → await → schedule next only after the body finishes), or guard with an `inFlight` boolean that early-returns while a tick is pending. Clear/null the timer handle *before* starting the long `/import` await so no poll fires during import.

## 2. Each running JobCard runs its own 1-second `setInterval`; N concurrent jobs = N timers driving N re-renders/sec
- **Severity**: medium
- **Lens**: performance
- **Category**: re-render / timer fan-out
- **File**: src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx:21
- **Scenario**: Every `JobCard` for a not-yet-completed job mounts a `setInterval(() => setNow(Date.now()), 1000)` purely to recompute an `elapsed` seconds label. With several queued/generating jobs that is one independent timer + one `setState` + one card re-render per job per second, on top of the store updates from the polling in finding #1. The elapsed label only needs whole-second granularity and is identical math for every card.
- **Root cause**: Per-instance clock state instead of a single shared ticker; the timer keys off `job.completedAt` so it keeps ticking for `pending`/`generating`/`importing` cards indefinitely.
- **Impact**: Avoidable render churn that scales linearly with queue size; combined with #1's redundant `updateJob` calls it makes the queue the hottest re-render path in the module. Minor battery/CPU cost when a tab is left open with active jobs.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Hoist one `now` ticker into `GenerationQueue` (single `setInterval`, only mounted when `jobs.some(active)`), pass `now` down to cards; or memoize the elapsed string and only re-tick the subset that is in-flight. Wrap `JobCard` in `React.memo`.

## 3. `searchPolyHaven` fetches the entire catalog on every search, then filters/slices client-side
- **Severity**: high
- **Lens**: both
- **Category**: over-fetch / missing cache
- **File**: src/lib/visual-gen/asset-sources.ts:39
- **Scenario**: `searchPolyHaven` hits `GET /assets?t=<category>`, which returns the *complete* Poly Haven catalog for that type (hundreds of entries) as one JSON object. The browse route (src/app/api/visual-gen/browse/route.ts:23-35) then does the query match in JS (`results.filter(...)`) and `slice(0, 50)`. Every keystroke-triggered "Search" re-downloads and re-parses the full catalog server-side; nothing is cached, deduped, or `revalidate`d. PolyHaven has no server-side search, so the whole list is the only option — but re-pulling it per request is wasteful.
- **Root cause**: No memoization/Next `fetch` cache on a list that changes rarely (CC0 catalog), and search semantics implemented by full-list download + client filter.
- **Impact**: Each search = a large external GET + full JSON parse + O(n) filter on the server; repeated searches multiply this. Slow first paint of results and unnecessary egress against the free upstream API (risking rate limits).
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Add `fetch(..., { next: { revalidate: 3600 } })` (or a module-level in-memory cache keyed by category) so the catalog is pulled at most hourly; keep the client-side filter on the cached list. Optionally move the `slice(0,50)` cap before serialization is already done — fine as is.

## 4. Three identical sequential poll loops (Leonardo image, Leonardo texture, Scenario) — duplicated orchestration with no shared abstraction
- **Severity**: medium
- **Lens**: architecture
- **Category**: duplication / missing abstraction
- **File**: src/lib/leonardo.ts:139
- **Scenario**: The `for (let attempt...) { await sleep(pollMs); fetch; if status COMPLETE/FAILED ... }` poll loop is copy-pasted three times: leonardo.ts:139 (generateImage), leonardo.ts:322 (generateTextureOn3DModel), and scenario.ts:136 (generateTexture). Each re-implements the same attempt counter, sleep, transient-skip-on-`!ok`, terminal-status check, and timeout-throw, with subtly different constants (MAX_POLL_ATTEMPTS 30 vs 60; interval 2000 vs 3000) and slightly different failure handling (Leonardo `continue`s silently on a failed poll with no consecutive-failure cap, unlike the MCP poller in #1 which does cap).
- **Root cause**: No shared `pollUntil(predicate, { intervalMs, maxAttempts })` helper; each provider client grew its own loop.
- **Impact**: Three places to fix any polling bug (e.g. adding jittered backoff, a consecutive-failure cap, or abort support); inconsistent resilience between providers; ~40 duplicated lines. A flaky upstream that 500s mid-generation will silently burn all 30/60 attempts here because failed polls just `continue`.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Extract a generic `async function pollJob<T>({ poll, isDone, isFailed, intervalMs, maxAttempts, onTransientError })` into a shared `lib/visual-gen/poll.ts`; have all three clients call it. Centralizes backoff/abort and the failure cap.

## 5. Unused provider helpers and a duplicated `GenerationMode` type — dead/drifting surface
- **Severity**: low
- **Lens**: architecture
- **Category**: dead code / type duplication
- **File**: src/lib/visual-gen/providers.ts:79
- **Scenario**: `getProviderById` (line 79), `getAvailableProviders` (line 83), and `getFreeProviders` (line 87) are exported but have zero call sites anywhere in `src` (grep confirms only their definitions). Meanwhile `GenerationPanel.tsx:29` re-implements `getAvailableProviders` inline as `GENERATION_PROVIDERS.filter((p) => p.modes.includes(mode))`. Separately, the `GenerationMode` type is declared twice — providers.ts:7 and useForgeStore.ts:13 — so the two can silently drift.
- **Root cause**: Helpers written ahead of need and never adopted; the store redeclares a type it could import from providers.ts.
- **Impact**: Dead exports invite "is this the canonical accessor?" confusion and must be carried by the bundler/maintainers; the duplicated mode union is a latent inconsistency bug if one side adds a mode.
- **Effort**: 2 · **Value**: 3
- **Fix sketch**: Delete the three unused helpers (or have GenerationPanel use `getAvailableProviders` instead of the inline filter — pick one). Import `GenerationMode` from `providers.ts` in useForgeStore.ts and remove the local redeclaration.
