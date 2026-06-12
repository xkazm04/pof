# Visual Asset Generation — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

*Scope note: `src/components/modules/visual-gen/asset-browser/index.ts` listed in the scope file does not exist; the asset browser lives as individual files (`AssetBrowserView.tsx`, `BrowsePanel.tsx`, `AssetCard.tsx`, …), which were audited as the intended scope.*

## Bug findings (new since 2026-06-09)

## 1. Single transient status-poll failure permanently fails an in-flight MCP job and orphans the remote generation
- **Severity**: High
- **Lens**: bug
- **Category**: recovery-gap
- **File**: `src/components/modules/visual-gen/asset-forge/useForgeStore.ts:157`
- **Scenario**: User submits a Rodin/Hunyuan3D job (multi-minute remote generation). Mid-poll, one status fetch fails transiently — dev-server restart, Wi-Fi blip, a single 502 from the bridge. `tryApiFetch` returns `ok: false` for *any* thrown fetch or non-success payload, and the very first non-ok poll runs `clearInterval` and marks the job `failed`.
- **Root cause**: The poll loop treats every transport-level error as a terminal job failure — zero retry tolerance, and no distinction between "network hiccup" and "remote job actually failed". Bonus defect on the same path: unlike the other terminal transitions, this one never sets `completedAt`, so `JobCard`'s 1s elapsed timer keeps ticking forever on a card labeled "Failed". (Distinct from the 2026-06-09 #3 overlapping-poll race — this is fragility of a single poll, not overlap.)
- **Impact**: Lost generation — the remote provider finishes the model but it is never imported into Blender; the user re-spends API credits to regenerate; the failed card shows a running timer (logging lies).
- **Fix sketch**: Keep a consecutive-failure counter and only fail the job after N (e.g. 3) misses; treat only explicit remote `failed`/job-not-found as terminal; set `completedAt: Date.now()` on every terminal transition.

