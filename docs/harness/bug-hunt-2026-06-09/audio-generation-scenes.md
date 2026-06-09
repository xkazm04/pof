# Bug Hunt — Audio Generation & Scenes
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. Path-traversal guard uses prefix match without a separator — arbitrary file read
- **Severity**: critical
- **Category**: logic-error
- **File**: src/app/api/audio-asset/route.ts:11-16
- **Scenario**: An unauthenticated caller hits `GET /api/audio-asset?relPath=../audio-secrets/key.mp3` (or `..%2F..%2F.pof%2Fpof.db`). `relPath` is taken verbatim from the query string and never sanitized for `..`.
- **Root cause**: The containment check is `normalize(join(AUDIO_DIR, relPath)).startsWith(normalize(AUDIO_DIR))`. There is no trailing path separator on the prefix and no rejection of `..` segments. Any sibling directory whose name *starts with* the basename `audio` (e.g. `~/.pof/audio-secrets`, `~/.pof/audiobackup`) passes the `startsWith` test, and `..` segments let the resolved path climb out of `AUDIO_DIR` entirely. `startsWith` on a non-separator-terminated prefix is the canonical traversal bypass. The endpoint then `readFileSync`s the resolved path and streams the bytes back, so the file content is exfiltrated.
- **Impact**: security — arbitrary file read of any file the server process can reach via a path that prefix-matches `AUDIO_DIR` or escapes it with `..`; reads of adjacent app data (SQLite DB, secrets) are plausible.
- **Fix sketch**: Make traversal structurally impossible: resolve the candidate, then require `rel = path.relative(AUDIO_DIR, abs)` to be non-empty, not start with `..`, and not be absolute (`!rel.startsWith('..') && !path.isAbsolute(rel)`). Equivalently compare against `AUDIO_DIR + path.sep`. Also reject any `relPath` containing `..` up front. Centralize this in one `resolveInsideAudioDir()` helper used by every filesystem read.

## 2. Scene edits do read-modify-write off stale server state with no optimistic merge — lost updates
- **Severity**: high
- **Category**: race-condition
- **File**: src/hooks/useAudioScene.ts:67-74 (with src/hooks/useCRUD.ts:75-84 and src/components/modules/content/audio/AudioView.tsx:222-269)
- **Scenario**: User drags a zone in the painter (fires `handleUpdateZones` → `updateDoc({ id, zones })` on every mousemove). A `PUT` for an early drag frame is still in flight when `mutate` finishes a later frame and calls `refetch()`. The refetch resolves with a server snapshot several frames behind the cursor and overwrites `data.docs`, so `activeDoc.zones` (which the painter renders from via `zones={activeDoc.zones}`) snaps backward mid-drag. Worse cross-field case: while a `{zones}` PUT is in flight, the user edits a soundscape on the Soundscapes tab; that handler builds its payload from the *stale* `activeDoc.zones`, so the in-flight zone positions are clobbered on save.
- **Root cause**: `useCRUD.mutate` is not optimistic — it `await apiFetch(PUT)` then `await refetch()` and renders purely from refetched server state. Every editing handler in `AudioView` derives its next array from `activeDoc`, which lags reality until the refetch lands. Firing one PUT-plus-full-refetch per mousemove turns continuous editing into a stream of racing read-modify-write cycles over the *entire* `zones`/`emitters` arrays with no debounce, no version/ETag, and no field-level merge.
- **Impact**: data loss (dropped emitter/zone edits, position snap-back) and UX degradation (jitter, request storm) during normal painter use.
- **Fix sketch**: Apply the edit to local state optimistically and reconcile, rather than rendering from refetch; debounce/throttle persistence of drag and commit only on mouse-up; and make the write conflict-safe (per-field PATCH or an `updated_at`/version check so a stale array can't overwrite a newer one). This removes the whole class by ensuring the array being written is always derived from the freshest local value.

## 3. Generation cache hit ignores the requested set — asset filed under the wrong/old set, requested set never created
- **Severity**: high
- **Category**: data-loss
- **File**: src/app/api/audio-gen/route.ts:79-87
- **Scenario**: A user previously generated "sword clang" into set "Combat A". Later they request the identical prompt targeting a brand-new `setName: "Boss B"` (or a different existing `setId`). The hash matches the old asset, so the route returns `{ asset: cached, set: cachedSet }` — the *original* "Combat A" set — and returns before reaching the `upsertSet` block. "Boss B" is never created and the asset never appears under it.
- **Root cause**: `computePromptHash` keys only on `provider+kind+duration+prompt`; the cache lookup `findAssetByPromptHash` is global and `setId`/`setName` are never part of the key or the hit path. The design assumes "identical prompt ⇒ identical desired placement," but placement (which set/event/surface the asset belongs to) is an independent dimension the user explicitly chose. The early `return` on a hit silently discards the requested target set.
- **Impact**: data loss / corruption — the user's requested set is silently not created/populated; the UI shows the asset living under an unrelated set, and the usage meter logs a "saved" call for work the user actually wanted done.
- **Fix sketch**: Make the cache reuse only the generated *bytes/file*, not the set placement: on a hash hit, still resolve/create the requested set and insert a new `audio_assets` row (or hardlink/copy the file) pointing at the requested `setId`, reusing `promptHash`+`durationMs`. Alternatively scope the cache key to `setId`. Either way, the requested set must always be honored regardless of cache state.

## 4. Re-running spatial-audio "merge" appends duplicate zones/emitters forever and never stamps lastGeneratedAt
- **Severity**: medium
- **Category**: state-corruption
- **File**: src/app/api/spatial-audio-generate/route.ts:41-54 (with src/lib/spatial-audio-generator.ts:324-326)
- **Scenario**: A user runs "generate spatial audio" against an existing audio scene, tweaks the level, and runs it again into the same scene. Each run does `zones: [...existing.zones, ...result.zones]` / `emitters: [...existing.emitters, ...result.emitters]`.
- **Root cause**: `generateSpatialAudio` resets its module-level `zoneIdCounter`/`emitterIdCounter` to 0 every call and mints IDs as `zone-auto-<n>-<Date.now() base36>`. Because the timestamp suffix differs between runs, the "same" room produces a *new* ID each time, so the merge has no key to dedupe on and stacks a fresh copy of every zone/emitter at identical coordinates on top of the previous run. The merge path also omits `lastGeneratedAt` from the `updateAudioScene` payload, so the scene's "Last generated" timestamp never updates on a merge. There is no upper bound, so repeated regeneration bloats the JSON blob and the painter unboundedly.
- **Impact**: corruption / UX degradation — duplicated overlapping zones and emitters, ballooning scene documents, double-triggered audio in generated UE code, and a stale "last generated" indicator.
- **Fix sketch**: Make regeneration idempotent: derive stable per-room IDs (e.g. `zone-auto-${room.id}`) and upsert by matching room/zone identity instead of blind concatenation, or clear previously auto-generated (`*-auto-*`) entries before re-applying. Include `lastGeneratedAt` in the merge update so the timestamp reflects every run.
