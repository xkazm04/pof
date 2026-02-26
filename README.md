# Pillars of Fortune (PoF)

An AI-powered companion for building Unreal Engine 5 C++ games. PoF provides structured checklists, intelligent prompts, feature tracking, and quality evaluation — all designed to keep a large-scale game project on track from first prototype to polish pass.

## Philosophy

Game development in UE5 C++ is a multi-year, multi-system endeavor. PoF exists to reduce the cognitive overhead by:

- **Breaking the work down** — every module (combat, animation, loot, UI, audio, etc.) has a curated checklist of implementation steps with embedded UE5 best-practice prompts.
- **Tracking what's done** — a Feature Matrix records implementation status and quality scores across all modules, so you always know where you stand.
- **Connecting the dots** — a dependency graph between features surfaces the Next Best Action and prevents building on missing foundations.
- **Learning from mistakes** — build errors are fingerprinted and stored so the same mistake isn't repeated twice.
- **Evolving prompts** — an A/B testing engine measures prompt effectiveness and promotes winners automatically.

## Key Features

**Module System** — 39 domain modules across 6 categories (character, combat, loot, animation, materials, level design, AI, multiplayer, etc.) each with checklists, quick actions, and knowledge tips. Over 170 checklist items and 100+ quick actions total.

**Integrated CLI Terminal** — Spawns Claude Code directly from the UI. Domain-specific skill packs are injected into prompts based on context (souls-combat, loot-itemization, projectile-systems, etc.). A callback system (`@@CALLBACK:<id>` markers) lets Claude submit structured results back to the app automatically.

**Feature Matrix** — Per-feature implementation tracking with statuses (implemented / improved / partial / missing), quality scores 1-5, and historical review snapshots. Tracks 300+ unique features with cross-module dependency resolution.

**Evaluator** — 3-pass deep evaluation (structure, quality, performance) with cross-module correlation, pattern extraction, and a finding collector that rolls up issues into actionable fix plans.

**Game Director** — Session-based analysis that reviews your project holistically, tracks findings over time, and detects regressions between sessions.

**Prompt Builder** — Composable 6-section prompt architecture (project context, domain context, task instructions, UE5 best practices, output schema, success criteria) ensures consistent, high-quality AI interactions.

**NBA Engine** — Next Best Action recommendations scored 0-100 across five dimensions: urgency (dependency blockers), success probability (pattern track record), impact (features unblocked), recency (evaluator recommendations), and readiness (dependencies met).

