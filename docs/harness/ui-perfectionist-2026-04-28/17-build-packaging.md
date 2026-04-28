# UI Perfectionist — Build & Packaging

> Context: Build & Packaging (Game Systems)
> Files read: 6
> Total: 8 — Critical: 0, High: 3, Medium: 4, Low: 1

## 1. `formatBytes` / `formatDuration` duplicated verbatim across siblings
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/game-systems/BuildComparison.tsx:11-24, src/components/modules/game-systems/BuildHistoryDashboard.tsx:48-61
- **Scenario**: The two adjacent dashboard surfaces both display sizes in B/KB/MB/GB and durations in ms/s/m+s. They each carry an identical copy of `formatBytes` and `formatDuration`. If GB precision changes from 2 to 1 decimals, or "ms" rounding changes, the two views will silently drift.
- **Root cause**: No shared formatting module under `src/lib/packaging/` (or `src/lib/format/`); inlined helpers were copy-pasted between sibling files.
- **Impact**: Inevitable visual drift between the History table row and the Compare panel, plus duplicated maintenance for what should be one design-system primitive.
- **Fix sketch**: Extract `formatBytes` and `formatDuration` into `src/lib/packaging/format.ts` (or a more general `src/lib/format/units.ts`). Import in both components. While there, expose a single `precision` knob so all build surfaces choose the same rounding. The `RecordBuildForm` size-GB → bytes math (BuildHistoryDashboard.tsx:196-197) should reuse a shared `gbToBytes` helper too.

