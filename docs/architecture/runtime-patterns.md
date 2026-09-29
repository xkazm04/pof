# Runtime Patterns & Coding Conventions

Cross-cutting infrastructure that every module in the app depends on: the typed event bus, the `Lifecycle<T>` protocol, the Suspend/LRU module cache, and the ESLint-enforced coding conventions.

---

## Key files

| File | Purpose |
|------|---------|
| `src/lib/event-bus.ts` | Singleton `EventBus` class + exported `eventBus` instance |
| `src/types/event-bus.ts` | `EventMap` interface (all typed channels), `BusEvent<C>`, handler types |
| `src/lib/lifecycle.ts` | `Lifecycle<T>` protocol + four factories + `composeLifecycles` |
| `src/hooks/useLifecycle.ts` | `useLifecycle()` / `useGuardedLifecycle()` React hooks |
| `src/lib/state-emitter.ts` | `createStateEmitter<T>()` — shared subscribe/notify/getState primitive for the bridge singletons |
| `src/hooks/useSuspend.ts` | `SuspendContext`, `useSuspendableEffect`, `useSuspendableSelector` |
| `src/components/layout/ModuleRenderer/index.tsx` · `helpers.ts` | LRU module cache (`LRU_CAP = 5`, `SESSION_LRU_CAP = 5`) + `lruTouched()` / `ObservedLiveProbe` / `EvictionBasis` |
| `src/lib/logger.ts` | Thin `logger` wrapper — `info`, `warn`, `debug`, `log` |
| `src/lib/chart-colors.ts` | Full semantic color palette: `STATUS_*`, `ACCENT_*`, `MODULE_COLORS`, helpers |
| `src/lib/constants.ts` | `UI_TIMEOUTS`, `Z_INDEX`, `MOTION`/`CLI_ANIM`, `getAppOrigin()` |
| `src/types/result.ts` | `Result<T, E>` discriminated union, `ok()`, `err()`, `mapResult()`, `unwrapOr()` |
| `eslint.config.mjs` | Enforced rules: no-console (warn), no hardcoded hex (warn), no explicit any (warn) |

---

## Event bus

### What it is

`src/lib/event-bus.ts:26` defines `class EventBus` with a singleton exported at line 191 as `eventBus`. It is a typed pub/sub bus with three subscription modes, a rolling replay buffer, and handler-error isolation.

### Channel namespaces

All channels are defined in `src/types/event-bus.ts` as a merged `EventMap` interface. The namespaces and their channels are:

| Namespace | Channels |
|-----------|---------|
| `cli` | `cli.task.started`, `cli.task.completed`, `cli.session.created`, `cli.session.removed` |
| `eval` | `eval.scan.completed`, `eval.recommendation`, `eval.visual` |
| `build` | `build.started`, `build.completed`, `build.queued`, `build.progress`, `build.succeeded`, `build.failed`, `build.aborted` |
| `checklist` | `checklist.item.changed`, `checklist.module.completed` |
| `file` | `file.changed`, `file.verified` |
| `nav` | `nav.module.changed`, `nav.tab.changed` |
| `ue5` | `ue5.connected`, `ue5.disconnected`, `ue5.error`, `ue5.ws.*` (5 WebSocket channels) |
| `pof` | `pof.connected`, `pof.disconnected`, `pof.error`, `pof.manifest.updated`, `pof.test.completed`, `pof.snapshot.captured`, `pof.compile.completed` |
| `gate` | `gate.verdict.changed` (emitted by `drainOne` when an L3/L4 test-gate verdict moves; carries `from`/`to`/`regression`) |
| `oneshot` | `oneshot.started`, `oneshot.step-completed`, `oneshot.completed`, `oneshot.failed` |

The type `EventChannel = keyof EventMap` means TypeScript enforces payload shapes at call sites.

### Subscription modes

```ts
// 1 — Exact channel
const unsub = eventBus.on('cli.task.completed', (event) => { /* event.payload.success */ });

// 2 — Namespace prefix (matches all cli.* channels)
const unsub = eventBus.onNamespace('cli', (event) => { /* any CLI event */ });

// 3 — Wildcard (every event — use for devtools/analytics only)
const unsub = eventBus.onAny((event) => { /* event.channel, event.payload */ });
```

All three return an `Unsubscribe` function. Pass it to a `Lifecycle` or call it in a `useEffect` cleanup.

### Replay buffer

The bus keeps the last 200 events in memory (`maxReplaySize = 200`, `src/lib/event-bus.ts:31`). Late subscribers can call:

```ts
eventBus.getReplayBuffer('cli.task.completed');   // exact channel
eventBus.getReplayByNamespace('eval');            // namespace prefix
eventBus.replayTo('cli.task.completed', handler); // push past events to handler
```

### When to use the event bus

Use it for **decoupled cross-module notifications** — when a producer should not import a consumer (e.g., the CLI terminal emitting `cli.task.completed` to update a checklist). Prefer Zustand store subscriptions for tightly coupled UI state; use the bus for broader lifecycle signals, telemetry, and devtools.

---

## Lifecycle protocol

### Protocol (`src/lib/lifecycle.ts:23`)

```ts
interface Lifecycle<T = void> {
  init(): T;       // start the resource
  isActive(): boolean;
  dispose(): void; // safe to call multiple times
}
```

Six resource patterns share this protocol: CLI sessions, file watchers, SSE connections, event bus subscriptions, the activity feed bridge, and the module cache auto-save timer.

### Factories

