# PoF · Entity-Centric Workspace Refactor — Design

**Date:** 2026-05-24
**Branch:** `feature/entity-centric-workspace`
**Scope:** Major UI/architecture overhaul replacing the 7-category × 37-module sidebar with a 3-tab entity-centric shell. Folds the CLI into per-entity workflow. Surfaces UE state always-on. Absorbs the relevant subset of 184 backlog ideas and drops the other ~147.

---

## 0 · Problem statement

Today's PoF app has three structural problems that compound:

1. **Mass of features spread into pieces hard to grasp.** L1 sidebar = 7 categories. L2 sidebar = 37 sub-modules. Each sub-module = 4–8 sub-tabs. Evaluator alone is 26 tabs. A user wanting "dodge balance" navigates Core Engine → Combat → Metrics. There's no jump/search, no home dashboard, and no overview of the whole.
2. **CLI development is separate from unique module tabs.** The CLI is a bottom-bar multiplexer. Modules dispatch CLI tasks via push events, but results flow back via `@@CALLBACK → API → polled refetch`. They're two architecturally parallel systems glued by Zustand subscriptions and custom events. The user sees CLI output in one place and module state in another.
3. **Hard to overview current state of the game / see how changes affect the real game.** 8 catalogs have lifecycle state, but it's only visible inside that catalog's module. UE bridge shows connection state but not content-sync state. 5 separate "overview" dashboards (UnifiedSummary, ProjectHealth, AggregateQuality, DirectorOverview, CrossModuleFeature) each show a partial picture; none is the single source of truth.

## 1 · Pivot

The primary noun changes from **module** (37, organized by feature domain) to **entity** (the thing actually being built — a Fireball ability, a Brute archetype, a Dungeon zone, a HUD screen). Catalogs are containers of entities. The 8 catalogs that the folder-09 work shipped (spellbook / items / loot-tables / bestiary / combat-map / screen-flow / zone-map / state-graph) become the primary first-class objects.

