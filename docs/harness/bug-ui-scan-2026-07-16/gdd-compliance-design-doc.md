# GDD Compliance & Design Doc — Bug + UI Scan

> Total: 10

> Note: `GDDComplianceView.tsx` and `GameDesignDocView.tsx` no longer exist as single files on `master` — both were refactored into folders (`GDDComplianceView/{index,constants,helpers,GapIndicators,ScoreRing,ModuleCard,ModuleDetail,SuggestionsPanel}.tsx` and `GameDesignDocView/{index,constants,Markdown,GDDSectionCard,StatRow}.tsx`). All files in both folders were read in full, along with `useGameDesignDoc.ts`, `useDesignDocument.ts`, and `gddComplianceStore.ts` (read to verify the resolve/re-audit interaction below).

## Bug findings

### 1. Re-audit / auto-audit silently wipes all manually-resolved gaps
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/evaluator/GDDComplianceView/index.tsx:35-37 (also src/stores/gddComplianceStore.ts:104-105,117-126)
- **Scenario**: User expands a module, clicks "Resolve" on three gaps, then edits any single checklist checkbox anywhere else in the app (or clicks "Re-audit"). `checklistProgress` changes identity, the `ensureAudit` effect fires, `runAudit` POSTs to `/api/gdd-compliance` and overwrites `report` with a fresh server-computed report where every gap is `resolved: false` again.
- **Root cause**: `resolveGap` only flips `resolved` on the client-held report copy (`applyResolveGap`); there is no server-side persistence and `runAudit`'s response unconditionally replaces `report`/`modules` with the server's view, which has no notion of prior client resolutions.
- **Impact**: A user's triage work (marking gaps resolved) disappears with zero warning the next time the checklist changes anywhere in the app — not just on an explicit "Re-audit" click. Looks like real work was lost with no undo and no toast/confirmation.
- **Fix sketch**: Either persist resolved-gap ids server-side (include in the audit request/response) or, client-side, snapshot resolved gap ids before `runAudit` and reapply `applyResolveGap` for any gap ids that still exist in the new report.

### 2. `useGameDesignDoc.generate` has no guard against out-of-order responses
- **Severity**: High
- **Category**: bug
- **File**: src/hooks/useGameDesignDoc.ts:32-47
- **Scenario**: User switches projects quickly (or double-clicks "Refresh"/"Generate GDD"). Two `generate()` calls fire back-to-back with different `projectName`s; the first request is slower than the second and resolves after it.
- **Root cause**: No `AbortController`, in-flight request id, or "is this still the active project" check before `setGdd(data)`/`setError(...)` in the `finally`/`catch`. `isMounted()` only guards unmount, not staleness.
- **Impact**: The GDD panel can end up showing project A's design document while `projectName` (and the rest of the UI) has already moved on to project B — a stale-data bug that's invisible until the user notices mismatched stats/sections.
- **Fix sketch**: Capture a request token (or the `projectName` at call time) and only apply the result if it still matches the current `projectName`/latest request id when the promise resolves.

### 3. Export/copy failures are swallowed with no user-visible feedback
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useGameDesignDoc.ts:66-68,87-89; src/components/modules/evaluator/GameDesignDocView/index.tsx:43-57,74-80
- **Scenario**: `/api/game-design-doc` POST (export-markdown or export-pitch) fails (network blip, 500, auth expiry). `exportMarkdown`/`exportPitch` catch the error and return `null`; the caller (`handleExport`, `handleCopyMarkdown`, `handleExportPitch`) just does `if (!markdown) return;` and turns off its loading flag.
- **Root cause**: Unlike `generate()`, which sets the hook's `error` state on failure, the export/copy paths have no error channel at all — the catch block doesn't even log.
- **Impact**: User clicks "Export .md"/"Copy"/"Export Pitch", sees a brief spinner, then nothing happens — no download, no toast, no error text. Reads as "did it work?" success theater with no diagnostic trail.
- **Fix sketch**: Surface a transient error toast/inline message on `null` return, and at minimum `logger.warn`/`logger.error` the caught exception instead of discarding it.

### 4. `useDesignDocument` mutations race via unguarded re-fetch
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useDesignDocument.ts:68-109
- **Scenario**: User rapidly creates a doc, then deletes it (or updates it) before the first `fetchAll()` (triggered inside `create`) has resolved. `create`, `update`, and `remove` each independently call `fetchAll()` with no cancellation of a previous in-flight one.
- **Root cause**: No request sequencing/AbortController; each mutation trusts its own `fetchAll` call to be the last word, but responses can land out of order.
- **Impact**: `docs`/`summary` can transiently (or permanently, if the last-resolving fetch is actually the older request) show a doc that was just deleted, or omit one that was just created — a state-corruption class bug that's hard to reproduce deterministically, which matches "worked on my machine" bug reports.
- **Fix sketch**: Track a monotonically increasing request id (or AbortController) in the hook and ignore/drop `fetchAll` responses that aren't the most recent.