| Factory | File:line | Use case |
|---------|-----------|---------|
| `createLifecycle(factory, teardown)` | `lifecycle.ts:38` | Single disposable resource with controlled-monopoly: calling `init()` again disposes the previous instance before creating a new one |
| `createSubscriptionLifecycle(subscribe)` | `lifecycle.ts:71` | A set of unsubscribe functions collected by one `subscribe()` call; `dispose()` calls all unsubs |
| `createGuardedLifecycle(setup)` | `lifecycle.ts:98` | One-time initialization guard: re-calling `init()` is a no-op while active; must `dispose()` to re-init |
| `createTimerLifecycle(callback, delayMs)` | `lifecycle.ts:127` | Debounced timer (e.g., auto-save); `init()` starts/restarts, `dispose()` cancels |

`composeLifecycles(...lifecycles)` at `lifecycle.ts:163` groups multiple instances into one: `init()` runs all in order, `dispose()` runs all in reverse.

### React hooks (`src/hooks/useLifecycle.ts`)

```ts
// Disposes and re-inits when deps change; disposes on unmount.
useLifecycle(() => createTimerLifecycle(callback, 500), [callback]);

// Single-init variant — safe for React StrictMode double-mount.
useGuardedLifecycle(() => createGuardedLifecycle(setup));
```

Both hooks store the `Lifecycle` instance in a `useRef` so `dispose()` is always called on the exact instance that was created, even across strict-mode double invocations.

---

## State emitter (`src/lib/state-emitter.ts`)

`createStateEmitter<T>({ initial, label, clone? })` is the shared observable-state primitive behind the bridge singletons. It owns the subscribe/notify/getState trio so callers don't re-roll it:

```ts
const emitter = createStateEmitter<ConnState>({
  label: '[PoF-CM]',            // prefixes subscriber-error warnings
  initial: { status: 'disconnected', /* … */ },
  // Optional — override the default shallow clone when state holds a Map etc.
  clone: (s) => ({ ...s, propertyWatches: new Map(s.propertyWatches) }),
});

emitter.getState();             // defensive copy (clone), safe to hand to subscribers
emitter.peek();                 // live ref — for the owner's own hot internal reads only (read-only)
emitter.setState({ status });   // shallow-merge, then notify all subscribers
const unsub = emitter.subscribe(handler);  // returns an unsubscribe fn
```

`notify` iterates subscribers with a per-handler `try/catch` (a throwing subscriber is logged via `logger.warn` under `label` and never blocks siblings) — the same isolation the event bus gives. **Compose, don't inherit**: hold it as a private field and delegate `getState`/`onStateChange`, expose internal reads through a `private get state() { return this.emitter.peek(); }` getter. Used by `pof-bridge/connection-manager.ts`, `ue5-bridge/connection-manager.ts`, and `ue5-bridge/ws-live-state.ts`.

**Live-channel write ledger (`src/lib/ue5-bridge/sync-ledger.ts`).** `ue5LiveState.setProperty` returns a `WriteReceipt { key, sent, seq }` (`send()` reports whether the socket was OPEN; the `set.property` wire frame is unchanged) and records a `SyncWrite` in `LiveEditorState.writes`, keyed `objectPath::propertyName`, with the value then watched on that exact key as its base. Each `property.update` on the key re-classifies it with the three-way compare base / written / read-back into a closed vocabulary: `dropped` (never sent), `unobserved`, `pending` (read-back = base), `confirmed` (read-back = written, convergence is never a conflict), `diverged` (the only one `deriveConflicts` returns, as typed values). `confirmed`/`diverged` are settled - later edits in UE are subsequent history. Ordering is the client's own arrival `seq`, never UE timestamps; the plugin sends no ack, so the ledger claims no more than delivery plus read-back. The emitter clone copies `writes` like `propertyWatches`; `disconnect()` clears both. A panel consumes the ledger rather than scanning its own display log (`BidirectionalStateSyncPanel`: a dropped write logs `warn` and is not counted as sent) - pinned by `sync-ledger.test.ts`, `ws-write-receipt.test.ts` and `bidirectional-sync-ledger.test.tsx`.

---

## Suspend/LRU pattern

### Problem

Navigating between modules unmounts components, destroying local state and interrupting running CLI sessions. Keeping every visited module mounted wastes memory and causes invisible timers/subscriptions to fire.

### LRU cache (`src/components/layout/ModuleRenderer/index.tsx` · `helpers.ts`)

`ModuleRenderer` keeps the last **5 modules** (`LRU_CAP = 5`, `index.tsx:29`) and the last **5 inline terminal sessions** (`SESSION_LRU_CAP = 5`, `index.tsx:32`) mounted simultaneously. Navigation promotes the active module to the front of the list via `lruTouched()` (`helpers.ts`).

The victim is the least-recently-used entry with **no observed live work** — `lruTouched()` takes an `ObservedLiveProbe` derived from the CLI session store, so a pane with a running CLI session is skipped. The classic tail is evicted only when every candidate is live (the cap always holds); that case is reported with basis `forced-over-live-work` and surfaces in the Activity Feed as a `shell-eviction` event.

**The probe is positive-evidence only:** `false` means "nothing observed", never "idle" — the shell cannot see a module's own streams or polls. `EvictionBasis` (`'unprobed' | 'no-observed-live-work' | 'forced-over-live-work'`) carries that distinction outward beside the existing `liveWork` verdict, so no report can upgrade it, and `unprobed` exists so "no probe was supplied" can never render as a clean bill of health. Routine `no-observed-live-work` evictions stay a `logger.debug` line by design: surfacing them would put "something may have been lost" in front of the user on every 6th navigation, in exactly the case the shell cannot characterise.

The evicted entry's DOM subtree unmounts and cleans up. All mounted-but-hidden modules have `display: none` applied via `style`.

