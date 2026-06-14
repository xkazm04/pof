# Audio Generation & Scenes — zen-perf scan
> Context: Audio & Blender Pipeline / Audio Generation & Scenes
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. `GET /api/audio-gen` issues an N+1 query for every set on every library open/refresh
- **Severity**: high
- **Lens**: performance
- **Category**: db-n+1
- **File**: src/app/api/audio-gen/route.ts:118-122
- **Scenario**: Every time the Library tab mounts, the user hits Refresh, or an import/delete/favorite toggle triggers `refresh()` (AudioLibraryPanel.tsx:48,55,93,98,112), the GET handler runs `listSets(db())` (one `SELECT * FROM audio_sets`) and then `sets.flatMap((s) => listAssets(db(), s.id))` — one additional `SELECT * FROM audio_assets WHERE setId = ?` per set. With 40 sets that is 41 prepared-statement round trips to fetch data that one indexed query returns.
- **Root cause**: The route fetches assets set-by-set instead of selecting all assets once. `idx_audio_assets_setId` already exists (audio-asset-db.ts:42) but the grouping is done by issuing N queries rather than one `ORDER BY setId, createdAt`.
- **Impact**: O(sets) synchronous better-sqlite3 calls block the request thread; latency and CPU scale linearly with library size for a payload the client immediately re-groups anyway (AudioLibraryPanel groups by `asset.setId` in `groups`, lines 62-73). `db()` is re-invoked per call too (cheap, but multiplies the noise).
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Add `listAllAssets(db)` → `SELECT * FROM audio_assets ORDER BY createdAt ASC` (rows already carry `setId`), map through `rowToAsset`, and replace the `flatMap` with that single call. Hoist `db()` into a local `const d = db()` to avoid repeated calls in GET/POST.

## 2. `ctx` object is rebuilt every render, defeating the generation `useCallback`s
- **Severity**: medium
- **Lens**: performance
- **Category**: referential-stability
- **File**: src/components/modules/content/audio/AudioView.tsx:68
- **Scenario**: `const ctx = { projectName, projectPath, ueVersion };` creates a fresh object literal on every render of AudioView. It is a dependency of `handleGenerateAll` (line 248), `handleGenerateZoneCode` (line 254) and `handleGenerateSoundscape` (line 259), so all three `useCallback`s are recreated on every render even though the underlying primitives are unchanged. Those callbacks are passed down to `ZonePropertyPanel` and the soundscape buttons, so memoization there is lost too.
- **Root cause**: A derived object is constructed inline instead of being memoized from its primitive parts.
- **Impact**: Continuous canvas interaction in the Painter (drag/draw updates `activeDoc` via `updateDoc`, re-rendering AudioView on every mouse move) churns these callbacks each frame, breaking any downstream memo and adding GC pressure during the hottest interaction path. Low correctness risk but real per-frame waste.
- **Effort**: 1 · **Value**: 5
- **Fix sketch**: `const ctx = useMemo(() => ({ projectName, projectPath, ueVersion }), [projectName, projectPath, ueVersion]);` then keep `ctx` (not its fields) in the callback deps.

