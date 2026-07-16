# Layout Lab & Pipeline Steps — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Drain "in flight" flag is scoped to the component instance, not the entity
- **Severity**: High
- **Category**: bug
- **File**: src/components/layout-lab/Baseline/useBaseline.ts:27,122-135
- **Scenario**: User selects Entity A, clicks "Drain gates" (a real UE-editor boot that can take many seconds). While `drainGates(catalogId, 'A')` is in flight, the user switches to Entity B (same catalog) and clicks "Drain gates" there too.
- **Root cause**: `draining` is a single `useState(false)` local to the `useBaseline` hook instance (line 27), not keyed by entity. `runDrain` only guards `if (!catalogId || !entity || draining) return;` (line 123) — it has no per-entity scoping. Entity B's drain click is silently swallowed (no error, no toast) because `draining` is still `true` from A's still-running request, and stays `true` until A's `drainGates` promise resolves in the `finally` (line 132-134), at which point `setDraining(false)` fires for whichever entity happens to be selected at that moment.
- **Impact**: The operator sees the "draining…" affordance (surfaced to `NextStepCoach` via the `draining` prop in `Baseline/index.tsx`) attached to the wrong entity, and a legitimate drain request for Entity B is dropped with zero feedback — it looks like nothing happened when the button was clicked.
- **Fix sketch**: Key the drain state by `${catalogId}/${entityId}` (e.g. a `Set<string>` or a map in `useLabRunnerStore`, which already tracks `localDrain` scope) instead of a single boolean, and gate both the button's disabled state and `runDrain`'s early-return on that per-entity key.

### 2. "Produce fix" has no dispatch guard — double-click double-submits
- **Severity**: High
- **Category**: bug
- **File**: src/components/layout-lab/steps/StepFrame.tsx:137-154 (button), src/components/layout-lab/steps/ArchetypeStep.tsx:246-254 (`runFix`)
- **Scenario**: On a gallery-kind step (e.g. Icon 2D Art) that is not yet passing, the operator double-clicks the "⚡ Produce fix" button (touch double-tap, or an impatient real click before any visual feedback appears).
- **Root cause**: The button's `onClick={() => onFix?.(acceptance.fixDirection)}` (StepFrame.tsx:140) has no `disabled`/in-flight state at all, unlike its sibling `CliProduce` component in the very same file tree, which explicitly guards with `if (dispatching) return;` (`shared/CliProduce.tsx:89`). `runFix` in ArchetypeStep (lines 250-254) calls `generate(dir, buildPrompt(dir))` for gallery steps directly, with no debounce.
- **Impact**: Two `generate()` dispatches fire for one user action, appending two candidate batches to `genHistory` for what the user believes was a single "produce a fix" click — inflating/corrupting the kept-candidate history and (if `generate` triggers any billed/simulated LLM call downstream) silently doubling cost for one intended action.
- **Fix sketch**: Give `StepFrame`/`ArchetypeStep` the same `dispatching` guard pattern used in `CliProduce` — track an in-flight flag around the `onFix` call, disable the button and swap its label to a "Dispatching…" state while it resolves.

