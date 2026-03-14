# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
pof/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (fonts, Toaster, dark theme)
│   │   ├── page.tsx                  # Single page → <AppShell />
│   │   ├── globals.css               # Global styles (Tailwind 4)
│   │   └── api/                      # 72 API route handlers
│   │       ├── checklist/            # Checklist completion callbacks
│   │       ├── claude-terminal/      # CLI process spawning & streaming
│   │       ├── cli-task-registry/    # Task callback registration
│   │       ├── feature-matrix/       # Feature status CRUD + aggregation
│   │       ├── filesystem/           # File browsing, scanning, watching
│   │       ├── module-scan/          # UE5 project scanning
│   │       ├── pof-bridge/           # PoF UE5 plugin bridge
│   │       ├── ue5-bridge/           # UE5 Remote Control bridge
│   │       ├── visual-gen/           # Asset/material generation
│   │       └── [40+ other domains]   # Domain-specific routes
│   ├── components/
│   │   ├── layout/                   # App shell, sidebar, top bar, module renderer
│   │   ├── cli/                      # CLI terminal components & store
│   │   │   ├── store/                # cliPanelStore.ts
│   │   │   └── skills/               # Domain knowledge packs for CLI
│   │   ├── ui/                       # Shared UI primitives (Button, Card, Badge, etc.)
│   │   └── modules/                  # Module-specific views
│   │       ├── core-engine/          # aRPG genre modules (character, combat, loot, etc.)
│   │       │   └── unique-tabs/      # 29 domain-specific visualization tabs
│   │       ├── content/              # Content modules
│   │       │   ├── animations/       # Animation system views
│   │       │   ├── audio/            # Audio system views
│   │       │   ├── level-design/     # Level design views
│   │       │   ├── materials/        # Materials views
│   │       │   ├── models/           # 3D model views
│   │       │   └── ui-hud/           # UI/HUD views
│   │       ├── game-systems/         # Game system modules
│   │       │   └── blueprint-transpiler/ # Blueprint-to-C++ transpiler
│   │       ├── visual-gen/           # Asset Studio modules
│   │       │   ├── asset-viewer/     # 3D asset viewer (Three.js)
│   │       │   ├── asset-forge/      # AI asset generation
│   │       │   ├── material-lab/     # Material editor
│   │       │   ├── blender-pipeline/ # Blender integration
│   │       │   ├── asset-browser/    # Asset library browser
│   │       │   ├── import-automation/# Import pipeline
│   │       │   ├── auto-rig/         # Auto-rigging
│   │       │   └── procedural-engine/# Procedural generation
│   │       ├── evaluator/            # Quality evaluation & dashboards (30 components)
│   │       ├── game-director/        # Session tracking & regression
│   │       ├── project-setup/        # Project wizard & config panels (17 components)
│   │       └── shared/               # Shared module components
│   ├── hooks/                        # 32 custom React hooks
│   ├── stores/                       # 22 Zustand stores
│   ├── services/                     # Cross-store coordination
│   ├── lib/                          # Core business logic
│   │   ├── claude-terminal/          # CLI process management
│   │   ├── evaluator/                # Evaluation prompts & logic
│   │   ├── prompts/                  # Prompt builders (12 files)
│   │   ├── ue5-bridge/               # UE5 Remote Control client
│   │   ├── pof-bridge/               # PoF UE5 plugin client
│   │   ├── visual-gen/               # Asset generation logic
│   │   │   ├── generators/           # Generator implementations
│   │   │   └── blender-scripts/      # Python scripts for Blender
│   │   ├── ai-director/              # AI director logic
│   │   ├── combat/                   # Combat simulation engine
│   │   ├── economy/                  # Economy simulation engine
│   │   ├── item-dna/                 # Item genome system
│   │   ├── loot-designer/            # Loot table designer
│   │   ├── crash-analyzer/           # Crash analysis logic
│   │   ├── implementation-planner/   # Implementation planning
│   │   ├── localization/             # Localization pipeline
│   │   ├── marketplace/              # Marketplace integration
│   │   ├── packaging/                # Build packaging logic
│   │   ├── post-process-studio/      # Post-process effects
│   │   ├── profiling/                # Performance profiling
│   │   └── prompt-evolution/         # Prompt versioning
│   ├── types/                        # 40 TypeScript type definition files
│   └── __tests__/                    # Test files
│       ├── lib/                      # Library unit tests
│       │   └── generators/           # Generator tests
│       └── stores/                   # Store unit tests
├── public/                           # Static assets
├── docs/                             # Documentation
├── .pof/                             # Local project config
│   └── signals/                      # Signal files
├── .planning/                        # Planning documents
│   └── codebase/                     # Codebase analysis (this file)
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript configuration
├── next.config.ts                    # Next.js configuration
└── vitest.config.ts                  # Test configuration (assumed)
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router entry points
- Contains: Single page (`page.tsx`), root layout (`layout.tsx`), 72 API route handlers
- Key files: `src/app/page.tsx` (renders AppShell), `src/app/layout.tsx` (root HTML, fonts, Toaster)

