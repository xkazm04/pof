# UI Perfectionist — Project Setup Wizard

> Context: Project Setup Wizard (Project Setup & UE5 Bridge)
> Files read: 11
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Brand-green hex `#00ff88` hardcoded across the wizard surface — bypasses the design token system

- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/project-setup/SetupWizard.tsx:112,127,149,160,183,185,187,193,202,217,225,256,276,278; src/components/modules/project-setup/PathBrowser.tsx:263,318-319,340-341,363-366,401,429-437,448-450,461; src/components/modules/project-setup/ProjectFilesPanel.tsx:52,57,76; src/components/modules/project-setup/ProjectSetupModule.tsx:102
- **Scenario**: The same brand accent (`#00ff88`) appears as a literal hex in roughly 30+ class lists across the wizard's most prominent surfaces — the entry screen logo/CTA/tabs, the path browser highlight rail, project file rows, and the module header. Adjacent code already uses semantic tokens (`text-accent-setup`, `bg-accent-medium`, `border-accent-strong`, `bg-accent-subtle`), so the same color is referenced via two parallel systems in the same file (e.g. SetupWizard line 183: `border-[#00ff88]/40` next to line 193 `bg-accent-medium text-[#00ff88]/80`). PathBrowser uses raw `text-[#00ff88]` 9 times, and a parallel raw `text-[#3b82f6]` for the engines block (lines 318-319) that has no token at all.
- **Root cause**: `WizardButton`/`StatusChecklist` were tokenized but the larger free-form surfaces (`SetupWizard`, `PathBrowser`, `ProjectFilesPanel`) were authored before or in parallel and never migrated. There is no Tailwind utility for `accent-setup` as a foreground/border/ring drop-in for arbitrary hover/focus combinations, so authors fell back to the hex.
- **Impact**: Theme-switching, dark/light variants, and any future brand-color tweak require a global find-replace across ~30 sites with hand-checking of opacity suffixes (`/40`, `/60`, `/70`, `/80`, `/90`). It also produces visible micro-drift today: `text-[#00ff88]/80` vs `text-accent-setup/70` (StatusChecklist:152) are the same nominal color at different opacities, side by side.
- **Fix sketch**: Extend the `accent-setup` token to expose ring/border/text/bg variants with first-class opacity support (Tailwind 4 `@theme` already supports `--color-accent-setup` plus `/<alpha>`). Then replace `[#00ff88]` with `accent-setup` and `[#00ff88]/40` with `accent-setup/40` mechanically. Add a new `accent-engine` (or reuse `accent-core`) for the blue `#3b82f6` in PathBrowser:318-319. Document the token in a brief design-tokens README so future panels don't regress.

## 2. Two parallel "select an item" list patterns reinvented — SetupWizard, PathBrowser, StatusChecklist all roll their own row

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/project-setup/SetupWizard.tsx:178-205 (project picker); src/components/modules/project-setup/PathBrowser.tsx:312-323 (engines), 334-345 (suggestions), 357-378 (detected projects), 418-440 (directories); src/components/modules/project-setup/StatusChecklist.tsx:134-171 (checklist rows)
- **Scenario**: There are at least 6 visually-similar "row with leading icon, primary label, optional badge/version chip, secondary path/detail, optional trailing affordance" components written from scratch in this module. They differ in micro-detail — some use `gap-2.5`, some `gap-3`, some `gap-2`; some use `bg-accent-subtle` for hover, some use `bg-[#3b82f6]/5`, some `bg-accent-subtle bg-accent-subtle` (PathBrowser:424 — duplicate class), some `hover:bg-surface-hover`. The detected-project row appears in two places (SetupWizard and PathBrowser) with different markup, and the "version pill" appears in three places with three different paddings (`px-1.5 py-0.5`, `text-2xs px-1.5 py-0.5`, `text-xs px-1.5 py-0.5`).
- **Root cause**: No shared `<SelectableRow>` or `<ListItem>` primitive in `src/components/ui/`; each panel author copy-adapted the closest existing markup.
- **Impact**: Same visual archetype drifts on padding, hover, badge sizes, and trailing icon affordance — the wizard feels stitched-together on close inspection. Bug fixes (e.g. correcting that doubled `bg-accent-subtle bg-accent-subtle`) won't propagate. Adds significant maintenance load before the user even reaches the main app.
- **Fix sketch**: Extract `<ListRow icon label detail badges? trailing? variant="default|highlight|warning" onClick />` into `src/components/ui/`. Migrate the 6 sites in three passes: (a) PathBrowser lists, (b) SetupWizard project picker, (c) StatusChecklist (its connector-line variant could be a `connector` prop). Add a `<VersionBadge>` and `<UnverifiedBadge>` while extracting — both appear in multiple places already.

## 3. Missing-state and empty-state treatments inconsistent — three different empty-state visual recipes within one module