### 3. A failed artifact write to the server is reported to the user as success
- **Severity**: High
- **Category**: bug
- **File**: src/components/layout-lab/labArtifactClient.ts:30-36 (`postArtifact`), src/components/layout-lab/Baseline/useBaseline.ts:94-103 (write-through registration)
- **Scenario**: The `/api/pipeline-artifacts` route is unreachable (server restart, network blip, 500). The operator runs Produce on a step.
- **Root cause**: `postArtifact` calls `tryApiFetch` and returns `void` unconditionally — no success/failure signal is propagated (labArtifactClient.ts:31-35; `tryApiFetch`'s non-throwing contract is invoked specifically because "server may be offline", per the doc comment on `fetchArtifacts`). `useBaseline`'s `setLabSync` callback (lines 96-101) does `void postArtifact(...).then(() => invalidateArtifacts(...))` — the `.then` runs regardless of whether the POST actually succeeded. Meanwhile `useLabPipelineStore.produce()` has already set `done: true` locally and `CliProduce` shows "✓ Recorded" (its `successMsg`) purely from the local synchronous store write, before the network call even resolves.
- **Impact**: The UI shows a definitive success state ("✓ Recorded", a green pass/checkmark on the pipeline rail) even though the artifact never reached the server. Since `hydrateEntity` is intentionally add-only (never overwrites), the gap is invisible until a different session/device/browser opens the same entity and finds the step missing, with no record of what silently failed to sync.
- **Fix sketch**: Have `postArtifact` return a success boolean (mirroring `fetchArtifacts`'s `r.ok` pattern already used two lines below it), and surface a persistent (not just per-CliProduce-instance) "not synced to server" indicator on the pipeline rail/step when the write-through fails, instead of only ever showing local-store-derived state as truth.

### 4. Restored `lastEntityId` can silently point at an entity that no longer exists
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/layout-lab/Baseline/useBaseline.ts:41, src/components/layout-lab/LayoutLab.tsx:48-53
- **Scenario**: The operator was on Entity A of the "items" catalog; `prefs.lastEntityId` is persisted to localStorage (`LayoutLab.tsx:72`). Entity A is later deleted (or the seeded catalog data changes) via another part of the app or a re-seed. The operator reopens `/layout` — `navAdopted` logic (`LayoutLab.tsx:49-53`) restores the stale `lastEntityId` into `entityId` state.
- **Root cause**: `useBaseline` computes `entity = entities.find((e) => e.id === entityId) ?? entities[0] ?? null;` (useBaseline.ts:41) — when the id no longer matches anything, it silently falls back to `entities[0]` for rendering, but the *state variable* `entityId` in the parent (`LayoutLab`) is never corrected to match; it still holds the dead id.
- **Impact**: Every action that reads the *rendered* `entity` (header title, "Reset" button, drain, produce) operates on the correct fallback entity, but any code path that reads the *persisted/parent* `entityId` (e.g. `CatalogTree`'s `selectedEntityId` prop is actually `entity?.id`, so that one is fine) would disagree with what's stored in prefs — and the mismatch is never reconciled or surfaced, so a stale id can persist across sessions indefinitely.
- **Fix sketch**: When the fallback triggers (`entities.find(...)` misses), call back into the parent to correct `entityId`/`prefs.lastEntityId` to the fallback's real id (or `null`) instead of leaving the stale value floating in state.

## UI findings

### 5. Header has no responsive collapse and will overflow on narrower viewports
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/layout-lab/LayoutLab.tsx:135-166
- **Scenario**: Resize the browser to a tablet width (e.g. ~900-1000px) — below `Baseline`'s own `COLLAPSE_BREAKPOINT` of 1100px (`Baseline/constants.ts:5`), where the body correctly collapses its tree/pipeline columns into drawers.
- **Root cause**: The header (lines 135-166) hosts nine interactive controls across three flex zones (brand, then Catalogs/Matrix/Canon/+One-shot/Status/3D Studio/Legacy shell, then LabJobsChip/RunnerChip/LabBridgeStrip/ThemeToggle) with no `flexWrap`, no `overflow-x`, and no width-based collapse of its own — only the left brand zone has `overflow: hidden` truncation.
- **Impact**: While the composition body gracefully adapts at 1100px, the header — the one persistent chrome element — has no matching responsive behavior, so its button row can clip or force horizontal scroll on the same viewports the rest of the UI was explicitly designed to handle.
- **Fix sketch**: Give the header the same drawer/overflow-menu treatment as the body below `COLLAPSE_BREAKPOINT` (e.g. collapse the center action group into a menu, or let it wrap).

### 6. Interactive tree rows have no focus-ring styling, unlike the chapter header right above them
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/layout-lab/CatalogTree.tsx:42-59 (catalog button), 88-100 (entity button), 118-129 (discard button), 192-207 (category toggle, for contrast)
- **Scenario**: Tab through the Catalogs tree with a keyboard.
- **Root cause**: The category/chapter toggle button explicitly carries `className="focus-ring-inset"` (line 195), but the actual `role="treeitem"` catalog buttons, the entity-select buttons, and the "discard draft" `×` button carry no focus-ring class at all — they rely on whatever the global reset leaves behind.
- **Impact**: The one non-selectable, decorative row (the chapter header) gets a clear focus indicator while the rows that matter most for keyboard/roving-tabindex navigation (`useRovingFocus` is wired specifically to these rows) may render with an inconsistent or missing focus outline, undermining both the design system's consistency and keyboard accessibility.
- **Fix sketch**: Apply the same `focus-ring`/`focus-ring-inset` utility class used elsewhere in this file to the catalog, entity, and discard buttons so keyboard focus is visibly consistent across the whole tree.

### 7. First-paint skeleton doesn't match the real header/body layout it precedes
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout-lab/NewHome.tsx:42-72 vs src/components/layout-lab/LayoutLab.tsx:135-166
- **Scenario**: Cold load `/` (NewHome) while Zustand persist rehydrates.
- **Root cause**: `NewHomeSkeleton` renders a plain title + 5 generic action stubs right-aligned in the header, and a 260px/1fr two-column body (constants.ts:5's collapse width is 260+320=580px inline layout of tree+pipeline, not 260). The real `LayoutLab` header is a three-zone layout (brand / 7 centered actions / 4 right-side status widgets), and the real wide body is a **three**-column grid (260px tree, 320px pipeline, 1fr canvas — `Baseline/index.tsx:146`).
- **Impact**: The skeleton-to-real swap produces a visible layout jump (column count and header composition both change), which is exactly the kind of first-paint jank a loading skeleton is meant to prevent.
- **Fix sketch**: Mirror the real three-zone header and three-column (260/320/1fr) grid in the skeleton, using the same width constants (`COLLAPSE_BREAKPOINT`/column widths) so no reflow occurs when real content arrives.

### 8. Full-page-navigation buttons are visually identical to in-app view toggles
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout-lab/LayoutLab.tsx:151-157
- **Scenario**: The header's center zone renders `Catalogs` / `Matrix` / `Canon` (instant `setView` state toggles) directly adjacent to `Status`, `3D Studio`, and `Legacy shell` (each does `window.location.href = ...`, a full page navigation/reload) — all using the identical `<Button>` component with no `active` state or icon differentiating the two behaviors.
- **Root cause**: Both button classes share one component and one visual treatment; only the view-toggle buttons receive an `active` prop.
- **Impact**: A user clicking "Status" or "3D Studio" expecting the same instant, state-preserving switch they just got from "Matrix" instead loses their in-memory session state to a full navigation, with no visual cue beforehand that this button behaves differently from its neighbors.
- **Fix sketch**: Visually distinguish navigation-away actions (e.g. an external-link glyph, a separating divider, or a distinct button variant) from same-page view toggles.

### 9. "Produce fix" hand-rolls its own button styling instead of reusing the shared `Button` component
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout-lab/steps/StepFrame.tsx:137-154 vs src/components/layout-lab/ui/Button.tsx (used throughout LayoutLab/Baseline)
- **Scenario**: Compare the "⚡ Produce fix" button inside the Acceptance banner to any other actionable button in the same lab (header actions, "Populate demo"/"Reset" in Baseline, `CliProduce`'s own dispatch button).
- **Root cause**: `StepFrame` builds its own inline-styled `<button>` (padding, colors, border, radius all hand-computed at lines 142-150) rather than composing the shared `Button`/`IconButton` primitives the rest of the lab uses, and it defines no hover/active/transition states (every neighboring `Button` usage gets consistent transitions from the shared component).
- **Impact**: This one call-to-action — arguably the most important button on the whole step page, since it is the one-click remediation path — is the least polished: no hover feedback, and any future design-token change to the shared `Button` component (spacing, radius, hover) will silently miss this one instance.
- **Fix sketch**: Route "Produce fix" through the shared `Button`/`IconButton` component (with a `variant="accent"` or similar), passing the `⚡` glyph as its label, instead of a bespoke inline style block.
