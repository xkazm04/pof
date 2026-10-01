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

**Pane holds (`src/hooks/usePaneHold.ts`).** A module declares in-flight work the shell cannot otherwise see with `usePaneHold(active, reason)`; `renderModulePane` provides `PaneIdContext` beside `SuspendContext`, so no module knows its pane id, and outside a shell pane (the lab, previews, tests) the hook is a no-op. Holds live in a tiny external store (`{ paneId -> reasons }`, one entry per holder, released by the holder's effect cleanup, so an unmounted pane can never leave one behind); `ModuleRenderer` subscribes to it with `useSyncExternalStore` and folds it into `observedLiveKey(sessions, holds)` as `m:` positive evidence, exactly like a running CLI session. A hold only changes WHICH pane is evicted - `lruTouched` still evicts exactly one per overflow past the cap. A forced eviction over held work reports `liveWork: 'pane-hold'` plus `holdReason`, and the Activity Feed names it (`Module torn down: Packaging - UE cook running`). The holds are **snapshotted into the pending eviction in the render that decides it** (`pickPaneHolds`): React runs the evicted pane's unmount cleanup, which releases its hold, before the report effect, so a report-time read would never see it. Adopters: the interactive cook (`useCookProgress`, rule `cookHoldsPane` - held until the cook settles, which is AFTER the server's `recorded`/`record-error` event that follows `done`/`error` (or stream end), never on the bare `done`: the build row and its id do not exist yet; the cook PROCESS no longer depends on the hold - it is a server job, see Cook jobs below), the ScanTab batch fix and the ReviewableModuleView checklist batch (held across the inter-item gap when no CLI session runs).

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

## Runs bound to their input (blueprint transpiler)

The Blueprint transpiler (`BlueprintTranspilerView`, and the multiplayer `ReplicationScaffoldPanel`) keeps no results in `useState`. `src/lib/blueprint-transpiler/run-state.ts` is a pure reducer over `{ input: { blueprintJson, existingCpp, moduleName }, runs: { transpile, diff } }`, where each run is `idle | running{key, prev} | done{key, result} | failed{key, error}` and `key` is the fingerprint (FNV-1a + length) of exactly the inputs that action reads (transpile: JSON + target module; diff: JSON + existing C++). `selectRun(state, action)` derives `{ result, running, error, stale, staleBecause }`:

- **stale** is fingerprint inequality against the current input, not a dirty flag (editing the JSON back makes the result fresh again). A transpile whose Blueprint JSON moved hides Write to Project and offers "Blueprint changed - re-transpile"; a stale diff or replication scan says it describes the previous input.
- **last request wins**: a reply whose key is not the running key is dropped (a module retarget re-transpiles; the old target's late reply cannot land).
- **errors are per action**: the Transpile and Semantic Diff tabs never show each other's error.

`useBlueprintTranspiler({ projectPath, surface })` is a thin adapter: the state lives in a module-scope `Map` keyed `${projectPath}::${surface}` (the session-draft pattern above) read through `useSyncExternalStore`, so an eviction or remount restores the input and the result, and a reply that lands after an unmount still settles its run. Each action is ONE POST: `/api/blueprint-transpiler` returns the parse (`asset` + `summary`) additively with the `transpile` / `diff` result, and the action reads its input from the store at call time; an identical in-flight run is joined, which is why the view needs no in-flight latch. In-memory by design, like the AnimBP drafts.

**Procedural Engine (same pattern, one generator table).** `procedural-engine/generatorSpecs.ts` is the one table of generators (`GENERATOR_SPECS`: terrain / dungeon / vegetation, each `{ label, defaults, generate, summarize, describeSize, toExportScript(data, config), exportName }`); the selector options derive from it and `GeneratorTab` looks rows up instead of branching on the type. `useProceduralStore.generate(type)` binds the result to a snapshot of the config that produced it (`runs[type] = { config, data, generatedAt }`), and `selectRun(state, type)` derives `fresh | stale` with `staleBecause` as a field diff against the live config, so editing the seed back makes the preview fresh again. `exportToBlender(type)` builds the script from the RUN's config, not the live one: a Size edit after Generate cannot put "extent 256 m" over a 65-sample mesh, and every script carries a `# PoF procedural run: <type>, seed <n>, size <s>` line. The dungeon reads `EXPORT_CELL_SIZE` / `EXPORT_WALL_HEIGHT` from the level wizard's `exportPlan.ts` and emits the `DungeonScriptMeta` seed/algorithm header. Export feedback is per generator (`selectExportFeedback`; `exportState` mirrors only the last export), and dispatch goes through `executeViaMCP`, so procedural exports appear in Script History. A preview set directly (no run) exports under the live config. Export is click-only.

## Canvas edits as named ops, with undo (level flow editor)

The level flow editor has ONE write surface: `onEdit(op, mode)`. Every gesture is a named op from `LevelEditOp` (`src/lib/level-design/level-edit.ts`: `add-room`, `move-room`, `nudge-room`, `update-room`, `delete-room`, `link`, `unlink`, `set-link-gate`, `declare-gate`) and one pure reducer, `applyLevelEdit(doc, op) → Result<{ patch, inverse, marksDocAhead }>`, decides what the op means:

- **patch**: only the keys the op touched, with every reference to something it removed pruned in the SAME patch (`delete-room` drops the room's links, its `difficultyArc` id and its `syncReport` rows). One act is one commit, so one PUT.
- **inverse**: the prior values of exactly those keys (snapshot-of-touched-keys), so it cannot drift from the forward op.
- **marksDocAhead**: the op decides the sync consequence, not the setter. A link edit flips a `synced` doc to `doc-ahead` because the codegen prompt emits connections.

`useDocCommitBuffer` (`LevelDesignView/`) applies an op to the live doc (`peek`, bridged over the gap between a write resolving and the next render) and routes it by `EditCommitMode`. Ops with the same `gestureKey` in a row are one gesture and one undo entry: a drag's `stage` frames plus its mouseup commit, held-arrow `nudge-room`s, or a debounced typing burst in one field of one room. The inverse is captured on the gesture's first frame. A debounced gesture closes when its commit starts (the pause, a blur, a doc switch), a staged one closes on its own commit. History is per document (switching documents empties it) and capped at `EDIT_HISTORY_LIMIT` = 50. A new edit after an undo clears redo. Undo and redo are each one commit with `marksDocAhead: true`, so an undo never claims `synced`.

**External changes.** Before an undo or redo is applied, `rebaseHistoryPatch` compares the live doc against what the entry expects. If `syncReport` was rewritten since (a Check Sync landed between the edit and the undo), the live report is kept, so an undo never brings back stale divergence rows. If any other key drifted (for example "adopt code" edited a room), the history is cleared with a reason instead of overwriting that change.

**Locks, keys and one-way doors.** A click (or Enter) on a link opens the `LinkInspector` (zero writes); deletion is two-step on Delete/Backspace and inside the inspector. Its Apply is one `set-link-gate` op (direction, condition, `requires`, and the room that `grants` the keys: one `{connections, rooms}` patch, one PUT, one undo step); 'Declare gate' turns a prose-only `condition` into a key and grants it from a picked room as one `declare-gate` op. The writers live in `src/lib/level-design/gate-authoring.ts` (pure). Grant candidates are the rooms `lintLevelPacing` still reaches with the gate held shut by a key no room grants, so the picker uses the linter's own closure rather than a copy of its private walk, and a granting room reachable only through the gate is refused. `buildNarrativeCodegenPrompt` emits `[requires: k]` and `Grants: k` only when present, so an ungated document's prompt is unchanged.

To add a canvas op, extend `LevelEditOp` and `applyLevelEdit` (plus a `gestureKey` and `describeLevelEdit` line). It then gets one-commit persistence and undo for free. Do not add another whole-array setter to `LevelFlowEditorProps`.

**Streaming zone plan (named ops, one mode, view-owned).** The Streaming tab's plan is a pure reducer in `src/lib/level-design/streaming-plan.ts`: `applyStreamingOp(state, op, { newId })` over `StreamingOp` (`setPaint`, `setErase`, `startLink`, `cancelMode`, `cellClick`, `paint`, `erase`, `updateZone`, `setZoneType`, `updateTransition`, `deleteTransition`, `select`). The interaction mode is ONE union (`select | paint | erase | link`), so paint and link cannot coexist and `cellClick` resolves by mode, not by if-order; a link returns to `select`, and a pair already linked in either direction is not linked again. One set-zone-type rule (`withZoneType`) serves the palette and the editor: a zone still named its type's default label follows the new type, a name the designer chose is kept. `useLevelDesignView` owns the reducer (`streamingPlanStore`, beside `procgenSpecStore`) because the planner is unmounted on every tab switch; `useStreamingZonePlanner(store?)` is a thin adapter that falls back to a private instance of the same reducer when rendered alone. The plan is in memory only: a reload or module eviction still resets it to the default plan. The lib owns the plan types, the default plan and `ZONE_TYPE_LABELS`; `buildStreamingZonePrompt` and the planner's `types.ts` read them, so lib no longer imports from the component folder. Op names are stable because other surfaces dispatch them by name. To add a planner gesture, add a `StreamingOp` and its `applyStreamingOp` case; do not add a setter to the hook.

**Streaming preflight (compile errors block, hitches warn, fixes are ops).** `src/lib/level-design/streaming-preflight.ts` is a pure lint over the plan document: `preflightStreamingPlan(config) -> { findings, blocksGenerate }` and `residency(config) -> { byZone, peak }`. Rules: `duplicate-identifier` / `invalid-identifier` (EWorldZone enumerators: empty, leading digit, C++ keyword) are the ONLY findings with `blocksGenerate`, because they guarantee the generated C++ will not compile; `unreachable` (no transition path from an Always Loaded zone, edges undirected) is an error that does not block; `seamless-hitch` (a seamless boundary, checked both ways, whose far side is not resident from the near side) and `non-adjacent` (a seamless link spanning more than one cell) are warnings. With no Always Loaded zone, reachability reports `status: 'not-evaluated'`, never a pass. A zone is resident at P when it is P, Always Loaded, or within its own preload radius of P (Chebyshev, the square ZoneCell draws). Each fix is a `PreflightFix` that `fixToOp` turns into an existing `updateZone` / `updateTransition` op, dispatched only when the designer clicks it in `PreflightPanel`; the planner never auto-edits. `zoneEnumIdentifier` is the one name-to-enumerator rule, used by both the lint and `buildStreamingZonePrompt`. To add a rule, add a `PreflightRule`; set `blocksGenerate` only if the output provably cannot compile.

## One scene edit buffer, rebased ops (audio scene painter)

The audio scene has ONE optimistic edit buffer for the canvas, the property panels AND the Soundscapes tab: `useSceneBuffer` (`AudioView/useSceneBuffer.ts`, over `useEntityCommitBuffer`), mounted once per AudioView by `useSceneSession` (see *One session for every tab* below) and written as `{ id, zones, emitters }` through the throwing `commitDoc`. Its buffered patch is a LIST of named ops, `SceneOp` (`src/lib/audio-scene-ops.ts`: `addZone`, `moveZone`, `resizeZone`, `deleteZone`, `patchZone`, `addEmitter`, `moveEmitter`, `deleteEmitter`, `patchEmitter`), never a scene snapshot:

- **Rebased, not snapshotted.** The canvas renders `applySceneOps(server, ops)`, and every write replays the same list onto the NEWEST server copy. A write that lands while ops are buffered (a panel field, a failed gesture awaiting Retry) is kept, never hidden or overwritten. Ops are idempotent against a server that already has them (`addZone` of an existing id is skipped), because a buffer re-sends its whole list after a failure or an overlapping commit.
- **Derived membership.** `emitter.zoneId` is recomputed by the reducer after every geometry op with `resolveMembership(x, y, zones)`: the highest-priority containing zone, array order breaking ties (UE AudioVolume semantics). No gesture writes it. `deleteZone` re-derives the orphans (another containing zone, else `null`).
- **Rules live in the reducer.** The pitch range (`pitchMin <= pitchMax`, the moved end pushes the other) is applied by `patchEmitter`, so both panels and any future caller get it.
- **Cadence** is `useEntityCommitBuffer`'s: drag frames `stage` (consecutive moves of one target fold into one op, `foldSceneOps`), text and slider frames `stageDebounced`, mouseup / chip clicks `commit`. Panels get a scene-backed `RecordCommit` (`useSceneZone` / `useSceneEmitter`) via their `record` prop, so a slider drag redraws the canvas on the same frame with zero writes. The buffer has one failure surface: the painter's banner and its Retry.

`AudioScenePainter` takes EITHER a shared `buffer` OR the write callbacks (`onCommit` / `onUpdateZones` / `onUpdateEmitters`), in which case it builds its own `useSceneBuffer`. The panels take EITHER `record` OR `onCommit`. To add a scene edit, add a `SceneOp` and its `applySceneOps` case. Do not add another per-record writer that builds from `activeDoc`: that is the lost update this replaced.

**One session for every tab.** `useSceneSession` (`AudioView/useSceneSession.ts`, called by `useAudioView`) owns the buffer one level above the tabs, keyed `sceneId:epoch`, so a tab switch never unmounts it. `PainterTab` takes it as `buffer` (without one, e.g. in tests, it builds its own over `commitScene`); each Soundscapes zone field is a `patchZone` op through `useSceneZone`, so the old whole-zones-array writer built from `activeDoc` is gone. Its write is bound to the scene of the render that issued it, and every exit settles against the scene the edit was made in: `requestSwitch` (the sidebar) flushes and switches only once that write is confirmed; a refused write HOLDS the switch and the sidebar states it with Retry (re-send, then switch) or Discard (bump the epoch so the ops are never rendered or written again, then switch). `settle()` writes what is buffered and returns the doc with the ops applied: Generate prompts are built from it, never from `activeDoc`. An audio CLI completion stamps `lastGeneratedAt` on the scene the run was dispatched for (`dispatchedSceneIdRef`), not the scene open when it ends. The scene's own fields (description, the three settings) stay one `useDebouncedCommit` each, which flushes on unmount, so a tab or scene switch inside the typing pause writes the draft to the scene the tab was keyed by.

**Listen mode (audition).** The painter's LISTEN tool places a listener puck (component state, never persisted) and `AuditionReadout` plays the scene through the project's real clips. The pure half is `auditionMix(scene, listener, library)` (`src/lib/audio-scene-audition.ts`): per emitter a gain, lowpass, pan and clip URL, or a named not-heard reason (`unbound`, `no-clips`, `set-missing`, `out-of-range`). It reads the reverb and occlusion rows from `src/lib/audio-scene-acoustics.ts`, the same tables `audio-codegen.ts` ships to UE (one authority per quantity: do not re-declare them). A zone's effective reverb is decided in one place, `resolveZoneReverb(zone)` beside the tables: a table preset is its `REVERB_PARAMS` row (the zone's hidden sliders are ignored), and `custom` is the zone's decay/diffusion/wet sliders over the custom row's density and delays. `auditionMix`, the codegen and `ReverbDecayGlyph` all read it. In the codegen a custom zone's volume carries `bUseCustomReverb` + `CustomReverb`, which `ApplyReverbSettings` prefers over the preset row. The MetaSound ambient layer fades by the resolved decay/wet, and a `none` zone keeps the struct defaults. The glyph's tail is the resolved seconds / 4 s for every preset. The live half is `useSceneAudition` (Web Audio). It creates nothing until an explicit Play. A listener move only glides existing node params. The only network call is a GET of `/api/audio-asset` (never the billed `POST /api/audio-gen`). `stop()`, unmount, leaving the tool AND the keep-alive LRU hiding the module (`useSuspendableEffect` cleanup) all close the context, and showing the module again stays silent until Play.

**Level to audio sync.** Auto-Generate Spatial Audio (`SpatialAudioGeneratorPanel`, `POST /api/spatial-audio-generate`) is a previewed, re-runnable sync, not an append. `generateSpatialAudio` derives ids from the room (`zone-room-<roomId>`, `emitter-room-<roomId>-<sound>`), links every zone and emitter with `sourceRoomId`, and stamps each one with `derivedFrom`: the values it was written with (a zone's stamp also lists its emitter ids). It invents no cue path: `soundCueRef` stays `''`, so codegen labels the emitter a PLACEHOLDER. The pure `planLevelAudioSync(scene, generation, { overwrite })` (`src/lib/spatial-audio-sync.ts`) plans one row per room as `SceneOp`s for `applySceneOps`. If current differs from the stamp, a human tuned the room: it is `kept` with no op, unless its id is in `overwrite`. If the stamp differs from the new derivation, the level changed: the room is `updated` with one `patchZone`, and geometry travels as the whole rect. A generated emitter the operator deleted stays deleted. A room gone from the level is `orphaned`, and nothing is ever deleted. `action: 'preview'` returns the plan and writes nothing. `generate` applies it, and an existing scene keeps its own global reverb (the dominant-room reverb only seeds a new scene). The panel shows the plan before any write, with per-room overwrite toggles and an explicit Apply. `sourceRoomId` and `derivedFrom` are additive keys in the zones/emitters JSON blobs (no column). To derive a new zone or emitter field from the level, add it to `SYNCED_ZONE_FIELDS` / `SYNCED_EMITTER_FIELDS`, or the sync will never see it change.

**Sound Forge targets a library set.** Where a Forge run lands is decided before any billed call by the pure `src/lib/audio-library/forgeTarget.ts`. `resolveForgeTarget(sets, assets, { typedName, selectedSetId })` returns `existing` (a picked set, or the one set a typed name already names, trimmed and case-insensitive because UE folder paths are), `new`, or `ambiguous` (several sets share the name). `planForgeRun(target, form, provider)` returns the exact `POST /api/audio-gen` bodies, or a refusal with zero bodies: `name-ambiguous`, `name-missing`, `prompt-missing`, or `kind-unservable` carrying the provider's own `unsupported[kind]` text. For an existing set every body carries its `setId` and the set's kind, event key, surface and loop flag (differing form values come back as `lockedFields`), and takes are numbered from max(highest parsed `(variation N)` over the set's stored prompts, take count) + 1, skipping any prompt the set already holds, so a deleted take cannot turn Generate into a cached repeat. A new set keeps the old shape: the first body names it and the returned id is threaded into the rest. `SoundForgePanel` reads the library once on mount (the free GET, never the POST), states no plan until that read lands, states the plan above the button (`takes 4-5 into footstep-stone`), spends only on the Generate click, and re-reads the library after the run so the next plan numbers past it. The Library's optional `onMoreTakes(setId)` makes `AudioView` hold `forgeTargetSetId`, switch to the Forge tab and pass `initialTargetSetId`. Why: the Forge restarted at `(variation 1)` (cache hits, 0 new takes) and posted a free-text name, and `upsertSet` keys on id only, so a changed prompt under a taken name minted a same-named twin that the name-keyed consumers (import status, emitter cue path, `/Game/Audio/<setName>/`) then confused. The route and DB are unchanged, so another caller can still mint a twin: resolve through `forgeTarget` before posting.

---

## Packaging pre-flight: a verdict states its own coverage

`PreflightPanel` runs four cook-relevant checks (config sanity, WITH_EDITOR audit, Build verify (Shipping), Asset validation) plus a diagnostic Editor build-verify — but only the two *fast* ones auto-run. The gate therefore never reports a bare status word:

- `KNOWN_CHECKS` in `PreflightPanel.tsx` enumerates every check the panel can produce. A check with no result renders an explicit **not-run** tile (`data-status="not-run"`, `ui/StatusChip`) instead of being absent, and the header word is qualified by its coverage (`ready — 2 of 4 checks run, 2 not run`, `data-coverage="2/4"`).
- `PreflightStatusSummary` carries `canCook` (nothing that RAN failed — unchanged; an unrun check qualifies the verdict, it never vetoes the build) alongside `fullyCovered`, `notRunLabels` and `coverage`. `BuildConfigSelector` shows the unrun labels in the gate-block copy.
- The **map-exists** check validates the maps the cook will ship. `resolveCookMaps()` (`preflight-runner.ts`) prefers the selected profile's `cookSettings.mapsToInclude` (the list UAT receives as `-map=A+B`), falls back to `GameDefaultMap` only when that list is empty, and returns a `CookMapCheck { source, checked, missing }` so `checkConfigSanity` can name which set it looked at. `POST /api/packaging/preflight` takes `mapsToInclude`; the old `mapName` field drove nothing and is gone.
- **Package gates the profile you press** (`src/lib/packaging/package-flow.ts`). Package is a pure reducer `packageFlow(state, event)`, not a boolean: `idle -press-> measuring(profileId, mapsKey, kinds) -summary-> cook | blocked`; `blocked -measure-missing-> measuring(failing + never-run kinds)`, `blocked -override-> cook (overridden)`, `cancel -> idle`, `cook -settled-> idle`. `PreflightStatusSummary` (now defined there, re-exported by the panel) carries its identity - `mapsKey` (`mapsKeyOf(maps)` of the held FAST verdict, `null` until one is held) plus `failing`/`failingKinds`, `notRunKinds` and `running` - and a summary only decides a measuring flow when it measured THAT mapsKey and no requested kind is still running or unmeasured (a requested kind that settles without a verdict blocks: unmeasured is not a pass). `BuildConfigSelector` feeds the panel the pressed profile's maps (the default profile's when idle) and a `requestedChecks {token, kinds}` prop the panel runs once per token (an in-flight kind for the same `project#mapsKey` is not re-POSTed; a fast verdict for maps no longer gated is dropped); the cook request is issued only on the transition INTO `cook`. So an early press waits for the gate, profile B is never released by profile A's verdict, and the gate block offers **Run missing checks, then cook** beside Package anyway / Cancel. `canCook` semantics are unchanged: an unrun slow check the operator did not ask for is disclosed on the cook, never a veto. The nightly runner's `defaultRunnerDeps().runPreflight` passes the scheduled profile's `cookSettings.mapsToInclude` too.

Standard: ai-registry `game-production/ship-pipeline-gating` — absence of measurement is its own status, never a pass.

---

## Server-side scheduler (cron)

`src/instrumentation.ts` is the one place the app runs work on a wall-clock interval **without a browser**. Next.js calls its exported `register()` once per server start; guarded to `NEXT_RUNTIME === 'nodejs'` (better-sqlite3 is node-only) and to a `globalThis.__pofSchedulerStarted` flag (no double-register on dev HMR). It starts a 1-minute `setInterval` (`UI_TIMEOUTS.scheduleTick`, `.unref()`'d) that calls `tickScheduler()` and `tickPurgeExpiredKeys()`.

The main consumer is **scheduled nightly builds** (`src/lib/packaging/scheduled-build-runner.ts`):

- **Config + state** live in the `settings` table via `build-schedule-store.ts` — a disabled-by-default `BuildSchedule` (time, weekdays, profile, skip-if-unchanged, **and the captured project target** so the server cron can run unattended), plus last-run `ScheduleState`. The single-flight guard is the cook job registry (next bullet); `isRunning()` = a `nightly` job is active (plus a manual `setRunning` hold).
- **`tickScheduler()`** reads the schedule, asks the pure `isDueAt()` (`build-scheduler.ts`) whether a slot is due, and fire-and-forgets `runScheduledBuild()` if so. `startScheduledRun()` is the manual ("Run now") path.
- **Cook jobs (`src/lib/packaging/cook-jobs.ts`).** A cook is a server job, not a request: one job per project (key = path with `/` separators, no trailing slash, lower-cased) on `globalThis`, shared by the interactive Package button and the nightly runner (the repo's server-job pattern, as `deep-eval-job.ts`). `runCookJob(spec, run)` locks the project synchronously or refuses naming the holder (`an interactive cook|a nightly build is already running for this project (job <id>)`); `startCookJob(ctx, {executor, finalizeDeps})` is the interactive body (stream the executor, then `finalizeCook` and append `recorded`/`record-error` + size events); `startScheduledRun` runs the WHOLE nightly chain (pre-flight, cook, smoke, finalize) as a `nightly` job, streaming its cook events and appending `recorded {buildId}`. Every event carries a monotonic `seq` in a ring bounded on log lines only (`MAX_JOB_LOG_EVENTS`); `subscribeCookJob(jobId, fromSeq)` replays then follows live, and a settled job stays readable by id for `SETTLED_TTL_MS` so a late reattach still gets `recorded`. Detaching never cancels: only `cancelCookJob` aborts the executor, which kills the UAT tree (`killProcessTree`) and yields `error{status:'cancelled'}`; the job still finalizes, so the row is recorded `cancelled`. HTTP: `POST /api/packaging/execute` starts + streams (SSE body unchanged, job id in the `X-Cook-Job-Id` header, 409 naming the holder when busy); `/api/packaging/cook-jobs` GET `?projectPath=` (the ACTIVE job or null), `?jobId=` (settled too), `?attach=<id>&from=<seq>` (SSE resume), DELETE `?jobId=` (cancel, 404 unknown). Client: `CookProgress/cookJobStream.ts` drives POST or attach, dedupes by `seq`, and on a stream that closes unsettled RE-QUERIES the job and resumes from `lastSeq + 1` instead of guessing; only a job the server no longer holds, or one that settled without a result, settles the console failed (a stream with no job id keeps the old terminal-event rule). `useCookProgress` with `request = null` attaches to the open project's active job (reload, other tab, nightly); the console shows `Reattached - <kind>` and a Cancel button; a cancelled cook settles `status:'failed', cancelled:true` and renders as cancelled. `BuildConfigSelector` skips its post-cook smoke for a `nightly` completion (the chain ran its own).
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

**Local generators: one process seam.** The local runners (TripoSR, Hunyuan3D, TRELLIS.2, ARDY, SkinTokens) spawn through `runLocalProcess(cmd, args, { timeoutMs, env?, cwd? })` (`src/lib/visual-gen/local-process.ts`, server-only). It returns a `ProcessOutcome` `{ stdout, code, timedOut?, spawnError? }`, so a kill by our own timer and a failure to start are no longer both `code: null`; it settles on `close` (bounded grace after `exit`) so the last output line is not lost. A run that printed no script marker takes its error from the pure `processFailureReason(outcome, { tool, timeoutMs })`: could not start / timed out after N min / exited with code X / exited 0 without reporting a result, plus the last <=300 chars of output (NULs from wsl.exe's UTF-16 stripped). Runners use it as `markerError ?? processFailureReason(...)`, so a script's own `POF_*_ERROR` still wins, and the forge never shows a bare "generation failed" for a marker-less ending. SkinTokens treats `timedOut` / `spawnError` as terminal before `isCrashExit` is asked, so only a real native crash is retried. The headless-Blender spawns (finish / split / views) run through it too, with tool `Blender (<script>)`: a marker-less crash is `exited with code 1 — last output: … MemoryError`, a killed split is `timed out after 10 min`, never "no part above the speck threshold" (that reason now needs a printed DONE), and a Blender that never started says `could not start`. `mesh-critique` still owns its copy and can adopt the seam.

**Spawned scripts: one declared marker contract.** The scripts PoF spawns itself print `POF_<P>_<KEY>=<value>` lines, and each script's vocabulary is declared once in `SCRIPT_MARKERS` (`src/lib/visual-gen/script-markers.ts`, pure): `triposr`, `hunyuan`, `trellis`, `meshFinish`, `meshSplit`, `meshViews`, each `{ script, prefix, keys: { KEY: result | error | metric | path | reason | diagnostic | repeat }, templates? }` (`BAKE_{map}`, `BAKE_{map}_ERROR`, the views' `{n}`). Every parser reads through `readMarkerBlock(id, stdout)` → `{ get, num, all, slots, diagnostics?, undeclared }`: `get` throws on a key the script does not declare; a printed key the declaration does not know lands in `undeclared` and `diagnostics` instead of vanishing; `diagnostic` keys (preview / CLIP errors, load and gen seconds, `PALETTE_SKIPPED`) are always surfaced verbatim; markers are read only at line start. `script-markers.test.ts` reads each script's source and fails when a key is printed but undeclared or declared but never printed. What that buys: a bake that ran and threw is `MeshFinishResult.bakeFailed[{ map, reason }]` next to `bakeSkipped` (refused before running), and `GET /api/visual-gen/mesh-finish/status` forwards both, so a missing map path is never ambiguous; `previewError` (Hunyuan3D, TRELLIS.2), `fidelityError` (TripoSR CLIP) and `diagnostics` ride on the runner results. `readMarker` (full key) lives here and `local-process.ts` re-exports it. `pof_txt2img.py`, ARDY, SkinTokens and fbx-convert are not declared yet.

Two stdout contracts, side by side, not merged: the `POF_<P>_*` vocabulary above is for SUBPROCESSES PoF spawns (`runLocalProcess`, Blender resolved by `locateBlender`) and is read with `readMarkerBlock`; the `POF_RESULT=` JSON receipt below is for code sent to the operator's LIVE Blender over MCP and is read with `readReceipt`. A new spawned script declares its keys in `SCRIPT_MARKERS`; a new MCP generator ends with `pyReceipt`.

**Blender: one locator.** Every headless Blender runner (`runMeshFinish` and its Finish-in-Blender remedy, `runMeshSplit`, `runMeshViews` under the view gate and icon-from-mesh, `runFbxConvert`) and `GET /api/visual-gen/blender/detect` resolve the executable through `locateBlender` (`src/lib/visual-gen/blender-locate.ts`, pure over `env` / `platform` / `exists` / `listDir` / `which` seams): explicit `blenderPath` → `POF_BLENDER` → each `%ProgramFiles%/Blender Foundation/Blender X.Y` from the directory listing, newest first → fixed Steam / unix / mac paths → a PATH scan (no process spawned) → none. It returns `{ path, source: explicit|env|install|path, probed[] }`, and a miss is the one `blenderNotFound(probed)` error (count and list probed, plus `POF_BLENDER`). `resolveBlenderPath(explicit, env, exists, seams?)` is a delegate and `BLENDER_CANDIDATES` is derived (fixed paths only), so no hand-written version list exists; a runner's deps inject the same seams. Detect adds `blender --version` and answers `{ path, version, source, probed }` for exactly the path the runners spawn. `scripts/diablo/render.ts` still pins its own 4.2 path.

**Blender MCP: one receipt envelope.** A 200 from `/api/blender-mcp/execute` only means the addon accepted the code; a script's outcome is its receipt. A generator ends, after any `raise`, with `pyReceipt(kind, fields)` (`src/lib/blender-mcp/receipt.ts`): one `print('POF_RESULT=' + json.dumps({...}))` line whose field values are Python expressions (`pyStr` for a literal). `service.executeCode` normalises the addon reply first (`output`, else the ahujasid addon's `{executed, result}` text, else the stringified reply) and parses receipts once, so `ExecuteOutput` is `{ output, receipts }`. A caller asks `readReceipt(result.data | output | receipts, kind, expect)` and gets `confirmed | unconfirmed | mismatch`; only `confirmed` renders as success. The last receipt of the kind wins, every `expect` field must match exactly, and a receipt quote-escaped inside a stringified reply still parses. Kinds today: `export` `{ path, format }` (`SceneExporter` expects its own path), `blockout` `{ placed }` (`readBlockoutReceipt` keeps its three-state signature and needs a numeric count), and `armature` `{ name, bones: len(amt.bones) }`. Auto-Rig dispatches through `executeViaMCP`, and `describeArmatureOutcome` reports the bones Blender built next to the preset's declared count (the UE5 Mannequin stand-in is 11 of 67). The LOD tab measures and grades through the same envelope: `mesh-stats` `{ meshes: [{ name, tris, verts, polys }] }` (`meshStatsScript`, read-only, triangles from `loop_triangles`; `readMeshStats`, dispatched only on the "Read scene meshes" click) and one `lod` `{ level, name, targetTris, tris, polys }` per level (`generateLodsScript` decimates to triangle targets, ratio = target / measured source in Blender). `src/lib/visual-gen/lod-plan.ts` plans (`planLodChain`: per-level targets from the measured count, LOD0 against the `polycount-presets` class target/ceiling, no count = `unmeasured`) and grades (`gradeLodReceipt`: honoured within face-budget's 10% tolerance, `over` with the ~2x quad trap named, `under`, a level with no receipt = `unmeasured`); `LodPlanTable` shows it and the run is never painted green whole. The bespoke `POF_EXPORT_FINISHED=` / `POF_BLOCKOUT_PLACED=` markers are retired and confirm nothing. The other generators still print prose, and six raw call sites still fall back to a fabricated success string; each can adopt the envelope with one `pyReceipt` line.

**Blender file jobs never use the live session.** A file-to-file transform runs in its own `--background --factory-startup` Blender, never over the MCP bridge (which is the operator's open scene). FBX -> GLB is `runFbxConvert` (`src/lib/visual-gen/fbx-convert.ts` + `scripts/visual-gen/pof_fbx_convert.py`, spawned through `runLocalProcess`): import, bake rotation/scale on unparented meshes, triangulate, export GLB with Draco opt-in (the app's `SceneViewer` has no Draco decoder). It is `converted` only when the `POF_FBXCONV_DONE` receipt names a GLB that is on disk and newer than the run; a marker-less ending carries `processFailureReason`. `POST /api/visual-gen/fbx-convert` takes `{ inputPath, draco? }` (absolute, `.fbx`, exists — else 400/404), writes only `generated/converted/<stem>.glb` (an `ASSET_DIRS` row), and answers `{ converted: true, url, meshes, tris, bytes }` or `{ converted: false, reason }`. `FBXConversionTab` POSTs there and works with the bridge down. The live-session `convert-fbx.ts` (which ran `read_factory_settings` in the operator's Blender) is deleted, and `fbx-convert.test.ts` guards 0 occurrences of `read_factory_settings` under `src/lib/blender-mcp/scripts`.

## Tier-1 mesh gate: one gate request

What a generated mesh is held to is derived ONCE. `gateRequestFor({ assetClass, stage, targetExtentM?, sentBudget? })` (`src/lib/visual-gen/gate-request.ts`, pure) returns `{ deps, gradedAs }`: the class from `resolveAssetClass` (absent / unrecognised is stated in `gradedAs`, never graded class-blind in silence), ceilings from `critiqueThresholdsFor`, size from `targetExtentM ?? nominalExtentFor`, orientation from `expectsUprightFor`, and a budget ONLY when one was actually sent.

- The job-store builders are thin delegates that add only what their producer owns: `localCritiqueDeps` (TripoSR / Hunyuan / remediate: `raw`, no budget), `critiqueDepsForSpec` (Tripo: `raw`, the sent `faceLimit` in quads or triangles), `trellisGateDeps` (`raw`, the sent `decimation_target`), `critiqueDepsForFinish` (`finished`, `targetFaces`). A new producer is one call, not a fifth copy.
- `CritiqueDeps.orientation` is forwarded by `critiqueMesh` to `scoreMesh`, so a lying character now draws `orientation-lying` on its job verdict, and the /3d inspector shows the same WARN (below). It is a WARN (-15) that always carries its reason. Re-roll (`isAcceptable`), finish routing and remediation read fail codes only, so it never buys a paid roll or routes a finish.
- `MeshFinishJob.gradedAs` is projected by `GET /api/visual-gen/mesh-finish/status`, so a finished mesh says what it was held to.
- **The viewer grades through the gate.** The pure scorer lives in node-free `mesh-score.ts` (`mesh-critique.ts` re-exports it). `gradeViewerAsset` (`asset-viewer/assetGrade.ts`) builds its request with `gateRequestFor({ assetClass, stage: 'unknown', targetExtentM })` and grades with `scoreGeometry({ faces, verts, bbox }, deps)` = `scoreMesh` unchanged on clean-topology metrics, so its `findings` equal the job verdict's on the six geometry codes (`GEOMETRY_CODES`). `StudioInspector` paints each row with that severity (over-ceiling is a WARN, not a failure), shows an orientation row, and a geometry-only roll-up naming `GATE_ONLY_CODES` as measured only by the Tier-1 gate; class-blind with no findings is `unmeasured`, never pass. Remaining follow-up: the class-blind MCP gate (`blender-mcp/mcp-gate.ts`).

## Delivered mesh: the verdict names its remedy

A delivered card answers "fixable locally, or pay again?" instead of leaving it to the operator. `remedyFor({ critique, assetClass, meshPath })` (`src/lib/visual-gen/delivery-remedy.ts`, pure, server-side) projects the two existing decisions (`assessStage`, `planFinishFromCritique`) onto one of three kinds. It never changes a verdict.

- `finish` ($0): basename + `generated/<dir>` of the mesh, `addresses` / `unaddressed`, and the planner's note. This also covers the budget-DEFERRED (`max-then-finish`) character whose `warn` reads as a green Complete.
- `reroll` (paid; `empty-mesh` / `degenerate-bbox`): a note only, with no button. The one paid path stays `retryJob`, which still runs on `failed` jobs only, and a rejected card is `completed`.
- `none`: the reason (floater-only, critic unavailable, mesh outside `ASSET_DIRS`). `undefined` when nothing needs a remedy, so a clean card stays quiet.
- `GET /api/visual-gen/generate/status` projects `remedy` for a `done` job, because the client never receives `findings`. The MCP status path omits it.
- `useForgeStore.finishJob(id)` runs on an explicit click (`FinishRemedy.tsx`). It POSTs the existing `/api/visual-gen/mesh-finish/remediate` with `{ name, dir, assetClass }`. A `routed: false` answer lands verbatim as `finish.state 'refused'` and starts no poll. A 202 polls `/mesh-finish/status` on the same tracked-poller rail as a generation (Stop-able, 30-min ceiling), ending with `remediation.summary` and a preview of the finished low-poly.

## Style DNA: one canon-aware resolver

Which Style DNA reaches a 2D prompt, and why not, is resolved ONCE on the server: `src/lib/visual-gen/style-apply.ts`. Call sites hand it typed inputs, `styleRequestOf(body)` → `{ apply, canonProfile?, catalogId? }`, never pre-rendered style text.

- `resolveStyle(db, req)` → `{ fragment, applied: { id, name } | null, withheld }`. The profile comes from `styleDnaForProfile`: the project's active style for PoF's own entities (no canon, or `pof`), and only that canon's style for any other canon (a DB binding, else the shipped per-subject-class variant picked by `subjectClassOf(catalogId)`). A canon-bound style never leaves its canon, and the project style never reaches another one. A canon with no style is `withheld` with the reason. `db` may be a thunk (`getDb`), and `apply: false` never opens it.
- `styledPrompt(prompt, res, max)` is `applyStyleFragment`. `applyStyle(db, prompt, req, max)` is a prompt route's whole style step and returns `{ prompt, styleDnaApplied, styleDnaWithheld, styleDnaDropped }`. `styleDnaDropped` is `styleFragmentPreview(...).dropped`, the same sentences the Style DNA editor shows. `styleClause(db, req)` returns the fragment as a sentence clause for a prompt with its own style slot.
- Adopters: `/api/leonardo` (image mode, Leonardo's cap), `POST /api/visual-gen/generate-2d` (the 2D front) and `POST /api/visual-gen/contact-sheet` (the resolved clause becomes the sheet's `Style/medium:`; absent or withheld, the medium is `style` or the default as before). All three accept the fields as optional and report the outcome beside the result. Absent `applyStyleDna`, the provider gets the prompt byte-identical. A guard test fails if `src/app` or `src/components` calls `styleDnaForProfile` directly.
- Toggle reach is derived. `STYLE_DNA_SENDERS` (`style-dna.ts`) lists each forge file that reads the flag with `{ path: 2D|3D, resolution: server|client, reaches }`, and `STYLE_DNA_REACH` (senders, label "2D + 3D prompts", note) is built from that list. `StyleDnaReach.test.tsx` checks the list against a source grep of the real readers. The 2D forge (`Image2DPanel`) sends `applyStyleDna: true` only when the switch is on and a style is active, and shows the applied, withheld and dropped lines. The 3D submit (`GenerationPanel`) still appends the store's snapshot on the client and is declared `client`. The Style DNA panel is on both forge tabs. `scripts/diablo/media.ts` keeps its own resolution (ablation flags). It is script-owned and not app reach.
- Icon Set mode (`IconSetPanel.tsx`, below `Image2DPanel` on the forge 2D tab) is the contact sheet's in-app caller and a declared `server` sender. `icon-set-plan.ts` (pure, client-safe) derives coverage of a (catalog, step) from `GET /api/visual-gen/icons`, which reads through the library door. Only entity-scoped art counts: the step icon does not. It groups the cast by `canonProfile`, which `GET /api/catalog/entities` now serves, and splits each group into the fewest exact-fill grids of at most 16 cells (`SHEET_GRIDS`). Each grid is checked by `buildContactSheetPrompt`. A blank brief is refused and the refusal names the entity. The module also owns `SHEET_DEFAULTS` and `SHEET_PROVIDER_ID`, which the route reads, so the free preview shows the prompt that is sent. The preview labels its Style line as the default only when the switch is off. `iconSetRun.ts` posts the sheets one at a time on the single paid click. Every body carries the switch as `applyStyleDna` and the sheet's `canonProfile`, and each answer is typed as cut, uncut, refused or failed. The route's uncut 502 carries `details: { sheetUrl, verdict, ...style outcome }`, so a paid sheet the gate would not cut stays reachable. After a run the panel refetches the listing and re-derives coverage from it, not from the run report.

## PoF plugin routes: one declared table, GET-only probes

The PoF Bridge plugin's routes are declared ONCE: `POF_ROUTES` (`src/lib/pof-bridge/routes.ts`) lists each route's subsystem, method, path and `effect` (`read` | `mutates` | `ws`). A drift guard (`src/__tests__/lib/pof-bridge/routes.test.ts`) fails when a `/pof/...` literal in `PofBridgeClient`, `run-python.ts` or a `proxyToPofBridge(...)` handler is not declared, so a new plugin route cannot land in one copy only.

- `planRouteProbe(route)` (pure) derives whether a health check may touch a route: `http-get {path}` (with a cheaper `probePath`, e.g. `/pof/manifest?checksum-only=true`), `ws`, or `not-probed` (`mutates` / `needs-argument`). A probe is side-effect-free by construction. A POST of `{}` to `/pof/compile/live` or `/pof/snapshot/capture` IS the real request, so mutating routes are listed and never called.
- The Bridge Endpoints monitor (`project-setup/BridgeEndpointHealth`, mounted in Project Setup) derives its rows from the table. It executes the plan through the Bridge Doctor: `probeHttpRoute` (the Doctor's GET-only `httpProbe`) on `pofPort`, and `probeWsLiveState` on `wsPort` for `/pof/live`. A failed row carries the Doctor's `ProbeFailureKind`, where a 404 reads as "route not in this plugin build". Not-probed rows render calm and sit outside the healthy/probed counts. Probing runs only on the Ping All click.

## Bridge transport: one kernel, the failure kind is a field

`bridgeFetch(url, {method, body, headers, timeoutMs, signal, fetchImpl, parseErrorBody, label})` (`src/lib/bridge/transport.ts`) is the one HTTP transport to the UE editor plugins. Three hosts delegate to it and keep their own public shapes and wording: `proxyToPofBridge` (`pof-bridge/proxy.ts`, every `/api/pof-bridge/*` route), `runPython` (`bridge/run-python.ts`, with `parseErrorBody: true` because the plugin answers its `{ok, data|error}` envelope on 4xx/5xx too) and `bridgeRequest` (`ue5-bridge/shared.ts`, behind `PofBridgeClient` and `RemoteControlClient`). A host never calls fetch or arms its own `AbortController`; `transport.test.ts` greps the three for it.

- It returns `{ok: true, status, data}` or a failure with `kind` (`unreachable` | `timeout` | `aborted` | `auth-rejected` | `http-error` | `malformed-body`), `reachable` (the plugin answered), `indeterminate`, `status` (the upstream status, or 502 / 504 / 499) and `detail` (snippets capped at 200 chars).
- The body is read as text and parsed outside the transport catch, so a live plugin that answers garbage is `malformed-body` (reachable), never `unreachable`. 401/403 are `auth-rejected` everywhere, and `pofProxyError` names the auth token.
- The deadline is composed with the caller's signal (either one ends the call) and holds even when a fetch ignores its signal. A timed-out or cancelled non-GET is `indeterminate`: the plugin may already have written the file or started the compile. Its detail says the outcome is unknown and must be checked before retrying. A timed-out GET is a definite failure.
- `bridgeRequest` returns `BridgeRequestResult<T>`: a `Result<T, string>` whose failure also carries `kind`, `reachable`, `indeterminate` and `status`. Callers that only read `error` (the connection managers, `/api/ue5-bridge/query`) keep working, and a consumer branches on `kind`, never on the sentence. The Bridge Doctor (`bridge-doctor/probes.ts`) and the test-gate executor still run their own fetch; they are the next adopters.

## Headless UE builds: dispatched from Build Health

The Build Health tab (`evaluator/BuildHealthDashboard`) starts the headless builds it charts; before, only the `pof_ue_build` MCP tool could fill `headless_builds`.

- `src/lib/ue5-bridge/build-run.ts` (pure, client-safe): `defaultBuildRequest(project)` returns `Result` with the `start` body (the project's Editor target, Development, Win64) and refuses, before any request, a value the route would reject. The route's `start` and `rebuild` share its `validateBuildTarget`. `buildRunReducer` follows ONE run: idle, dispatching, queued, running (percent and `[N/M]` line), settled (then the report refetches once). It follows the run by id: each `GET ?buildId` answer is a `status` event; a status unreadable for `MAX_MISSED_POLLS` (20) polls (404: never recorded) goes `lost` with a reason, never a silent spinner. An interrupted build settles `failed` and carries the server's `reason`.
- `useBuildRun` dispatches only on a click (`buildNow` / `rebuild` / `abort`). Mounting, polling and the settle refetch never POST. It polls `GET /api/ue5-bridge/build?buildId` (one small status object, never the history or its logs) every `UI_TIMEOUTS.pollInterval` while a run is in flight, and pauses while the module is suspended.
- **Build ledger: the row precedes the spawn.** `BuildQueue.enqueue` inserts the `headless_builds` row as `queued` (`recordQueuedBuild`) before the build can spawn; when that insert fails, `POST start` returns 500 naming the record failure and nothing runs. `processNext` flips the row to `running` (`markBuildRunning`) before `executeBuild`, whose close handler upserts the full result; the queue then writes the summary only onto a row still queued/running (`settleBuildRow`: a lost write, a thrown executor, or a queued abort, which settles `aborted` with no duration). `GET ?buildId` answers every stage through the pure `resolveBuildStatus` (`build-status.ts`) over the live item and `getBuildStatusRow` (summary columns, never the log): a live item wins (`owned: true`); a settled row answers its summary; an unowned `running` row reads `running, owned: false` until it is older than `UI_TIMEOUTS.buildProcessTimeout`, then `failed, interrupted`; an unowned `queued` row is `failed, interrupted` at any age (the queue is in memory, so it can never start). 404 means the id was never recorded. `getBuildHistory` and `getHealthBuilds` (so the recurring-errors view too) read settled rows only (`TERMINAL_BUILD_SQL`), and health also skips a queued abort, so success rate is unchanged. The pof-mcp build wait settles on real builds with no pof-mcp change (it reads the same top-level `status`).
- `BuildQueueItem.progress` (additive, optional) holds the running item's latest `onProgress` line, so a status read shows it. The `build.progress` event still fires.
- `POST /api/ue5-bridge/build {action:'rebuild', buildId}` re-enqueues the recorded request (`getBuildRequestById` in `build-pipeline.ts`: target, type, configuration, platform, engine; `additionalArgs` are not stored). An unknown id returns 404. The lookup stays out of the route because pof-mcp's project-scope guard lists this route as `scoped: false`. Each regression alert's "Rebuild to confirm" uses it, so the lane's next point confirms or clears the alert.

## Combat sweeps: one kernel, run as a job

The Simulator tab's Predictive Balance sweep (`src/lib/combat/predictive-balance.ts`) owns no fight loop. Every heatmap cell and sensitivity step is one `runCombatSimulation` call into `src/lib/combat/simulation-engine.ts`, so its survival / TTK (`summary.avgFightDurationSec`) / DPS numbers describe the same fight the Combat Simulator, goal-seek and feedback comparison resolve. EHP and the canon one-shot facet are read from the engine's own exported `buildPlayerAttributes` / `buildEnemyAttributes`. A sensitivity step pins one player attribute through `OverrideCombatScenario.playerAttributeOverrides`, which is applied after scaling. Each cell keeps its own seed (`sweepCellSeed(archetypeId, level)`, `sens|attr|step`), so results do not depend on order.

- `planPredictiveSweep(config, enemies?)` is pure: it returns `{ registry, units: { scenario, sim }[], assemble(summaries, durationMs) }`, with units in report order. It runs no fights.
- `runPredictiveBalance` (sync, for tests and headless callers) and `runPredictiveBalanceAsync(config, enemies?, { signal, onProgress })` (the job) drain the same plan, and the job's report deep-equals the sync one apart from `durationMs`. The job calls `onProgress(0, total)` before its first cell and then `(k, total)` after each cell. Each cell goes through `runCombatSimulationBatched` in batches of `SWEEP_BATCH_SIZE` (200). It yields between batches and between cells and checks the signal at every yield. An abort resolves `{ aborted: true }` and never produces a partial report. `runCombatSimulationBatched` accepts `signal` for any caller. `yieldToEventLoop` uses `setImmediate` in Node and a `MessageChannel` task in the browser, because a nested `setTimeout(0)` is clamped to 4 ms per yield.
- `usePredictiveSweep()` (`sub_character/simulator/predictive/`) binds the job to a component. It returns `{ report, running, progress, error, run, cancel }`. A new `run` aborts the one in flight (last request wins), `cancel` keeps the previous report, and unmount aborts. It holds the shell pane while running (`usePaneHold`), so the keep-alive LRU does not evict and cancel it. The panel shows "cell k/N" and a Cancel button.
- New sweep features (solve and goal-seek over the sweep) drive this job or its plan. They do not add a second fight loop or a synchronous sweep on the UI thread.
- The report carries its own axes: `levels`, `encounters[{ index, label, archetypeId }]` and `midLevel` (the swept level nearest the middle of the range, used by the headline, the DPS breakdown and the sensitivity steps), and each `HeatmapCell` carries `encounterIndex`. Encounter labels are unique (a collision gets `(Lv+N)`, then `#i`). `ResultsPanel` and `SurvivalHeatmap` render from the report alone, never from the live config.
- Tune from the heatmap (`src/lib/combat/sweep-tuning.ts`). `solveCellTuning(config, enemies, { level, encounterIndex }, lever, target, { signal, onEval, range })` narrows the config to one cell. Because of the per-cell seed, that narrowed run is the full-sweep cell. It first runs a 5-point pre-sweep over the lever's band (`COMBAT_TUNING_LEVERS`) and refuses a non-monotonic curve or an unreachable target, naming the sweep's numbers (`applicable: false`). It then runs the shared `solveFor` by replay: `solveFor` runs synchronously over a memo of evaluated lever values; a miss interrupts it, that value is evaluated as one `runPredictiveBalanceAsync` job, and `solveFor` re-runs. The tolerance is `max(solver default, 1/iterations)`, and an abort resolves `{ aborted: true }`. `diffSweeps(base, next)` returns per-cell survival/TTK deltas, alert churn by message, and canon status flips.
- In the panel, heatmap cells are buttons. `CellTuner` offers a lever, a target % and Solve (shows "eval k" with a Cancel; holds the pane while solving), then Apply. Apply re-runs the sweep with `config.tuning[lever] = solvedValue` and keeps the previous run as the baseline: cells get +/- pts badges and `SweepDiffBar` offers Undo. A run's report is shown only once its job lands, so a cancelled Apply keeps the previous tuning. `ConfigPanel` shows non-default levers as chips with Reset. All of this is session-local, with no store.

## Encounter bands: one law, every surface reads it

A fight's survival rate and mean fight length become a verdict in one place, `src/lib/balance/encounter-bands.ts`. `difficultyBand(rate)` returns easy (≥ 0.9), fair (≥ 0.6), tough (≥ 0.35) or brutal; the cuts are `SURVIVAL_BAND_CUTS`. `fightLengthBand(ttkSec)` returns instant (< 1s), healthy, long (> 20s) or stall (> 45s), from `FIGHT_LENGTH_CUTS`. `bandSeverity` / `fightLengthSeverity` map a band to good, warning or critical (fair and healthy are good, brutal and stall critical). `isFlaggedSeverity` is the "this is a problem" test, and `survivalTone(rate)` is the colour of that severity. `SURVIVAL_TARGET` (0.65) and `TTK_TARGET_SEC` (4) are the tuning targets inside the good bands.

- Readers: the Combat Simulator Fight Report Card (`src/lib/combat/fight-report.ts`, headline band). In the GAS Balance simulator (`sub_ability/gas-balance/`), `balanceHealth.ts` reads it for the survival and duration findings, the headline, the narrative (which names the band) and the win-margin gates. `detectBreakpoints` in `simulation.ts` flags a sweep level exactly when the report would flag its survival or duration finding, with one breakpoint per level whose reason names the band. The Survival `StatBadge` (`ResultsSummary.tsx`) and the sweep-table Survival cell (`LevelSweepPanel.tsx`) colour by `survivalTone`.
- A new surface that grades a fight (a solver target, a badge, an alert) imports these constants and functions. It never restates a cut inline. `src/__tests__/lib/ability/gas-balance-verdict-agreement.test.ts` checks that the report and the sweep agree over a 147-point survival x TTK grid, and a source guard over `gas-balance/*.ts(x)` fails on any inline `survivalRate < 0.x` comparison.
- Tested fixes (`gas-balance/balanceFixes.ts`). A survival or duration finding's "Try" is a solved lever, not a formula guess. `FIX_TARGETS` maps the finding to its metric (survival rate or mean TTK), the band law's target (`SURVIVAL_TARGET`, `TTK_TARGET_SEC`), the candidate `GAS_LEVERS` (player/enemy health, player/enemy damage; a damage lever scales base damage and attack power) and `lands`, the band the finding reads healthy in (fair, healthy). `solveFix(scenario, findingId, lever, { range })` measures the scenario on 500 seeded fights, picks the lever's helpful direction (×1 to ×10, or ×0.1 to ×1, narrowed so no stat leaves `STAT_BOUNDS` from `data.ts`), and runs `solveLever`: a 5-point pre-sweep that refuses a non-monotonic curve or an out-of-reach target with the sweep's own numbers, then the shared `solveFor` over a memo. The seeded sim is a step function of a stat (one extra hit flips many fights), so when the bisection cannot hit the target it takes the evaluated value nearest it and accepts it only if it `lands`. A refused or unlanded solve carries `spec: null`. `applyFix` scales one lever, clamped to `STAT_BOUNDS`, so an applied scenario always re-imports. The defence fix is set, not searched: armor goes to `targetArmorFor(refHit)`. `rankFixes` orders measured grade deltas first, unmeasured next and refused last. In the UI, `FindingFix` gives each such finding a Solve button (one job per lever, `yieldToEventLoop` between them; no rAF), a row per lever with the measured before/after (`Player HP ×5.68 (500→2841): survival 0%→67%, grade D→F`), and Apply only on a landed row. Apply goes through `BalanceHealthReport`'s optional `onApply` to `index.tsx`, which swaps the scenario in, clears the preset and re-runs through the chunked runner. It keeps the solved-on run as `applied`, so the next report shows an "Applied <lever>: grade <before> → <after>, survival <before> → <after>" chip. "What to try first" is ranked by `rankFixes` once findings are solved. Consistency, margin and overkill findings say "not solvable by a single stat".

## Encounter findings: one pacing authority

The Encounter Choreographer (`src/components/modules/core-engine/sub_combat/choreography/`) reports every balance alert and pacing defect through one module, `src/lib/combat/encounter-findings.ts`. `simulateEncounter` computes the tension curve first, then `deriveEncounterFindings(facts, curve)` returns `EncounterFinding[]` = `{ kind, severity, message, timeSec, endTimeSec? }` (`ChoreographyAlert` is an alias).

- Balance kinds (`unknown-archetype`, `player-death`, `spongy`, `trivial`, `tedious-hp`, `burst-spike`) are read from sim facts against `ENCOUNTER_ENVELOPE`, the one threshold table. Its `bucketSec` is also the tension curve's default `windowSec`, so the two cannot drift.
- Pacing kinds are a 1:1 promotion of the curve's `tone: 'issue'` beats (`dead-zone`, `anticlimax`, `flat-pacing`). The curve is the only pacing detector: do not add a second one in the sim. A beat's tone comes from `BEAT_TONE` (`tension-curve.ts`), and `PACING_FINDINGS` is keyed on the derived `IssueBeatType`, so a new issue beat does not compile until it is mapped.
- Match findings across tuning passes by `kind` (plus time), never by message text: messages embed numbers.
- Tension intensity sits on a fixed basis: window flux divided by the effective player max HP, clamped to 1, never by the fight's own peak. `curve.basis` declares `{ windowSec, sampleStepSec, intensityReference, observedPeakFlux }` (the observed peak is diagnostic only). A fixed basis can saturate, so the climax is the LAST sample at peak tension. Peak tension therefore compares across passes and encounters.
- UI: `severityColor` (`choreography/types.ts`) is the only severity-to-colour map. A finding with `endTimeSec` renders as a band on the alert lane and carries a range label in Balance Alerts; the scrub tooltip (`findAlertAt`) matches it by containment, and a point finding within 1s wins over a containing range.

## Asset Inventory: UE-declared edges over name guesses

The Models Asset Inventory tab (`models/AssetInventory/`) scans Content/ through `POST /api/filesystem/scan-assets`. The route's `inferDependencies` only guesses edges from shared base names (mesh to material, material to texture). `useAssetInventory` reads the scan with `tryApiFetch<AssetScanResult>`, so the `{success, data}` envelope is unwrapped once and an error keeps its text. Before that, the hook stored the raw envelope and the first render after a scan threw.

- `src/lib/asset-inventory/declared-edges.ts` (pure, client-safe) joins the scan and the PoF Bridge manifest on one key. `gamePathToContentKey('/Game/X/Y[.Y]')` gives `X/Y` (null for `/Engine` or plugin mounts), `contentKeyOf({relativePath})` strips `.uasset`/`.umap`, and matching ignores case. `declaredEdges(manifest, assets)` turns `textureReferences` into `uses-texture` and `crossReferences` into `references`, keyed by relativePath like the route's edges. A reference with no scanned file at either end is counted in `unresolvedRefs`, never drawn.
- Every `InventoryEdge` carries `provenance`: `declared` (from UE's manifest) or `inferred` (the route's name guess). `mergeInventoryEdges(inferred, declared, manifest)`: an asset the manifest covers keeps ONLY its declared out-edges (an empty UE list drops the guesses); an uncovered asset keeps its guesses, tagged. With no manifest the edges are the route's, 1:1.
- `reconcileInventory(assets, manifest)` returns `{notInManifest, missingOnDisk}` (only `/Game` entry paths), or `{available: false}` without a manifest. Then the hook's `ueFilter` is null and the "Not in UE manifest" chip is hidden.
- UI: DependencyGraph draws declared edges solid and guesses dashed, with a per-asset legend ("n UE-declared · m guessed from names"). Without a manifest it says every edge is a guess. AssetCard shows a `UE` / `not in UE manifest` badge, the summary bar splits the edge count by provenance, and BridgeManifestCard lists "Missing on disk (n)". A guess is never labelled declared. The route and its exported types are unchanged (the asset-code oracle reads them).
- Tests: `src/__tests__/lib/asset-inventory/declared-edges.test.ts` (the design doc's example manifest: 10 declared edges, 1 unresolved) and `src/__tests__/components/content/useAssetInventory.test.tsx` (envelope, provenance, reconcile filter, render). `useManifest` is stubbed at the hook.

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
- **Severity/score tokens**: `SEVERITY_TOKENS.critical/high/medium/low` (bundles `color`, `bg`, `border`); `qualityColor(score)` maps 1–5 quality scores. A 0–100 score has ONE table, `SCORE_BANDS` in chart-colors (≥80 positive/ok, ≥60 medium/warn, ≥50 high/warn, else critical/bad; `scoreBand(s)`). Every score helper derives from it: `scoreBandToken(score)` (4-band severity token), `scoreStatusToken(score)` (status-token, 3-level ok/warn/bad with glyph) and `successRateColor(score)` (its colour). Never restate the cuts inline: `src/__tests__/lib/no-inline-score-ladder.test.ts` holds migrated files at zero and ratchets `src/components` at a pinned BASELINE. A cut may only move so a score reads less flattering, never more (`score-band-authority.test.ts` checks every retired ladder over 0..100)
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