## 2. Inline `inputClass` / `selectClass` strings reinvented in every form
- **Severity**: High
- **Category**: Design System
- **File**: src/components/modules/game-systems/BuildConfigSelector.tsx:275-276, src/components/modules/game-systems/BuildHistoryDashboard.tsx:203-204, src/components/modules/game-systems/CookSettingsPanel.tsx:47, src/components/modules/game-systems/BuildComparison.tsx:97 & 110
- **Scenario**: Three components each declare a local `const inputClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted font-mono outline-none focus:border-violet-500/50 ...'` (and a near-identical `selectClass`). BuildComparison repeats the same string inline twice on its two `<select>` elements (using `bg-surface-deep` instead of `bg-background` — already a divergence). This is the textbook field-row drift smell flagged in the context.
- **Root cause**: No shared `<TextInput>` / `<SelectInput>` / `<FieldRow>` primitive under `src/components/ui/`. Each author reproduces the spec from memory, with small inconsistencies (`bg-background` vs `bg-surface-deep`, presence of `font-mono`, presence of `w-full`).
- **Impact**: Focus ring, padding, and background color drift between the Profile editor, Cook settings, Record-build form, and Compare selectors; future tweaks (e.g. adding a focus-visible ring, dark-mode adjustment) will land in some forms and not others.
- **Fix sketch**: Add `src/components/ui/Field.tsx` exporting `FieldLabel`, `TextInput`, `SelectInput`, `Textarea` with the canonical Tailwind tokens. Replace the local class strings. Decide once whether `bg-background` or `bg-surface-deep` is correct for inputs; the rest follow. Bonus: this also clears up the `font-mono` inconsistency (cook-maps textarea uses it; plugins textarea uses it; profile name input does too — but UX-wise the name field probably shouldn't be mono).

## 3. Three different `Badge`/chip implementations on the same screen
- **Severity**: High
- **Category**: Visual Consistency
- **File**: src/components/modules/game-systems/PlatformProfileCard.tsx:207-213 (Badge), src/components/modules/game-systems/PlatformProfileCard.tsx:78-85 (PAK/COMP/ENC pills), src/components/modules/game-systems/BuildHistoryDashboard.tsx:108-112 (version pill), src/components/modules/game-systems/BuildHistoryDashboard.tsx:541-553 (platform filter chip)
- **Scenario**: PlatformProfileCard's own header inline-renders three "PAK / COMP / ENC" pills with `text-2xs text-text-muted bg-surface-hover px-1 py-px rounded`, then literally three lines below in its expanded body re-renders semantically-identical capability labels through a local `Badge` component using `text-2xs text-text-muted-hover bg-surface-hover px-1.5 py-px rounded`. Different padding (`px-1` vs `px-1.5`), different muted color (`text-text-muted` vs `text-text-muted-hover`). The dashboard's version pill (line 109) is yet another variant with violet tinting, and the platform filter chips (line 544) introduce a fourth shape (`rounded-full`).
- **Root cause**: No `Chip`/`Tag`/`Badge` primitive in the design system; every author hand-rolls one with whatever padding feels right.
- **Impact**: Visible inconsistency on a single card (header pills look slightly tighter and darker than expanded-body badges) and across the screen four chip styles compete for the eye.
- **Fix sketch**: Add `src/components/ui/Chip.tsx` with variants: `subtle` (bg-surface-hover, text-text-muted), `accent` (configurable color, statusBg-style 12% bg), `outline-active`. Use `rounded-full` for filter/toggle chips and `rounded` for static labels — make that distinction explicit in the API. Replace all four sites; PlatformProfileCard's header pills and Badge() then unify.

## 4. CompareRow vs BuildRow vs MetricCard reinvent the row primitive
- **Severity**: Medium
- **Category**: Component Architecture
- **File**: src/components/modules/game-systems/BuildComparison.tsx:46-70, src/components/modules/game-systems/BuildHistoryDashboard.tsx:65-79 & 83-184
- **Scenario**: Three local row/cell primitives — `CompareRow` (3-col grid for diff display), `BuildRow` (7-col grid for table), `MetricCard` (icon + label + value stat) — share the same vocabulary (icon + uppercase label + value), but each is hand-built. The History table header at line 568 hand-codes the same 7-column grid template as the row at line 90, requiring two-place maintenance whenever a column changes.
- **Root cause**: No shared `StatCell`/`DataRow` primitive; the comparison/history dashboards reinvent rows independently.
- **Impact**: Adding a new column to the History table is two-place edits (header line 568 + row line 90); the visual rhythm between Compare and History feels slightly different because spacing and label typography are independently chosen.
- **Fix sketch**: Lift the column grid template into a constant (`const HISTORY_COLS = 'grid-cols-[auto_1fr_80px_80px_80px_60px_auto]'`) and share between header and row. Consider a tiny `<DataTable columns={...} rows={...}/>` primitive if a third table appears. `MetricCard` can stay component-local; the cleanup target is the table.

## 5. Missing loading skeleton — entire screens flash empty before fetch resolves
- **Severity**: Medium
- **Category**: Polish (missing state)
- **File**: src/components/modules/game-systems/BuildConfigSelector.tsx:152-256, src/components/modules/game-systems/BuildHistoryDashboard.tsx:420-602
- **Scenario**: Both top-level views start with `loading=true` and fetch profiles/builds/stats/version in parallel, but never render a skeleton. During the initial fetch, the user sees the spinning RefreshCw button but the body is fully empty — then snaps to the empty-state copy ("No build profiles yet" / "No builds recorded yet"), then snaps again to populated content when the fetch completes. The empty-state false-positive flash is visible on every cold load.
- **Root cause**: The empty-state branches at BuildConfigSelector.tsx:208 and BuildHistoryDashboard.tsx:577 fire whenever the array is empty, including during the initial loading window. They guard against `!loading` only in the first case (line 208 does `profiles.length === 0 && !loading`), but the History dashboard renders the empty-state message regardless of `loading`.
- **Impact**: Janky perceived performance and a misleading "No builds recorded yet" message that flashes on every reload.
- **Fix sketch**: Add a small skeleton row/card primitive (3-4 placeholder bars) and render it while `loading && data.length === 0`. In BuildHistoryDashboard, gate the line 577 empty-state on `!loading`. Keep the existing populated layout shape so layout doesn't shift on data arrival.

## 6. Custom toggle switch in CookSettingsPanel — tiny, hard to hit, no focus ring, while the same screen uses native checkboxes
- **Severity**: Medium
- **Category**: Accessibility-as-polish + Visual Consistency
- **File**: src/components/modules/game-systems/CookSettingsPanel.tsx:16-39, src/components/modules/game-systems/BuildConfigSelector.tsx:375-403
- **Scenario**: CookSettingsPanel wraps a `sr-only` checkbox with a 28x16-pixel custom switch (line 25, `w-7 h-4`) and a 12-pixel knob. Right above it, the parent `ProfileEditor` uses native `<input type="checkbox" className="accent-violet-500"/>` for Stage / Archive / Run-After-Build. Two visually different checkbox idioms in the same modal. The custom switch additionally has no `:focus-visible` ring (the `sr-only` input is the only focusable target), making keyboard navigation invisible, and at 28x16 it's well under any reasonable touch target.
- **Root cause**: One author reached for a fancier switch component, another stuck with native. No shared `<Toggle>` primitive.
- **Impact**: Visual inconsistency in a single editor modal; keyboard users get no visible focus indicator on cook-setting toggles; touch targets fail WCAG 2.5.5 (24x24 minimum, 44x44 AAA).
- **Fix sketch**: Either (a) standardize on the custom switch and add focus styling on the wrapper label (`has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500/50`) plus bump to `w-8 h-4.5` minimum, then port ProfileEditor's three toggles to it; or (b) drop to native `accent-violet-500` checkboxes everywhere for simplicity. Pick one and ship it through `src/components/ui/Toggle.tsx`.

## 7. Platform list duplicated between Pipeline and History with different label conventions
- **Severity**: Medium
- **Category**: Visual Consistency / Design System
- **File**: src/components/modules/game-systems/BuildHistoryDashboard.tsx:22 & 217-221, src/components/modules/game-systems/PlatformProfileCard.tsx:15-29, src/components/modules/game-systems/BuildConfigSelector.tsx:22-28
- **Scenario**: The Pipeline tab (BuildConfigSelector → PlatformProfileCard) uses platform IDs `Win64 / Linux / Mac / Android / IOS` (UE convention), while the Builds tab (BuildHistoryDashboard) hard-codes `Windows / Linux / Mac / Android / iOS`. Same five platforms, different display labels and casing on the same screen, with no mapping. The Record form's `<select>` uses `'Windows'`, but the actual PackagingView pipeline records will surface as `'Win64'`. Filter chips in History won't match Pipeline-recorded builds.
- **Root cause**: Two ad-hoc string lists; no `PLATFORM_DISPLAY` map and no enforcement that `BuildRecord.platform` shares a vocabulary with `BuildProfile.platform`.
- **Impact**: User-visible label inconsistency between sibling tabs; correctness risk that platform-filter chips silently fail to match builds recorded by the actual pipeline.
- **Fix sketch**: Lift `SUPPORTED_PLATFORMS` from `build-profiles.ts` as the single source of truth. Add a `displayLabel` field (`Win64` → "Windows", `IOS` → "iOS"). Use it for both the Pipeline cards and the History select/filters, normalizing record values to the same id set. The icon map in PlatformProfileCard.tsx:15 and BuildConfigSelector.tsx:22 should also be one shared constant.

## 8. Tab styling drift inside BuildHistoryDashboard — only one of three tabs gets a hover state on the label
- **Severity**: Low
- **Category**: Polish (interaction state)
- **File**: src/components/modules/game-systems/BuildHistoryDashboard.tsx:413-418
- **Scenario**: `tabClass` for inactive tabs is `text-text-muted hover:text-text-muted` — i.e., the hover state is the same as the resting state. The active-tab branch uses `text-text bg-surface-hover border-b-2 border-violet-500`. Hovering an inactive tab gives zero visual feedback.
- **Root cause**: Likely a typo — `hover:text-text-muted` should be `hover:text-text` (or `hover:text-text-muted-hover`).
- **Impact**: Inactive tabs feel "dead" on hover; inconsistent with every other hoverable button on the same screen.
- **Fix sketch**: Change `hover:text-text-muted` to `hover:text-text` on line 417. While there, add a `focus-visible:ring-1 focus-visible:ring-violet-500/40` for keyboard parity.
