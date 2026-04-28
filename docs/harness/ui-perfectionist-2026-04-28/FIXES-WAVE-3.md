# Wave 3 Fix Summary — UI Perfectionist 2026-04-28

> 7 fix commits + 1 summary doc. Wave 3 extracted 7 reusable primitives and migrated their highest-leverage call sites — the wave's biggest leverage win was Fix 1 (KPICard absorbed 12 dashboard StatCard/MetricCard forks in a single commit).

## Per-commit table

| # | hash | finding | primitive | files (excl. primitive itself) |
|---|------|---------|-----------|---------|
| 1 | bc88a74 | 20.1 | `KPICard` | 12 evaluator dashboards (Aggregate, CrossModuleOverlap, AssetCodeOracle, AssetScout, Combat, Economy, Pattern, Perf, PostProcess, Session, PromptEvolution, WeeklyDigest) |
| 2 | 6ea40b3 | 01.1 | `AccentButton` | shared/{FeatureMatrix, RoadmapChecklist, QuickActionsPanel}.tsx (7 sites) |
| 3 | 1556493 | 25.1 | `TintedButton` | project-setup/UE5RemoteController.tsx (5 sites) |
| 4 | 28cb91b | 09.2 | `StatusDot` | core-engine/dzin-panels/{Core, Abilities, Attributes, Effects, Tags}Panel.tsx (8 sites) |
| 5 | 10c2375 | 18.3 | `ChipButton` | game-systems/{EQSPipelineDiagram, EQSComponentInventory}.tsx (5 sites) |
| 6 | 8e7cc3d | 01.2 | `CopyButton` | shared/{QuickActionsPanel, RoadmapChecklist}.tsx (2 sites) |
| 7 | e16cf8e | 31.1 | `ScoreRing` | game-director/{DirectorOverview, SessionDetail}.tsx (3 sites) |
| — | this   | docs    | —         | docs/harness/ui-perfectionist-2026-04-28/FIXES-WAVE-3.md |

Total: **42 inline reimplementations replaced** by 7 primitives across 24 files.

## What was fixed

**Fix 1 — `KPICard`.** The wave's headliner. 12 evaluator dashboards each defined a private `function StatCard` (or `MetricCard`) rendering the same recipe (icon + label + value + optional sub/delta) with 4 cosmetic variants of the visual. Extracted `KPICard` with `layout: 'horizontal' | 'vertical'`, optional motion entrance via `animated`, and ReactNode `value` so caller-controlled inline color (Tailwind class span vs inline style) was preserved at migration time. Each local `StatCard`/`MetricCard` now wraps `KPICard`, so call sites are unchanged but the chrome (padding, border, font sizes) is unified.

**Fix 2 — `AccentButton`.** The `style={{ backgroundColor: \`${accentColor}24\`, color: accentColor, border: \`1px solid ${accentColor}38\` }}` recipe was duplicated 7× across the shared/ folder. New primitive uses `withOpacity(c, OPACITY_15)` / `OPACITY_22` so the magic 24/38 hex literals live in one place. Built-in `loading` / `loadingLabel` / `leftIcon` props collapsed the inline `{loading ? <Loader2 .../> Reviewing... : <RefreshCw/> Review with Claude}` ternary that every CTA repeated.

**Fix 3 — `TintedButton`.** Bridge-panel sibling to AccentButton with a different visual contract: `border-{c}40 / bg-{c}15 / text-{c}` and `font-bold rounded-lg`. Migrated 5 buttons in UE5RemoteController (Describe/Read/Write, Call Function, Search Assets, Connect, Disconnect). Other bridge panels (LiveStateSyncPanel, BidirectionalStateSyncPanel, BridgeEndpointHealth, LiveCodingPanel) deferred to followup — same primitive will absorb 10+ more sites.

**Fix 4 — `StatusDot`.** Extracted `<StatusDot color size="xs|sm|md" emphasis="none|ring|halo" />` to subsume the `w-N h-N rounded-full flex-shrink-0` pattern duplicated across 8+ dzin-panel sites. The `emphasis="ring"` variant produces the canonical `0 0 0 3px ${c}33` outline; `halo` produces a soft glow. Migrated 8 sites across CorePanel/AbilitiesPanel/AttributesPanel/EffectsPanel/TagsPanel — including 4 ring-emphasis dots that previously hand-coded the boxShadow string. Also replaced the one rgba-literal dot in CorePanel:151.

**Fix 5 — `ChipButton`.** Toned chip primitive (`text-2xs px-1.5 py-0.5 rounded` + colored bg/border at `OPACITY_15` / 30% opacity). Migrated 5 EQS pipeline-step / kind / cost chips. Standardised on `OPACITY_15` for soft fill (was: 10/15/25/30 across the audited contexts). Audio preset/mode pills + ability tab-pills are next followups using the same primitive.

**Fix 6 — `CopyButton`.** Internalised the `useState(copied) + setTimeout(reset, UI_TIMEOUTS.copyFeedback)` pattern. Replaced literal `text-[#4ade80]` with `STATUS_SUCCESS` token. Defaults `stopPropagation=true` because most call sites are inside parent button rows. Migrated QuickActionsPanel.CopyPromptButton and RoadmapChecklist.CopyItemButton. FeatureMatrix's third copy site is a `<span role="button">` nested inside a `<button>` — swapping to a real button would create invalid nested-interactive HTML, so it was left as a followup tied to the broader a11y refactor in finding 01.8.