**`src/components/layout/`:**
- Purpose: Application shell and navigation chrome
- Contains: 13 layout components forming the app skeleton
- Key files:
  - `AppShell.tsx`: Top-level orchestrator, gates setup wizard vs main app, initializes global hooks
  - `ModuleRenderer.tsx`: LRU-cached module switching with suspend context and crossfade animations
  - `Sidebar.tsx` / `SidebarL1.tsx` / `SidebarL2.tsx`: Two-level sidebar (categories L1, sub-modules L2)
  - `TopBar.tsx`: Header with project info and global actions
  - `CLIBottomPanel.tsx` / `CLITabBar.tsx`: Bottom terminal panel with tab management
  - `ActivityFeedPanel.tsx`: Right-side activity feed
  - `GlobalSearchPanel.tsx`: Full-text search overlay (Ctrl+K)
  - `ModuleErrorBoundary.tsx`: Error boundary wrapping each module

**`src/components/modules/`:**
- Purpose: Domain-specific module views organized by category
- Contains: 6 category directories + shared components
- Pattern: Each module has a `*View.tsx` entry component. Core engine modules use `GenreModuleView` wrapper. Simple content/game-system modules use `createSimpleModuleView()` factory or custom view.

**`src/components/modules/shared/`:**
- Purpose: Reusable module view components shared across all module categories
- Key files:
  - `ReviewableModuleView.tsx`: Standard module layout with Overview/Roadmap tabs, checklist, quick actions panel
  - `RoadmapChecklist.tsx`: Checklist rendering with progress tracking
  - `FeatureMatrix.tsx`: Feature status grid with review capabilities
  - `QuickActionsPanel.tsx`: Collapsible sidebar with context-aware quick actions
  - `createSimpleModuleView.tsx`: Factory for modules needing only standard ReviewableModuleView
  - `RecommendedNextBanner.tsx`: NBA recommendation banner

**`src/components/modules/core-engine/`:**
- Purpose: Core engine (aRPG genre) module views
- Contains: Genre module view, plan view, scan tab, telemetry, unique tabs
- Key files:
  - `GenreModuleView.tsx`: Wrapper adding Scan tab + unique domain tab to ReviewableModuleView
  - `ScanTab.tsx`: UE5 project scanning interface
  - `unique-tabs/`: 29 domain-specific visualization/editor tabs (one per aRPG sub-module)

**`src/components/cli/`:**
- Purpose: CLI terminal UI and supporting components
- Contains: Terminal rendering, input handling, output parsing, skills system
- Key files:
  - `CompactTerminal.tsx` (via `index.ts`): Main terminal component
  - `InlineTerminal.tsx`: Inline terminal rendered within module views
  - `store/cliPanelStore.ts`: Session management store
  - `skills.ts` / `skills/`: Domain knowledge packs injected into CLI prompts
  - `UE5BuildParser.ts`: Parses UBT build output for warnings/errors

**`src/components/ui/`:**
- Purpose: Shared UI primitives (design system atoms)
- Contains: 11 reusable components
- Key files: `Button.tsx`, `Card.tsx`, `Badge.tsx`, `Tooltip.tsx`, `SurfaceCard.tsx`, `EmptyState.tsx`, `ProgressRing.tsx`, `MarkdownProse.tsx`

**`src/hooks/`:**
- Purpose: Custom React hooks for reusable stateful logic
- Contains: 32 hooks
- Key files:
  - `useModuleCLI.ts`: Standard way to launch CLI sessions from module components
  - `useCRUD.ts`: Generic data-fetching hook with loading/error/mutate
  - `useSuspend.ts`: Suspend context, `useSuspendableSelector`, `useSuspendableEffect`
  - `useLifecycle.ts`: React hook for Lifecycle protocol cleanup
  - `useKeyboardShortcuts.ts`: Global keyboard shortcuts (Ctrl+B, Ctrl+J, Ctrl+1-5)
  - `useFeatureMatrix.ts`: Feature matrix data + mutations
  - `useActiveModuleId.ts`: Derives current module ID from navigation store
  - `useFileWatcher.ts`: Watches UE5 Source/ for file changes
  - `usePofBridge.ts`: Auto-connects to UE5 plugin HTTP server