- **Severity**: Medium
- **Category**: Visual Consistency / Polish
- **File**: src/components/modules/project-setup/SetupWizard.tsx:206-231 (empty: no projects); src/components/modules/project-setup/PathBrowser.tsx:394-417 (empty: empty directory); src/components/modules/project-setup/ProjectFilesPanel.tsx:33-43 (empty: no files); src/components/modules/project-setup/ProjectSetupModule.tsx:155-161 (empty: no path)
- **Scenario**: Each "empty" surface uses a different recipe. SetupWizard uses a centered `FolderOpen` at `w-8 h-8 text-text-muted/30` with a single message and inline action links. PathBrowser uses a `Folder` at `w-6 h-6 text-text-muted/20` with two outlined buttons. ProjectFilesPanel wraps a `FilePlus2` at `w-5 h-5` inside a styled `bg-surface-hover` square. ProjectSetupModule's no-path empty state is just a paragraph in a SurfaceCard with no icon at all. Vertical paddings range from `py-6` to `py-16`.
- **Root cause**: No shared `<EmptyState>` primitive (BlueprintInspector has its own at lines 338-348, also a 4th flavor). Each panel author chose icon size, opacity, and padding ad-hoc.
- **Impact**: A wizard's empty states are conversion-critical — they're the spots where users decide whether the tool understands them. Today the wizard signals five different "voices" depending on which screen the user lands on.
- **Fix sketch**: Extract `<EmptyState icon title body? actions? size="sm|md|lg" />` matching the most-used recipe (probably PathBrowser's outlined-button variant since it offers escape hatches). Standardize icon at `w-8 h-8 text-text-muted/30` and vertical padding at `py-12`. Replace all four sites; this is also a chance to give the no-path state in ProjectSetupModule actual recovery affordances.

## 4. Three step-indicator / mode-tab patterns — none extracted, all subtly different

- **Severity**: Medium
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/modules/project-setup/SetupWizard.tsx:120-134 (UE version pills); src/components/modules/project-setup/SetupWizard.tsx:144-167 (Open Existing / Start Fresh tabs); src/components/modules/project-setup/TestHarnessPanel.tsx:332-350 (Suites / Results / Snapshots tabs)
- **Scenario**: The wizard has three tab/segmented-control surfaces: pill-shaped UE version selector (rounded-full, fill-on-active), an underline tab strip for mode (border-b-2 active), and another underline tab strip in TestHarnessPanel that uses inline `style={{ borderBottom: ... }}` with a hex from `chart-colors`. The two underline strips are visually similar but one uses Tailwind classes (`text-[#00ff88] border-b-2 border-[#00ff88]`) and the other inline styles (`ACCENT_VIOLET`).
- **Root cause**: No shared `<Tabs>` or `<SegmentedControl>` primitive. The wizard could reasonably use one underline-tabs primitive for both mode-tabs and test-harness-tabs, with an `accentColor` prop driving the palette.
- **Impact**: Hard to keep typography (`text-xs font-medium` in one, `text-xs font-medium` in another, but `text-xs font-bold uppercase tracking-wider` for similar BlueprintInspector section headers) and active-state metrics in lockstep. Ranks especially as wizard polish since these tabs appear immediately on first launch.
- **Fix sketch**: Extract `<UnderlineTabs items value onChange accentClassName?>` and `<PillSegmented items value onChange>` into `src/components/ui/`. Migrate SetupWizard mode-tabs and TestHarnessPanel tabs to the shared primitive; the UE-version pills stay as PillSegmented. Wire accent via the design token system fix from finding #1.

## 5. WizardButton variants don't cover the wizard's most prominent buttons — primary/destructive coverage gap

- **Severity**: Medium
- **Category**: Design System / Component Architecture
- **File**: src/components/modules/project-setup/WizardButton.tsx:6-23; src/components/modules/project-setup/SetupWizard.tsx:273-280 (Create & Launch); src/components/modules/project-setup/PathBrowser.tsx:458-468 (Select This Project)
- **Scenario**: `WizardButton` defines three variants — `primary | warning | info` — and is used by the panels (CreateProjectPanel, BuildVerifyPanel, ToolingBootstrapPanel, StatusChecklist). But the two highest-stakes CTAs in the wizard — "Create & Launch" on the entry screen and "Select This Project" inside PathBrowser — are not WizardButton instances. They're hand-rolled buttons with `bg-[#00ff88] text-background` and `bg-accent-medium text-[#00ff88]` respectively, neither matching the WizardButton "primary" variant (`bg-accent-medium text-accent-setup`).
- **Root cause**: WizardButton's "primary" was scoped to the in-flow CTAs (after the user picks a project), and the hero-state CTA on the entry screen was authored independently. The result is three different "this is the main action" treatments, none of which share token semantics.
- **Impact**: The first button users see (Create & Launch) and the most-used one (Select This Project) lack the loading/disabled handling that WizardButton provides — `Create & Launch` has `disabled:opacity-30 disabled:cursor-not-allowed` (line 276) but no loading state; `Select This Project` has neither a loading state nor an error treatment.
- **Fix sketch**: Add a `hero` (or `primary-solid`) variant to WizardButton mirroring SetupWizard's CTA: solid accent fill, dark text. Consider also a `secondary` variant for the path browser's contextual select. Migrate both buttons. While there, extend WizardButton with a `tone="destructive"` for completeness — TestHarnessPanel's delete/abort actions can adopt it.

## 6. Inline `style={{}}` color drift in TestHarnessPanel and BlueprintInspector — abandons Tailwind layer entirely

- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/project-setup/TestHarnessPanel.tsx:319-322,338-341,452-456,465-466,498-503,521-524,562-563,573-577,634,649,658,820-821,840,846,852,854,887,893-895,914,916,920,931,943,957,959,963,972 (60+ inline-style sites); src/components/modules/project-setup/BlueprintInspector.tsx:79,80,93-94,119,151-153,239-243,271,309-322
- **Scenario**: TestHarnessPanel and BlueprintInspector use `style={{ background: \`${ACCENT_VIOLET}${OPACITY_15}\` }}` patterns extensively because Tailwind 4 can't compose a hex+opacity at runtime. Almost every status pill, badge, header bar, and section divider in these two files is built from string-concatenated hex/opacity pairs. This works, but defeats Tailwind purging, hover-state utilities, dark-mode handling, and grep-ability.
- **Root cause**: `chart-colors.ts` exports raw hexes plus `OPACITY_8|10|15|20` strings, and authors composed them with template literals because no token-aware `<Pill tone="success">` primitive existed.
- **Impact**: Cannot apply theme tweaks via the cascade; `:hover` states require duplicate inline computation; future a11y tweaks (e.g. raise contrast for status pills) require touching ~80 lines across two files. Also: inline styles defeat the Tailwind reset, so any padding/margin token drift goes silently uncaught.
- **Fix sketch**: Define semantic Tailwind tokens for status (`status-success`, `status-error`, `status-warning`, `status-info-violet`, `status-info-cyan`, etc.) and an `<StatusPill tone size>` and `<StatusBadge>` primitive. Replace inline-style sites in TestHarnessPanel/BlueprintInspector with Tailwind classes via these primitives. The chart-color hexes can remain, but only for Recharts/visx chart props where Tailwind isn't applicable.

## 7. PathBrowser is a 480-line god-component mixing data fetching, navigation, and four list flavors

- **Severity**: Medium
- **Category**: Component Architecture
- **File**: src/components/modules/project-setup/PathBrowser.tsx:55-486
- **Scenario**: PathBrowser combines: path bar, breadcrumb-ish nav buttons (Up/Home/Drives), engines list, suggested locations list, detected projects list, directory listing, .uproject indicator, and select button — all in one component with 7 useState hooks and 4 list rendering blocks. Each list block has its own header strip with an icon and text. The component is unaware of WizardButton (line 459-468 is a hand-rolled select button). Despite all this surface area, no PathBrowser sub-components have been extracted.
- **Root cause**: Grew organically; no extraction pressure because it's the only consumer.
- **Impact**: Hard to tell from reading the file what visual language each section is supposed to share with the rest of the wizard. The duplicated `bg-accent-subtle bg-accent-subtle` (line 424) is exactly the kind of bug that survives because the file is too big to scan. Also blocks finding #2's row-primitive extraction.
- **Fix sketch**: Split into `<PathBar>`, `<NavButtons>`, `<DetectionList variant="engines|suggested|projects" items onSelect>`, `<DirectoryList items onClick>`, and the .uproject footer. Move filesystem orchestration into a `usePathBrowser` hook (mirrors how `useProjectScan` was already done for ProjectSetupModule — that pattern works). The shell component then becomes a layout file under 80 lines.

## 8. `text-2xs` used inconsistently — defined locally, not part of the design system

- **Severity**: Low
- **Category**: Design System / Polish
- **File**: src/components/modules/project-setup/SetupWizard.tsx:261; src/components/modules/project-setup/StatusChecklist.tsx:239,242; src/components/modules/project-setup/PathBrowser.tsx:366,371,437,450; src/components/modules/project-setup/ProjectFilesPanel.tsx; src/components/modules/project-setup/BlueprintInspector.tsx:78,80,98,100,117,118,121,143,247,318
- **Scenario**: A `text-2xs` utility is referenced in ~15 places across the wizard for the smallest typography tier (badges, hints, secondary detail). It's smaller than Tailwind's default `text-xs`. There's no other typographic tier called "2xs" in the documented scale, and grep shows it's only defined ad-hoc in tailwind config.
- **Root cause**: A new typography size was added without making it part of a documented type scale. Sometimes `text-xs` is used where `text-2xs` would be appropriate (StatusChecklist:147 uses `text-xs` for a label that visually matches BlueprintInspector's `text-2xs` row labels at line 143).
- **Impact**: Subtle inconsistency in label sizing between sibling panels. Low impact today but a barrier to future systematic typography refresh.
- **Fix sketch**: Audit all `text-2xs` and `text-xs` use within the wizard module and define a 4-tier type scale (`text-2xs` 10px, `text-xs` 12px, `text-sm` 14px, `text-base` 16px) with a one-line rule for each tier ("badges/chips", "secondary detail/labels", "primary copy", "headings only"). Codify in design-tokens README and run a sweep.
