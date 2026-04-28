# UI Perfectionist Scan — pof, 2026-04-28

> Audit of visual consistency, component architecture, design-system token discipline, polish, and accessibility-as-polish across the `pof` codebase.
> 32 parallel subagent runs, batched in 4 waves of 8.
> 253 findings across 32 contexts. Counts verified two ways (header sums + per-finding `**Severity**` bullet counts) and reconciled to bullet-count truth.

---

## Totals

| | Critical | High | Medium | Low | **Total** |
|---|---:|---:|---:|---:|---:|
| Across 32 contexts | 4 | 108 | 109 | 32 | **253** |
| Share | 1.6% | 42.7% | 43.1% | 12.6% | 100% |

Density: ~7.9 findings per context (range: 5–11). Logic-only contexts (eval engine, project-health) returned floors of 5; UI-dense contexts (evaluator dashboards) hit 11.

---

## Per-context breakdown

Sorted by criticals desc, then by total. Each row links to its full report.

| # | Context | Group | Crit | High | Med | Low | Total | Report |
|---:|---|---|---:|---:|---:|---:|---:|---|
| 20 | Evaluator UI Dashboards | Quality & Evaluation | 1 | 4 | 5 | 1 | 11 | [20-evaluator-ui-dashboards.md](20-evaluator-ui-dashboards.md) |
| 06 | Loot, Items & Economy | Core Engine (aRPG) | 1 | 4 | 3 | 1 | 9 | [06-loot-items-economy.md](06-loot-items-economy.md) |
| 12 | UI/HUD & Models | Content Creation | 1 | 4 | 3 | 1 | 9 | [12-ui-hud-models.md](12-ui-hud-models.md) |
| 18 | AI Behavior & Tactics | Game Systems | 1 | 4 | 3 | 1 | 9 | [18-ai-behavior-tactics.md](18-ai-behavior-tactics.md) |
| 29 | UI Primitives & Shared Infrastructure | App Shell | 0 | 4 | 5 | 1 | 10 | [29-ui-primitives-shared-infrastructure.md](29-ui-primitives-shared-infrastructure.md) |
| 30 | Layout & Navigation | App Shell | 0 | 4 | 5 | 1 | 10 | [30-layout-navigation.md](30-layout-navigation.md) |
| 01 | Feature Matrix UI & API | Module System | 0 | 3 | 5 | 1 | 9 | [01-feature-matrix-ui-api.md](01-feature-matrix-ui-api.md) |
| 08 | Character Design & Genome | Core Engine (aRPG) | 0 | 3 | 5 | 1 | 9 | [08-character-design-genome.md](08-character-design-genome.md) |
| 15 | Animation & Audio | Content Creation | 0 | 4 | 4 | 1 | 9 | [15-animation-audio.md](15-animation-audio.md) |
| 02 | Module Registry & Feature Graph (instance 2) | Module System | 0 | 3 | 4 | 1 | 8 | [02-module-registry-feature-graph.md](02-module-registry-feature-graph.md) |
| 04 | Game Data & Debug Tools | Core Engine (aRPG) | 0 | 3 | 4 | 1 | 8 | [04-game-data-debug-tools.md](04-game-data-debug-tools.md) |
| 05 | Abilities & Progression | Core Engine (aRPG) | 0 | 4 | 3 | 1 | 8 | [05-abilities-progression.md](05-abilities-progression.md) |
| 07 | Combat & Balance Simulation | Core Engine (aRPG) | 0 | 3 | 4 | 1 | 8 | [07-combat-balance-simulation.md](07-combat-balance-simulation.md) |
| 09 | Core Engine Panels & Views | Core Engine (aRPG) | 0 | 4 | 3 | 1 | 8 | [09-core-engine-panels-views.md](09-core-engine-panels-views.md) |
| 13 | Level Design | Content Creation | 0 | 4 | 3 | 1 | 8 | [13-level-design.md](13-level-design.md) |
| 14 | Materials & Visual Effects | Content Creation | 0 | 4 | 3 | 1 | 8 | [14-materials-visual-effects.md](14-materials-visual-effects.md) |
| 17 | Build & Packaging | Game Systems | 0 | 3 | 4 | 1 | 8 | [17-build-packaging.md](17-build-packaging.md) |
| 24 | Asset Generation & Pipeline | Visual Generation | 0 | 4 | 3 | 1 | 8 | [24-asset-generation-pipeline.md](24-asset-generation-pipeline.md) |
| 25 | UE5 & POF Bridge | Project Setup | 0 | 4 | 3 | 1 | 8 | [25-ue5-pof-bridge.md](25-ue5-pof-bridge.md) |
| 26 | Project Setup Wizard | Project Setup | 0 | 3 | 4 | 1 | 8 | [26-project-setup-wizard.md](26-project-setup-wizard.md) |
| 27 | Task System & Prompt Engineering | CLI Terminal | 0 | 4 | 3 | 1 | 8 | [27-task-system-prompt-engineering.md](27-task-system-prompt-engineering.md) |
| 28 | CLI Terminal | CLI Terminal | 0 | 4 | 3 | 1 | 8 | [28-cli-terminal.md](28-cli-terminal.md) |
| 31 | Game Director & Regression | Analytics | 0 | 4 | 3 | 1 | 8 | [31-game-director-regression.md](31-game-director-regression.md) |
| 03 | Module Registry & Feature Graph (instance 1) | Module System | 0 | 3 | 3 | 1 | 7 | [03-module-registry-feature-graph.md](03-module-registry-feature-graph.md) |
| 16 | Gameplay Subsystems | Game Systems | 0 | 3 | 3 | 1 | 7 | [16-gameplay-subsystems.md](16-gameplay-subsystems.md) |
| 23 | Procedural Generation & Rigging | Visual Generation | 0 | 3 | 3 | 1 | 7 | [23-procedural-generation-rigging.md](23-procedural-generation-rigging.md) |
| 32 | Session Tracking & Telemetry | Analytics | 0 | 3 | 3 | 1 | 7 | [32-session-tracking-telemetry.md](32-session-tracking-telemetry.md) |
| 10 | Dzin Layout & State Engine | Core Engine (aRPG) | 0 | 2 | 3 | 1 | 6 | [10-dzin-layout-state-engine.md](10-dzin-layout-state-engine.md) |
| 11 | Dzin Panel Framework | Core Engine (aRPG) | 0 | 3 | 2 | 1 | 6 | [11-dzin-panel-framework.md](11-dzin-panel-framework.md) |
| 19 | Localization & Marketplace | Quality & Evaluation | 0 | 2 | 3 | 1 | 6 | [19-localization-marketplace.md](19-localization-marketplace.md) |
| 21 | Project Health & Crash Analysis | Quality & Evaluation | 0 | 2 | 2 | 1 | 5 | [21-project-health-crash-analysis.md](21-project-health-crash-analysis.md) |
| 22 | Evaluation Engine & Quality | Quality & Evaluation | 0 | 2 | 2 | 1 | 5 | [22-evaluation-engine-quality.md](22-evaluation-engine-quality.md) |

