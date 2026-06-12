# Pipeline Artifacts & Test Gates — Bug + UI scan (2026-06-12)

> Total: 8 findings (3 bug, 5 ui)

## Bug findings (new since 2026-06-09)

Dedup note: the four 2026-06-09 findings (editor-lease lock keyed by filter shape, substring result correlation, deferred-tier coercion/overwrite, optimistic `applyLifecycle` without rollback) were re-confirmed as known and are not repeated. The commit-265b4ee `foreign_keys = ON` pragma was checked against this context: none of `pipeline_artifacts`, `pipeline_tracks`, or `catalog_lifecycle` declare or are referenced by any `REFERENCES ... ON DELETE CASCADE` clause (the only FK tables are asset-library, ai-testing, audio-asset, game-director), so the pragma flip cannot cascade into or block inserts in this context — no regression found.

## 1. Scenario-only L3 jobs reach the bridge executor, which runs an *unfiltered* automation pass and correlates against ALL recorded results
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure / state-corruption
- **File**: `src/lib/test-gate-runner/drain.ts:115` (admission), `src/lib/test-gate-runner/bridgeExecutor.ts:105-109,41-46` (execution/correlation)
- **Scenario**: Register a behavioural scenario for a real catalog (the documented use of `scenarioRegistry.ts` — the built-in `registerScenario('abilities', …)` is the template) and let a deferred row exist whose `reason` lacks the `live-UE runner not yet run:` prefix, so `parseTestName` returns null. `collectDeferred` attaches the scenario; `drainJobs` admits the job because the L3 skip guard is `!job.testName && !job.scenario`. The default executor (bridge — both the drain route and the worker default to it) then runs it.
- **Root cause**: Only the spawn executor understands `scenario`; the bridge executor assumes every job it receives has a `testName`. It POSTs `JSON.stringify({ filter: job.testName, flags: [] })` → `filter` is dropped (`{"flags":[]}`, an unfiltered run-everything request), and its poll loop calls `interpretAutomationResult(data, undefined)`: with `matchName` undefined, `matched = all` — the verdict is computed over *every* result in the editor's buffer, including stale results from prior runs. The "scenario jobs are spawn-only" invariant is stated in the registry's doc comment but enforced nowhere.
- **Impact**: A garbage verdict (pass or fail derived from unrelated/stale tests, detail string literally `"undefined: N passed"`) is persisted to `pipeline_artifacts` and a `gate.verdict.changed` event/webhook fires — the exact false-verdict failure this subsystem was built to prevent. Dormant today (no live catalog is keyed in the registry yet) but armed by the very first real `registerScenario` call.
- **Fix sketch**: In `bridgeExecutor.run`, throw early when `!job.testName` (job stays deferred/skipped, never falsely judged). Additionally make `drainJobs`' executor pick scenario-aware: a scenario-only job must only match an executor that can run scenarios (e.g. add a `supports(job)` predicate to `GateExecutor`).

## 2. catalogStore persist `merge` shadows whole catalogs — newly-seeded entities in an existing catalog never appear, and their server lifecycle rows are silently dropped
- **Severity**: Medium
- **Lens**: bug
- **Category**: stale-state / data-loss
- **File**: `src/stores/catalogStore.ts:118-125` (merge), `src/stores/catalogStore.ts:79-80` (compounding skip)
- **Scenario**: A user has used the app once (localStorage `pof-catalog` persisted). A code update adds a new seed entity to an *existing* catalog (e.g. a new spellbook ability). On load, `merge` does `{ ...current.entitiesByCatalog, ...persisted.entitiesByCatalog }` — the persisted `spellbook` map wholesale replaces the freshly-seeded one, so the new entity vanishes. `setEntities` is only ever called from tests, so there is no other hydration path. Worse, if the pipeline already produced lifecycle rows for that entity, `loadLifecycle`'s `if (!ent) continue` silently discards the server record.
- **Root cause**: The spread merges at the catalog level, but the comment's stated contract ("newly-added seed entries appear after a code update") requires an entity-level merge. The assumption "a persisted catalog map is a superset of the seeded one" breaks on every seed addition.
- **Impact**: Entities exist in the DB/seed code but are invisible in every catalog UI for returning users until they wipe localStorage; their lifecycle/track progress is untrackable. Decisions made on an incomplete catalog.
- **Fix sketch**: Merge per-entity: for each catalogId, `{ ...current.entitiesByCatalog[id], ...persisted.entitiesByCatalog[id] }` (seeded entries as base, persisted entries override matching ids). One nested loop in `merge`.