## 2. Cancelling a pending MCP job during submission spawns an unregistered poller that can import the cancelled model
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/visual-gen/asset-forge/useForgeStore.ts:219`
- **Scenario**: User submits an MCP job, the card appears as "Pending", and they click the X remove button while the initial `POST /api/blender-mcp/generate` (line 128) is still in flight. `removeJob` looks up `pollingIntervals` — empty, since the interval is only registered at line 219 *after* the await — and just deletes the job. `submitMcpJob` then resumes: `updateJob` on the deleted id silently no-ops, the `setInterval` is created anyway, and when the remote job completes the callback auto-POSTs `/api/blender-mcp/generate/import`.
- **Root cause**: Interval registration happens after an await, so `removeJob`'s "clear the interval" cleanup assumes a map that isn't yet populated; nothing downstream re-checks that the local job still exists before acting on its behalf.
- **Impact**: A model the user explicitly cancelled gets imported into their Blender scene anyway; ghost polling continues against the bridge until a terminal status; `pollingIntervals` holds an entry keyed to a dead job in the meantime.
- **Fix sketch**: After each `await` in `submitMcpJob` (and at the top of the poll callback), bail out if `!get().jobs.some(j => j.id === localId)`; alternatively have `removeJob` record cancelled ids in a Set the poller consults before importing.

## 3. Generated UE5 skeletal-mesh import script writes scale/LOD to StaticMeshImportData — user's scale silently ignored
- **Severity**: Medium
- **Lens**: bug
- **Category**: wrong-output
- **File**: `src/lib/visual-gen/ue5-import-templates.ts:67`
- **Scenario**: User configures `meshType: 'skeletal'`, `format: 'fbx'`, `scale: 0.5` in Import Automation. The emitted C++ sets `bImportAsSkeletal = true` but then assigns `Factory->ImportUI->StaticMeshImportData->ImportUniformScale = 0.5f` (and `StaticMeshImportData->bAutoComputeLodDistances` when `lodCount > 0`). UE5's skeletal FBX import reads `SkeletalMeshImportData`, not `StaticMeshImportData`.
- **Root cause**: The template hardcodes the static-mesh import-data branch for all mesh types. Tellingly, `meshClass`/`factoryClass` computed at lines 26-27 are never used in the template string, and `lodCount`'s actual value is never emitted (any non-zero count produces identical code) — the skeletal branch was never specialized.
- **Impact**: The generated code compiles cleanly in UE5 (both members exist on `UFbxImportUI`), so the skeletal mesh imports at scale 1.0 regardless of the configured factor — a silent wrong-result in the exact tooling meant to prevent manual import mistakes.
- **Fix sketch**: Branch the import-data target on `meshType` (`SkeletalMeshImportData->ImportUniformScale` for skeletal), omit static-only flags (`bAutoGenerateCollision`, LOD distance) for skeletal meshes, and emit `lodCount` into the script or drop the option.

## 4. Uncommitted transparency drift-fix breaks its own unit test (verified red)
- **Severity**: Low
- **Lens**: bug
- **Category**: regression
- **File**: `src/lib/leonardo.ts:116` (assertion at `src/__tests__/leonardo/leonardo-client.test.ts:105`)
- **Scenario**: New bug introduced by the recent uncommitted fix. Ran `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts`: 1 failed / 16 passed — the working-tree code now sends `transparency: 'foreground_only'` (correct per Leonardo's TransparencyType) but the exact `toEqual` body assertion still expects `'foreground'`.
- **Root cause**: The API-drift remap (`'foreground'` → `'foreground_only'`) changed the wire format without updating the test that pins the request body exactly.
- **Impact**: Test suite is red in the working tree; CI will block the commit, and the most likely "quick fix" (reverting the mapping) would reintroduce the 400-on-transparency API drift the change was made to fix.
- **Fix sketch**: Update the expectation to `transparency: 'foreground_only'` and add a dedicated case asserting the alias mapping (`'foreground'` in → `'foreground_only'` on the wire; `'foreground_only'` passes through).

## 5. Cleanup fetch in generateTextureOn3DModel's finally block can mask the real error
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/leonardo.ts:340`
- **Scenario**: Every `texture3d` call currently throws the informative "POST /generations-texture returned 404 … not available" error from the try block (per the file's own live-verified note). If the cleanup `DELETE /models-3d/{id}` in the `finally` then *rejects* (network drop, DNS failure — distinct from a non-ok response, which is handled), the unguarded `await fetch` throws from `finally`, superseding the pending exception.
- **Root cause**: A throw inside `finally` replaces both the in-flight exception and any return value; the cleanup call handles non-ok statuses but not fetch rejection, unlike `deleteGeneration` which is reached only via guarded paths.
- **Impact**: The caller (and `/api/leonardo` route, which surfaces `error.message` to the client) sees a bare "fetch failed" instead of the actionable endpoint-unavailable message; in a future where the try succeeds, a successful result would be silently destroyed by a flaky cleanup.
- **Fix sketch**: Wrap the finally-block cleanup in `try { … } catch (e) { logger.warn(…) }` so cleanup failures are logged but never propagate.

## UI findings

## 6. Reference-image upload is unreachable by keyboard (display:none file input)
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:187`
- **Scenario**: In Image-to-3D mode the upload zone is a `<label>` wrapping an `<input type="file" className="hidden">`. `hidden` is `display: none`, which removes the input from the tab order, and the label itself is not focusable — a keyboard-only user can Tab straight past the upload zone and can never select a reference image, making the entire Image-to-3D flow mouse-only.
- **Root cause**: The common "pretty label + hidden input" pattern was implemented with `display:none` instead of a visually-hidden-but-focusable input (`sr-only`/clip pattern), so focus and Enter/Space activation are lost.
- **Impact**: A whole generation mode is unusable without a pointer; also invisible to the focus order for screen-reader users.
- **Fix sketch**: Replace `className="hidden"` with `className="sr-only"` so the input stays focusable, and add `focus-within` styling on the label (e.g. reuse `VISUAL_GEN_FOCUS_RING` semantics) so keyboard focus on the drop zone is visible.

## 7. Asset-forge controls skip the cluster's standardized focus ring and aria-pressed treatment
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:106`
- **Scenario**: `src/lib/visual-gen/ui.ts` exists precisely to standardize keyboard focus in this cluster, and the sibling asset browser applies `VISUAL_GEN_FOCUS_RING` + `aria-pressed` everywhere (BrowsePanel sources/categories, AssetCard buttons). In the forge, the mode selector (lines 106-127), provider grid (137-147), queue remove button (`GenerationQueue.tsx:82`, icon-only with `title` but no `aria-label`), and PromptBuilder chips (which have `aria-pressed` but no ring) all rely on the browser-default outline removal — tabbing through them shows no focus indicator, and AT users get no selected-state announcement for mode/provider.
- **Root cause**: The forge components predate (or missed) the shared `VISUAL_GEN_FOCUS_RING` rollout; selected state is conveyed by border color only.
- **Impact**: Inconsistent keyboard experience between two halves of the same module; screen readers cannot tell which mode/provider is active; color-only selection fails low-vision users.
- **Fix sketch**: Append `VISUAL_GEN_FOCUS_RING` to mode/provider/chip/remove buttons; add `aria-pressed={mode === '…'}` to the mode toggle, `aria-pressed` on provider cells, and `aria-label="Remove job"` on the queue X button.

## 8. Browse search failures are silent — stale results masquerade as fresh, and zero-hit searches show the wrong copy
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/visual-gen/asset-browser/BrowsePanel.tsx:53`
- **Scenario**: User searches "wood", gets results, then searches "marble" while Poly Haven is down (or the route returns `success: false`). The catch block is literally `// Silent fail`, and the non-success branch does nothing — the spinner stops and the old "wood" grid remains, presented as the answer to "marble". Separately, a *successful* search with zero hits falls into the empty state whose copy is "Click Search to browse free CC0 assets." — telling the user to do what they just did.
- **Root cause**: No error state in the store/panel, and a single empty-state string conflates "never searched" with "no results" with "search failed".
- **Impact**: Users act on stale data or assume assets don't exist; failures are indistinguishable from no-ops, so they retry blindly.
- **Fix sketch**: Track `error: string | null` and `hasSearched` in the browser store; render an error banner with a Retry button on failure, and "No results for "{query}"" after an empty successful search.

## 9. Disabled Generate button never says why
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:224`
- **Scenario**: The submit button dims to 40% opacity when `canSubmit` is false, but gives no reason: empty subject in text mode, no reference image in image mode, or Blender disconnected (the `BlenderConnectionBar` covers the last case only when an MCP provider is selected). A user who filled chips but no subject sees a composed prompt preview yet a dead button.
- **Root cause**: `canSubmit` collapses four distinct preconditions into one boolean with no surfaced message.
- **Impact**: Trial-and-error friction on the module's primary CTA; especially confusing in image mode where the missing requirement (the image) is above the fold but not flagged.
- **Fix sketch**: Derive a `disabledReason` string alongside `canSubmit` and render it as helper text under the button (and as the button `title`), e.g. "Add a subject or pick chips first" / "Upload a reference image".

## 10. Segmented-toggle and status-pill JSX is hand-copied across the visual-gen cluster
- **Severity**: Low
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:105`
- **Scenario**: The forge mode selector (lines 105-128) and BrowsePanel's source selector (`BrowsePanel.tsx:79-94`) are byte-for-byte the same button recipe (`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border` + the same active/inactive ternary); the colored status pills (`Free` emerald, `Coming Soon` amber, `MCP` blue at GenerationPanel.tsx:151-167) repeat the same `text-xs … bg-…/10 px-1.5 py-0.5 rounded` recipe that AssetCard's CC0 badge (`AssetCard.tsx:70`) duplicates with a subtly different padding (`px-1` vs `px-1.5`).
- **Root cause**: No shared `SegmentedToggle` / `StatusPill` primitives in the cluster, so each panel re-implements them and they have already begun drifting (padding, focus-ring presence — see finding 7).
- **Impact**: Visual drift compounds with every new panel; fixes like the focus-ring rollout must be applied N times and predictably get missed.
- **Fix sketch**: Extract `SegmentedToggle` (options + value + onChange, baking in `VISUAL_GEN_FOCUS_RING` and `aria-pressed`) and a `StatusPill` (tone: emerald/amber/blue) into `visual-gen` shared components; replace the four call sites.