Note: contexts 02 and 03 are duplicate context records (same files, same description) returned by the API — the two scans were biased toward different lenses (architecture vs. shared-component) so their findings are largely complementary, not redundant.

---

## All 4 critical findings — one-line summary

Sorted into the themes they map to. Each item links to the full entry in the per-context report.

### Critical-1 — Loot rarity colour scale forks across three sibling tabs
- [06.1] Three sibling tabs each declare their own RARITY → colour map. `LootTableVisualizer/data.ts:37-43`, `ItemEconomySimulator/constants.ts:17-23`, `AILootDesigner/constants.ts:38-44`. Same concept, divergent palettes — players see "Legendary" in three different golds across one feature surface.

### Critical-2 — Two visual languages collide inside one tab group
- [12.1] `InventoryGridDesigner.tsx:141-205` and `MenuFlowDiagram.tsx:317-340` ship an "indigo cyberpunk" theme; `HudThemeEditor.tsx:541-585`, `LowHealthPulse.tsx:114-156`, and `EnemyHealthBarFSM.tsx:85-100` use the project's SurfaceCard token system. Same parent module, two design languages.

### Critical-3 — Eleven local `StatCard`/`MetricCard` reimplementations across the dashboard suite
- [20.1] `AggregateQualityDashboard.tsx:773-805`, `CrossModuleOverlapPanel.tsx:241-265`, `AssetCodeOracleView.tsx:256`, `AssetScoutView.tsx:206`, `CombatSimulatorView.tsx:555`, `EconomySimulatorView.tsx:645`, `PatternLibraryView.tsx:287`, `PromptEvolutionView.tsx:1187`, `PerformanceProfilingView.tsx:621`, `PostProcessStudioView.tsx:822`, `SessionAnalyticsDashboard.tsx:170`, `WeeklyDigestView.tsx:323`. Meanwhile `src/components/ui/StatStrip.tsx` exists but is unused.