**`src/stores/`:**
- Purpose: Zustand state stores with persistence
- Contains: 22 stores
- Key files:
  - `moduleStore.ts`: Checklist progress, verification, scan results, health per module
  - `projectStore.ts`: Project path, UE version, setup state, recent projects
  - `navigationStore.ts`: Active category/sub-module, sidebar mode
  - `evaluatorStore.ts`: Evaluation results and recommendations
  - `ue5BridgeStore.ts`: UE5 Remote Control connection state
  - `pofBridgeStore.ts`: PoF plugin connection state
  - `combatSimulatorStore.ts`: Combat simulation state
  - `economySimulatorStore.ts`: Economy simulation state

**`src/services/`:**
- Purpose: Cross-store coordination to break circular dependencies
- Contains: Single file
- Key files: `ProjectModuleBridge.ts` -- late-bound store accessors with debounced auto-save lifecycle

**`src/lib/`:**
- Purpose: Core business logic, utilities, and domain engines
- Contains: 50+ files and 18 subdirectories
- Key files:
  - `module-registry.ts`: Central registry of all sub-modules (checklists, quick actions, tips)
  - `feature-definitions.ts`: Dependency graph of features per module, prerequisite computation
  - `nba-engine.ts`: Next Best Action recommendation engine
  - `cli-task.ts`: Unified CLI task abstraction with callback system
  - `prompt-context.ts`: Shared project context builder for all prompts
  - `event-bus.ts`: Typed pub/sub singleton with replay buffer
  - `event-bus-bridge.ts`: Zustand store -> event bus bridge
  - `lifecycle.ts`: Resource lifecycle protocol and factories
  - `api-utils.ts`: API envelope helpers (server: `apiSuccess`/`apiError`, client: `apiFetch`/`tryApiFetch`)
  - `db.ts`: SQLite database initialization and schema management
  - `constants.ts`: `UI_TIMEOUTS`, `getAppOrigin()`, `getOriginFromRequest()`
  - `chart-colors.ts`: Color constants and helpers
  - `search-index.ts`: FTS5 full-text search indexing
  - `logger.ts`: Custom logger replacing `console.*`