**PoF Bridge** — Live connection to the UE5 companion plugin for real-time manifest data, test execution, snapshot management, live coding, and compilation feedback.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16, React 19 |
| State | Zustand 5 (with persist) |
| Database | better-sqlite3 (WAL mode, stored at `~/.pof/pof.db`) |
| Styling | Tailwind CSS 4, Framer Motion |
| Testing | Vitest |
| Validation | Zod 4 |
| Code Highlighting | Shiki |
| Icons | Lucide React |
| Virtualization | react-window |
| Notifications | Sonner |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs entirely locally — all data is stored in a SQLite database in your home directory.

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Run tests
npm run test:watch   # Vitest in watch mode
npm run validate     # typecheck + lint + test (full CI check)
```

## Project Structure

```
src/
├── app/                 # Next.js App Router + 60+ API routes
├── components/
│   ├── cli/             # Terminal UI, task queue, skills, UE5 build parser
│   ├── layout/          # App shell (TopBar, Sidebar, ModuleRenderer, CLI panel)
│   ├── modules/         # All feature modules by category
│   │   ├── content/     # animations, audio, materials, level-design, models, ui-hud
│   │   ├── core-engine/ # aRPG modules + unique visualization tabs
│   │   ├── evaluator/   # Quality dashboards, pattern library, GDD compliance
│   │   ├── game-director/ # Session tracking, regression detection
│   │   ├── game-systems/  # AI, physics, multiplayer, dialogue, packaging
│   │   ├── project-setup/ # Project wizard, path browser, build verification
│   │   └── shared/      # FeatureMatrix, QuickActions, RoadmapChecklist
│   └── ui/              # Reusable primitives (Badge, Card, ProgressRing, etc.)
├── hooks/               # 30+ custom React hooks
├── lib/                 # Core business logic, DB layers, prompt builders
│   ├── claude-terminal/ # CLI service, session manager, stream-json parser
│   ├── evaluator/       # Deep eval engine, finding collector, correlation
│   ├── pof-bridge/      # UE5 plugin bridge client, connection manager
│   ├── prompts/         # Per-module prompt builders (animation, material, etc.)
│   └── *.ts             # NBA engine, event bus, lifecycle, feature defs, etc.
├── services/            # Cross-store bridges
├── stores/              # 20 Zustand stores
└── types/               # TypeScript definitions
```

---

## Module Breakdown

PoF organizes game development into 39 modules across 6 categories. Each module provides a curated checklist, quick actions, knowledge tips, and domain-specific prompts.

### Core Engine (13 modules)

The aRPG backbone — these modules cover every system needed to build a souls-like or action RPG from scratch.

| Module | Description | Key Features |
|--------|-------------|--------------|
| **Character & Movement** (`arpg-character`) | Base character class, input binding, camera, locomotion | `AARPGCharacterBase`, Enhanced Input, spring arm camera, root motion movement |
| **Animation System** (`arpg-animation`) | AnimInstance, blend spaces, montages, state machines | Custom AnimInstance, locomotion blend space, attack montages, hit reacts, retargeting pipeline |
| **Ability System (GAS)** (`arpg-gas`) | Gameplay Ability System integration | ASC setup, attribute sets, gameplay tags, abilities, gameplay effects, damage calculation |
| **Combat System** (`arpg-combat`) | Melee, combos, hit detection, souls-like mechanics | Combo chains, trace-based hit detection, dodge/roll i-frames, death/respawn, hit feedback |
| **Enemy AI** (`arpg-enemy-ai`) | AI controllers, behavior trees, perception | AI controller, enemy character base, perception (sight/hearing), behavior trees, EQS, archetypes, spawn system |
| **Items & Inventory** (`arpg-inventory`) | Item data, inventory component, equipment | Item definitions, instance system, inventory component, equipment slots, consumables, affixes/modifiers |
| **Loot & Drops** (`arpg-loot`) | Loot tables, world drops, pickup system | Weighted loot tables, rarity tiers, world drop actors, drop-on-death, pickup interaction, chest/container system |
| **UI & HUD** (`arpg-ui`) | HUD widgets, GAS binding, menus | HUD overlay, GAS attribute binding, enemy health bars, cooldown display, inventory/stats screens, damage numbers |
| **Progression** (`arpg-progression`) | XP, leveling, attribute allocation, unlocks | XP/level attributes, progression curves, XP award on kill, level-up effects, ability unlocks, attribute allocation |
| **World & Levels** (`arpg-world`) | Zone layout, transitions, boss arenas | Zone layout, blockout meshes, spawn placement, interactive objects, zone transitions, boss arenas, hazards, NavMesh |
| **Save & Load** (`arpg-save`) | Persistence, serialization, save slots | USaveGame subclass, custom serialization, async save/load, auto-save, save slot UI, versioning/migration |
| **Polish & Debug** (`arpg-polish`) | Optimization, debugging, final pass | Structured logging, debug draw, console commands, object pooling, tick optimization, async asset loading |
| **Plan** (`core-engine-plan`) | Implementation planning and dependency visualization | Plan matrix map, implementation orchestrator, feature dependency graph |

Each core-engine module includes **unique visualization tabs** for interactive exploration:

- **AbilitySpellbook** — catalog of all abilities with cooldowns and costs
- **AnimationStateGraph** — visual state machine viewer for animation states
- **CombatActionMap** — flow diagram of combo chains and action sequences
- **DebugDashboard** — real-time debug tools and variable inspection
- **EnemyBestiary** — enemy catalog with stats, behaviors, and drop tables
- **ItemCatalog** — filterable item database with affix previews
- **LootTableVisualizer** — weighted drop probability visualization
- **ProgressionCurve** — XP and stat progression charts
- **ScreenFlowMap** — UI/UX screen flow diagrams
- **ZoneMap** — world zone layout with spawn and transition points

### Content (6 modules)

Asset creation and management tools for the art and audio pipeline.

| Module | Description | Key Features |
|--------|-------------|--------------|
| **3D Models** (`models`) | Mesh import pipeline, LODs, skeletal setup | Asset pipeline diagram, import settings, LOD configuration, skeletal mesh setup |
| **Animations** (`animations`) | Animation authoring, retargeting, automation | AnimBP scanning, retarget pipeline, animation-specific prompt builder with UE5 best practices |
| **Materials** (`materials`) | Material instances, parameters, style transfer | Material parameter configurator, style transfer tool, shader complexity analysis |
| **Level Design** (`level-design`) | Spatial layout, difficulty arcs, world building | Spatial diagram visualization, difficulty arc charts, sync status panel, level design DB persistence |
| **UI / HUD** (`ui-hud`) | Widget blueprints, UMG, screen flows | Widget hierarchy, UMG layout, HUD overlay authoring |
| **Audio** (`audio`) | Sound cues, audio events, spatial audio | Audio property panel, code generation panel, spatial audio generator, audio scene management |

### Game Systems (8 modules)

Cross-cutting gameplay systems beyond the core aRPG loop.

| Module | Description | Key Features |
|--------|-------------|--------------|
| **AI / NPC Behavior** (`ai-behavior`) | Advanced AI behaviors, testing sandbox | Behavior tree authoring, AI testing sandbox with configurable scenarios |
| **Physics & Collision** (`physics`) | Physics configuration, collision profiles | Physics material setup, collision channel config, ragdoll tuning |
| **Multiplayer** (`multiplayer`) | Replication, netcode, session management | Property replication, RPCs, session creation, lag compensation |
| **Save / Load** (`save-load`) | Extended save system, cloud saves | Platform-specific save paths, cloud save integration, data migration |
| **Input Handling** (`input-handling`) | Enhanced Input System, rebinding | Input mapping contexts, action bindings, gamepad support, rebinding UI |
| **Dialogue & Quests** (`dialogue-quests`) | Dialogue trees, quest state machines | Dialogue node editor, quest state tracking, quest generation prompts |
| **Packaging** (`packaging`) | Build packaging, cook settings, platform profiles | Build configuration selector, cook settings panel, platform profile cards, size trend analytics, build history dashboard |
| **BP to C++** (`blueprint-transpiler`) | Blueprint to C++ conversion | Blueprint parser, C++ code generation, transpilation preview |

### Evaluator

The quality intelligence layer that continuously analyzes your project.

| Component | Description |
|-----------|-------------|
| **Deep Evaluation Engine** | 3-pass analysis (structure, quality, performance) per module. Each pass produces structured findings that are deduplicated and aggregated. |
| **Aggregate Quality Dashboard** | Unified quality scores across all modules with trend visualization |
| **Cross-Module Feature Dashboard** | Tracks features that span multiple modules and their dependency health |
| **Cross-Module Overlap Panel** | Detects duplicated or conflicting implementations across modules |
| **Dependency Graph** | Interactive visualization of 300+ feature dependencies with blocker detection |
| **Pattern Library** | Stores successful implementation patterns with success rates for NBA scoring |
| **GDD Compliance Checker** | Validates implementation against the living Game Design Document |
| **Game Design Document** | Auto-synthesized living GDD built from project data and evaluator findings |
| **Finding Collector** | Aggregates raw eval findings into deduplicated, prioritized issue lists |
| **Correlation Engine** | Detects relationships between findings across different modules |
| **Fix Plan Generator** | Converts findings into step-by-step fix plans with priority ordering |
| **Crash Analyzer** | Parses UE5 crash logs, identifies root causes, suggests fixes |
| **Combat Simulator** | Simulates combat encounters for balance tuning |
| **Economy Simulator** | Models game economy for currency/drop-rate balancing |
| **Performance Profiler** | Tracks frame time, draw calls, memory usage against budgets |
| **Post-Process Studio** | Post-process volume configuration and effect preview |
| **Asset Code Oracle** | Analyzes assets referenced in C++ code for consistency |
| **Asset Scout** | Discovers untracked or orphaned assets in the project |
| **Codebase Archeologist** | Deep codebase analysis for architecture patterns and tech debt |
| **Localization Pipeline** | Translation status tracking, string extraction, locale management |
| **Calendar Roadmap** | Timeline-based planning with milestone deadlines |
| **Workflow Orchestrator** | DAG-based task orchestration with dependency resolution |
| **Session Analytics** | Tracks development session durations, productivity patterns |
| **Weekly Digest** | Auto-generated weekly progress summaries |
| **Prompt Evolution** | Tracks prompt version history and effectiveness (A/B test results) |
| **Holistic Health View** | Overall project health combining all evaluator signals |
| **Nexus View** | Central hub connecting all evaluator subsystems |

### Game Director

Session-based holistic project analysis and regression tracking.

| Component | Description |
|-----------|-------------|
| **Director Overview** | High-level project status dashboard |
| **New Session Panel** | Creates new review sessions with scope configuration |
| **Session Detail** | Per-session findings with severity and affected modules |
| **Findings Explorer** | Browse and filter all findings across sessions |
| **Regression Tracker** | Compares findings between sessions to detect regressions or improvements |

### Project Setup

First-run configuration and ongoing project management.

| Component | Description |
|-----------|-------------|
| **Setup Wizard** | Guided project initialization (UE5 path, project name, modules) |
| **Path Browser** | Navigate filesystem to locate UE5 projects |
| **Build Verify Panel** | Validates UE5 build toolchain is properly configured |
| **Project Files Panel** | Browse and inspect project source files |
| **Tooling Bootstrap** | Ensures required CLI tools and plugins are installed |
| **Manifest Preview** | Inspects the project manifest (modules, paths, settings) |

---

## Unique Systems

### CLI Terminal & Task System

The terminal spawns Claude Code directly from the UI and manages sessions, task queues, and structured result collection.

- **CLI Service** (`lib/claude-terminal/cli-service.ts`) — spawns Claude Code, parses stream-json output, manages session lifecycle
- **Task Abstraction** (`lib/cli-task.ts`) — every CLI invocation is a `CLITask` created via `TaskFactory` methods (`.checklist()`, `.featureFix()`, `.featureReview()`, `.moduleScan()`, `.quickAction()`, `.askClaude()`)
- **Callback System** — prompts embed `@@CALLBACK:<id>` markers; the terminal intercepts Claude's output, validates JSON, merges static fields (e.g., `moduleId`), and POSTs results to the app's API. Callers never handle raw output
- **Skill Packs** (`components/cli/skills/`) — domain-specific knowledge injected into prompts: souls-combat, loot-itemization, projectile-systems, animation-state-machines, and more
- **UE5 Build Parser** — parses Unreal Build Tool output for errors, warnings, and build metrics

### Prompt Engineering System

Composable, context-aware prompt construction ensures every AI interaction carries the right UE5 domain knowledge.

- **Shared Context Header** (`lib/prompt-context.ts`) — `buildProjectContextHeader()` injects UE project paths, build commands, coding standards, and error memory into every prompt
- **Fluent Prompt Builder** (`lib/prompts/prompt-builder.ts`) — 6-section pipeline: Project Context, Domain Context, Task Instructions, UE5 Best Practices, Output Schema, Success Criteria
- **Per-Module Builders** — specialized prompt builders in `lib/prompts/` for animation checklists, material configuration, AI testing, audio events, inventory, level design, post-process, and more
- **Prompt Evolution** — tracks prompt versions over time, measures effectiveness, and promotes high-performing variants

### NBA Engine (Next Best Action)

Recommends which checklist item to work on next by scoring across multiple dimensions.

- Reads from checklist progress, dependency graph, pattern library, evaluator recommendations, and task history
- **Scoring breakdown (0-100):**
  - Urgency (0-30) — dependency blockers, critical priority
  - Success Probability (0-25) — pattern success rate, module track record
  - Impact (0-20) — number of features unblocked downstream
  - Recency (0-15) — evaluator recommendation freshness
  - Readiness (0-10) — all dependencies satisfied
- Each recommendation includes a human-readable reason, matched pattern, known pitfalls, and the full score breakdown

### Event Bus

Typed publish/subscribe system for decoupled communication across the application.

- Namespaced channels: `cli.*`, `eval.*`, `build.*`, `checklist.*`, `file.*`
- Replay buffer (200 events) for late subscribers
- Wildcard and namespace prefix subscriptions

### Lifecycle System

Resource management protocol ensuring deterministic cleanup across component lifecycles.

- `createLifecycle` — single resource wrapper (init/dispose)
- `createSubscriptionLifecycle` — event subscription management
- `createGuardedLifecycle` — one-time initialization guard
- `createTimerLifecycle` — debounced timer management
- `composeLifecycles` — combine multiple lifecycles into one
- `useLifecycle()` hook — guaranteed cleanup on unmount

### Suspend / LRU Cache

Modules are cached in an LRU when navigating away. Hidden modules receive a `SuspendContext = true` signal.

- `useSuspendableEffect` — timers and polling pause when the module is hidden
- `useSuspendableSelector` — Zustand subscriptions freeze when suspended
- Prevents unnecessary re-renders and background CPU usage for off-screen modules

### PoF Bridge

Real-time connection to the UE5 companion plugin for live project awareness.

- **Connection Manager** — WebSocket-based connection lifecycle with auto-reconnect
- **Manifest Sync** — live project manifest data (assets, classes, configurations)
- **Test Runner** — trigger and monitor UE5 automation tests from the web UI
- **Snapshot Management** — capture and compare project state snapshots
- **Live Coding** — hot-reload support for rapid iteration
- **Compilation Feedback** — real-time build status and error reporting
- **Verification Engine** — rule-based verification of UE5 project state

### Database Layer

10 SQLite tables managed through dedicated `*-db.ts` files, all sharing a single better-sqlite3 instance with WAL mode.

| Database File | Purpose |
|--------------|---------|
| `feature-matrix-db.ts` | Feature status, quality scores, review history |
| `session-log-db.ts` | CLI session records and transcripts |
| `error-memory-db.ts` | Fingerprinted build errors and resolution history |
| `session-analytics-db.ts` | Development session duration and productivity metrics |
| `pattern-library-db.ts` | Successful implementation patterns with success rates |
| `telemetry-db.ts` | Module usage and interaction telemetry |
| `level-design-db.ts` | Level layout, zone, and spatial data |
| `audio-scene-db.ts` | Audio scene configurations and cue mappings |
| `ai-testing-db.ts` | AI test scenarios and results |
| `game-director-db.ts` | Director session findings and regression data |

### State Management

20 Zustand v5 stores with persist middleware, organized by domain.

| Store | Purpose |
|-------|---------|
| `moduleStore` | Checklist progress, verification status, scan results |
| `projectStore` | Project setup, recent projects, dynamic UE5 context |
| `navigationStore` | Active module, tab, and panel navigation |
| `evaluatorStore` | Evaluation results and finding aggregations |
| `patternLibraryStore` | Implementation patterns and success metrics |
| `pofBridgeStore` | PoF Bridge connection state and live data |
| `ue5BridgeStore` | UE5 Bridge connection and build status |
| `activityFeedStore` | Activity feed events and notifications |
| `combatSimulatorStore` | Combat encounter simulation state |
| `crashAnalyzerStore` | Crash log analysis results |
| `economySimulatorStore` | Economy simulation parameters and results |
| `errorDiagnosticsStore` | Error diagnostic data and resolution tracking |
| `gddComplianceStore` | GDD compliance scores per module |
| `localizationPipelineStore` | Localization progress and string coverage |
| `marketplaceStore` | Marketplace asset integration state |
| `performanceProfilingStore` | Performance budget tracking |
| `postProcessStudioStore` | Post-process effect configurations |
| `projectHealthStore` | Aggregated project health metrics |
| `promptEvolutionStore` | Prompt version history and A/B results |
| `taskDAGStore` | Task dependency DAG for workflow orchestration |

### API Surface

60+ API routes organized by domain, all following a standardized envelope pattern:

```typescript
// Success: { success: true, data: T }
// Error:   { success: false, error: string }
```

**Key route groups:**
- `/api/claude-terminal/` — CLI stream and query endpoints
- `/api/feature-matrix/` — feature status CRUD, aggregate views, batch review, history, import
- `/api/filesystem/` — project scanner, asset scanner, AnimBP scanner, file watcher
- `/api/game-director/` — session management and findings
- `/api/pof-bridge/` — UE5 plugin bridge (status, manifest, test, snapshot, compile)
- `/api/ue5-bridge/` — UE5 build pipeline (status, query, build)
- Domain-specific routes for evaluator subsystems, audio, level design, dialogue, packaging, and more
