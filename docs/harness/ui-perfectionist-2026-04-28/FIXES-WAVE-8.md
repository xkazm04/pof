# UI Perfectionist — Wave 8 Fix Summary

> 6 commits, 6 polish findings closed.

Wave 8 is the polish wave — the residual MEDIUM/LOW findings that earlier waves' primitives, tokens, and consolidation patterns were never going to capture. Pixel-level inconsistencies (inline `style={{ width, height }}` dots, `text-2xs` vs `text-xs` form-label drift, `p-2` rather than `DZIN_SPACING.compact.wrapper`) and copy-tone deviations (`...` vs `…` ellipsis, Title-Case vs sentence-case empty-state titles, `<span>` where siblings use `<h2>`) are not pattern-violations so much as ground-down residue. This wave was scoped tight: per-fix call-site cap of 8, conservative on semantic upgrades, and zero gold-plating.

## Per-commit table

| # | Hash    | Subject                                                                  | Files | Findings closed |
|---|---------|--------------------------------------------------------------------------|-------|-----------------|
| 1 | ab94162 | replace inline width/height styles with sized utility classes           | 5     | 02.1            |
| 2 | 41e0212 | migrate residual compact-density wrapper to DZIN_SPACING token          | 1     | 09.3            |
| 3 | d4816c8 | unify form-label sizing to text-xs                                      | 1     | 26 (text-2xs vs text-xs) |
| 4 | a7a8d6f | use ellipsis character for in-progress UI states                        | 6     | multiple medium copy-tone |
| 5 | c22f87f | sentence-case empty-state titles + tighten copy                         | 4     | multiple medium copy-tone |
| 6 | 996d429 | upgrade StatusChecklist sidebar heading from span to h2                 | 1     | 09.M            |
| 7 | (this doc) | wave-8 fix summary + cumulative update                               | 2     | —               |

## What was fixed

### Fix 1 — Inline `style={{ width, height }}` → utility classes (finding 02.1)

Five sites where inline `style={{ width: N, height: N }}` had drifted from the Tailwind sizing scale were migrated. Sites: `SynergyDetector.tsx` (4×4 dot → `w-1 h-1`), `UnifiedTimeline.tsx` (14×14 alert dot → `w-3.5 h-3.5`), `progression/AchievementBoard.tsx` and `ProgressionCurve/rewards/AchievementBoard.tsx` (28×28 → `w-7 h-7`), `CharacterBlueprint/metrics/index.tsx` (32 → `w-8`). The `width: 60` outlier in `metrics/index.tsx` was left alone (no clean Tailwind equivalent at 60px, and migrating would silently change the visual). The 120×120 / 180×160 boxes in `WeightDistribution` and `GearSections` are out-of-scope for the "tiny dots" theme.

### Fix 2 — Residual compact-density wrapper deviation (finding 09.3)

`EffectTimelinePanel.TimelineCompact` used inline `className="p-2"` instead of the canonical `DZIN_SPACING.compact.wrapper` token (`'space-y-1.5 p-2'`). One-line migration. The 3-4 panel deviations the report originally flagged had already been closed in earlier waves; this was the only residual.

### Fix 3 — Form-label sizing unified to text-xs (finding 26)

`BridgeEndpointHealth.tsx` had three form labels (`Host`, `PoF Bridge Port`, `Remote Control Port`) using `text-2xs font-bold uppercase tracking-wider`, while the canonical form-label pattern in sibling `UE5RemoteController.tsx` (and other project-setup form fields) is `text-xs font-bold uppercase tracking-wider`. Migrated the 3 outliers to match. Other `text-2xs` uses across the project-setup module are micro-chip/status-value labels (different role) and were left alone — the spec called for migrating only sites where the visual role is clearly identical.

### Fix 4 — Ellipsis character for in-progress UI states (multiple findings)

Replaced three-dot ASCII (`...`) with the typographic ellipsis (`…`) on six high-visibility in-progress labels:

- `ConnectionStatusBadge.tsx` — `Connecting…`, `Reconnecting…`
- `SidebarL2.tsx` — `Loading…` tooltip
- `BlenderConnectionBar.tsx` — `Connecting…`
- `LiveCodingPanel.tsx` — `Compiling…`, `Verifying…`, `Reverting…`, `Writing file…` (also sentence-cased "Writing File" → "Writing file" since it's not in a tracking-wider role), and the inline `Compiling…` button label
- `BlueprintInspector.tsx` — `Loading…` button label
- `RegressionTrackerView.tsx` — `Processing…` button label

Convention now canonical for the project: in-progress states use the single Unicode `…`. Title Case on button labels (`Run Playtest`, `Run Full Pipeline`) was intentionally left alone — that's a separate cultural decision and migrating would be a regression for users used to it.

### Fix 5 — Sentence-case empty-state titles (multiple findings)

Four `<EmptyState>` consumers used Title-Case titles while sibling consumers used sentence-case for the same role. Migrated:

- `DependencyGraph.tsx`: `No Feature Data Yet` → `No feature data yet`
- `SessionAnalyticsDashboard.tsx`: `No Sessions Recorded Yet` → `No sessions recorded yet`
- `ProjectHealthDashboard.tsx`: `No Health Data` → `No health data yet` (also added `yet` for consistency with sibling empty states)
- `PromptEvolutionView.tsx`: `No A/B tests` → `No A/B tests yet`, plus added trailing period to the description (`Create variants and start an A/B test to compare their effectiveness.`) since it's a complete sentence and other empty-state descriptions follow that convention.

The descriptions across the codebase were already empathic (most do "what is this + what action to take"). The titles were the residual drift.

### Fix 6 — Heading hierarchy: StatusChecklist span → h2 (finding 09.M)

`StatusChecklist.tsx` (the project-setup sidebar) used a `<span>` for its `Status` heading while five sibling project-setup panels (`CreateProjectPanel`, `BuildVerifyPanel`, `ProjectFilesPanel`, `ManifestPreview`, `ToolingBootstrapPanel`) all use `<h2>` with the exact same classes for the same visual role. Aligning semantics. Other heading-mismatch candidates in the codebase (`<div>` for KPI labels, `<span>` for inline metric labels next to a count) were intentionally left alone — those `<div>`/`<span>` choices are appropriate for the role (they're inline labels next to a value, not standalone section headings) and upgrading to `<h3>` would announce a new section to screen readers unexpectedly.

## Patterns established (catalogue items 38–40)

- **38. `style={{ width: N, height: N }}` is forbidden when N maps to a Tailwind size.** Migrate to `w-N h-N` (or the closest standard `w-3.5 / h-3.5` form for half-step values like 14px). Inline-style sizing is permitted only for non-standard values (e.g. `width: 60`) where no clean utility exists.
- **39. In-progress UI states use the typographic ellipsis `…`, not `...`.** A single Unicode glyph reads as one shape rather than three dots; matters at small sizes and on hi-DPI displays.
- **40. Empty-state titles are sentence-case with a `yet` suffix where appropriate.** "No findings yet", "No A/B tests yet". Descriptions are complete sentences with periods. UPPERCASE titles in tracking-wider roles are unaffected (different design language).

## What remains (followups / skipped)

### Skipped or partial this wave

- **Title-Case button labels.** `Run Playtest`, `Run Full Pipeline`, `Run Analysis`, `Generate UE5 Code` — the codebase consistently uses Title Case for primary action buttons. Per the spec ("Sentence case for labels"), these would be sentence-case. Skipped because (a) it's a cultural decision, not a drift, and (b) migrating would feel like a regression to users. Followup: a deliberate design pass on button-label case.
- **`text-2xs` vs `text-xs` for chip labels.** The codebase uses both for various small uppercase-tracking-wider chips. Only form labels were migrated this wave. The chip use-case is intentionally smaller than the form-label role; not a drift.
- **Heading semantic upgrades elsewhere.** Many `<div>`-as-heading and `<span>`-as-heading uses exist. Per the wave's conservative-on-semantics caveat, only the StatusChecklist case was upgraded — the rest were either inline-label uses (correctly `<span>`/`<div>`) or KPI-value patterns (correctly `<div>` with no heading semantics).

### Followups (within the closed findings)

- **Inline `style={{ width: 60 }}` and similar non-standard sizes.** Could be migrated to `w-15` if the project adds a custom Tailwind extension, or to `[width:60px]` arbitrary-value class. Wasn't worth the boilerplate this wave.
- **Empty-state descriptions ending without periods.** A few consumers still have descriptions without trailing periods. A future copy pass could unify these in one sweep — the convention is now established.
- **Other `Run` button label inconsistencies.** `Run`, `Run scan`, `Run now`, `Run Analysis`, `Run Playtest` — the same conceptual action with five labels. Out of scope for the wave's risk budget; deserves a deliberate naming pass.

### Larger PRs deferred

- **Tooltip portal + positioning** (carried over from Wave 7).
- **Full StateGraphCanvas extraction** (carried over from Wave 5).

`tsc --noEmit` was 0 before each commit and remains 0 after the wave.