## 3. Drain-worker singleton state evaporates on dev recompile — an orphaned, unstoppable `setInterval` keeps driving the non-reentrant editor alongside any new worker
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition / recovery-gap
- **File**: `src/lib/test-gate-runner/worker.ts:33-37,71-79`; same pattern in `src/app/api/pipeline-artifacts/drain/route.ts:9`
- **Scenario**: Operator starts the always-on worker (`POST /drain/worker {action:'start'}`) while running `next dev`. Any edit that touches the route's dependency graph re-evaluates `worker.ts`: `timer`, `tickInFlight`, `cfg`, and `status` are re-initialized in the fresh module instance, but the old module's `setInterval` callback (closing over the old `cfg`) keeps firing. `GET /worker` now reports `running:false`; `{action:'stop'}` clears only the new (null) timer. Starting again yields *two* concurrent drain loops against the one editor. The drain route's `drainInFlight` Set is likewise reset mid-drain, so the 409 overlap guard silently disappears.
- **Root cause**: Process-lifetime singletons stored as plain module-level variables. The known 2026-06-09 finding covered the two locks not knowing about each other; this is a distinct mechanism — the lock/timer state itself does not survive module re-evaluation, leaving an unreferenceable interval that no API can stop short of killing the process.
- **Impact**: Overlapping automation runs against the shared UE editor (cross-contaminated verdicts, the known garbage-verdict mode), plus a worker that lies about being stopped — in a dev-companion app that predominantly runs under `next dev`.
- **Fix sketch**: Hoist the worker singleton (`timer`, `cfg`, `status`, `cooldownUntil`, `tickInFlight`) and the route's `drainInFlight` onto `globalThis` (e.g. `globalThis.__pofDrainWorker ??= {...}`) so exactly one instance survives recompiles; `startDrainWorker` then always finds and clears the real timer.

## UI findings

