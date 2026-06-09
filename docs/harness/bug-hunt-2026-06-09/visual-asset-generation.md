# Bug Hunt — Visual Asset Generation
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

## 1. Non-MCP generation jobs are queued but never executed (permanent "pending" success theater)
- **Severity**: high
- **Category**: silent-failure
- **File**: src/components/modules/visual-gen/asset-forge/useForgeStore.ts:61 (and GenerationPanel.tsx:74)
- **Scenario**: A user selects a "free" local provider (TripoSR or TRELLIS.2 — both `status: 'free'`, both selectable in the provider grid), types a prompt, and clicks "Generate 3D Model". `handleSubmit` calls `addJob(...)`, which inserts a job with `status: 'pending'`, `progress: 0`. Nothing else happens.
- **Root cause**: The store only ever advances a job's state inside `submitMcpJob` (the only place `updateJob` is called). For non-MCP providers `handleSubmit` calls the plain `addJob`, but there is no client-side worker, no `useEffect` driver, and no call to the placeholder `/api/visual-gen/generate` route anywhere in the codebase (grep confirms the route is unreferenced outside its own file). The design assumes "a processor will pick up pending jobs," but that processor was never built — so every non-MCP submission is a dead job. The UI actively reinforces the illusion: `GenerationQueue`/`JobCard` starts a 1s `setInterval` that increments the displayed elapsed seconds forever (it only stops when `job.completedAt` is set, which never happens), so the user sees a job "running" indefinitely.
- **Impact**: UX degradation — the primary advertised feature (local 2D/3D generation) is completely non-functional with zero error feedback; jobs accumulate, each with a forever-ticking timer interval, and the user has no signal that nothing is happening.
- **Fix sketch**: Make "no executor" impossible to ship silently: either (a) route non-MCP `addJob` submissions through an actual driver that flips status to `generating`→`completed`/`failed` and sets `completedAt`, or (b) until that exists, immediately mark non-MCP jobs `failed` with an explicit "local generation not yet wired up" error so the queue can never display an eternally-pending/ticking job. Treat any terminal-less status as a programming error in a dev assertion.

## 2. Leonardo image results render a CDN URL whose generation was already deleted
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/leonardo.ts:149 (consumed at src/components/modules/visual-gen/material-lab/AdvancedTexturePanel.tsx:401,438)
- **Scenario**: A user runs ControlNet or Inpaint in the Advanced Texture panel. The client POSTs to `/api/leonardo` with `mode: 'image'` and no `opts.cleanup`. `generateImage` therefore takes the default (`cleanup !== false` → cleanup ON): it downloads the bytes via `downloadThenDelete`, **issues a DELETE for the generation**, and returns `{ imageUrl, generationId, imageBase64 }`. The route (`/api/leonardo/route.ts:33`) forwards `...result` but the component only reads `cnResult.imageUrl` / `ipResult.imageUrl` and renders `<img src={imageUrl}>`.
- **Root cause**: The "download-then-delete" protocol makes `imageUrl` a dangling reference — the only durable copy of the image is `imageBase64`, but the consumer was wired to the URL. The assumption that "the returned `imageUrl` is renderable" is false whenever `cleanup` ran (which is the default). Once Leonardo deletes the generation, its signed CDN URL is purged/expires and returns 403/404, so the image fails to load. The actually-downloaded bytes are silently thrown away by both the route and the component.
- **Impact**: UX degradation / data loss — ControlNet and Inpaint produce a broken image tile every time on the default path; the one retained copy of the asset (`imageBase64`) is discarded, so the result is unrecoverable without re-spending an API generation.
- **Fix sketch**: Make the durable artifact the one that's rendered: have the route return/persist `imageBase64` (e.g. a `data:` URL or a saved file path) and have the component bind to that, OR have callers that intend to display the result pass `cleanup: false` so the live URL survives. Encode the invariant in types — `GenerateImageResult` should not expose a bare `imageUrl` as "the renderable image" when cleanup deleted it.

## 3. Overlapping MCP status polls double-fire the Blender import
- **Severity**: medium
- **Category**: race-condition
- **File**: src/components/modules/visual-gen/asset-forge/useForgeStore.ts:152
- **Scenario**: For an MCP provider (Rodin/Hunyuan3D), `submitMcpJob` starts `setInterval(async () => {...}, 5000)`. If a status request is slow (overloaded MCP bridge, slow network) and takes longer than the 5s interval, `setInterval` fires the next tick before the previous async callback has returned — two callbacks run concurrently. Both can read `status === 'completed'` from their respective in-flight responses.
- **Root cause**: `setInterval` does not await async callbacks, and there is no re-entrancy guard / in-flight flag. `clearInterval(interval)` is idempotent, so each concurrent callback that observes "completed" proceeds past it and independently POSTs `/api/blender-mcp/generate/import`, then races on `updateJob(localId, ...)`. The design assumes one poll completes before the next begins (true only when each poll is faster than 5s).
- **Impact**: corruption — duplicate import of the same generated model into the Blender scene (duplicate objects), plus interleaved `updateJob` writes that can flip a job from `importing`→`completed`→`failed` nondeterministically.
- **Fix sketch**: Eliminate overlap structurally: replace `setInterval` with a self-scheduling `setTimeout` loop that only schedules the next poll after the current `await` resolves, or guard the callback with an `inFlight`/`finished` boolean so a terminal transition (completed/failed) can run its import + state update exactly once.

## 4. Object URLs created for reference images are never revoked
- **Severity**: medium
- **Category**: resource-leak
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:72
- **Scenario**: In image-to-3D mode, every submit does `URL.createObjectURL(imageFile)` and stores the blob URL on the job (`addJob({ imageUrl })`). The user uploads several reference images across a session, submitting each. None of these blob URLs is ever revoked — not on submit, not when the job is removed (`removeJob` only clears polling intervals), not on unmount.
- **Root cause**: `createObjectURL` allocates a blob entry that the browser keeps alive until `revokeObjectURL` is called or the document is discarded; the code treats the blob URL as a fire-and-forget string and never pairs it with a revoke. Because non-MCP image jobs also never terminate (finding #1), the references pin the underlying File blobs for the lifetime of the tab.
- **Impact**: resource-leak — accumulating blob/File memory (reference images can be multi-MB each) across a long authoring session; over many submissions this grows unbounded and degrades the tab.
- **Fix sketch**: Tie each object URL's lifetime to its job: revoke in `removeJob`/`clearCompleted` when discarding a job that owns a blob URL, and revoke-and-replace whenever a new file is chosen. Centralize creation so every `createObjectURL` has a guaranteed matching `revokeObjectURL`.