### Critical-4 — Mountain icon SVG positioning bug breaks render
- [18.1] `TacticalCoverAnalysis.tsx:451-455` — a `lucide-react` `Mountain` is positioned via `x`/`y` props inside an SVG. Lucide icons are pure `<svg>` elements, not `<image>`, so `x`/`y` are silently ignored — the icon renders at origin, not at the intended anchor point. **This is a bug, not a polish issue**; it's a single-line fix and worth doing first.

---

## Triage themes

11 themes detected by clustering on category + title-keyword similarity. Counts are approximate (a single finding can touch multiple themes).

| # | Theme | Approx count | Why this is a wave, not just individual fixes |
|---|---|---:|---|
| A | **Token discipline & colour drift** — chart-colors / OPACITY_* / withOpacity not adopted, hex literals, `${color}NN` opacity-suffix concatenation, parallel rarity/severity palettes | ~55 | These all collapse if tokens are adopted top-down. Mass migration in one pass is faster than per-component fixes. |
| B | **Missing / duplicated UI primitives** — KPICard, AccentButton, TintedButton, StatusDot, FieldRow, ChipButton, CopyButton, Slider, ScoreRing | ~45 | One PR per primitive (extract once → adopt across N call sites) is dramatically more efficient than retrofitting case-by-case. |
| C | **Page / section / dashboard chrome forks** — gradient page headers, dzin section headers (10x), 6-way visual-gen page header, dialogue-view outlier | ~18 | Shared chrome is a single primitive (DashboardHeader / ModuleHeader / SectionHeader); fixing in one wave keeps pixel-perfect alignment. |
| D | **SVG-graph / flow-graph reinvention** — StateGraphCanvas, FlowNode, ArcPath, GradientLegend, RadarChart, FlankRamp, DependencyGraph + NexusView topology | ~15 | All these views need the same handful of low-level SVG primitives; extracting once unblocks future work. |
| E | **Severity / status taxonomy fragmentation** — 4 sibling severity vocabs (crash/codebase/asset/perf), 3 lifecycle vocabs in evaluator, scattered status emoji icons | ~12 | One canonical severity & status registry; the UI side becomes consistent once the data side is. |
| F | **Slider / form-row / input chrome drift** — three slider implementations, 17× inline StatInput, inputClass/selectClass forked per form | ~12 | One Slider + one FormField primitive eliminate most of the drift. |
| G | **Empty / loading / error / suspense states missing** — ModuleRenderer has no Suspense boundary, panels lack empty states, ErrorBoundary visual treatment, sonner not adopted (Level Design, Module Registry) | ~14 | Shell-level fix (add Suspense) + EmptyState/ErrorState primitives propagate. |
| H | **A11y & keyboard polish** — Tooltip is hover-only with no role/aria/keyboard, InteractivePill has `focus:outline-none` with no replacement, focus-visible regression on ~30 buttons in materials, sidebar focus rings | ~13 | One Tooltip rewrite + one focus-ring audit; concentrated impact. |
| I | **Design-system primitives are incomplete** — Button missing variants → WizardButton fork, motion.ts has 4 conflicting taxonomies, chart-colors opacity scale has 19 near-duplicates, DZIN_TOKENS drift from CSS vars, DZIN_SPACING.compact missing tokens | ~10 | Fixing the primitives unblocks waves A & B; prerequisite work. |
| J | **Tailwind JIT-incompatible runtime classes** — `bg-[${STATUS_WARNING}${OPACITY_10}]` template-literal classes don't get emitted, so badges silently render with no background tint | ~4 | Quick to fix once spotted; 4 instances. Critical for visual correctness. |
| K | **Toast / sonner adoption gap** — Level Design panel rolls its own toast, Module Registry has bespoke notification | ~3 | Trivial sonner adoption. |