## 3. Painter rebuilds `minimap` (and recomputes content bounds) on every pan frame
- **Severity**: medium
- **Lens**: performance
- **Category**: memoization
- **File**: src/components/modules/content/audio/AudioScenePainter.tsx:343-347
- **Scenario**: The `minimap` `useMemo` depends on the whole `view` object (`[zones, emitters, view, size.width, size.height]`). Panning updates `view.panX/panY` on every `mousemove` (handleMouseMove, lines 184-191), so each pan frame re-runs `viewportRectInContent`, `contentBounds(zones, emitters)` (an O(zones+emitters) bounds scan), `unionBounds`, and `minimapProjection`, then re-renders every minimap `<rect>`/`<circle>`. The minimap projection only needs to change when the *world bounds* change, not on pure translation.
- **Root cause**: Memo keyed on the entire mutable `view` rather than the values that actually affect projection (zoom + content extent); panning never changes the union bounds when content already dominates, yet the memo recomputes regardless.
- **Impact**: On large scenes, every pan frame does full content-bounds + projection work and re-renders N minimap nodes — visible jank during drag-pan, the single most common painter gesture. (Note: `contentBounds` is also called independently in `fitToContent`, line 310, which is fine — it's the per-frame path that hurts.)
- **Effort**: 5 · **Value**: 5
- **Fix sketch**: Split the memo: memoize `contentBounds(zones, emitters)` on `[zones, emitters]`, derive `vpRect` cheaply, and only recompute the projection when zoom or the union extent changes. Alternatively throttle minimap projection to animation frames during active pan.

## 4. Module-review CLI plumbing (Feature Matrix / Roadmap / Fix) is duplicated verbatim across module views
- **Severity**: high
- **Lens**: architecture
- **Category**: duplication / SRP
- **File**: src/components/modules/content/audio/AudioView.tsx:110-210
- **Scenario**: Roughly 100 lines of AudioView are the generic "review/checklist" harness — `rvToast`/`rvRefetch` state, the toast auto-dismiss effect, `handleRvItemCompleted`, four `useModuleCLI`/`useChecklistCLI` sessions, `handleRvReviewComplete`, `handleRvFix`, `handleRvSync`, `startRvReview`. None of it is audio-specific; it only varies by `moduleId` and label. Project memory notes 30+ module views, and this block is copy-pasted into each, so a fix to the import/sync flow must be edited in every module.
- **Root cause**: A cross-cutting "module feature-review" concern lives inline in each feature view instead of behind a single hook/component.
- **Impact**: ~100 lines of dead-weight per module view (here mixed into a 776-line component), high drift risk (the `feature-matrix/import` POST body and toast wiring must stay identical everywhere), and AudioView's actual audio responsibilities are buried. Pure maintainability cost, no behavior change.
- **Effort**: 6 · **Value**: 6
- **Fix sketch**: Extract a `useModuleFeatureReview(moduleId, label, accentColor)` hook returning `{ toast, refetchKey, reviewCli, fixCli, syncCli, checklistCli, startReview, handleFix, handleSync, lastCompletedId }`, plus a small `<ModuleFeatureReviewToast/>`. AudioView then renders Overview/Roadmap from the hook in a handful of lines; reuse across the other module views.

## 5. `spatial-audio-generator` uses module-level mutable ID counters — non-reentrant and ID-collision prone
- **Severity**: low
- **Lens**: architecture
- **Category**: shared-mutable-state
- **File**: src/lib/spatial-audio-generator.ts:302-311
- **Scenario**: `emitterIdCounter` and `zoneIdCounter` are module-level `let`s reset at the top of each `generateSpatialAudio` call (lines 324-326). On a server (the spatial-audio-generate route runs this in a Next.js API handler, route.ts:34) the module is a shared singleton; two concurrent generations interleave on the same counters, and the reset in one call corrupts the other. IDs combine the counter with `Date.now().toString(36)`, so two emitters created within the same millisecond in one run can also collide if the counter were ever not incremented.
- **Root cause**: Generation state (`nextId`) is kept in module scope instead of local to the call, making a pure transform stateful and non-reentrant.
- **Impact**: Rare but real duplicate/за-overwritten zone/emitter IDs under concurrent generation; the generated scene merges (`spatial-audio-generate/route.ts:46-52` spreads zones/emitters into an existing doc) would then key two distinct items to one id, breaking selection/drag in the painter. Low likelihood (single-user desktop tool) keeps severity down.
- **Effort**: 2 · **Value**: 3
- **Fix sketch**: Move the counters into `generateSpatialAudio` as locals and pass an `idgen` closure (or `let z = 0; const genZoneId = () => \`zone-auto-${++z}-${randomUUID().slice(0,8)}\``) to `getDefaultEmitterForType`/pacing blocks. Drops the module-level `let`s and the reset entirely.