(The scope's UI surface is the layout-lab components consuming the in-scope stores/APIs: `Baseline.tsx`, `NextStepCoach.tsx`, `CatalogMatrix.tsx`, `useEntityArtifacts.ts`.)

## 4. Running deferred gates gives zero outcome feedback — the DrainSummary is discarded and failures are silent
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/layout-lab/Baseline.tsx:133-143` (and `NextStepCoach.tsx:97-108`)
- **Scenario**: The operator clicks "Run N deferred gates". The button shows "Running…", then reverts. If the bridge is unreachable (all jobs skipped), the drain 409s (another drain in flight), or the server is down (`drainGates` returns null), nothing changes on screen and no message appears — the user cannot tell "ran and passed" from "didn't run at all".
- **Root cause**: `runDrain` ignores `drainGates`' return value (`ran/passed/failed/skipped` summary) and `drainGates` maps every error to `null`; there is no result/error state in the coach.
- **Impact**: Success theater on the subsystem's primary operator action; users re-click, assume gates passed, or assume the feature is broken. An invisible 409 also masks the editor-contention condition operators most need to know about.
- **Fix sketch**: Surface the summary: keep `DrainSummaryLite | 'error'` in Baseline state and render a one-line result in NextStepCoach ("2 passed · 1 failed · 3 skipped (bridge unavailable)") with the status tint; on `null`, show a dismissible error row instead of silence.

## 5. The runner's failure detail can never appear in the pipeline-rail tooltip — `deriveEntityArtifacts` drops `reason` (and the server tier), leaving dead tooltip code
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/layout-lab/hooks/useEntityArtifacts.ts:61`, consumed at `src/components/layout-lab/Baseline.tsx:199-201`
- **Scenario**: A drained Test Gate fails; the server artifact stores `reason: "VSPropInteractTest: 1 failed / 2"`. The rail shows ✕, but hovering the step never shows why: Baseline's tooltip branch `` `${a?.reason ? ` — ${a.reason}` : ''}` `` is unreachable because the derived artifact object omits `reason` entirely (it also prefers the local recompute's tier over `srv.tier`).
- **Root cause**: `deriveEntityArtifacts` constructs the overlay artifact from `{data, ueAssets, status, tier}` only — `serverArts[s].reason` (the runner's `verdict.detail`, the contract written by `drainOne`) is discarded one hop before the only component that displays it.
- **Impact**: After a failed drain there is nowhere in the Baseline screen to learn the failure cause; operators must query the API by hand. The diagnostic plumbing exists end-to-end and is severed at the last step.
- **Fix sketch**: In the artifact mapping add `...(srv?.reason ?? res?.reason ? { reason: srv?.reason ?? res?.reason } : {})` and prefer `srv?.tier ?? res?.tier` when the server verdict overlays. The existing tooltip then works unchanged.

## 6. CatalogMatrix blocker tooltip shows a stale "not yet run" reason for gates the runner actually ran and failed
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/layout-lab/CatalogMatrix.tsx:72-75`
- **Scenario**: An entity's Test Gate step has server `status:'fail'` with the runner's stored reason ("TestX: 2 failed / 3"). The blockers strip recomputes `accept(a.data)` — for a `runtimeDeferred`/`visualDeferred` step that *always* returns `reason: "live-UE runner not yet run: TestX"` — and the fallback chain `res?.reason ?? res?.detail ?? a.reason` lets that recomputed string win over the artifact's real verdict reason. The ⚠ tooltip claims the gate was never run while the cell shows ✕ failed.
- **Root cause**: The recompute-for-a-human-reason heuristic assumes `accept()` can explain any failure, but L3/L4 accept functions are constant "deferred" stubs; the genuinely authoritative `a.reason` is last in precedence.
- **Impact**: Contradictory status (failed cell, "not yet run" explanation) misleads triage of exactly the rows the matrix flags as blocked.
- **Fix sketch**: Invert precedence for runner tiers: if `a.tier === 'L3' || a.tier === 'L4'` (or `res?.status === 'deferred'` while `a.status === 'fail'`), use `a.reason` first; keep the recompute fallback for L0–L2 data gates.

## 7. CatalogMatrix renders every cell as "pending" while artifacts load (and after a failed fetch) — loading/error states are presented as real data
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/layout-lab/CatalogMatrix.tsx:51-67,79` (with `labArtifactClient.ts:19-24` returning `[]` on failure)
- **Scenario**: Switching catalogs (or opening the matrix with the server offline) shows a fully-populated grid of ○ pending glyphs and "0 / N config-complete" until/unless the fetch resolves — indistinguishable from a catalog where nothing has actually been produced. On fetch failure it stays that way permanently with no retry or notice.
- **Root cause**: `fetchArtifacts` is non-throwing (`[]` on error) and the component keeps no loading/error flag; the empty artifact map legitimately decodes to "pending" in `statusByStep`.
- **Impact**: Operators briefly (or, offline, indefinitely) see false regression — "everything pending" — in the very screen meant to be the catalog-wide source of truth; flicker on every catalog switch.
- **Fix sketch**: Track `'loading' | 'error' | 'ready'` alongside `artState`; while loading render the grid dimmed with an `aria-busy` skeleton row note, and on error show an inline "couldn't load verdicts — retry" bar instead of pending glyphs.

## 8. NextStepCoach wraps interactive controls in a `role="status"` aria-live region
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/layout-lab/NextStepCoach.tsx:57-67`
- **Scenario**: The entire coach Panel — including the drain button, the jump button, the disclosure toggle, and the expandable region — is `role="status"` with `aria-live="polite"`. Screen readers treat all of it as a live status message: expanding "more", toggling plain-language, or the label flipping to "Running…" can re-announce the whole panel's text, and buttons inside a status region are announced as part of the message rather than as focusable controls.
- **Root cause**: The live region was applied to the container to announce next-step changes, instead of scoping it to the text that actually changes.
- **Impact**: Noisy, repeated announcements for screen-reader users on every interaction with the coach; the status semantics also misrepresent buttons as static content.
- **Fix sketch**: Move `role="status" aria-live="polite"` onto the message `<span>` (the "What to do next …" / "All done." text) only; leave the Panel as a plain container. Optionally announce drain completion via the same scoped region.
