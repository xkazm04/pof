# Bug Hunt — Level & Materials Authoring
> Total: 4
> Severity: 0 critical, 1 high, 3 medium, 0 low

Audit scope: the `level-materials-authoring` context — UE5 material configurator, layer graph, PBR/texture lab, post-process recipe studio (effects + GPU estimator + store), level-design spatial planning, and the material/style-transfer/post-process API surface. Findings below are the 4 highest-severity *real* bugs; each was traced through its data and control flow.

---

## 1. Dropping a new reference image keeps the previous image's parameter overrides
- **Severity**: high
- **Category**: state-corruption
- **File**: src/components/modules/content/materials/MaterialStyleTransfer.tsx:141-152
- **Scenario**: A user uploads screenshot A, runs Analyze, then opens "Refine Parameters" and overrides Roughness/Metallic/Emissive/Surface. They then **drag-and-drop** screenshot B onto the drop zone instead of using the file picker or the clear (X) button.
- **Root cause**: `handleFileSelect` (line 130-136) and `handleClearImage` (line 154-162) both reset all four `override*` states when a new/cleared image arrives. `handleDrop` (line 147-149) resets only `imageDataUrl` and `analysis` — it forgets `setOverrideRoughness/Metallic/Emissive/Surface(null)`. The drop path is a divergent copy of the upload path that drifted out of sync. Because `effectiveAnalysis` (line 112-121) is `analysis` merged with whatever the override values currently are, image B's fresh analysis gets silently overwritten by image A's leftover overrides.
- **Impact**: corruption / silent wrong output — the generated UE5 material (and the displayed analysis preview) uses parameters the user never chose for this image, with no visible "modified" indicator on the new analysis. The mismatch is invisible until the material renders wrong in-engine. (Secondary: `handleDrop` also skips the 10MB size guard that `handleFileSelect` enforces.)
- **Fix sketch**: Make image-replacement state-resetting a single shared function (e.g. `resetForNewImage()`) called by upload, drop, and re-pick, so the override-clearing can never diverge between entry points. Treat overrides as derived-from-analysis: clear them automatically whenever `analysis` is set to a new value (e.g. in a `useEffect` keyed on the analysis identity) rather than per-handler.

## 2. Uploaded texture blob URLs are never revoked (memory leak on every upload/clear/replace/reset)
- **Severity**: medium
- **Category**: resource-leak
- **File**: src/components/modules/visual-gen/material-lab/PBREditor.tsx:73-79
- **Scenario**: A user iterates on a PBR material, uploading and re-uploading albedo/normal/metallic/roughness/AO maps, clicking the (X) to clear slots, or hitting reset — repeatedly, as is normal during material authoring.
- **Root cause**: `handleUpload` calls `URL.createObjectURL(file)` and stores the blob URL via `setTexture(channel, url)`. There is no matching `URL.revokeObjectURL` anywhere: `setTexture` in the store (useMaterialStore.ts:104-113) just overwrites the slot, `setTexture(channel, null)` (PBREditor.tsx:101) nulls it, and `reset()` (useMaterialStore.ts:139-149) clears all five slots — none revoke the old URL. The design assumes the browser reclaims blob URLs automatically; it does not — a blob URL pins its `Blob` in memory until `revokeObjectURL` is called or the document is destroyed.
- **Impact**: UX degradation — steady memory growth proportional to (number of texture uploads × image size) for the whole session. Heavy 4K source textures × dozens of iterations can balloon to hundreds of MB and degrade/crash the tab. Leaked objects are unreachable but un-reclaimed.
- **Fix sketch**: Centralize blob-URL ownership in the store: have `setTexture` revoke the previous URL for that channel before replacing it, and have `reset()` revoke all current URLs. Track which URLs the store created (vs. external http(s) URLs) so only owned blob URLs are revoked. Belt-and-suspenders: revoke remaining URLs on unmount.

## 3. Failed reference analysis fails silently — stuck spinner, no error shown
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/components/modules/content/materials/MaterialStyleTransfer.tsx:164-188
- **Scenario**: The `/api/style-transfer` request returns a non-OK envelope (`{ success: false }` from a 400/500), or the network throws (offline, aborted, server restart) while the user waits on "Analyzing visual properties…".
- **Root cause**: `handleAnalyze` only acts on the happy path: `if (json.success) { setAnalysis(...) }` with no `else`, so a `success:false` response is dropped on the floor; and the `catch {}` block is an explicit "Silently fail — user can retry" with no user-facing state. There is no `error` state in this component at all (unlike `BiomeScatterPanel`/`PostProcessStackBuilder`, which surface `fetchError`/`generateError` inline). The assumption that "the user can just retry" ignores that they get no signal that anything failed — the spinner clears in `finally` and the UI returns to its idle state as if nothing happened.
- **Impact**: UX degradation — the user perceives a no-op ("I clicked Analyze and nothing happened"), retries into the same failure, and has no idea whether the server is down, the image is rejected, or the description was empty. Classic success-theater on the failure branch.
- **Fix sketch**: Add an `analyzeError` state; set it both when `!json.success` (using `json.error`) and in the `catch`. Render it in an inline `role="alert"` block mirroring the sibling panels. Make the dropped-error path impossible by funneling all calls through `tryApiFetch`/`Result` so a non-ok response is a typed branch the caller must handle rather than an ignorable boolean.

## 4. Difficulty distribution miscounts (NaN/dropped buckets) on malformed persisted room data
- **Severity**: medium
- **Category**: edge-case
- **File**: src/lib/level-design-db.ts:134-137
- **Scenario**: A level-design doc is saved with rooms whose `difficulty` is a non-integer or a numeric string — e.g. `2.5`, or `"3"` — which is entirely possible because `rooms` is an unvalidated JSON blob written verbatim by `updateDoc` (line 99-107) and read back via `JSON.parse` (line 47) with no schema enforcement.
- **Root cause**: `if (room.difficulty >= 1 && room.difficulty <= 5) diffDist[room.difficulty]++;` guards only the numeric *range*, not integer membership. `diffDist` has keys `1..5` only. `diffDist[2.5]` is `undefined`, so `undefined++` writes `NaN` into the (newly created) `2.5` bucket; a stringy `"3"` passes the coercing comparison but indexes `diffDist["3"]` (a different key from numeric `3`), splitting/misattributing the count. The neighboring `room.type` check is correctly guarded with `room.type in typeDist`; the difficulty check was not given the same membership guard.
- **Impact**: corruption — the `difficultyDistribution` summary returned to the UI contains `NaN` or under/over-counted buckets, poisoning any chart or balance heuristic that consumes it, with no error raised. A single bad room silently corrupts the aggregate for the whole project.
- **Fix sketch**: Validate at the trust boundary: coerce and floor on read (`const d = Math.trunc(Number(room.difficulty))`) and bucket only when `Number.isInteger(d) && d >= 1 && d <= 5`. Better, validate/normalize `rooms` against a schema in `updateDoc`/`rowToDoc` so the aggregation can trust its inputs and this class of "garbage in the JSON column" bug becomes structurally impossible.