**Fix 7 — `ScoreRing`.** Three score rings in DirectorOverview/SessionDetail each hard-coded `strokeDasharray` circumference (175.9, 106.8, 94.2) and re-implemented the `>=70 success / >=40 warning / else error` ladder. New primitive computes circumference from `2*pi*r` and exports `scoreToStatusColor(value)` for callers that want the colour without the ring. Kept as a sibling to the existing `ProgressRing` — `ProgressRing` takes a caller-supplied colour for arbitrary progress; `ScoreRing` internalises the score-out-of-100 case. Migrated all 3 listed sites.

## Patterns established (catalogue items 14-20)

14. **One primitive per visual archetype, not per call site.** When a `function StatCard` definition appears in 12 files with cosmetic drift (vertical vs horizontal vs animated), the answer is one primitive with a discriminator prop, not 12 conformant copies of one canonical local. KPICard's `layout` prop and ReactNode `value` keep the migration mechanical (rewriting each local `function StatCard` to wrap KPICard).
15. **Token tier matters: 24/38 vs 15/40.** AccentButton uses `OPACITY_15`+`OPACITY_22` (~14% / ~22%); TintedButton uses `OPACITY_15`+`40` (~14% / ~25%). The two were intentionally kept as siblings rather than merged via a `tone` prop — the 38 vs 40 border literal is a real visual-weight distinction in the bridge-panel surface vs the per-module CTA. Document the difference rather than premature-unifying.
16. **`withOpacity(color, '40')` over template literals.** The `${color}40` syntax silently breaks for `var(--token)` colours; `withOpacity` knows how to handle both hex and CSS-var inputs. New primitives never use template-string opacity concatenation.
17. **`as: 'button' | 'span'` discriminator on chip primitives.** ChipButton renders the same visual as a button or as a span — the choice is whether the chip is interactive. Avoid forcing every call site to wrap in `<button>` when half are non-clickable category labels.
18. **Computed circumference, not literal magic numbers.** SVG ring primitives must compute `2 * pi * r` from a `radius` prop. `175.9 / 106.8 / 94.2` are unmaintainable when `strokeWidth` changes the effective radius.
19. **Score → colour mapping belongs to a function, not a ternary.** `scoreToStatusColor(score)` lives in ScoreRing.tsx (close to its consumer); it could move to chart-colors if more places need it. Either way: one source of truth for the threshold ladder.
20. **Migration via local-wrapper preserves call sites.** The cheapest migration in Fix 1 was `function StatCard(props) { return <KPICard {...mapped} /> }` — call sites remain identical, only the local definition changes. Faster + lower-risk than rewriting 60+ JSX call sites in one commit.

## What remains (out-of-scope drift spotted)

- **TintedButton (4 panels)**: LiveStateSyncPanel (2 sites), BidirectionalStateSyncPanel (3 sites), BridgeEndpointHealth (1 site), LiveCodingPanel (2 sites) — same primitive, mechanical migration; deferred.
- **StatusDot (other dzin-panels)**: AnimationMontagesPanel, AnimationStateMachinePanel, AnimationBlendSpacePanel, AbilityForgePanel, AISandboxPanel, TagDepsPanel, LoadoutPanel, EffectTimelinePanel each have 1-3 inline status dots. Mechanical migration; deferred.
- **ChipButton (audio + ability tabs)**: AudioPropertyPanel preset/mode pills + 3 ability tab-pill editors + AITestingSandbox pass/fail badges + SquadChoreographyEditor pipeline chips — all match the `text-2xs px-1.5 py-0.5 rounded` + bg-tint chip pattern.
- **FeatureMatrix inline CopyButton (line 1094)**: nested `<span role="button">` inside parent `<button>`. Must coordinate with the broader a11y refactor (finding 01.8) — replacing the parent button row with `onClick`-on-`<div>` would unblock the swap to real `<CopyButton>`.
- **`AccentButton` UE5 / RoadmapChecklist edge sites**: `${accentColor}10` (line 767 UE5) and `${accentColor}18`/`28` in NBA banners — opacity drift inside the AccentButton family worth a unified pass.
- **`ScoreRing` (other ring-like surfaces)**: UnifiedSummaryView's `CombinedHealthGauge` (270° arc), GDDComplianceView's local ScoreRing, and ProjectHealthDashboard's radar — finding 20.6 lists these. They need `startAngle` / `sweepAngle` extension to ProgressRing or a richer ScoreRing — deferred.
- **KPICard call-site cleanup**: 12 evaluator views still ship the wrapper `function StatCard` shim. A future pass can delete the shim and pass `KPICard` props directly at each call site, dropping ~150 lines.

## Tool-budget note

Wave 3 ran ~85 tool calls — within the 90-call budget. No fix was simplified or skipped due to budget pressure. The PreToolUse read-before-edit hook fired noisy reminders for every Edit, but the runtime did not actually reject any edit (all `Edit` tool responses returned `updated successfully`). No retries were needed.

## Verification

`npx tsc --noEmit` → 0 errors after every fix commit and at end of wave.
