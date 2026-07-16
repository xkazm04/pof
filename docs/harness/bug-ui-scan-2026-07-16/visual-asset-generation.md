# Visual Asset Generation — Bug + UI Scan

> Total: 9

> Note: `src/components/modules/visual-gen/asset-browser/index.ts` does not exist on `master` (no barrel file in that directory). The directory's actual entry point, `AssetBrowserView.tsx`, was read instead and folded into this pass for context; it did not surface additional high-value findings beyond what's below.

## Bug findings

### 1. `submitLocalJob` poll loop has no failure cap — infinite retry storm on a stuck job
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/visual-gen/asset-forge/useForgeStore.ts:329
- **Scenario**: The `/api/visual-gen/generate/status` route starts erroring persistently (server restart, DB lock, provider outage lasting minutes). Every poll tick hits `if (!res.ok) { scheduleNext(); return; }` and reschedules unconditionally.
- **Root cause**: Unlike `submitMcpJob`'s poller (lines 187, 224-236), which caps consecutive transport failures at `MAX_CONSECUTIVE_POLL_FAILURES = 3` and fails the job, `submitLocalJob`'s poller has no such cap — it retries forever at the fixed interval with no backoff and no way to ever mark the job failed from transport errors alone.
- **Impact**: The job sits in "Generating" indefinitely, silently hammering the status endpoint on every tick for as long as the tab stays open, with the user given no way to know it will never resolve and no failed state to retry from.
- **Fix sketch**: Mirror the MCP poller's consecutive-failure counter and terminal `failed` update in `submitLocalJob`'s `tick()`.

### 2. FileReader has no `onerror`, and the form is reset before the read completes
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:82-91
- **Scenario**: User uploads a reference image for a runner-backed provider (e.g. TripoSR); the file is unreadable (corrupt, permissions, browser quirk) or simply large enough that `reader.readAsDataURL` takes a moment.
- **Root cause**: `reader.onload` is the only handler set; `reader.onerror` is never assigned. Worse, `resetBuilder()` and `setImageFile(null)` run synchronously immediately after `reader.readAsDataURL(imageFile)` is called — i.e. before `onload`/`onerror` ever fires — clearing the upload UI while the read is still in flight.
- **Impact**: On a read error, nothing happens: no job is queued, no error is shown, and the form already looks reset as if submission succeeded — a classic silent failure / success-theater gap. Even on the happy path there's a visible window where the form has cleared but no queue entry exists yet.
- **Fix sketch**: Add `reader.onerror` to surface an error (e.g. a transient toast or a failed placeholder job), and defer `resetBuilder()`/`setImageFile(null)` until inside `onload` (or until `submitLocalJob` has been kicked off).