### 5. "Export PDF" can run against a stale `gdd` snapshot mid-regenerate
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/evaluator/GameDesignDocView/index.tsx:85-109,245-254
- **Scenario**: User clicks "Refresh" (sets `isLoading=true`, an async `generate()` in flight) and, before it resolves, clicks "Export PDF". `handleExportPDF` is disabled only by `exportingPdf`, not by `isLoading`, so it captures the pre-refresh `gdd` via `exportGDDAsPrintableHTML(gdd)`.
- **Root cause**: The three export buttons (`Export .md`, `Export Pitch`, `Export PDF`) are only gated on their own per-action loading flag, never on the shared `isLoading` (regenerate-in-flight) state.
- **Impact**: The exported PDF/markdown/pitch silently reflects the previous (possibly outdated) GDD snapshot instead of the one currently being regenerated, with no indication to the user that what they exported may already be stale.
- **Fix sketch**: Also disable export actions while `isLoading` is true, or export directly from the freshly-resolved `data` rather than the closure's `gdd`.

## UI findings

### 6. "Re-audit" and its own loading spinner are styled as an error/danger action
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/GDDComplianceView/index.tsx:41-47,88-96
- **Scenario**: On first load (no error yet), the loading state renders `<Loader2 style={{ color: STATUS_ERROR }} />` next to "Running compliance audit...". The "Re-audit" button is permanently styled `bg-status-red-subtle border-status-red-strong` / `color: STATUS_ERROR`.
- **Root cause**: The view reuses the severity/error red token (`STATUS_ERROR`) as its accent color for a neutral, routine action (re-running an audit) and for a normal (non-error) loading state, rather than a neutral/brand accent.
- **Impact**: A perfectly normal "please wait" spinner and a benign "re-run" button both read as warnings/errors at a glance, which trains users to associate red with "something's wrong" less reliably, and undercuts the one place red *should* stand out — an actual critical-gap count.
- **Fix sketch**: Use the module's neutral/brand accent (as `GameDesignDocView` does with `ACCENT`) for the loading spinner and the Re-audit button chrome; reserve `STATUS_ERROR`/`SEVERITY_TOKENS.critical` for genuine error states and critical gap counts.

### 7. Module grid has no responsive fallback for narrow panel widths
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/GDDComplianceView/index.tsx:100-109; src/components/modules/evaluator/GDDComplianceView/ModuleCard.tsx:28
- **Scenario**: This view renders inside a resizable evaluator panel that can be narrowed well below the width needed for two `ModuleCard`s side by side. `grid grid-cols-2 gap-2` has no `sm:`/container-based fallback to a single column.
- **Root cause**: Fixed 2-column grid with no responsive breakpoint, despite `ModuleCard` itself already defensively `truncate`-ing the module name — an implicit admission that space is tight.
- **Impact**: At narrow panel widths, module name/score/progress bar/gap count get cramped and truncated together rather than gracefully stacking to one column.
- **Fix sketch**: Add a narrower-width single-column fallback (container query or a wrapping `flex flex-wrap` with a `min-width` per card) instead of a hard `grid-cols-2`.

### 8. Table-of-contents "active section" only updates on click, not on scroll
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/GameDesignDocView/index.tsx:165-187,258-268
- **Scenario**: User clicks a TOC entry (sets `activeSectionId`, scrolls to it), then manually scrolls further down through subsequent sections in the main content pane.
- **Root cause**: `activeSectionId` is set only inside the TOC button's `onClick`; there's no scroll listener/IntersectionObserver keeping it in sync with which section is actually in view.
- **Impact**: The TOC's `aria-current`/highlighted item goes stale the moment the user scrolls instead of clicking — a common "table of contents that lies" complaint, and the `aria-current` value becomes actively misleading for screen-reader users navigating by landmark.
- **Fix sketch**: Add an IntersectionObserver (or scroll-based recompute) over the section headers to keep `activeSectionId` in sync with true scroll position.

### 9. Five-button export toolbar has no wrap/overflow handling
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/GameDesignDocView/index.tsx:202-256
- **Scenario**: The sticky toolbar packs Refresh, Copy, Export .md, Export Pitch, and Export PDF into one `flex items-center gap-1.5` row alongside the document title, in the same resizable panel that constrains `GDDComplianceView`'s grid (finding #7).
- **Root cause**: No `flex-wrap`, no icon-only collapse at small widths, and no overflow menu — the row assumes the panel is always wide enough for all five labeled buttons plus the title.
- **Impact**: At narrower panel widths the toolbar will either wrap awkwardly (fighting the `sticky`/`backdrop-blur` header) or clip actions, with no responsive strategy defined.
- **Fix sketch**: Collapse to icon-only buttons (with `title` tooltips, already present) below a width threshold, or move less-common actions (Export Pitch/PDF) into an overflow menu.

### 10. Inconsistent "ahead" tint math between `GapSplitIndicator` and `GapSideCard`
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/GDDComplianceView/GapIndicators.tsx:41-49,72-96
- **Scenario**: In the compact/full split bar, the *trailing* (behind) side is drawn at full opacity/solid color (just a smaller width) — only the label opacity is dimmed (`opacity: designAhead ? 1 : 0.55`) for the full variant, and not at all for the compact variant's non-active side. Meanwhile `GapSideCard` signals "ahead" via a colored border/background instead of opacity.
- **Root cause**: Two different visual encodings (bar-width vs. label-opacity vs. card-border) are used to express the same "ahead" concept across sibling components in the same feature, without a shared, single tint/opacity rule.
- **Impact**: The "which side is ahead" story is told three different visual ways in the same expanded gap row, adding cognitive load beyond what the explicit `aria-label`/consequence text already conveys — a design-system consistency gap rather than a functional one.
- **Fix sketch**: Standardize on one "ahead" encoding (e.g., always full-opacity + border for the ahead side, always-dimmed for the trailing side) and reuse it across `GapSplitIndicator`'s compact variant and `GapSideCard`.
