# Bug Hunt — Layout Lab & Pipeline Steps
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

## 1. `runDrain` has no cancellation guard — stale verdicts clobber the wrong entity
- **Severity**: high
- **Category**: race-condition
- **File**: src/components/layout-lab/Baseline.tsx:133-143
- **Scenario**: If an operator clicks "Run deferred gates" on entity X, then selects entity Y (or a different catalog) before the drain + refetch round-trip finishes, the in-flight `runDrain` closure resolves and calls `setServerArts(Object.fromEntries(arts.map(...)))` with **X's** artifacts — overwriting the `serverArts` state that the canvas is now rendering for **Y**.
- **Root cause**: The hydrate effect at line 111 carefully guards against exactly this with a `cancelled` flag and an `entity?.id` dependency, but `runDrain` is an ad-hoc async handler that captures `catalogId`/`entity` by closure and writes `serverArts` unconditionally in its `finally`-adjacent path. There is no per-request token, no "is this still the selected entity?" check, and no `cancelled` flag. The design assumes the user stands still during a multi-second live-UE drain.
- **Impact**: corruption — Y's pipeline timeline and rollup show X's pass/fail/tier verdicts (the `serverArts` overlay in `deriveEntityArtifacts` line 60 promotes them), so an operator can read a green gate for an entity that never ran it, or a red one for a passing entity. UX degradation + false acceptance signal.
- **Fix sketch**: Mirror the hydrate effect: capture a request id (or the `entity.id` at dispatch) and discard the result if `entity.id` changed before resolution. Better, route drain through the same effect-scoped `cancelled`/AbortController machinery so every `setServerArts` write is gated by "still the active entity" by construction, making whole-class stale-write impossible.

## 2. Add-only hydration + localStorage persistence permanently strands stale step data
- **Severity**: high
- **Category**: data-loss
- **File**: src/components/layout-lab/labPipelineStore.ts:73-83
- **Scenario**: If a step was produced locally (persisted into `localStorage` under `pof-lab-pipeline`) and the server's authoritative artifact for that step later changes — the drain/runner rewrites status/data, or the same entity is edited from another browser/session — then on the next load `hydrateEntity` runs `if (!merged[step]) { merged[step] = artifact }` and **silently drops the server copy** because a local entry already exists.
- **Root cause**: `hydrateEntity` is documented as "add-only: never overwrites/clears local steps", which is the correct guard against wiping un-synced local produces, but it conflates "the user has unsynced local work" with "the local copy is fresher than the server's". There is no timestamp/version comparison (`LabStepArtifact.at` and `PipelineArtifact.updatedAt` both exist and are ignored). Because the local store is `persist`-backed in `localStorage`, a stale artifact survives reloads forever — there is no recovery path short of the user hitting "Reset".
- **Impact**: data loss / corruption — the lab shows pass/fail, tier, and produced `data` that the server has since superseded; acceptance is "derived from truth" but the truth it derives from is a stale cached lie. Two sessions on the same entity silently diverge with no warning.
- **Fix sketch**: Make hydration a last-writer-wins (or server-wins-on-tie) merge keyed on `updatedAt`/`at`: overwrite a local step only when the incoming artifact is newer, and keep purely-local (never-synced) steps. This makes "stale local shadows fresh server" structurally impossible while still preserving offline produces.

## 3. Write-through `postArtifact` is fire-and-forget success theater
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/components/layout-lab/labPipelineStore.ts:51 / Baseline.tsx:99-107 / labArtifactClient.ts:27-33
- **Scenario**: If the server rejects a produce POST — `artifactUpsertSchema` validation failure (400), a 500, or the dev server being offline — the failure is swallowed: `postArtifact` awaits `tryApiFetch` (which converts every error to a non-throwing `Result`), returns `void`, ignores `r.ok`, and `_labSync` calls it with `void`. `CliProduce` has already rendered "✓ Dispatched · written to the UE project + DB."
- **Root cause**: The persistence sink was deliberately made non-throwing ("server may be offline"), but it provides **no** feedback channel back to the store or UI for the case where the local write succeeded yet the server write did not. The local artifact is marked `done: true` regardless, and the success copy explicitly claims a DB write that may never have happened. There is no retry, no dirty/unsynced flag, no error surface.
- **Impact**: UX degradation + silent divergence — the user trusts the "written to the UE project + DB" confirmation; on the next session the missing-on-server step is invisible (hydration is add-only and the local copy is `done`), so the artifact silently never reaches the pipeline_artifacts table that the catalog→UE contract treats as the source of record.
- **Fix sketch**: Return the `Result` from `postArtifact`, have `_labSync` mark the step as unsynced/dirty on `!r.ok` (a `synced` flag on `LabStepArtifact`), surface a "saved locally, not synced" badge, and drive a bounded background retry. Then "success theater" is impossible because the success message is gated on an acknowledged server write.

## 4. Selected-entity fallback silently retargets Produce/Reset to a different entity
- **Severity**: medium
- **Category**: state-corruption
- **File**: src/components/layout-lab/Baseline.tsx:70
- **Scenario**: If `entityId` no longer resolves to a real entity in the current catalog — the selected draft is discarded via the `×` button in `CatalogTree` (`removeDraft`), or a persisted `lastEntityId` / one-shot `pendingNavigation` points at an id that isn't in `entitiesByCatalog` yet — then `entity = entities.find(e => e.id === entityId) ?? entities[0] ?? null` silently resolves to `entities[0]`, while the `entityId` state still holds the dead id.
- **Root cause**: The fallback (`?? entities[0]`) exists to avoid a null canvas, but it changes *which entity the user is operating on* without updating `entityId` or telling the user. Every downstream action keys off the resolved `entity.id`, not the stale `entityId`: `populateItemDemo(entity, produce)`, `resetEntity(entity.id)`, the bespoke step `produce(entity.id, …)`, and the write-through POST all now target `entities[0]`. The header/tree and the action target disagree.
- **Impact**: corruption / data loss — clicking "Reset" wipes `entities[0]`'s pipeline (not the entity the user thought was selected), and "Populate demo" / a Produce overwrites the first entity's artifacts. The tree highlights nothing (or the old row), so the misdirected write is easy to miss.
- **Fix sketch**: Treat an unresolvable `entityId` as "no selection": render the empty/select-an-entity state instead of silently substituting `entities[0]`, and reconcile state (`onSelectEntity(null)` / clear the stale persisted id) when the referenced entity disappears, so an action can never fire against an entity the user didn't explicitly select.