**`src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: 40 type definition files
- Key files:
  - `modules.ts`: `SubModuleId`, `CategoryId`, `SubModuleDefinition`, `ChecklistItem`, `QuickAction`, `ModuleSchema`
  - `api.ts`: `ApiResponse<T>` envelope type
  - `result.ts`: `Result<T, E>` discriminated union
  - `event-bus.ts`: Event channel and payload type definitions
  - `feature-matrix.ts`: Feature row types
  - `navigation.ts`: Sidebar mode types

**`src/__tests__/`:**
- Purpose: Test files
- Contains: Unit tests for libraries and stores
- Structure: Mirrors `src/lib/` and `src/stores/` paths

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Application entry, renders `<AppShell />`
- `src/app/layout.tsx`: Root HTML layout, fonts, toast provider
- `src/components/layout/AppShell.tsx`: Main application orchestrator

**Configuration:**
- `package.json`: Dependencies and npm scripts
- `tsconfig.json`: TypeScript config with `@/*` path alias to `src/`
- `next.config.ts`: Next.js config, externalizes `better-sqlite3`
- `src/lib/constants.ts`: UI timing constants and origin helpers

**Core Registries:**
- `src/lib/module-registry.ts`: All sub-module definitions (checklists, quick actions, tips)
- `src/lib/feature-definitions.ts`: Feature dependency graph and prerequisite computation
- `src/lib/evaluator/module-eval-prompts.ts`: 3-pass evaluation criteria per module
- `src/components/layout/ModuleRenderer.tsx`: Module ID -> React component mapping

**Core Logic:**
- `src/lib/cli-task.ts`: CLI task abstraction and callback system
- `src/lib/prompt-context.ts`: Shared project context for prompts
- `src/lib/prompts/prompt-builder.ts`: 6-section prompt construction
- `src/lib/event-bus.ts`: Typed event bus singleton
- `src/lib/lifecycle.ts`: Resource lifecycle protocol
- `src/lib/nba-engine.ts`: Next Best Action recommendation engine
- `src/lib/db.ts`: SQLite database singleton and schema

**Testing:**
- `src/__tests__/setup.ts`: Vitest setup file
- `src/__tests__/stores/`: Store unit tests
- `src/__tests__/lib/`: Library unit tests

## Naming Conventions

**Files:**
- Components: PascalCase (`AppShell.tsx`, `ReviewableModuleView.tsx`)
- Hooks: camelCase with `use` prefix (`useModuleCLI.ts`, `useSuspend.ts`)
- Stores: camelCase with `Store` suffix (`moduleStore.ts`, `navigationStore.ts`)
- Libraries: kebab-case (`cli-task.ts`, `event-bus.ts`, `module-registry.ts`)
- Types: kebab-case (`feature-matrix.ts`, `event-bus.ts`)
- API routes: kebab-case directories with `route.ts` files (`api/feature-matrix/route.ts`)

**Directories:**
- Components: kebab-case category folders (`core-engine/`, `game-systems/`, `visual-gen/`)
- Lib subdirectories: kebab-case (`claude-terminal/`, `ue5-bridge/`, `post-process-studio/`)

**Exports:**
- Components: named exports, PascalCase (`export function AppShell()`)
- Hooks: named exports, camelCase (`export function useModuleCLI()`)
- Stores: named exports via `create()` (`export const useModuleStore = create<...>()`)
- Constants: UPPER_SNAKE_CASE (`UI_TIMEOUTS`, `MODULE_COLORS`, `STATUS_SUCCESS`)
- Types: PascalCase (`SubModuleId`, `ChecklistItem`, `ApiResponse`)

## Where to Add New Code

**New Sub-Module (e.g., a new game system):**
1. Add ID to `SUB_MODULE_IDS` array in `src/types/modules.ts`
2. Add definition (checklist, quick actions, tips) in `src/lib/module-registry.ts`
3. Add feature definitions in `src/lib/feature-definitions.ts`
4. Add eval prompts in `src/lib/evaluator/module-eval-prompts.ts`
5. Create view component in appropriate `src/components/modules/<category>/` directory
6. Register component in `MODULE_COMPONENTS` map in `src/components/layout/ModuleRenderer.tsx`
7. Add to parent category's `subModules` array in `src/lib/module-registry.ts`

**New API Route:**
- Create `src/app/api/<domain>/route.ts`
- Use `apiSuccess(data)` / `apiError(msg)` from `@/lib/api-utils`
- For database access: import `getDb()` from `@/lib/db`

**New Zustand Store:**
- Create `src/stores/<domain>Store.ts`
- Use `create<State>()(persist(...))` pattern with `createJSONStorage(() => localStorage)`
- Exclude transient runtime state from persistence

**New Custom Hook:**
- Create `src/hooks/use<Name>.ts`
- Import stores via `@/stores/`, utilities via `@/lib/`

**New Shared UI Component:**
- Create `src/components/ui/<Name>.tsx`
- Export as named export

**New Prompt Builder:**
- Create `src/lib/prompts/<domain>.ts`
- Use `PromptBuilder` class from `@/lib/prompts/prompt-builder`

**New Library/Utility:**
- Create `src/lib/<domain>.ts` or `src/lib/<domain>/` directory for complex domains
- For database logic: create `src/lib/<domain>-db.ts`

**New Type Definitions:**
- Create `src/types/<domain>.ts`
- Use `SubModuleId` union from `src/types/modules.ts` for module-scoped types

**New Core Engine Unique Tab:**
- Create component in `src/components/modules/core-engine/unique-tabs/<Name>.tsx`
- Register in `src/components/modules/core-engine/unique-tabs/index.ts` (via `getUniqueTab()`)

## Special Directories

**`src/app/api/`:**
- Purpose: Next.js route handlers (server-side only)
- Generated: No
- Committed: Yes
- Note: Each route directory contains a `route.ts` file. Nested routes (e.g., `feature-matrix/aggregate/`) represent sub-endpoints.

**`.planning/`:**
- Purpose: Planning and analysis documents
- Generated: By analysis tools
- Committed: Yes

**`.pof/`:**
- Purpose: Local project configuration and signal files
- Generated: By the app
- Committed: Partially (signals directory)

**`~/.pof/`:**
- Purpose: User-level SQLite database (`pof.db`)
- Generated: At runtime by `src/lib/db.ts`
- Committed: No (user home directory, outside repo)

**`src/lib/visual-gen/blender-scripts/`:**
- Purpose: Python scripts executed by Blender for asset generation
- Generated: No
- Committed: Yes

**`src/components/cli/skills/`:**
- Purpose: Domain knowledge packs injected into CLI prompts
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-14*
