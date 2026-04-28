# UI Perfectionist — Game Director & Regression

> Context: Game Director & Regression (Analytics & Session Tracking)
> Files read: 6
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Score-ring SVG geometry duplicated three times with magic numbers

- **Severity**: High
- **Category**: Component Architecture / Magic Numbers
- **File**: src/components/modules/game-director/DirectorOverview.tsx:96-117, 244-259; src/components/modules/game-director/SessionDetail.tsx:103-118
- **Scenario**: Three nearly identical circular score rings exist at radii 28, 17, and 15. Each hard-codes `strokeDasharray` circumference (175.9, 106.8, 94.2) and re-implements the same threshold ladder `score >= 70 ? SUCCESS : score >= 40 ? WARNING : ERROR`. Drift will be inevitable as colors or thresholds change.
- **Root cause**: No shared `<ScoreRing size value />` primitive — every panel rolls its own and computes 2πr by hand.
- **Impact**: Three sources of truth for score color thresholds; a designer tweaking the bands has to chase three files. Magic numbers (175.9, 106.8, 94.2) are not self-documenting and can desync from the radius.
- **Fix sketch**: Extract `<ScoreRing size value strokeWidth />` into `src/components/ui/ScoreRing.tsx`. Compute circumference = `2 * π * r` from the radius prop. Centralize the score→color mapping (e.g. `scoreColor(value)` in `chart-colors.ts`) so SUCCESS/WARNING/ERROR thresholds live once.

## 2. Finding row primitive reimplemented across SessionDetail and FindingsExplorer with diverging affordances

- **Severity**: High
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/modules/game-director/SessionDetail.tsx:266-332; src/components/modules/game-director/FindingsExplorer.tsx:147-176
- **Scenario**: Both surfaces render the same finding shape (severity icon, title, category chip, related-module chip, description, confidence, suggestedFix) but with different markup. SessionDetail's row is an expandable button; FindingsExplorer's is a static `motion.div` showing "Fix:" inline as italics. The category chip color treatment is identical but copy-pasted; description uses `line-clamp-2` in one and full-height in the other.
- **Root cause**: No shared `<FindingRow finding expandable />` component. Each surface independently chose how to handle the suggestedFix (collapsed-by-default vs always-visible italic).
- **Impact**: Users see the "same" finding rendered two ways across tabs, which weakens the mental model. Adding any field (e.g. timestamp, reproduction notes) requires editing two files and risks divergence.
- **Fix sketch**: Extract `<FindingRow finding expanded? onToggle? variant='compact'|'expandable' />` to `src/components/modules/game-director/FindingRow.tsx`. Standardize the suggestedFix presentation (recommend the SessionDetail collapsible pattern; collapse by default in both views with a shared toggle behavior).

## 3. Empty-state illustration block copy-pasted five times verbatim

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/game-director/DirectorOverview.tsx:306-337; src/components/modules/game-director/SessionDetail.tsx:339-366, 419-447; src/components/modules/game-director/FindingsExplorer.tsx:106-133; src/components/modules/game-director/RegressionTrackerView.tsx:421-438, 566-582
- **Scenario**: The exact same "rounded-2xl tinted background with a primary icon plus two satellite icons at -bottom-1 -right-1 and -top-1 -left-1" composition appears in six places, each with hand-tuned `${ACCENT}08` / `${ACCENT}15` opacity hex strings, identical headline+paragraph+CTA layout, and the same `w-16 h-16 mb-5` outer dimensions.
- **Root cause**: No shared `<EmptyState icon satelliteIcons title body cta />` primitive in `components/ui/`.
- **Impact**: Six locations to keep in sync. Hex-suffix opacity literals (`08`, `15`, `30`) bypass the `chart-colors.ts` `OPACITY_*` constants that exist precisely for this; one file (RegressionTrackerView) uses the constants, the other empty-states do not.
- **Fix sketch**: Build `<EmptyState icon satelliteIcons={[Bottom, Top]} title body action accent />` and replace all six call sites. Migrate the inline `${ACCENT}08` patterns to use the existing `OPACITY_8` / `OPACITY_15` tokens, or better, the `statusBg/statusBorder` helpers already used in SessionDetail's CoverageView (lines 541, 550) — which proves the helpers exist but aren't being used everywhere.

## 4. Status-pill color treatment reimplemented inconsistently between status maps

- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/game-director/DirectorOverview.tsx:17-24; src/components/modules/game-director/RegressionTrackerView.tsx:27-32
- **Scenario**: Two parallel status registries live in two files. `DirectorOverview.STATUS_CONFIG` uses `${color}12` background, `${color}25` border, `${color}` text. `RegressionTrackerView.STATUS_STYLES` uses `${color}${OPACITY_15}` background and no border. The `analyzing` status in DirectorOverview hard-codes purple as `'#c084fc'` rather than referencing `ACCENT_PURPLE` from `chart-colors.ts`.
- **Root cause**: No shared `<StatusPill status registry />` primitive; status registries live next to consumers instead of in the design system layer (`lib/game-director-styles.ts` already exists but only handles severity, not status).
- **Impact**: The same "Fixed" or "Complete" connotation looks different in adjacent tabs. The raw `#c084fc` literal escapes the chart-colors token system, which the rest of this module is otherwise disciplined about.
- **Fix sketch**: Move both registries into `lib/game-director-styles.ts` as `SESSION_STATUS_STYLES` and `FINGERPRINT_STATUS_STYLES`. Replace `'#c084fc'` with `ACCENT_PURPLE`. Extract `<StatusPill registry status size? />` so the bg/border/text formula lives once.