**Pane holds (`src/hooks/usePaneHold.ts`).** A module declares in-flight work the shell cannot otherwise see with `usePaneHold(active, reason)`; `renderModulePane` provides `PaneIdContext` beside `SuspendContext`, so no module knows its pane id, and outside a shell pane (the lab, previews, tests) the hook is a no-op. Holds live in a tiny external store (`{ paneId -> reasons }`, one entry per holder, released by the holder's effect cleanup, so an unmounted pane can never leave one behind); `ModuleRenderer` subscribes to it with `useSyncExternalStore` and folds it into `observedLiveKey(sessions, holds)` as `m:` positive evidence, exactly like a running CLI session. A hold only changes WHICH pane is evicted - `lruTouched` still evicts exactly one per overflow past the cap. A forced eviction over held work reports `liveWork: 'pane-hold'` plus `holdReason`, and the Activity Feed names it (`Module torn down: Packaging - UE cook running`). The holds are **snapshotted into the pending eviction in the render that decides it** (`pickPaneHolds`): React runs the evicted pane's unmount cleanup, which releases its hold, before the report effect, so a report-time read would never see it. Adopters: the interactive cook (`useCookProgress`, rule `cookHoldsPane` - held until the cook settles, which is AFTER the server's `recorded`/`record-error` event that follows `done`/`error` (or stream end), never on the bare `done`: the build row and its id do not exist yet), the ScanTab batch fix and the ReviewableModuleView checklist batch (held across the inter-item gap when no CLI session runs).

**Keep-alive means mounted.** Nothing inside a pane may be keyed on visibility: the pane's entrance fade (`PaneEntrance`) replays through animation controls, because a visibility-keyed wrapper remounted the whole module subtree on every hide and show (it did until 2026-09-29, so a cook died on the first navigation away).

### SuspendContext (`src/hooks/useSuspend.ts:17`)

```ts
export const SuspendContext = createContext<boolean>(false);
```

`ModuleRenderer` wraps every mounted-but-hidden module in `<SuspendContext.Provider value={!isVisible}>` via the shared `renderModulePane()` helper (line 247) — used for both special-category and sub-module panes. A value of `true` means "this subtree is suspended (hidden)".

### useSuspendableEffect

Drop-in replacement for `useEffect` that pauses when suspended:

```ts
// Runs only when the module is visible; cleanup is called when it hides.
useSuspendableEffect(() => {
  const timer = setInterval(poll, UI_TIMEOUTS.pollInterval);
  return () => clearInterval(timer);
}, [poll]);
```

When `suspended` becomes `true`, the cleanup function fires. When `suspended` becomes `false`, the effect re-runs (line 106: `[suspended, ...deps]`).

### useSuspendableSelector

Drop-in for Zustand's `useStore(selector)` that freezes while suspended:

```ts
const progress = useSuspendableSelector(useModuleStore, (s) => s.checklistProgress);
```

While suspended, the store subscription is replaced with a no-op (no re-renders). On resume, `frozenRef` is cleared and `getSnapshot` reads fresh state from the store. Internally uses `useSyncExternalStore` (line 81) for tear-free reads.

---

## Unsaved canvas state across an LRU eviction (session drafts)

Suspension keeps a module mounted; **eviction unmounts it**, and any state living only in `useState` is gone. Surfaces that hold unsaved operator work therefore flush to a session-scoped draft store — the first is the visual AnimBP editor (`StateMachineEditor/draftStore.ts`): a module-scope `Map` keyed per project, written on every edit and read back on mount, with the editor reporting `draftRestored` so a restored draft is stated, never silently assumed. It is in-memory by design (a stale on-disk graph would quietly contradict a fresh scan).

The same file's seeding rule: `seedFromScan` / `seedFromBridge` (`StateMachineEditor/seed.ts`) turn the AnimBP scan or the live bridge manifest into editable states, reusing the read-only graph's `layoutStates` / `classifyState`; the editor's provenance strip says whether the canvas is the project's machine or a template. A seed is compared by CONTENT (`seedSignature`) because callers rebuild it each render, and it is adopted only while the canvas is untouched.

## Canvas edits as named ops, with undo (level flow editor)

The level flow editor has ONE write surface: `onEdit(op, mode)`. Every gesture is a named op from `LevelEditOp` (`src/lib/level-design/level-edit.ts`: `add-room`, `move-room`, `nudge-room`, `update-room`, `delete-room`, `link`, `unlink`, `set-link-gate`, `declare-gate`) and one pure reducer, `applyLevelEdit(doc, op) → Result<{ patch, inverse, marksDocAhead }>`, decides what the op means:

- **patch**: only the keys the op touched, with every reference to something it removed pruned in the SAME patch (`delete-room` drops the room's links, its `difficultyArc` id and its `syncReport` rows). One act is one commit, so one PUT.
- **inverse**: the prior values of exactly those keys (snapshot-of-touched-keys), so it cannot drift from the forward op.
- **marksDocAhead**: the op decides the sync consequence, not the setter. A link edit flips a `synced` doc to `doc-ahead` because the codegen prompt emits connections.

`useDocCommitBuffer` (`LevelDesignView/`) applies an op to the live doc (`peek`, bridged over the gap between a write resolving and the next render) and routes it by `EditCommitMode`. Ops with the same `gestureKey` in a row are one gesture and one undo entry: a drag's `stage` frames plus its mouseup commit, held-arrow `nudge-room`s, or a debounced typing burst in one field of one room. The inverse is captured on the gesture's first frame. A debounced gesture closes when its commit starts (the pause, a blur, a doc switch), a staged one closes on its own commit. History is per document (switching documents empties it) and capped at `EDIT_HISTORY_LIMIT` = 50. A new edit after an undo clears redo. Undo and redo are each one commit with `marksDocAhead: true`, so an undo never claims `synced`.

**External changes.** Before an undo or redo is applied, `rebaseHistoryPatch` compares the live doc against what the entry expects. If `syncReport` was rewritten since (a Check Sync landed between the edit and the undo), the live report is kept, so an undo never brings back stale divergence rows. If any other key drifted (for example "adopt code" edited a room), the history is cleared with a reason instead of overwriting that change.

**Locks, keys and one-way doors.** A click (or Enter) on a link opens the `LinkInspector` (zero writes); deletion is two-step on Delete/Backspace and inside the inspector. Its Apply is one `set-link-gate` op (direction, condition, `requires`, and the room that `grants` the keys: one `{connections, rooms}` patch, one PUT, one undo step); 'Declare gate' turns a prose-only `condition` into a key and grants it from a picked room as one `declare-gate` op. The writers live in `src/lib/level-design/gate-authoring.ts` (pure). Grant candidates are the rooms `lintLevelPacing` still reaches with the gate held shut by a key no room grants, so the picker uses the linter's own closure rather than a copy of its private walk, and a granting room reachable only through the gate is refused. `buildNarrativeCodegenPrompt` emits `[requires: k]` and `Grants: k` only when present, so an ungated document's prompt is unchanged.

To add a canvas op, extend `LevelEditOp` and `applyLevelEdit` (plus a `gestureKey` and `describeLevelEdit` line). It then gets one-commit persistence and undo for free. Do not add another whole-array setter to `LevelFlowEditorProps`.

## One scene edit buffer, rebased ops (audio scene painter)

The audio scene has ONE optimistic edit buffer for the canvas, the property panels AND the Soundscapes tab: `useSceneBuffer` (`AudioView/useSceneBuffer.ts`, over `useEntityCommitBuffer`), mounted once per AudioView by `useSceneSession` (see *One session for every tab* below) and written as `{ id, zones, emitters }` through the throwing `commitDoc`. Its buffered patch is a LIST of named ops, `SceneOp` (`src/lib/audio-scene-ops.ts`: `addZone`, `moveZone`, `resizeZone`, `deleteZone`, `patchZone`, `addEmitter`, `moveEmitter`, `deleteEmitter`, `patchEmitter`), never a scene snapshot:

- **Rebased, not snapshotted.** The canvas renders `applySceneOps(server, ops)`, and every write replays the same list onto the NEWEST server copy. A write that lands while ops are buffered (a panel field, a failed gesture awaiting Retry) is kept, never hidden or overwritten. Ops are idempotent against a server that already has them (`addZone` of an existing id is skipped), because a buffer re-sends its whole list after a failure or an overlapping commit.
- **Derived membership.** `emitter.zoneId` is recomputed by the reducer after every geometry op with `resolveMembership(x, y, zones)`: the highest-priority containing zone, array order breaking ties (UE AudioVolume semantics). No gesture writes it. `deleteZone` re-derives the orphans (another containing zone, else `null`).
- **Rules live in the reducer.** The pitch range (`pitchMin <= pitchMax`, the moved end pushes the other) is applied by `patchEmitter`, so both panels and any future caller get it.
- **Cadence** is `useEntityCommitBuffer`'s: drag frames `stage` (consecutive moves of one target fold into one op, `foldSceneOps`), text and slider frames `stageDebounced`, mouseup / chip clicks `commit`. Panels get a scene-backed `RecordCommit` (`useSceneZone` / `useSceneEmitter`) via their `record` prop, so a slider drag redraws the canvas on the same frame with zero writes. The buffer has one failure surface: the painter's banner and its Retry.

`AudioScenePainter` takes EITHER a shared `buffer` OR the write callbacks (`onCommit` / `onUpdateZones` / `onUpdateEmitters`), in which case it builds its own `useSceneBuffer`. The panels take EITHER `record` OR `onCommit`. To add a scene edit, add a `SceneOp` and its `applySceneOps` case. Do not add another per-record writer that builds from `activeDoc`: that is the lost update this replaced.

**One session for every tab.** `useSceneSession` (`AudioView/useSceneSession.ts`, called by `useAudioView`) owns the buffer one level above the tabs, keyed `sceneId:epoch`, so a tab switch never unmounts it. `PainterTab` takes it as `buffer` (without one, e.g. in tests, it builds its own over `commitScene`); each Soundscapes zone field is a `patchZone` op through `useSceneZone`, so the old whole-zones-array writer built from `activeDoc` is gone. Its write is bound to the scene of the render that issued it, and every exit settles against the scene the edit was made in: `requestSwitch` (the sidebar) flushes and switches only once that write is confirmed; a refused write HOLDS the switch and the sidebar states it with Retry (re-send, then switch) or Discard (bump the epoch so the ops are never rendered or written again, then switch). `settle()` writes what is buffered and returns the doc with the ops applied: Generate prompts are built from it, never from `activeDoc`. An audio CLI completion stamps `lastGeneratedAt` on the scene the run was dispatched for (`dispatchedSceneIdRef`), not the scene open when it ends. The scene's own fields (description, the three settings) stay one `useDebouncedCommit` each, which flushes on unmount, so a tab or scene switch inside the typing pause writes the draft to the scene the tab was keyed by.

**Listen mode (audition).** The painter's LISTEN tool places a listener puck (component state, never persisted) and `AuditionReadout` plays the scene through the project's real clips. The pure half is `auditionMix(scene, listener, library)` (`src/lib/audio-scene-audition.ts`): per emitter a gain, lowpass, pan and clip URL, or a named not-heard reason (`unbound`, `no-clips`, `set-missing`, `out-of-range`). It reads the reverb and occlusion rows from `src/lib/audio-scene-acoustics.ts`, the same tables `audio-codegen.ts` ships to UE (one authority per quantity: do not re-declare them). The live half is `useSceneAudition` (Web Audio). It creates nothing until an explicit Play. A listener move only glides existing node params. The only network call is a GET of `/api/audio-asset` (never the billed `POST /api/audio-gen`). `stop()`, unmount, leaving the tool AND the keep-alive LRU hiding the module (`useSuspendableEffect` cleanup) all close the context, and showing the module again stays silent until Play.

---

## Packaging pre-flight: a verdict states its own coverage

`PreflightPanel` runs four cook-relevant checks (config sanity, WITH_EDITOR audit, Build verify (Shipping), Asset validation) plus a diagnostic Editor build-verify — but only the two *fast* ones auto-run. The gate therefore never reports a bare status word:

- `KNOWN_CHECKS` in `PreflightPanel.tsx` enumerates every check the panel can produce. A check with no result renders an explicit **not-run** tile (`data-status="not-run"`, `ui/StatusChip`) instead of being absent, and the header word is qualified by its coverage (`ready — 2 of 4 checks run, 2 not run`, `data-coverage="2/4"`).
- `PreflightStatusSummary` carries `canCook` (nothing that RAN failed — unchanged; an unrun check qualifies the verdict, it never vetoes the build) alongside `fullyCovered`, `notRunLabels` and `coverage`. `BuildConfigSelector` shows the unrun labels in the gate-block copy.
- The **map-exists** check validates the maps the cook will ship. `resolveCookMaps()` (`preflight-runner.ts`) prefers the selected profile's `cookSettings.mapsToInclude` (the list UAT receives as `-map=A+B`), falls back to `GameDefaultMap` only when that list is empty, and returns a `CookMapCheck { source, checked, missing }` so `checkConfigSanity` can name which set it looked at. `POST /api/packaging/preflight` takes `mapsToInclude`; the old `mapName` field drove nothing and is gone.

Standard: ai-registry `game-production/ship-pipeline-gating` — absence of measurement is its own status, never a pass.

---

## Server-side scheduler (cron)

`src/instrumentation.ts` is the one place the app runs work on a wall-clock interval **without a browser**. Next.js calls its exported `register()` once per server start; guarded to `NEXT_RUNTIME === 'nodejs'` (better-sqlite3 is node-only) and to a `globalThis.__pofSchedulerStarted` flag (no double-register on dev HMR). It starts a 1-minute `setInterval` (`UI_TIMEOUTS.scheduleTick`, `.unref()`'d) that calls `tickScheduler()` and `tickPurgeExpiredKeys()`.

The main consumer is **scheduled nightly builds** (`src/lib/packaging/scheduled-build-runner.ts`):

- **Config + state** live in the `settings` table via `build-schedule-store.ts` — a disabled-by-default `BuildSchedule` (time, weekdays, profile, skip-if-unchanged, **and the captured project target** so the server cron can run unattended), plus last-run `ScheduleState`. An in-memory `running` flag is the single-flight guard.
- **`tickScheduler()`** reads the schedule, asks the pure `isDueAt()` (`build-scheduler.ts`) whether a slot is due, and fire-and-forgets `runScheduledBuild()` if so. `startScheduledRun()` is the manual ("Run now") path.
- **`runScheduledBuild(ctx, deps)`** runs the full chain — skip-if-unchanged (git HEAD vs last built commit) → fast pre-flight (`preflight-runner.ts`) → cook → smoke (Win64) → finalize (size-budget + version + record to `build_history`). Every side-effect is injected, so the orchestration is unit-tested without spawning anything; `defaultRunnerDeps()` wires the real implementations.
- **One cook finalizer.** Every automated `build_history` write — the nightly runner's three outcomes (pre-flight fail, cook fail, cooked) and the interactive cook route `/api/packaging/execute` — goes through `finalizeCook(outcome, ctx, deps)` in `src/lib/packaging/finalize-build.ts`. It owns the rules both paths must share: the size baseline RECORD is captured before the insert and scoped to the project (so a verdict names build #N, never an "unidentified" size), and only a build recorded green is versioned (bump-per-green-cook; failed, cancelled and smoke-failed builds stay unversioned). `ScheduledRunDeps` extends its `FinalizeDeps`; a new finalization rule is added there once, not ported per caller.
- **Smoke by build id.** The interactive smoke test takes ONE identity: `POST /api/packaging/smoke-test {buildId}`, the id the cook stream reported as `recorded`. The route reads outputPath/platform/config from that row (404 unknown, 400 non-Win64, 409 non-green or no `.exe` output path, before anything spawns), derives the game image from the recorded exe basename, and attaches the verdict to that row with `attachSmokeResultToBuild(id, note, status)` (appends the note, condemns on fail, never rewrites the version). `useCookProgress` settles once, after `recorded`/`record-error`, and passes `buildId`/`recordError` to `onComplete`; with no recorded row `BuildConfigSelector` starts no smoke run and `SmokeTest` says why. `runSmokeTest` (also the nightly runner's smoke) watches and kills only processes whose executable sits under the build's stage dir (an injected `ProcessProbe`, default `Get-CimInstance Win32_Process`), by PID, then the bootstrap tree; a same-named process elsewhere neither passes the build nor gets killed, and there is no by-image kill. `attachSmokeResultToLatestBuild` survives only as a resolver that delegates to the by-id attach; no route calls it.
- **Version authority is per project, derived from `build_history`.** `src/lib/packaging/version-manager.ts` is the one door for every version writer (`finalizeCook` via `FinalizeDeps.nextVersion(projectPath)` for the interactive and nightly cooks, and the manual `record` in `/api/packaging/history`) and reader (the history route's `dashboard` and `version` actions, which `pof_package_history` calls). A named project's current version is the max semver over EVERY versioned row in its scope (own + unattributed rows), whatever the row's status: a build that a later interactive smoke test condemns (by id, `attachSmokeResultToBuild`) keeps its number, so that number is burned and never reissued. `nextVersionFor(projectPath)` gives the pending bump intent (`build_version_next:<projectId>`) when one is ahead of current, and otherwise current + patch. `bump-version` sets that intent relative to current (minor after 0.1.2 means the next green cook is 0.2.0, and pressing it twice still means 0.2.0). The unscoped `''` caller keeps the legacy global `build_version` counter, and every assignment advances that key to max(stored, assigned). Accepted trade-off: deleting a project's newest versioned row lets its number be issued again.
- **One size verdict, readable budgets.** `src/lib/packaging/size-verdict.ts` is the pure, client-safe half of the size gate (types, `DEFAULT_BUDGETS`, `judgeBuildSize`, the `[SIZE_BUDGET]` note helpers, `budgetInputError`); `size-budgets.ts` keeps the `build_size_budgets` settings I/O, re-exports the pure half and wraps it (`evaluateBuildSize` = `judgeBuildSize` with the stored config by default), so the cook gate and the Trends chart judge with one function. `size-trend-model.ts` projects `getSizeTrend` (the NEWEST window, oldest-first) into per-platform series: each point is judged against the previous same-platform point, a point with no prior in the window is `no-baseline` (never `ok`), and a flagged point carries its (baseline, regressor) pair that opens Compare; `whatIf()` previews a candidate budget without a request. The history `dashboard` reports `budgets` `{budgets, failOnRegression, unreadable}` (a corrupt row is reported, not hidden) and POST `set-budget` retunes one canonical platform (budget > 0, growth 1-100, `failOnRegression` untouched; a corrupt row is refused with 409). The budgets stay informational: nothing reads `failOnRegression`.
- **Platform identity is canonical.** The UE `PlatformId` token (`Win64`, `IOS`, …) is the single id used for storage, size-budget lookup and history filtering. `build-profiles.ts` owns the `PLATFORM_LABELS` id→label map plus `normalizePlatformId()` (collapses any friendly/legacy spelling to the token) and `platformLabel()` (token→display name). `insertBuild` normalizes on write and `size-budgets.ts` normalizes on lookup, so a build cooked as `Win64` resolves the same budget a `Windows` record would — no double-keyed budget maps.
- API surface: `/api/packaging/schedule` (GET status, POST `save`/`tick`/`run-now`). UI: `NightlyBuildScheduler.tsx` in the packaging **Pipeline** tab (GET-polls for status; the cron, not the client, drives the actual builds).

The second consumer is **request-log hygiene**: `tickPurgeExpiredKeys()` (`src/lib/request-log.ts`) deletes expired `request_log` idempotency rows so that table stays bounded. It self-throttles to one `DELETE` per TTL window (1h), so most ticks are a cheap `now`-comparison no-op; the first tick after a restart always purges.

When adding another scheduled job, register it the same way (cheap when idle, guarded, `.unref()`'d) rather than spinning a second interval.

## 3D provider dispatch: one runner table

Which 3D providers PoF can actually start is written down ONCE. `RUNNER_PROVIDER_IDS` (`src/lib/visual-gen/providers.ts`) is the const tuple of runner-backed providers; each registry entry's `runnerBacked` is derived from membership (entries are typed without it), and `providerExecution()` — the forge's Submit gate — reads that flag.

- **`RUNNER_DISPATCH`** (`src/lib/visual-gen/runner-dispatch.ts`, server-only) `satisfies Record<RunnerProviderId, RunnerDispatch>`: per provider its `modes`, `start(input) → Result<{ jobId, extras }, string>` (each provider keeps its own pins and budget rules), and `getJob(id)`. An id added to the tuple without an entry fails `npm run typecheck`; the parity case in `ForgeProviderExecution.test.tsx` keeps the table's modes in step with what the forge offers.
- **`POST /api/visual-gen/generate`** runs its shape and Tier-0 input gates, then `runnerDispatchFor(providerId)`. A miss refuses with `runnerRefusal()`, which is `providerExecution(...).reason` — the same sentence the forge button shows (MCP providers are pointed at `/api/blender-mcp/generate`).
- **`GET /api/visual-gen/generate/status`** resolves a job through `resolveRunnerJob(jobId)` over the same table, so any provider the route can start is one the poller can find.

Adding a provider is one tuple id plus one table entry (and its job store) — not edits to the route, the status chain and the flags. Before the table, those were separate copies and TRELLIS.2 was offered as runnable by the forge, then refused by the route.

**Local generators: one process seam.** The local runners (TripoSR, Hunyuan3D, TRELLIS.2, ARDY, SkinTokens) spawn through `runLocalProcess(cmd, args, { timeoutMs, env?, cwd? })` (`src/lib/visual-gen/local-process.ts`, server-only). It returns a `ProcessOutcome` `{ stdout, code, timedOut?, spawnError? }`, so a kill by our own timer and a failure to start are no longer both `code: null`; it settles on `close` (bounded grace after `exit`) so the last output line is not lost. A run that printed no script marker takes its error from the pure `processFailureReason(outcome, { tool, timeoutMs })`: could not start / timed out after N min / exited with code X / exited 0 without reporting a result, plus the last <=300 chars of output (NULs from wsl.exe's UTF-16 stripped). Runners use it as `markerError ?? processFailureReason(...)`, so a script's own `POF_*_ERROR` still wins, and the forge never shows a bare "generation failed" for a marker-less ending. SkinTokens treats `timedOut` / `spawnError` as terminal before `isCrashExit` is asked, so only a real native crash is retried. The mesh-quality spawns (critique / finish / split / views) still own their copies and can adopt the seam.

## Tier-1 mesh gate: one gate request

What a generated mesh is held to is derived ONCE. `gateRequestFor({ assetClass, stage, targetExtentM?, sentBudget? })` (`src/lib/visual-gen/gate-request.ts`, pure) returns `{ deps, gradedAs }`: the class from `resolveAssetClass` (absent / unrecognised is stated in `gradedAs`, never graded class-blind in silence), ceilings from `critiqueThresholdsFor`, size from `targetExtentM ?? nominalExtentFor`, orientation from `expectsUprightFor`, and a budget ONLY when one was actually sent.

- The job-store builders are thin delegates that add only what their producer owns: `localCritiqueDeps` (TripoSR / Hunyuan / remediate: `raw`, no budget), `critiqueDepsForSpec` (Tripo: `raw`, the sent `faceLimit` in quads or triangles), `trellisGateDeps` (`raw`, the sent `decimation_target`), `critiqueDepsForFinish` (`finished`, `targetFaces`). A new producer is one call, not a fifth copy.
- `CritiqueDeps.orientation` is forwarded by `critiqueMesh` to `scoreMesh`, so a lying character now draws `orientation-lying` on its job verdict, as the asset viewer already showed. It is a WARN (-15) that always carries its reason. Re-roll (`isAcceptable`), finish routing and remediation read fail codes only, so it never buys a paid roll or routes a finish.
- `MeshFinishJob.gradedAs` is projected by `GET /api/visual-gen/mesh-finish/status`, so a finished mesh says what it was held to.
- Follow-ups that become one call: the viewer's inline derivation (`asset-viewer/assetGrade.ts`) and the class-blind MCP gate (`blender-mcp/mcp-gate.ts`).

## Delivered mesh: the verdict names its remedy

A delivered card answers "fixable locally, or pay again?" instead of leaving it to the operator. `remedyFor({ critique, assetClass, meshPath })` (`src/lib/visual-gen/delivery-remedy.ts`, pure, server-side) projects the two existing decisions (`assessStage`, `planFinishFromCritique`) onto one of three kinds. It never changes a verdict.

- `finish` ($0): basename + `generated/<dir>` of the mesh, `addresses` / `unaddressed`, and the planner's note. This also covers the budget-DEFERRED (`max-then-finish`) character whose `warn` reads as a green Complete.
- `reroll` (paid; `empty-mesh` / `degenerate-bbox`): a note only, with no button. The one paid path stays `retryJob`, which still runs on `failed` jobs only, and a rejected card is `completed`.
- `none`: the reason (floater-only, critic unavailable, mesh outside `ASSET_DIRS`). `undefined` when nothing needs a remedy, so a clean card stays quiet.
- `GET /api/visual-gen/generate/status` projects `remedy` for a `done` job, because the client never receives `findings`. The MCP status path omits it.
- `useForgeStore.finishJob(id)` runs on an explicit click (`FinishRemedy.tsx`). It POSTs the existing `/api/visual-gen/mesh-finish/remediate` with `{ name, dir, assetClass }`. A `routed: false` answer lands verbatim as `finish.state 'refused'` and starts no poll. A 202 polls `/mesh-finish/status` on the same tracked-poller rail as a generation (Stop-able, 30-min ceiling), ending with `remediation.summary` and a preview of the finished low-poly.

## PoF plugin routes: one declared table, GET-only probes

The PoF Bridge plugin's routes are declared ONCE: `POF_ROUTES` (`src/lib/pof-bridge/routes.ts`) lists each route's subsystem, method, path and `effect` (`read` | `mutates` | `ws`). A drift guard (`src/__tests__/lib/pof-bridge/routes.test.ts`) fails when a `/pof/...` literal in `PofBridgeClient`, `run-python.ts` or a `proxyToPofBridge(...)` handler is not declared, so a new plugin route cannot land in one copy only.

- `planRouteProbe(route)` (pure) derives whether a health check may touch a route: `http-get {path}` (with a cheaper `probePath`, e.g. `/pof/manifest?checksum-only=true`), `ws`, or `not-probed` (`mutates` / `needs-argument`). A probe is side-effect-free by construction. A POST of `{}` to `/pof/compile/live` or `/pof/snapshot/capture` IS the real request, so mutating routes are listed and never called.
- The Bridge Endpoints monitor (`project-setup/BridgeEndpointHealth`, mounted in Project Setup) derives its rows from the table. It executes the plan through the Bridge Doctor: `probeHttpRoute` (the Doctor's GET-only `httpProbe`) on `pofPort`, and `probeWsLiveState` on `wsPort` for `/pof/live`. A failed row carries the Doctor's `ProbeFailureKind`, where a 404 reads as "route not in this plugin build". Not-probed rows render calm and sit outside the healthy/probed counts. Probing runs only on the Ping All click.

## Headless UE builds: dispatched from Build Health

The Build Health tab (`evaluator/BuildHealthDashboard`) starts the headless builds it charts; before, only the `pof_ue_build` MCP tool could fill `headless_builds`.

- `src/lib/ue5-bridge/build-run.ts` (pure, client-safe): `defaultBuildRequest(project)` returns `Result` with the `start` body (the project's Editor target, Development, Win64) and refuses, before any request, a value the route would reject. The route's `start` and `rebuild` share its `validateBuildTarget`. `buildRunReducer` follows ONE run: idle, dispatching, queued, running (percent and `[N/M]` line), settled (then the report refetches once). A run in neither the queue nor the history for `MAX_MISSED_POLLS` (20) polls goes `lost` with a reason, never a silent spinner.
- `useBuildRun` dispatches only on a click (`buildNow` / `rebuild` / `abort`). Mounting, polling and the settle refetch never POST. It polls `GET /api/ue5-bridge/build?projectPath` (queue plus history) every `UI_TIMEOUTS.pollInterval` while a run is in flight, and pauses while the module is suspended. It does not poll `?buildId`, because a finished build leaves the queue and 404s there.
- `BuildQueueItem.progress` (additive, optional) holds the running item's latest `onProgress` line, so a status read shows it. The `build.progress` event still fires.
- `POST /api/ue5-bridge/build {action:'rebuild', buildId}` re-enqueues the recorded request (`getBuildRequestById` in `build-pipeline.ts`: target, type, configuration, platform, engine; `additionalArgs` are not stored). An unknown id returns 404. The lookup stays out of the route because pof-mcp's project-scope guard lists this route as `scoped: false`. Each regression alert's "Rebuild to confirm" uses it, so the lane's next point confirms or clears the alert.

---

## Coding conventions

These are enforced by `eslint.config.mjs` and the patterns in the codebase. Follow them in all new code.

### Import alias

Always use `@/` (maps to `src/`). Never use relative `../../` paths.

```ts
// correct
import { logger } from '@/lib/logger';
// wrong
import { logger } from '../../lib/logger';
```

### Logger, not raw console

`src/lib/logger.ts` exposes `logger.info`, `logger.warn`, `logger.debug`, `logger.log`. ESLint (`eslint.config.mjs:12`) warns on `console.*` except `console.error`, which remains allowed as the standard error-reporting path.

```ts
import { logger } from '@/lib/logger';
logger.info('session started', sessionId);
// console.error('something broke') — still allowed
```

### No hardcoded hex colors

ESLint warns on any string literal matching `#[0-9a-fA-F]{6,8}` (`eslint.config.mjs:16`). Instead:

- **Semantic status**: `STATUS_SUCCESS`, `STATUS_WARNING`, `STATUS_ERROR`, `STATUS_INFO`, `STATUS_BLOCKER` from `@/lib/chart-colors`
- **Severity/score tokens**: `SEVERITY_TOKENS.critical/high/medium/low` (bundles `color`, `bg`, `border`); `scoreBandToken(score)` maps 0–100 to a token; `qualityColor(score)` maps 1–5 quality scores
- **Calm severity cards**: `severityAccentCard(token)` — for finding/gap/issue rows, prefer a neutral `bg-surface` card with `border-l-[3px] border border-border` + this helper's left-rule style over a full translucent `token.bg` fill (a wall of saturated red flattens hierarchy). Reserve `token.color` for the leading icon and the small badge. Shared by Deep Eval, GDD Compliance, and the Codebase Archeologist.
- **Module accents**: `MODULE_COLORS.core/content/systems/evaluator` etc.; `TAB_ACCENT` for per-tab colors
- **Opacity**: `withOpacity(color, OPACITY_20)`, `statusBg(color)`, `statusBorder(color)` — never hand-roll `${hex}33`
- **Dynamic class bug**: Tailwind JIT cannot process template-literal arbitrary classes (`bg-[${expr}]`). Use `style={{ backgroundColor: color }}` for runtime-dynamic colors. See memory note `reference_dynamic_tailwind_arbitrary_class_bug.md`.
- **CSS variables**: Use `var(--text-muted)`, `var(--glow-success)` etc. for theme-relative values in non-SVG contexts

### Timing constants from UI_TIMEOUTS

All delay/interval values come from `UI_TIMEOUTS` in `@/lib/constants.ts`. Do not hardcode millisecond values.

```ts
import { UI_TIMEOUTS } from '@/lib/constants';
setTimeout(reset, UI_TIMEOUTS.copyFeedback);  // 1500 ms
setInterval(poll, UI_TIMEOUTS.pollInterval);  // 3000 ms
```

Key entries: `toast` (3 s), `copyFeedback` (1.5 s), `raceConditionBuffer` (50 ms), `batchItemDelay` (800 ms), `heartbeatInterval` (2 min), `ue5HealthCheck` (30 s), `buildProcessTimeout` (10 min).

### Result\<T, E\> for fallible operations

`src/types/result.ts` defines `Result<T, E = string>` as `{ ok: true; data: T } | { ok: false; error: E }`.

```ts
import { ok, err, type Result } from '@/types/result';

function parse(raw: string): Result<ParsedData> {
  try { return ok(JSON.parse(raw)); }
  catch (e) { return err(String(e)); }
}

// Client-side API calls
const result = await tryApiFetch<Data>('/api/thing');
if (result.ok) { use(result.data); } else { logger.warn(result.error); }
```

Prefer `Result` over `throw`/`try-catch` for expected failure modes (API errors, parse failures, validation).

### React 19 ESLint gotchas

**Client-only render guard** — The `react-hooks/set-state-in-effect` rule errors on `useEffect(() => setMounted(true))` mount guards. Use the `useSyncExternalStore` hydration trio instead:

```ts
// Correct — no ESLint error, correct SSR/client split
const hydrated = useSyncExternalStore(
  () => () => {},  // subscribe (no-op)
  () => true,      // client snapshot
  () => false,     // server snapshot
);
```

Used in `AppShell` (line 53) and `SidebarL2` (line 79) to gate portals and `document` access.

**Purity rule** — `Date.now()` and `Math.random()` in render (including `useMemo`) error under `react-hooks/purity`. Derive time windows from record timestamps (e.g., `createdAt`) rather than reading wall-clock time. Derive random seeds from stable props rather than calling `Math.random()` in render.

---

## See also

- [overview](overview.md) — high-level architecture map
- [ui shell](ui-shell.md) — `ModuleRenderer`, `AppShell`, `SidebarL2`, shell layout
- [state and persistence](state-and-persistence.md) — Zustand stores, SQLite, persist middleware, `ProjectModuleBridge`
