# CLI Terminal & Task System — zen-perf scan
> Context: CLI Terminal & Module Shell / CLI Terminal & Task System
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Server-side execution/session maps grow unbounded — leak + per-run event buffer never trimmed
- **Severity**: high
- **Lens**: performance
- **Category**: memory-leak
- **File**: src/lib/claude-terminal/cli-service.ts:351 (and :102, :188, :265); src/lib/claude-terminal/session-manager.ts:61
- **Scenario**: A long-running dev server that dispatches many CLI tasks over a session. Each `startExecution` adds an entry to the module-global `activeExecutions` map and never removes it. `cleanupExecutions(maxAgeMs)` (cli-service.ts:351) and `cleanupOldSessions` (session-manager.ts:61) exist but a repo-wide grep shows **neither is ever called** — the maps only grow.
- **Root cause**: Two GC helpers were written but never wired to a timer or a route. Separately, within a single run `execution.events.push(event)` (cli-service.ts:188) is called for *every* SSE event including a `stdout` event that stores the full `raw` chunk text (cli-service.ts:265) — so each long Claude run retains a duplicate of the entire stdout stream in memory for the life of the process.
- **Impact**: Steady RSS growth across a work session (each completed execution keeps its full event log + raw stdout forever); for a build-heavy task the per-run `events` array alone can hold megabytes of duplicated stdout. On a developer's always-on Next.js process this is an open-ended leak.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: (a) Call `cleanupExecutions()` at the top of `startExecution` (or on a `setInterval` registered once via the `globalForExecutions` singleton) and `cleanupOldSessions()` similarly. (b) Stop pushing the raw `stdout` event into `execution.events` — it is only consumed live by listeners, never replayed; emit it to listeners without `events.push`, or cap `events` to the last N entries since `awaitCallback`/`getExecutionStatus` only need text + the last event.

## 2. `awaitCallback` re-scans the entire accumulated event log on every text event
- **Severity**: medium
- **Lens**: performance
- **Category**: redundant-work
- **File**: src/lib/claude-terminal/cli-service.ts:411 (initial scan) + :433-440 (per-event listener)
- **Scenario**: A route that uses `awaitCallback` on a chatty execution. The initial pre-check loops `for (const ev of execution.events)` and runs the `CALLBACK_MARKER_RE` regex (`[\s\S]*?` across the whole body) over each text event's content. The listener then runs the same `parseCallbackMarker` on every subsequent text event.
- **Root cause**: Callback detection re-parses individual event contents rather than appending to and scanning a single accumulating buffer; the marker can only ever appear once, but the regex is run repeatedly over growing content.
- **Impact**: O(events × content-length) regex work per execution while streaming; cheap individually but quadratic-ish on a long run with many text chunks, on the server request path.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Accumulate text into a single string on the execution (or short-circuit once a marker is found and cache the result). The client already does exactly this with `assistantOutputRef` (useTaskQueue.ts:214) — mirror that single-buffer approach server-side and only run the regex on new appended text.

## 3. `buildTaskPrompt` is a 540-line switch mixing prompt text, callback registration, and per-type asset logic
- **Severity**: high
- **Lens**: architecture
- **Category**: SRP / oversized-function
- **File**: src/lib/cli-task.ts:459-1000
- **Scenario**: Adding the 19th task type, or changing the callback/submission contract. A single `switch` of ~18 cases (cli-task.ts:469) inlines: project-header assembly, `registerCallback(...)` calls with hand-written `schemaHint` JSON-as-string blobs, UE-vs-non-UE branching, and large literal prompt bodies (the `wbp-starter`, `mixamo-import`, `character-setup`, `audio-import` cases are each 30-60 lines of embedded markdown).
- **Root cause**: No per-task abstraction. Every task type re-implements the same shape (header → domain section → body → optional callback) by copy/paste, and the `schemaHint` strings duplicate field structures that already exist as TS types elsewhere.
- **Impact**: High change-cost and drift risk: the header/domain-section preamble is duplicated verbatim across `checklist`/`quick-action`/`feature-fix`/`feature-review`; a contract change touches ~18 sites. The file is the single largest in the context and is hard to review.
- **Effort**: 6 · **Value**: 6
- **Fix sketch**: Extract a `TaskDefinition` registry keyed by `CLITaskType`, each entry providing `{ needsWiring, needsCallback, buildBody(task, ctx), callback?(task, ctx) }`. Have one `buildTaskPrompt` shell assemble header + domain + body + `buildCallbackSection`. Move the long literal prompts (procgen/biome/mixamo/character/audio/wbp) into per-task builder modules under `lib/prompts/` like the others already are (`buildEvalPrompt`, `buildRunTestsPrompt`).