Modules either:
- Become **catalog aspect views** attached to entities (e.g., the AnimationStateGraph node-graph view becomes a facet of a state-graph entity's inspector)
- Fold into one of the new **3 L1 tabs** (Roadmap, GDD, Workflows → Mission Control; Build Pipeline, Crashes, Bridge → Live State)
- Get **promoted to a catalog** (Materials, Audio, Animations have entity-shaped data — give them a `materials` / `audio` / `animation-assets` catalog)
- Get **removed** (the DROP-STUB list)

## 2 · Top-level shell

```
┌─ TopBar ───────────────────────────────────────────────────────────────────────┐
│ PoF  [Catalogs] [Mission Control] [Live State]      Cmd+K   bridge●  ⚙ kazda  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│                                                              │                 │
│           Active L1 tab content                              │  CLI Rail       │
│           (Catalogs / Mission Control / Live State)          │  (collapsible   │
│                                                              │   right rail)   │
│                                                              │                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **3 L1 tabs.** Not 7. Not 37. Three. Persistent across the entire app.
- **CLI Rail.** Always-collapsible right-side rail (0 / 360px / 50%). Every CLI session in the app lives here. The rail is **entity-scoped** when an entity is selected; project-scoped when at the Catalog Hub / Mission Control / Live State root. The 13 `TaskFactory` methods all dispatch into this rail.
- **TopBar** shrinks to brand · L1 tabs · `⌘K` palette · bridge dot · user. The current TopBar trailing cluster (deferred from idea `d3b45c2e`) gets de-jargoned.
- **Project Setup** ducks into a settings cog on first-run completion. The `bb068439` guided tour fires once.
- **Asset Studio / Visual Gen** stops being an L1 sibling. The 9 Visual Gen modules become a **tools drawer** invokable from entity context — "Generate visuals for this enemy" opens the asset-forge tool with the bestiary entity pre-bound.

## 3 · Tab 1 — Catalogs (the creative surface)

### 3.1 Catalog Hub (root view)

A single page listing all 8 catalogs with a per-catalog stat strip:

```
┌─ Catalogs ──────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Spellbook       [▮▮▮▮▮▯▯▯]   62 entries · 24 verified · last ✓ 2h ago     │
│  Items           [▮▮▮▯▯▯▯▯]   180 entries · 32 verified · 1 failing ❌      │
│  Loot Tables     [▮▮▮▮▮▮▯▯]   18 entries · 14 verified · last ✓ 5h ago     │
│  Bestiary        [▮▮▯▯▯▯▯▯]   12 entries · 2 verified                      │
│  Combat Map      [▮▮▮▮▮▮▮▯]   24 entries · 21 verified                     │
│  Screen Flow     [▮▮▯▯▯▯▯▯]   18 entries · 3 verified                      │
│  Zone Map        [▮▮▮▯▯▯▯▯]   8 entries · 2 verified                       │
│  State Graph     [▮▯▯▯▯▯▯▯]   30 entries · 3 verified · ⚠ AnimBP manual     │
│                                                                             │
│  + Materials   + Audio   + Animation-Assets   (promoted from modules)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

Each row has a progress bar (lifecycle states), entry count, verified count, last-test result, and a click-through into the catalog detail view.

### 3.2 Catalog detail (per-catalog view)

When a catalog is selected, the layout splits 3-way:

```
┌────────────────┬────────────────────────────────────┬─────────────────────┐
│ Entity tree    │  Entity inspector                  │ CLI Rail            │
│ (categoryPath  │  (the selected entity, all facets) │ (entity-scoped      │
│  hierarchy)    │                                    │  sessions)          │
│                │                                    │                     │
│ Spellbook      │  ┌─ Header: GA_VS09Smite ───────┐  │                     │
│ ├ Offensive    │  │ planned → scaffolded → ✓verified                      │
│ │ ├ Fire       │  └─────────────────────────────┘  │                     │
│ │ │ ├ Fireball │  ┌─ Spec ──────────────────────┐  │ ▸ Gen run 12m ago    │
│ │ │ └ Smite ◀  │  │ damage=25, radius=300, ...  │  │   ✓ Verified         │
│ │ └ Ice        │  └─────────────────────────────┘  │                     │
│ ├ Defensive    │  ┌─ Lifecycle + UE assets ─────┐  │ [Run again]         │
│ └ Utility      │  │ /Script/PoF.GA_VS09Smite    │  │                     │
│                │  │ Last test: ✓ 1m ago         │  │                     │
│                │  └─────────────────────────────┘  │                     │
│                │  ┌─ Cross-links ───────────────┐  │                     │
│                │  │ Used by: Brute, Hssiss      │  │                     │
│                │  │ → linked Loot: lt-Brute     │  │                     │
│                │  └─────────────────────────────┘  │                     │
│                │  ┌─ Functional test ──────────┐  │                     │
│                │  │ VS09Ability.VSAbility09Test │  │                     │
│                │  │ Health 100 → 75 ✓           │  │                     │
│                │  └─────────────────────────────┘  │                     │
│                │  ┌─ Facets ─────────────────────┐  │                     │
│                │  │ Stats · Radar · Tests · Code │  │                     │
│                │  └──────────────────────────────┘  │                     │
└────────────────┴────────────────────────────────────┴─────────────────────┘
```

The **Entity Inspector** is the central new primitive. It's the same shell across all 8 catalogs (and the promoted Materials/Audio/Animation-Assets). It hosts a stack of **facet panels** which are catalog-specific:

| Facet | Description | Per-catalog implementation |
|---|---|---|
| **Header** | Name, category path, lifecycle badge, action buttons | Universal |
| **Spec** | The entity's design data (the typed `data` field) | Per-catalog editor |
| **Lifecycle + UE Assets** | Lifecycle state + `ueAssets[]` content paths with copy/open-in-UE buttons | Universal (reads `catalogStore`) |
| **Cross-links** | `CatalogLink[]` rendered as click-through to linked entities in other catalogs | Universal |
| **Functional Test** | The recipe's `testPath` result + log + "run again" | Universal (reads test-history store) |
| **Facets** (tab strip) | Catalog-specific deep views — for spellbook: stat bars, radar, generated C++; for bestiary: AI behavior, balance radar, encounters; for zone-map: 3D twin, procgen preview, quest DAG | Per-catalog |

The current per-module unique-tab UIs (ArchetypesTab, ComboChainDiagram, FlowNodesTab, ZoneMap inner sections, AnimationStateGraph panels) become **facet panels** mounted inside the appropriate entity inspector. Nothing is thrown away; it's just re-parented under entities.

### 3.3 Catalogs promoted from existing modules

Three modules have entity-shaped data and become catalogs:

- **Materials** — `material-lab`, `advanced-texture-panel`, master-material-instance data → `materials` catalog, entities are material definitions with PBR maps, instance counts, the existing UE binding tests as gate.
- **Audio** — `audio/AudioLibraryPanel`, the audio-import data → `audio` catalog, entities are sound sets with license + footstep wiring + the `VSFootstepWiringTest` as gate.
- **Animation-Assets** (separate from state-graph) — `animations/`, retargeting, montage assets → `animation-assets` catalog, entities are skeletal-mesh-bound montages.

These three lift their data into the same `CatalogEntityBase` shape we already have, register in `sections.ts`, and inherit the Entity Inspector shell for free.

### 3.4 Bulk operations on entities

A **multi-select shelf** at the top of the entity tree enables bulk operations driven by `batch.ts` (the single-dispatch queue we already shipped in folder-09):

- Bulk regenerate (run the same recipe step across N selected entities)
- Bulk verify (queue functional tests across N entities)
- Bulk export (collect UE asset paths into a manifest)
- Bulk lifecycle re-baseline (mark N entities `planned` again)

This is where the **agent-flight-recorder** (idea `8db7a7ed`) and **per-task diff review** (`a89549dc`) attach — the rail shows a queue of bulk operations with per-entity status, and structured `@@CALLBACK` payloads stream into each entity's inspector in real time.

## 4 · Tab 2 — Mission Control (the overview surface)

A single page consolidating the 5 existing overview dashboards. **Replaces** the Evaluator 26-tab god-tab (idea `ab134014` does this consolidation work).

### 4.1 Layout

```
┌─ Mission Control ───────────────────────────────────────────────────────────┐
│                                                                             │
│  Top headline: "142 of 200 features done · demo in 9 days · 2 agents now"  │  ← idea 3f4977fb
│                                                                             │
│  ┌─ Catalog Lifecycle ────────────┐  ┌─ Build & Test ──────────────────┐    │
│  │ 8 catalogs · 178/352 verified  │  │ Last build: ✓ 3m ago            │    │
│  │ [progress bars × 8]            │  │ Last test pass rate: 7/8 = 87%  │    │
│  │ ▲ Spellbook +5 verified today  │  │ ⚠ VSItems failing               │    │
│  └────────────────────────────────┘  └─────────────────────────────────┘    │
│                                                                             │
│  ┌─ Critical Path (b7927f28) ────────────────────────────────────────────┐  │
│  │ [DAG visualization with red highlighting on the bottleneck path]      │  │
│  │ Blocker: bestiary archetype Brute → needs ability A → needs ...       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Next Best Action (96f25afc) ──────┐  ┌─ Forecast (925151c6, 8a45533b)┐  │
│  │ 1. Regenerate GA_Frost              │  │ Playable by: 2026-06-12       │  │
│  │ 2. Wire BP_Hssiss → loot           │  │ ETA confidence: 78%           │  │
│  │ 3. Run VSZone gate after change    │  │ Trend: ▲ +3 days vs yesterday │  │
│  └─────────────────────────────────────┘  └───────────────────────────────┘  │
│                                                                             │
│  ┌─ Activity ──────────────────────────────────────────────────────────────┐ │
│  │ 12:42 [gen] VSAbility09Test verified                                    │ │
│  │ 12:31 [push] master ← 197 commits                                       │ │
│  │ 11:58 [test] VSLootDistributionTest 200/200 rolls                       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 What Mission Control absorbs

| Source today | Becomes |
|---|---|
| UnifiedSummaryView (Evaluator Overview tab) | "Critical Path" + "Activity" panels |
| ProjectHealthDashboard (radar chart) | Folded into Catalog Lifecycle panel |
| AggregateQualityDashboard (heatmap) | Folded into Catalog Lifecycle panel |
| DirectorOverview (playtest counts) | "Forecast" panel (with director ETA confidence) |
| CrossModuleFeatureDashboard (matrix) | "Critical Path" DAG (deps surfaced as edges, not a matrix) |
| Evaluator 26 tabs | Mostly **deleted**. Roadmap, Workflows, Patterns, i18n, Crashes, PP Studio, etc. either fold into Mission Control panels or are dropped per the DROP-STUB list. |

### 4.3 Mission Control core ideas folded in

**KEEP-CORE ideas that land here** (one per panel):
- `043728da` — structured cook log viewer → Activity panel jump-to-error
- `0a08d250` — orchestrated gated pipeline → Critical Path
- `0a9fe477` — cost/token spend → small footer chip
- `13107c70` — fuse perf + crashes → Forecast confidence input
- `15defbed` — match imported crashes → Activity panel
- `1e301d12` — self-healing UE-readiness gate → button on Catalog Lifecycle
- `21cea6d3` — predictive cook forecaster → Forecast
- `26a2c5f7` — unified health timeline → Forecast trend chart
- `2c4da945` — critical path dep graph → Critical Path
- `2c5de488` — predictive Mission Control → top headline + Forecast
- `2cba6df6` — bulk plan→DAG → NBA queue
- `3f4977fb` — live shareable command center → read-only `/mission-control` route
- `4e8d7fda` — anticipatory copilot → NBA panel
- `6237f43c` — ask-your-game (NL queries) → ⌘K palette integration
- `75fe1f1a` — alerting for critical findings → top headline + Activity
- `7b6ccedf` — cinematic Mission Control → animated build progress visualization
- `7df95d2a` — director mode NL → NBA / "what should I do?" widget
- `8603d0d6` — predictive fragility radar → Catalog Lifecycle annotations
- `8a45533b` — velocity-based completion forecast → Forecast
- `925151c6` — when will my game be done → Forecast
- `96f25afc` — project-wide NBA queue → NBA panel (PRIMARY)
- `ae20a945` — predictive success oracle → Forecast confidence interval
- `b2668699` — project home dashboard as default → IS Mission Control
- `b7927f28` — critical-path highlighting → Critical Path
- `c7cff73a` — value-vs-effort → NBA prioritization
- `ce5b130d` — NL roadmap oracle → ⌘K + NBA
- `d67fa562` — what-if time machine → Forecast scenarios
- `e1d1b89b` — milestone bundles → Critical Path milestones
- `ef237c77` — multi-agent DAG → NBA dispatch into CLI rail
- `f0f6e2e3` — self-healing feature matrix → Catalog Lifecycle panel
- `ff53b742` — autopilot self-driving build → NBA "Auto" mode (manual-gate by default)
- `9e354881` — session diff → Activity panel

## 5 · Tab 3 — Live State (the UE-side surface)

Always shows what's *actually* in UE right now. Persistent. Polls the bridge.

```
┌─ Live State ────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Bridge: ● connected · plugin v1.4 · 1,247 assets · last sync 12s ago      │
│                                                                             │
│  ┌─ Asset-Manifest Diff ────────────────────────────────────────────────┐  │
│  │ Catalog defines | In UE | Status                                      │  │
│  │ Spellbook  62  |  58   | 4 missing: GA_Frost, GA_Lightning, ...      │  │
│  │ Items     180  | 180   | ✓ in sync                                    │  │
│  │ Loot       18  |  16   | 2 missing                                    │  │
│  │ Bestiary   12  |   9   | 3 missing                                    │  │
│  │ [...]                                                                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Last Build ──────────┐  ┌─ Last Functional Tests ────────────────┐    │
│  │ ✓ PoFEditor 8.8s       │  │ VSAbility09Test    ✓ 12:39             │    │
│  │ 0 errors, 0 warn       │  │ VSItemsDefs        ✓ 12:38             │    │
│  │ Source/PoF (227 files) │  │ VSLootDistribution ✓ 12:39             │    │
│  └────────────────────────┘  │ VSEnemyAttack      ✓ 12:39             │    │
│                              │ VSCombatGrayBox    ✓ 12:41             │    │
│                              │ VSHUDFunctional    ✓ 12:41             │    │
│                              │ VSArenaSetup       ✓ 12:42             │    │
│                              │ ProcGenWalkTest    ✓ 12:44             │    │
│                              └────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ Live UObject Inspector (53d018a8) ──────────────────────────────────┐  │
│  │ Select an actor in the running PIE / editor → shows its UProperties   │  │
│  │ live. Folder-09 inspector tab pulls from the bridge.                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Crash Watchtower (fff73bb0, a23c6e6d, 15defbed) ───────────────────┐   │
│  │ No crashes in last 24h.  [Import crash dump]                          │   │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ 3D Zone Twin (4328916d) ────────────────────────────────────────────┐  │
│  │ Selected zone: VS09Ability · WebGL preview · scrub time, jump to ent. │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 What Live State absorbs

| Source today | Becomes |
|---|---|
| TopBar connection badge | Bridge status strip (still also in TopBar, but Live State has the detail) |
| ConnectionStatusBadge | Bridge status strip |
| Manifest hook (`useManifest`) | Asset-Manifest Diff panel |
| LiveStateSyncPanel (in Project Setup) | Top of Live State tab |
| BuildPipelinePanel (Core Engine module) | Last Build panel |
| BuildHistoryDashboard (game-systems) | Build history drawer (folds into Last Build) |
| Various crash panels | Crash Watchtower |
| FunctionalTesting scattered indicators | Last Functional Tests panel |

### 5.2 Live State KEEP-CORE ideas folded in

- `34b53407` — UE5 time-travel → "View this asset at a past timestamp" inline action on Asset Diff
- `4328916d` — living 3D zone twin → 3D Zone Twin panel
- `53d018a8` — live UObject inspector → Live UObject Inspector panel (PRIMARY)
- `a23c6e6d` — auto-ingest crashes → Crash Watchtower auto-import
- `a615e7f7` — live PIE co-tuning → "Tune live" button on entity inspector → opens PIE bridge
- `a65d0226` — living project digital twin → top-level concept of Live State
- `d876056b` — bridge health dashboard → Bridge status strip detail
- `fff73bb0` — crash watchtower → Crash Watchtower panel
- `ce85ff81` — unified bridge health console → cross-cutting status strip (also in TopBar)

## 6 · The CLI Rail (the bridge across all 3 tabs)

The single most important architectural change for closing the CLI/module gap.

### 6.1 Rail behavior

- **Always present** (collapsible 0 / 360px / 50%). Default 360px when an entity is selected; collapsed by default at root tab views.
- **Entity-scoped when an entity is selected.** Header says `Spellbook ▸ GA_VS09Smite`. The 13 `TaskFactory` methods all dispatch into this rail. New sessions get `moduleId` (already routed via `CATALOG_MODULE` in `useGeneration`) and the rail is filtered to the active entity's sessions.
- **Project-scoped** at Catalog Hub / Mission Control / Live State root. Shows the project's NBA queue (idea `96f25afc`).
- **Two-way binding.** When a session emits a `@@CALLBACK` payload (e.g., "GA_VS09Smite scaffolded at /Script/PoF.GA_VS09Smite"), the payload streams into the originating entity inspector cell in real-time. The catalog cell updates optimistically; reconciliation against `/api/catalog` happens after the callback POST. **No more "the API updated but the UI doesn't know yet."** (Today's gap.)
- **Per-task diff review** (idea `a89549dc`) — clicking a completed task shows the file diff Claude produced, with accept/reject. Wired through the existing `cli-task.ts` callback system extended to emit file change manifests.
- **Run history + transcript replay** (idea `4974ec2c`) — every session's transcript is stored; clicking past sessions replays the prompt + output without re-running.
- **Agent flight recorder** (idea `8db7a7ed`) — per session, capture inputs / tools called / outputs as a structured timeline.

### 6.2 Rail KEEP-CORE ideas folded in

- `04a08364` — visual prompt builder → "compose" button on rail
- `0ee551b8` — prompt history with diff → Run history panel inside rail
- `135ee09d` — one-click fix from any finding → finding → rail dispatch
- `4974ec2c` — persistent run history + replay → Run history (PRIMARY)
- `5144e216` — live progress for long ops → already partly built; finished here
- `6d9c9b9a` — auto-adopt winning prompt → after N successful runs of same template, mark as adopted
- `7bc512b9` — one-click fixes for asset/code → buttons on entity inspector → rail
- `8db7a7ed` — agent flight recorder → Per-session timeline drawer
- `a465ebf2` — self-improving task engine → telemetry-driven prompt refinement
- `a89549dc` — per-task diff review → file-change manifest + accept/reject (PRIMARY)
- `af5fbfe9` — closed-loop world synthesis → for zone-map regeneration
- `dafd6380` — plain-language prompt composer → "compose" UX inside rail
- `e0ed7c04` — NL intent → prompt compiler → ⌘K query → composed prompt → rail dispatch
- `f340c77b` — one-click fix with Claude → rail dispatch on any flagged issue
- `fe9b39ab` — wire one-click crash fix → from Crash Watchtower → rail
- `9eebaf16` — hot-patch history with rollback → Run history → rollback action

### 6.3 Command Palette (⌘K) integration

The palette is the cross-cutting jump-to / dispatch surface across all 3 tabs. It absorbs:

- `18ad7099` — Ctrl+K with actionable rows (PRIMARY)
- `41c61ebf` — ask-PoF NL intent
- `675dc44d` — universal intent shell
- `a79bc1c5` — plain-English asset finder
- `c09e7172` — palette upgrade for GlobalSearchPanel
- `c59b4ae9` — Cmd-K instant search/dispatch

Categories in the palette:
- **Jump to entity** (`Bestiary > Brute`, `Spellbook > Fireball`) — full-text + tag search
- **Dispatch action** (`Regenerate Brute`, `Verify Items`, `Run all gates`) — natural-language → composed prompt → rail
- **Open view** (`Open Mission Control`, `Open Live State`, `Open zone twin`)
- **Recent** (last 5 things you touched)

## 7 · Data model (mostly already done)

We do not rewrite the data model. Folder-09 already shipped:
- `CatalogEntityBase` with `lifecycle`, `ueAssets`, `categoryPath`, `tags`, `links`
- 8 catalogs registered in `sections.ts`
- `catalogStore` with gated lifecycle reducer
- `recipe.ts` per-catalog with `testPath`
- `useGeneration` with entity-generic dispatch
- 8 live UE gates proven green

**Additive changes only:**
- New catalogs (`materials`, `audio`, `animation-assets`) follow the same shape; their existing data is migrated.
- New `entityInspector` store records facet expansion state per entity.
- New `missionControlStore` aggregates: critical path DAG, NBA queue, forecast inputs.
- New `liveStateStore` polls the bridge for asset manifest, build status, test history.
- New `cliRailStore` consolidates `cliPanelStore` + new per-entity scoping + run-history persistence.

## 8 · Phases (the build plan)

This is a multi-day refactor. **12 phases**. Each phase ends green (`npm run validate` + targeted tests). Phases are sequential with explicit checkpoints. The first 4 phases are the foundation (shell + catalog hub + entity inspector + CLI rail). The middle 4 phases migrate existing modules into the new shell. The last 4 phases land enhancements + UI polish + cleanup + final live UE proof of the refactored experience.

| # | Phase | Output |
|---|---|---|
| **1** | **L1 shell scaffold** | New `AppShell`, 3-tab nav, CLI Rail container, ⌘K palette upgrade. `navigationStore` extended. Old sidebar still mounted behind a `?legacy=1` flag for safety; new shell is the default. |
| **2** | **Entity Inspector primitive** | Universal Inspector shell + Header + Spec + Lifecycle + Cross-links + Functional Test + Facets tab strip. Drop-in for any catalog. |
| **3** | **Catalog Hub** | 8-row catalog overview page with progress bars + entry counts + last-test indicators. Per-catalog detail view (tree + inspector). All 8 catalogs work end-to-end. |
| **4** | **CLI Rail + two-way binding** | `cliRailStore`, structured `@@CALLBACK` payload routing into entity inspector cells, run history, per-task diff review, agent flight recorder. |
| **5** | **Mission Control** | Consolidate 5 existing dashboards into single page. Critical Path DAG, NBA queue, Forecast, Activity feed. Read-only `/mission-control` route. |
| **6** | **Live State** | Bridge status strip detail, Asset-Manifest Diff, Last Build, Last Functional Tests, Live UObject Inspector, Crash Watchtower, 3D Zone Twin. |
| **7** | **Module migration A — Core Engine catalogs** | Move ArchetypesTab, ComboChainDiagram, FlowNodesTab, ZoneMap inner, AnimationStateGraph panels under their catalog entity inspectors as facets. Old Core Engine modules deprecated. |
| **8** | **Module migration B — Promote Materials/Audio/Animation-Assets** | Lift these 3 modules' data into new catalogs. Register in `sections.ts`. Their UI becomes catalog facets. |
| **9** | **Module migration C — Fold Evaluator + Game Director + Game Systems** | Roadmap/Workflows/Patterns/GDD/i18n/Crashes/PPStudio → Mission Control panels OR deleted (per DROP-STUB list). DebugDashboard, BP Transpiler textarea, Sprint Builder, Feel Studio → **deleted**. |
| **10** | **Per-catalog enhancements** | Land the ~67 KEEP-ENHANCE ideas, prioritized by impact, one batch per catalog. Spellbook gets `058687cb`/`158f9e5e`/`21f15b68`/`99292419`. Items gets `05f25f33`/`327e3733`/`3f7e7c81`/`5eee9409`/`84abc79e`. (etc.) |
| **11** | **Design-system + a11y + observability pass** | Land the ~37 KEEP-INFRA ideas: focus rings, typography tokens, glossary tooltips, chart tooltip primitive, asset picker, Shiki highlighting, retry/DLQ, knowledge inbox, accessible sliders. |
| **12** | **Cutover, cleanup, and live proof** | Remove the `?legacy=1` flag. Delete the old `AppShell`/`SidebarL1`/`SidebarL2`/`ModuleRenderer`. Delete dead modules per DROP-STUB. Run all 8 live UE gates against the refactored shell. First-run guided tour (`bb068439`). Commit + tag `v2.0-entity-centric`. |

Each phase will get its own implementation plan file under `docs/superpowers/plans/`. Plans use the proven TDD + bite-sized-step format from folder-09.

## 9 · Migration safety

- **Branch:** `feature/entity-centric-workspace`. All work lands here. Merge to master only after Phase 12 passes.
- **Legacy flag:** Phases 1–11 keep the old shell behind `?legacy=1` URL flag. Operator can A/B compare any time.
- **Shared-tree:** master remains stable for other CLIs continuing to work in parallel. Foreign WIP files in working directory are leftover from a non-mine session and isolated.
- **Data:** catalog data is shared with master via the SQLite DB (`~/.pof/pof.db`). Refactor reads + writes the same data; backwards-compatible.
- **Tests:** every phase ends with `npm run validate` + targeted vitest + tsc clean. Phase 12 also re-runs the 8 live UE gates.

## 10 · Out of scope (explicit)

The ~147 dropped backlog ideas. Categories:

- **Blender pipeline** — `07114e20`, `2d4fe8fa`, `84ef55d4`, `88943040`, `a72d2880`, several MCP-related
- **Asset/material/texture niche** — `1b469379`, `1611640d`, `2d57d2a9`, `36bba5e2`, `372fc223`, `3cc2c9d1`, `3f8e6288`, `52ed7b86`, `55550990`, `56842063`, `5802df5a`, `5ea5d3b5`, `6409dc73`, `9315fe16`, `a60f5663`, `c7e1c641`, `dcc3c4d1`, `e6266eac`
- **Audio middleware / spatial / mixing** — `25222d7d`, `33edf5e4`, `3b24d6ed`, `4bf63caa`, `6742bbd3`, `7f56765a`, `85295fa3`, `8bef0f10`, `8ec1e105`, `b9edeccf`, `ce52eab4`, `e2b95e0c`
- **Marketplace / community / federated AI** — `0da1c0b0`, `16cbc990`, `222dc99a`, `3700d83b`, `3aa75aff`, `427c616a`, `4939416e`, `4b57dbe2`, `71ab28cf`, `7108fc8e`, `76ee4d05`, `8b02ff06`, `9ad2c174`, `a080133e`, `afb1819c`, `b0ac2500`, `c3d11f7b`, `f5568e89`, `f8ddef05`, `fa91aad9`, `fd0c4e7b`
- **Localization** — `02b5d775`, `0d6e0e8b`, `24b9a2aa`, `39d822ae`, `468594be`, `4952bf02`, `8bef0f10`, `c1310789`, `da9fb25c`, `ed9786ca`
- **Niche moonshots that don't anchor to the entity model** — various (full list in `docs/_scratch/idea_verdicts.md`)
- **Modules slated for deletion** (DROP-STUB) — DebugDashboard, PP Studio, Evaluator 26-tab regroup variants, BP Transpiler textarea, genome/progression panels, audio module tab regroup, level-design tab regroup, Sprint Builder, Feel Studio, Gantt planning

All DROP-OOS + DROP-STUB `.claude/commands/idea-*.md` files are deleted in Phase 0 (before Phase 1 starts) to physically scope-out from future scans.

## 11 · Risks

- **Largest refactor PoF has done.** 12 phases over many CLI-days. The legacy flag mitigates by allowing rollback at any point.
- **Shared-tree concurrency** with other CLIs continuing on master. Mitigated by the feature branch; we only re-sync with master at Phase 12.
- **Data migration for promoted catalogs (Materials/Audio/Animation-Assets)** must preserve existing UI state. Phase 8 has a dedicated migration step + tests.
- **Asset Studio re-routing** — the 9 Visual Gen modules move from L1 sibling to entity-tool-drawer. Operator may miss the L1 access; mitigated by a clearly-visible "tools" button on every entity inspector + ⌘K shortcut.
- **Bridge poll load** — Live State polls the bridge continuously; rate-limit via existing `ue5-bridge/ws-live-state.ts` (no new transport).
- **Evaluator god-tab consolidation** loses some surfaces (PP Studio, i18n, Patterns). These were either rarely used or are out-of-scope per the verdicts; if any turns out to be essential mid-refactor, restore as a Mission Control panel.

## 12 · Acceptance

Refactor is complete when:
1. The 3 L1 tabs are the only persistent navigation. Old shell removed.
2. All 8 catalogs (plus 3 promoted: materials/audio/animation-assets) have full Entity Inspector coverage.
3. CLI Rail is the only CLI dispatch surface; structured `@@CALLBACK` payloads stream into entity inspector cells in real time.
4. Mission Control is the default landing page. The 5 old dashboards no longer exist.
5. Live State is always reachable; Asset Manifest Diff shows non-zero useful information.
6. All 8 per-section live UE gates still pass headless.
7. `npm run validate` is clean on the feature branch.
8. The ~147 DROP backlog files are gone from `.claude/commands/`.
9. The remaining ~184 keepers are mapped to specific phases in `docs/_scratch/idea_verdicts.md` (already done).
10. First-run guided tour (`bb068439`) demonstrates the new shape end-to-end.

---

**End of spec. Implementation plans for each of the 12 phases follow under `docs/superpowers/plans/2026-05-24-pof-ecw-phase-{NN}-*.md`.**

---

## 13 · ADDENDUM (2026-05-25) — Shell Switcher + Production Pipeline

Two operator-requested additions folded into the design after the foundation phases landed.

### 13.1 · Shell Switcher in the header (request 1)

Legacy is NOT descoped. Instead of typing `?ecw=1`, both shells get a header toggle:
- A shared `<ShellSwitcher />` renders a 2-state toggle (Legacy ⇄ New).
- It reads the current `?ecw` param and, on click, flips it via `history.pushState` + a dispatched `popstate` (which `page.tsx`'s `useSyncExternalStore` already listens to) — swapping the shell with no full reload.
- Mounted in `EcwTopBar` (new shell) and the legacy `TopBar` (minimal one-line addition, re-read-gated for shared-tree safety).
- The `?ecw=1` URL gate stays as the underlying mechanism; the switcher is just a visible control over it. Full legacy removal remains Phase 12.

### 13.2 · Production Pipeline per entity (request 2)

**The gap:** the Entity Inspector showed a single linear `lifecycle` (planned→…→verified). But "playable" actually requires multiple **production tracks** completed in parallel — gameplay logic, AI, 2D art, 3D art, animation, audio, VFX, and the functional-test gate. An entity can be `verified` on its core logic yet have no icon, no mesh, no SFX.

**The feature:** clicking a first-level entity surfaces, as the **top panel** of the inspector, a visualized **factory pipeline** — one node per track the entity's catalog needs, each colored by coverage state. Clicking a node opens its detail: current state, what's still needed, and an **"Evaluate with CLI"** action that dispatches Claude (into the CLI Rail) to assess that track and recommend next steps.

**Tracks** (`PipelineTrackId`): `logic · ai · art-2d · art-3d · animation · audio · vfx · test`.

**State** (`TrackState`): `not-started · in-progress · done · blocked`.

**Per-catalog pipeline** (`PIPELINE_BY_CATALOG`) — which tracks each catalog requires:
| Catalog | Tracks |
|---|---|
| spellbook | logic · art-2d · animation · vfx · audio · test |
| items | logic · art-2d · art-3d · test |
| loot-tables | logic · test |
| bestiary | logic · ai · art-3d · animation · audio · test |
| combat-map | logic · animation · test |
| screen-flow | logic · art-2d · test |
| zone-map | logic · art-3d · test |
| state-graph | animation · test |
| materials | art-3d · test |
| audio | audio · test |
| animation-assets | animation · test |
| (default) | logic · test |

**Persistence (operator decision: persisted store from the start).** Track state is stored, not just heuristically derived:
- `src/lib/pipeline/tracks.ts` — track defs + `PIPELINE_BY_CATALOG` + `pipelineForCatalog` (pure).
- `src/lib/pipeline-db.ts` — `pipeline_tracks` table (catalog_id, entity_id, track_id, state, note, updated_at; PK composite) + `rowToTrack` (pure, tested) + `listTracks`/`upsertTrack`. Mirrors `catalog-db.ts` exactly.
- `src/app/api/pipeline/route.ts` — GET `?catalogId=&entityId=` → records; POST `{catalogId,entityId,trackId,state,note?}` → upsert. `{success,data}` envelope.
- `src/stores/pipelineStore.ts` — `tracksByEntity['catalogId/entityId'][trackId] = TrackState`; `loadTracks`, `setTrackState`, `useEntityTracks` selector. Mirrors `catalogStore` lifecycle-merge conventions; transient nothing persisted (DB is source of truth, loaded on entity open).

**UI (top panel):**
- `src/components/ecw/pipeline/PipelineOverview.tsx` — horizontal track nodes, state-colored, click → select.
- `src/components/ecw/pipeline/PipelineTrackDetail.tsx` — selected track state + state-setter buttons (→ POST /api/pipeline) + "Evaluate with CLI" button.
- `src/hooks/useEntityTrackHelp.ts` — wraps `useModuleCLI` + `TaskFactory.quickAction`, dispatches a track-scoped evaluation prompt into the CLI Rail.
- Wired into `EntityInspector` ABOVE the Header/Spec panels; loads tracks on entity open.

**Deferred to 13b:** CLI auto-writeback of track state via `@@CALLBACK` (Phase 13 keeps "Evaluate with CLI" as a help dispatch; user reads the evaluation and sets the state). Richer per-track asset detection.

This addition directly deepens pain #3 ("see current state of the game") — the pipeline answers *"what's left to make this entity playable?"* at a glance, per entity, with a one-click path to CLI help on any gap.