### 3. No submission-in-flight guard — rapid double-click/Enter can double-submit a job
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:245-254
- **Scenario**: User double-clicks "Generate" (or clicks then hits Enter via `PromptBuilder`'s submit) before React re-renders the disabled state from the first click's `resetBuilder()`.
- **Root cause**: `handleSubmit` calls `submitMcpJob`/`submitLocalJob` without `await` and without setting any "submitting" flag; `canSubmit` is only recomputed on the next render, so a second synchronous invocation of `handleSubmit` within the same event-loop tick before re-render sees identical `effectivePrompt`/`imageFile` state and passes all the same guards.
- **Impact**: Two identical generation jobs (and two paid provider calls, for MCP-backed providers) can be submitted from one user intent, silently doubling cost/queue clutter.
- **Fix sketch**: Track a local `isSubmitting` state (or derive it from "a job with this exact prompt was just added within N ms") and disable the button/short-circuit `handleSubmit` while a submission is in flight.

### 4. Blob URLs from `URL.createObjectURL` are never revoked
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:95
- **Scenario**: User repeatedly queues "placeholder" jobs (any local, non-runner-backed provider) with image references over a long session.
- **Root cause**: Each such job creates `URL.createObjectURL(imageFile)` and stores it on the job, but nothing ever calls `URL.revokeObjectURL` — not on `removeJob`, not on `clearCompleted`, not on unmount.
- **Impact**: Each queued placeholder job leaks the underlying blob's memory for the lifetime of the tab; on a long working session with many image uploads this is a slow, unbounded memory leak.
- **Fix sketch**: Revoke the object URL in `removeJob`/`clearCompleted` in `useForgeStore.ts` when a job carrying a blob-URL `imageUrl` is removed.

### 5. Unwired "placeholder" local providers queue jobs that can never resolve, with the ticker running forever
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:94-99; src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx:95-102
- **Scenario**: User picks a local provider that isn't `mcpBacked` and isn't `runnerBacked` (per the comment at GenerationPanel.tsx:94, "other local providers aren't wired to execute yet") and submits a text-to-3D or image-to-3D request.
- **Root cause**: `addJob(...)` puts the job straight into `pending` status with no code path that ever calls `updateJob`/marks it `failed`/`completed` — there is no submission at all, just a queued shell. `GenerationQueue`'s `hasActive` check (`jobs.some(j => !j.completedAt)`) stays true forever because of this job, keeping the 1s `setInterval` ticking indefinitely.
- **Impact**: The user sees a job sitting in "Pending" forever with an incrementing elapsed-time counter and no error, no explanation, and no way to know the provider isn't actually implemented — success theater that looks like a stuck/slow backend rather than an unbuilt feature.
- **Fix sketch**: Either hide/disable providers that aren't wired to execute (the UI already does this for `coming-soon` via `isSelectable`), or have `addJob` for this path immediately set `status: 'failed', error: 'Not yet implemented'` instead of leaving it in perpetual `pending`.

## UI findings

### 6. Provider grid is a fixed 2-column layout with no responsive/overflow handling
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:146
- **Scenario**: `ForgeTab` wraps the panel in `max-w-2xl mx-auto`, but on narrower viewports (embedded panel, resized window, or a future mobile layout) the hardcoded `grid-cols-2` squeezes provider name + status badge + `line-clamp-2` description + VRAM note into a cramped card with no breakpoint fallback to a single column.
- **Root cause**: No `sm:`/responsive grid variant is used; the grid is always 2 columns regardless of container width.
- **Impact**: Provider cards become visually cramped or text overflows/wraps awkwardly on narrow layouts, hurting legibility exactly where the user needs to compare provider descriptions to choose one.
- **Fix sketch**: Use `grid-cols-1 sm:grid-cols-2` (or a container query) so cards get full width on narrow containers.

### 7. No "submitting" / in-flight visual state on the Generate button
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:245-254
- **Scenario**: User clicks "Generate 3D Model" for an MCP-backed or local provider; the network round trip to `/api/blender-mcp/generate` or `/api/visual-gen/generate` can take a noticeable moment.
- **Root cause**: The button only toggles between enabled/disabled based on `canSubmit` (derived from form fields), never reflecting that a submission is actively in progress — there's no spinner, no "Submitting…" label, no transient disabled state tied to the async call itself.
- **Impact**: Immediately after clicking, the button looks fully idle/clickable again (form reset happens synchronously), so the only feedback that anything happened is scrolling down to the queue — worse on slower connections, and compounds bug #3's double-submit risk.
- **Fix sketch**: Add local `isSubmitting` state, disable the button and show a small spinner/label while the initial submit call is pending.

### 8. `GenerationQueue` has no scroll boundary — unbounded list grows the whole page
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx:129-133
- **Scenario**: User queues many jobs over a session (image-to-3D batches, repeated experiments) without clearing completed ones.
- **Root cause**: The job list renders as a plain `space-y-2` column with no `max-height`/`overflow-y-auto` container and no virtualization; it's nested inside `ForgeTab`'s single `max-w-2xl mx-auto` column alongside the panel above it.
- **Impact**: A long queue pushes the Generate panel far up the page and forces scrolling through the entire page rather than just the queue, and rendering cost grows unbounded with job count (every job card re-renders every tick while any job is active, per the shared `now` ticker).
- **Fix sketch**: Give the queue container a `max-h-*` with internal scroll, and/or virtualize when job count exceeds a threshold.

### 9. Inconsistent type scale: `text-2xs` mixed with `text-xs` with no shared token
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:238
- **Scenario**: Every other label/badge/description in both `GenerationPanel` and `GenerationQueue` uses `text-xs`, but the Style DNA indicator alone drops to a non-standard `text-2xs` (a custom Tailwind extension smaller than `xs`).
- **Root cause**: One-off font-size choice not aligned with the rest of the panel's otherwise consistent `text-xs` typographic rhythm.
- **Impact**: The Style DNA note reads as visually subordinate/harder to notice relative to surrounding text of near-identical importance (it communicates that a hidden prompt fragment will be appended — arguably worth *more* visual weight, not less), and introduces a one-off token into an otherwise consistent component.
- **Fix sketch**: Standardize on `text-xs` (or a deliberately chosen, reused token) for this indicator to match the rest of the panel.