## 4. Duplicated `extractCallbackPayload` and two parallel in-memory callback registries
- **Severity**: medium
- **Lens**: architecture
- **Category**: duplication / dead-path
- **File**: src/lib/cli-task.ts:156 + src/lib/claude-terminal/cli-service.ts:388; registries at cli-task.ts:56 and cli-service.ts:369
- **Scenario**: A maintainer tracing how a `@@CALLBACK` result reaches the API. There are two functions named `extractCallbackPayload` (one client-shaped returning `{callbackId,payload}`, one server-shaped returning the parsed object) and two callback maps: `_callbackRegistry` (cli-task.ts:56, holds the POST descriptor) and `cliCallbackRegistry` (cli-service.ts:369, holds one-shot resolvers). The server-side `registerCallbackResolver` (cli-service.ts:377) is `function`-private and only used inside `awaitCallback` — yet `awaitCallback` *also* maintains its own `listener`, so the resolver-map indirection (cli-service.ts:427-445) is a redundant second path for the same resolve/reject.
- **Root cause**: Client and server independently grew callback handling around the same marker format; the server `awaitCallback` carries both a direct closure (`resolve`/`reject`) and a registry-based resolver that duplicate each other.
- **Impact**: Two same-named functions and two registries make the flow hard to follow and easy to break (e.g. forgetting which registry a fix applies to). The resolver-map branch in `awaitCallback` is effectively dead weight.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Keep the single shared `parseCallbackMarker` (already the source of truth) and delete cli-service.ts's private `extractCallbackPayload` wrapper, calling `parseCallbackMarker(...)?.data` inline. Remove the `cliCallbackRegistry`/`registerCallbackResolver` indirection from `awaitCallback` and resolve/reject directly through the closure + the single `listener`.

## 5. Per-keystroke regex entity extraction and code-block parsing on assistant messages with no memoization
- **Severity**: low
- **Lens**: performance
- **Category**: missing-memoization / re-render
- **File**: src/components/cli/TerminalOutput.tsx:432 (`extractInlineEntities`) + :686-713 (`renderSingleLog`)
- **Scenario**: A streaming run where the tail (last 8 logs) re-renders on every RAF log flush (useTaskQueue.ts:242 batches, but still fires per animation frame). For each assistant log in the tail, `renderSingleLog` calls `parseCodeBlocks(log.content)` and `extractInlineEntities(log.content)` — the latter runs four global regexes (`UE_CLASS_RE`, `FILE_RE`, `WARNING_RE`) plus a 24-entry concept substring scan over the full message text, every render, uncached.
- **Root cause**: `renderSingleLog` is a plain function called inside `.map` during render; results are recomputed for unchanged log entries on every parent re-render rather than memoized per log id.
- **Impact**: On long assistant messages during active streaming, multiple full-text regex passes per frame on the tail entries — minor jank on lower-end machines; bounded because only 8 tail entries and entities cap at 12.
- **Effort**: 3 · **Value**: 3
- **Fix sketch**: Memoize per-log derived data (`hasCodeBlocks`, `entities`, build-parse lookup) keyed by `log.id` (a `useMemo`-backed `Map` or a memoized `SingleLog` child component wrapped in `React.memo`). The build-parse result is already cached in `buildParseCache`; do the same for entity extraction so a stable log entry is parsed exactly once.