Themes A, B, and I together account for ~110 of the 253 findings — and they have load-bearing dependencies (I unblocks A/B, A unblocks D/F's downstream cleanups). That's where the highest-leverage work lives.

---

## Suggested next-phase split — 7 waves

Each wave is sessionable (5–7 fixes, single mental model) and waves are ordered by dependency.

### Wave 1 — Design-system primitive completeness *(prerequisite for A & B)*
Fix the primitives the rest of the codebase wants to reach for. Without this, waves 2–3 will have to either fork primitives or wait. **5–7 fixes:**
- Complete `Button` API: `disabled` styling, `loading` state, `icon` slot, intent variants, then delete the `WizardButton` fork [29.1, 26.5]
- Unify `motion.ts` — pick one taxonomy (DURATION + SPRING + MOTION_CONFIG) and document the canonical curve [29.3]
- Slim `chart-colors.ts` opacity scale (drop the 19 near-overlapping tokens to ~6 canonical values) [29.5/29.6]
- Reconcile `DZIN_TOKENS` with the actual `--dzin-*` CSS variables in `default.css` + `state.css` [10.1]
- Add missing `DZIN_SPACING.compact` tokens (`card`/`gap`/`sectionMb`/`contentMt`) so panels don't fall through to `full` [11.1]
- Establish card hierarchy: keep `SurfaceCard` as the canonical surface, retire `Card` as a thin re-export [29.4]

### Wave 2 — Mass token migration: kill colour drift
Now that tokens are stable, propagate them. **6–7 fixes** with tight scope per fix:
- **Fix #4 (the only critical-bug)** first: the lucide `Mountain` x/y bug in `TacticalCoverAnalysis.tsx:451-455` — single-line fix, do it as a smoke commit at the start of the wave [18.1]
- Loot rarity scale: collapse the three forks into one `RARITY_COLOUR` map in `lib/economy/definitions.ts`, retrofit the 3 call sites [06.1]
- HUD/Models cluster: kill the indigo-cyberpunk theme; migrate `InventoryGridDesigner` and `MenuFlowDiagram` to SurfaceCard tokens [12.1, 12.4]
- Project Setup wizard: replace `#00ff88` brand-green hex with `accent-setup` token across SetupWizard / PathBrowser / ProjectFilesPanel / ProjectSetupModule [26.1, 26.6]
- AI Behavior: replace 3 RGB-lerp ramps with `heatmapScale()`; migrate raw `text-[#4ade80]` / `text-[#f87171]` to `STATUS_SUCCESS` / `STATUS_ERROR` [18.2, AIBehaviorView]
- CombatSimulatorView: stop using parallel design system; adopt BlueprintPanel + chart-colors tokens [07.1]
- Audio "cyber-blue" theme fork in AudioEventCatalog/SpatialAudioGeneratorPanel/AudioPipelineDiagram → MODULE_COLORS + withOpacity [15.2]

### Wave 3 — Extract the missing UI primitives
**6–7 fixes**, each: extract once, adopt across N call sites.
- **`KPICard`** — canonical primitive replacing the **11 forks** of StatCard/MetricCard across the dashboard suite (critical #3) [20.1, 32.1]
- **`AccentButton` / `TintedButton`** — replace 6+ accent-button copies in shared/, 15+ tinted-button reinventions in bridge panels [01.1, 25.1]
- **`StatusDot`** — replace 8+ inline implementations across dzin-panels [09.2]
- **`ChipButton` / `CategoryPill`** — replace pipeline-step chips (4× drift in EQS), tab-pill rebuilds in 3 ability editors, audio preset/mode pills [05.3, 18.3, 15.3]
- **`CopyButton`** — replace 3+ near-identical copy-button implementations with their own `useState(copied)` machinery [01.2, 28+]
- **`ScoreRing`** — extract once from `DirectorOverview.tsx:96-117`; share with 3 other call sites [31.1]
- **`Slider` / `RangeInput`** — collapse 3 slider implementations across loot/materials/procedural; migrate bare `<input type="range">` in ProceduralEngineView to the existing `StyledSlider` [06.5, 14.2, 23.1]

### Wave 4 — Page / section chrome consolidation
**5–6 fixes**:
- `DashboardHeader` (icon-tile + title + sub + action) — adopt across the 5+ evaluator dashboards [20.2]
- `SectionHeader` for dzin-panels — unify the 10 forked section headers across CorePanel + 9 siblings [09.1]
- `PageHeader` for visual-gen — kill the 6-way primary-CTA + header drift across asset-forge / asset-browser / asset-viewer / material-lab / blender-pipeline [24.1, 24.3]
- `DialogueView` rewrite as `createTabbedModuleView` (matching its 4 siblings that use `createSimpleModuleView`) [16.1]
- Consolidate `DependencyGraph` + `NexusView` topology (~200 lines duplicated) [20.5]

### Wave 5 — SVG-graph primitives
**5–7 fixes** — once these primitives exist, future graph/flow editor work is cheap.
- `StateGraphCanvas` — extract from `AnimationStateMachine.tsx:686-1002` + `StateMachineEditor.tsx:746-957` [15.1]
- `FlowNode` / `WirePath` — for gas-blueprint editors, EQS pipeline diagram, audio pipeline diagram, FSM, MenuFlow, AssetPipeline, Asset dependency-graph [05.1, 12.5]
- `ArcPath` / `DraggableForwardArrow` / `GradientLegend` / `CompassTicks` — extract from Flank/Cover/Squad sibling SVGs [18.5]
- `LevelFlowEditor` pan/zoom primitive shared with `StreamingZonePlanner` [13.4]
- `RadarChart` / `LiveMetricGauge` / `Sparkline` — already in `_shared.tsx` but `affix-workbench/PowerBudgetRadar.tsx` and `DebugDashboard/CircularGauge.tsx` reinvent them [04.1]
- `ChartAxes` / `ChartTooltip` — three hand-rolled SVG chart libraries with three axis/grid conventions [20.4, 06.3, 13.2]

### Wave 6 — Empty / loading / error / suspense
**5–6 fixes**:
- Add Suspense boundary + skeleton to `ModuleRenderer` so every module gets the same loading treatment [30.1]
- `EmptyState` adoption — migrate 5 verbatim copy-pasted empty-state blocks in game-director module [31.3]
- Add empty/loading/error states to data panels in Game Data & Debug Tools [04.5]
- `ErrorState` primitive — ModuleErrorBoundary visual treatment + adoption
- Replace bespoke toasts with `sonner` (Level Design, Module Registry) [13.3, 02.4]
- Tab-count badge visibility on filterable tabs (Localization Pipeline) [19.2]

### Wave 7 — A11y polish + JIT bugs + status taxonomy
**6–7 fixes**:
- Rewrite `Tooltip` with proper role/aria-describedby/keyboard support + portal + positioning [29.2]
- Replace `InteractivePill`'s `focus:outline-none` with a proper visible focus ring [29 / Polish]
- Audit focus-visible across the ~30 buttons flagged in materials and project-setup [14, 26]
- Fix Tailwind JIT-incompatible runtime classes: `bg-[${STATUS_WARNING}${OPACITY_10}]` etc. — replace with static class lookup [32.3, 28.2]
- Unify severity vocabulary across crash-analyzer / codebase-archeologist / asset-code-oracle / performance-profiling (Theme E) [21.1, 22.1, 22.2]
- SidebarL1 active-indicator math + CLI tab 2px-jump fix [30.2, 30.3]
- Sidebar/Activity Feed focus rings [30.4]

**Beyond Wave 7:** ~75 medium/low findings remain (mostly polish — focus rings, hover states, micro-spacing, copy tone). These are good "incidental cleanup" work for future feature PRs touching adjacent files; they don't justify a dedicated wave.

---

## How this scan was run

- **Scanner prompt:** `agent_ui_perfectionist` (`src/lib/prompts/registry/agents/ui-perfectionist.ts`) — meticulous designer focused on visual consistency, component architecture, design-system tokens, polish, and accessibility-as-polish. DO/DON'T list calibrated against this codebase's tech stack (Next.js 16 / React 19 / Tailwind 4 / Zustand / R3F / Framer Motion / lucide / sonner).
- **Scope:** all 32 contexts returned by `GET /api/contexts?projectId=994c4d7f-5b3e-42be-b345-ef6421f4ee3e`. No side-scope filtering (pof has no Tauri / native split).
- **Findings target:** 5–10 per context (lowered to 3–5 for logic-heavy contexts: Dzin Layout/State, Dzin Panel Framework, Localization, Project Health, Eval Engine).
- **Execution method:** 4 parallel waves of 8 subagents each. Each subagent received the role prompt + project tech stack + context name/description + filtered file list + strict report template + strict reply template. Subagents were read-only — they produced one markdown report per context. The orchestrator never read a per-context report during scanning; only ≤150-word terse replies were aggregated. 32 reports written across the 4 waves.
- **Reports collectively read:** ~370 files (sum of `files_read` across all 32 replies).
- **Verification:** Findings counts verified two ways — `grep '^> Total:'` headers (sum: 253) vs. per-finding `^- \*\*Severity\*\*:` bullet count (sum: 253). 8 reports had minor severity-bucket mismatches in their header summaries (e.g. the report's header said "High: 4, Medium: 3" but the actual bullets were "High: 3, Medium: 4"). The bullet count is authoritative; INDEX numbers reflect bullets.
- **Theme detection:** clustered on the `Category:` field plus keyword-similarity in titles (e.g. "primitive", "fork", "hex", "duplicate", "missing"). 11 themes surfaced; 7 wave plan derived by dependency-ordering them.
- **Date:** 2026-04-28
- **Output dir:** `docs/harness/ui-perfectionist-2026-04-28/`