## 5. Three independent tab-bar implementations with `layoutId`-collision risk

- **Severity**: Medium
- **Category**: Component Architecture
- **File**: src/components/modules/game-director/GameDirectorModule.tsx:139-171; src/components/modules/game-director/SessionDetail.tsx:217-242; src/components/modules/game-director/RegressionTrackerView.tsx:169-199
- **Scenario**: Three tab bars are reimplemented with three different `layoutId` strings (`director-tab-indicator`, `session-detail-tab-indicator`, `regression-tab-indicator`). Padding differs (`px-3 py-2` vs `px-3 py-1.5`), the count badge in RegressionTrackerView uses `text-[9px]` (a one-off magic number) while SessionDetail uses `text-2xs`.
- **Root cause**: No shared `<TabBar tabs activeId onChange layoutId accent />` primitive. Padding/typography drifted because each was hand-tuned.
- **Impact**: Three places to maintain. The `text-[9px]` arbitrary value contradicts the rest of the module, which strictly uses `text-2xs` / `text-xs` from the type scale.
- **Fix sketch**: Extract `<TabBar items=[{id,label,icon,count}] active onChange layoutId accent />` into `components/ui/`. Replace the three call sites and standardize the count-badge typography to `text-2xs`.

## 6. StatCard duplicated with subtly different layout between Overview and Regression

- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/modules/game-director/DirectorOverview.tsx:170-202; src/components/modules/game-director/RegressionTrackerView.tsx:678-692
- **Scenario**: Both files define a local `StatCard`. DirectorOverview stacks the icon-chip above a vertical label/value pair (`p-3.5`, `text-xl` value). RegressionTrackerView lays them out horizontally (`p-3 flex gap-3`, `text-lg` value) with no border on the icon chip. Side-by-side, the two surfaces feel like different products.
- **Root cause**: Two independent definitions, same name, different visual language.
- **Impact**: Stat cards are the most visually prominent element in each tab; the inconsistency reads as drift.
- **Fix sketch**: Pick one canonical layout (recommend the DirectorOverview vertical with `border` accent on the icon-chip — it has more visual hierarchy), move it to `components/ui/StatCard.tsx`, accept an optional `delay` for stagger, and use it in both places.

## 7. Confidence shown as bare percent with no visual weight

- **Severity**: Medium
- **Category**: Polish / Information Hierarchy
- **File**: src/components/modules/game-director/SessionDetail.tsx:291; src/components/modules/game-director/FindingsExplorer.tsx:173
- **Scenario**: Both finding rows surface confidence as a flat right-aligned `text-2xs text-text-muted` "85%" string. There's no visual indication that, say, 95% is "high confidence" vs 40% "low confidence" — they look identical at a glance.
- **Root cause**: Confidence is a key signal for triaging AI-generated findings but it gets the same typography as a date stamp.
- **Impact**: Users can't scan a finding list and immediately see which findings to trust most. The 0–100 scale is wasted as just text.
- **Fix sketch**: Render confidence as a tiny stacked element: a small horizontal bar (`w-8 h-1`) filled to `confidence%` with color tinted by threshold (>80 success, >50 muted, ≤50 warning), with the percent below it in `text-2xs`. Or use a 3-dot indicator for low/medium/high. Either way, give confidence visual weight proportional to its triage value.

## 8. NewSessionPanel "Aggressive" toggle is a button not a switch

- **Severity**: Low
- **Category**: Accessibility / Component Architecture
- **File**: src/components/modules/game-director/NewSessionPanel.tsx:266-286
- **Scenario**: A boolean setting is rendered as a full-width button labeled "Enabled" / "Disabled" with no `role="switch"`, no `aria-checked`, no visual switch affordance. The other two settings in the row are sliders, so the visual rhythm of the row is broken (slider, slider, button-as-toggle).
- **Root cause**: Project lacks a shared `<Switch />` primitive, so this got hand-rolled as a styled button.
- **Impact**: Screen-reader users hear "Enabled, button" rather than "Aggressive mode, switch, off." Visually, the row's third column doesn't read as the same control category as the first two.
- **Fix sketch**: Either add a real `<Switch />` (track + thumb) and use it here with `role="switch"` + `aria-checked={aggressiveMode}`, or, since the row is already non-uniform, lean into a real visual switch that matches the orange accent. Keep the button keyboard behavior but add the ARIA attributes at minimum.
