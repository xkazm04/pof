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
| `src/hooks/useSuspend.ts` | `SuspendContext`, `useSuspendableEffect`, `useSuspendableSelector` |
| `src/components/layout/ModuleRenderer.tsx` | LRU module cache (`LRU_CAP = 5`, `SESSION_LRU_CAP = 5`) |
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

## Suspend/LRU pattern

### Problem

Navigating between modules unmounts components, destroying local state and interrupting running CLI sessions. Keeping every visited module mounted wastes memory and causes invisible timers/subscriptions to fire.

### LRU cache (`src/components/layout/ModuleRenderer.tsx`)

`ModuleRenderer` keeps the last **5 modules** (`LRU_CAP = 5`, line 11) and the last **5 inline terminal sessions** (`SESSION_LRU_CAP = 5`, line 14) mounted simultaneously. Navigation promotes the active module to the front of the list via `lruTouched()` (line 151). The tail (least-recently-used) entry is evicted — its DOM subtree unmounts and cleans up. All mounted-but-hidden modules have `display: none` applied via `style`.

### SuspendContext (`src/hooks/useSuspend.ts:17`)

```ts
export const SuspendContext = createContext<boolean>(false);
```

`ModuleRenderer` wraps every mounted-but-hidden module in `<SuspendContext.Provider value={!isVisible}>` (lines 243, 272). A value of `true` means "this subtree is suspended (hidden)".

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

## Server-side scheduler (cron)

`src/instrumentation.ts` is the one place the app runs work on a wall-clock interval **without a browser**. Next.js calls its exported `register()` once per server start; guarded to `NEXT_RUNTIME === 'nodejs'` (better-sqlite3 is node-only) and to a `globalThis.__pofSchedulerStarted` flag (no double-register on dev HMR). It starts a 1-minute `setInterval` (`UI_TIMEOUTS.scheduleTick`, `.unref()`'d) that calls `tickScheduler()`.

The first (and currently only) consumer is **scheduled nightly builds** (`src/lib/packaging/scheduled-build-runner.ts`):

- **Config + state** live in the `settings` table via `build-schedule-store.ts` — a disabled-by-default `BuildSchedule` (time, weekdays, profile, skip-if-unchanged, **and the captured project target** so the server cron can run unattended), plus last-run `ScheduleState`. An in-memory `running` flag is the single-flight guard.
- **`tickScheduler()`** reads the schedule, asks the pure `isDueAt()` (`build-scheduler.ts`) whether a slot is due, and fire-and-forgets `runScheduledBuild()` if so. `startScheduledRun()` is the manual ("Run now") path.
- **`runScheduledBuild(ctx, deps)`** runs the full chain — skip-if-unchanged (git HEAD vs last built commit) → fast pre-flight (`preflight-runner.ts`) → cook → smoke (Win64) → size-budget → record to `build_history`. Every side-effect is injected, so the orchestration is unit-tested without spawning anything; `defaultRunnerDeps()` wires the real implementations.
- API surface: `/api/packaging/schedule` (GET status, POST `save`/`tick`/`run-now`). UI: `NightlyBuildScheduler.tsx` in the packaging **Pipeline** tab (GET-polls for status; the cron, not the client, drives the actual builds).

When adding another scheduled job, register it the same way (cheap when idle, guarded, `.unref()`'d) rather than spinning a second interval.

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
