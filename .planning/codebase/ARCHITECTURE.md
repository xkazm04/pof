# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Single-page modular monolith with Next.js App Router

The application is a single-page app (SPA) served by Next.js 16. The single page (`src/app/page.tsx`) renders `<AppShell />`, which owns all navigation, layout, and module rendering. There is no multi-page routing -- all navigation is handled client-side via Zustand stores. The server side is used exclusively for API routes (72 route handlers) that provide database access, CLI orchestration, file system operations, and external service proxying.

**Key Characteristics:**
- Single HTML page with client-side module switching via LRU cache
- Module system with registry-driven metadata (checklists, quick actions, knowledge tips)
- CLI terminal integration that spawns Claude Code processes server-side
- Typed event bus for cross-component communication
- Zustand stores with localStorage persistence + SQLite server-side persistence
- Composable prompt engineering system for AI-assisted UE5 development

## Layers

**Presentation Layer:**
- Purpose: React components that render the UI
- Location: `src/components/`
- Contains: Layout shell, module views, CLI terminal, shared UI primitives
- Depends on: Stores, hooks, types
- Used by: Next.js page (`src/app/page.tsx`)

**State Layer:**
- Purpose: Client-side application state with persistence
- Location: `src/stores/`
- Contains: 22 Zustand stores with persist middleware
- Depends on: Types, API utilities, services bridge
- Used by: Components via selector hooks

**Hook Layer:**
- Purpose: Reusable stateful logic bridging stores, APIs, and components
- Location: `src/hooks/`
- Contains: 32 custom hooks for CLI sessions, data fetching, suspend management, keyboard shortcuts
- Depends on: Stores, lib utilities, API routes
- Used by: Components

**Business Logic Layer:**
- Purpose: Core domain logic, registries, engines, prompt construction
- Location: `src/lib/`
- Contains: Module registry, feature definitions, NBA engine, prompt builders, event bus, lifecycle management, database access, search indexing
- Depends on: Types, database (server-side only)
- Used by: Hooks, stores, API routes, components

**API Layer:**
- Purpose: Server-side route handlers providing database access, CLI process management, file system operations
- Location: `src/app/api/`
- Contains: 72 Next.js route handlers organized by domain
- Depends on: `src/lib/` (DB utilities, parsers, generators)
- Used by: Client-side via `apiFetch`/`tryApiFetch`/`useCRUD`

**Services Layer:**
- Purpose: Cross-store coordination to break circular dependencies
- Location: `src/services/`
- Contains: `ProjectModuleBridge.ts` -- late-bound store accessor pattern
- Depends on: Lifecycle utilities
- Used by: `projectStore`, `moduleStore`

**Types Layer:**
- Purpose: Shared TypeScript type definitions
- Location: `src/types/`
- Contains: 40 type definition files covering all domains
- Depends on: Nothing (leaf dependency)
- Used by: All other layers

## Data Flow

**Module Navigation Flow:**

1. User clicks category in `SidebarL1` -> `navigationStore.setActiveCategory()`
2. User clicks sub-module in `SidebarL2` -> `navigationStore.setActiveSubModule()`
3. `ModuleRenderer` reads `activeCategory` + `activeSubModule` from navigation store
4. LRU cache (`moduleLru` ref) tracks visited modules, evicts oldest beyond cap of 5
5. Active module component is rendered visible (`display: block`), others hidden
6. `SuspendContext.Provider` wraps each module with `value={!isVisible}` to freeze hidden modules

**CLI Task Execution Flow:**

1. Component calls `useModuleCLI.execute(task)` with a `CLITask` object
2. `buildTaskPrompt(task, ctx)` assembles the full prompt (project context + domain context + task instructions + callback markers)
3. `cliPanelStore.createSession()` creates/reuses a terminal session
4. Prompt dispatched to `CompactTerminal` which POSTs to `/api/claude-terminal/stream`
5. Server spawns Claude Code CLI process via `cli-service.ts` (`spawn('claude', [...])`)
6. CLI output streamed back as SSE events parsed from `--output-format stream-json`
7. Terminal intercepts `@@CALLBACK:<id>` markers in assistant output
8. Callback payload extracted, validated, merged with static fields, and POSTed to the registered API endpoint
9. `onComplete` callback fires on the hook, updating store state and recording analytics

**Checklist Progress Flow:**

1. User triggers a checklist item (click or CLI task completion)
2. `moduleStore.toggleChecklistItem()` or `setChecklistItem()` updates `checklistProgress`
3. `scheduleAutoSave()` debounces (2s) a SQLite write via `ProjectModuleBridge`
4. Bridge reads `projectStore.projectPath` and calls `moduleStore.saveProgress(path)`
5. Progress persisted to `project_progress` table in `~/.pof/pof.db`
6. On project switch: `loadModuleProgress()` restores from SQLite

**API Request Flow:**

1. Client calls `apiFetch<T>(url)` or `tryApiFetch<T>(url)` or `useCRUD(endpoint, initial)`
2. Server route handler processes request using `src/lib/*` utilities
3. Response wrapped in standardized envelope: `{ success: true, data }` or `{ success: false, error }`
4. `apiSuccess(data)` / `apiError(msg)` helpers enforce envelope shape server-side
5. `apiFetch` unwraps envelope and throws on error; `tryApiFetch` returns `Result<T, string>`

**State Management:**
- Client-side: Zustand stores with `persist` middleware to `localStorage`
- Server-side: SQLite at `~/.pof/pof.db` with WAL mode
- Bridge pattern: `ProjectModuleBridge` breaks circular dependency between project and module stores using late-bound `getState()` calls
- Transient state (e.g., `isRunning`, `scanResults`) excluded from persistence to avoid rehydration issues
- `cliPanelStore` uses custom `merge` to reset transient fields on rehydration

## Key Abstractions

**Module System:**
- Purpose: Represents a game development domain (combat, animation, loot, etc.)
- Registry: `src/lib/module-registry.ts` -- central definition of all sub-modules with checklists, quick actions, knowledge tips
- Types: `src/types/modules.ts` -- `SubModuleId` union, `SubModuleDefinition`, `CategoryDefinition`, `ChecklistItem`, `QuickAction`
- Pattern: A module has 5 identity facets: type identity (SubModuleId), registry entry (SubModuleDefinition), feature graph (FeatureDefinition[]), storage key (moduleStore), component factory (ModuleRenderer)
- Component: `MODULE_COMPONENTS` map in `src/components/layout/ModuleRenderer.tsx` maps each `SubModuleId` to its React component

**ReviewableModuleView:**
- Purpose: Standard module view layout with tabs (Overview, Roadmap, extra tabs), checklist, quick actions panel, feature matrix
- Location: `src/components/modules/shared/ReviewableModuleView.tsx`
- Pattern: Most modules render through this. Core engine modules add extra tabs (Scan, unique domain tab). Simple modules use `createSimpleModuleView()` factory.
- Examples: `src/components/modules/core-engine/GenreModuleView.tsx` wraps `ReviewableModuleView` with scan tab + unique tab

**CLITask:**
- Purpose: Unified task abstraction for every CLI invocation
- Location: `src/lib/cli-task.ts`
- Pattern: `TaskFactory` methods (`.checklist()`, `.featureFix()`, `.featureReview()`, `.moduleScan()`) create typed tasks. `buildTaskPrompt(task, ctx)` handles context injection. Callback system uses `@@CALLBACK:<id>` markers.
- Examples: `TaskFactory.checklist(moduleId, item, origin)`, `TaskFactory.featureReview(moduleId, features, origin)`

**PromptBuilder:**
- Purpose: Composable prompt construction with enforced 6-section architecture
- Location: `src/lib/prompts/prompt-builder.ts`
- Pattern: Fluent builder: `new PromptBuilder().withProjectContext(ctx).withDomainContext(domain).withTaskInstructions(task).build()`
- Sections: Project Context -> Domain Context -> Task Instructions -> UE5 Best Practices -> Output Schema -> Success Criteria

**Lifecycle Protocol:**
- Purpose: Unified resource management (init -> isActive -> dispose) for CLI sessions, file watchers, SSE connections, event bus subscriptions, timers
- Location: `src/lib/lifecycle.ts`
- Factories: `createLifecycle`, `createSubscriptionLifecycle`, `createGuardedLifecycle`, `createTimerLifecycle`
- Hook: `useLifecycle()` guarantees cleanup on unmount

**Event Bus:**
- Purpose: Typed pub/sub with namespaced channels, replay buffer (200 events), wildcard subscriptions
- Location: `src/lib/event-bus.ts`
- Channels: `cli.*`, `eval.*`, `build.*`, `checklist.*`, `file.*`
- Bridge: `src/lib/event-bus-bridge.ts` subscribes to Zustand stores and emits typed events

**Result Type:**
- Purpose: Discriminated union for explicit success/failure contracts
- Location: `src/types/result.ts`
- Pattern: `Result<T, E> = { ok: true; data: T } | { ok: false; error: E }`
- Constructors: `ok(data)`, `err(error)`
- Utilities: `mapResult`, `unwrapOr`, `unwrap`

**Suspend System:**
- Purpose: Freeze hidden modules to prevent unnecessary re-renders and side effects
- Location: `src/hooks/useSuspend.ts`
- Pattern: `SuspendContext` React context set by `ModuleRenderer`. `useSuspendableSelector` freezes Zustand subscriptions. `useSuspendableEffect` pauses effects when suspended.

## Entry Points

**Application Entry:**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Renders `<AppShell />` which gates on setup wizard vs main app

**AppShell:**
- Location: `src/components/layout/AppShell.tsx`
- Triggers: Mounted by page.tsx after hydration
- Responsibilities: Initializes global hooks (keyboard shortcuts, file watcher, activity feed bridge, PoF bridge, dynamic title), renders layout (TopBar, Sidebar, ModuleRenderer, CLIBottomPanel, ActivityFeedPanel, GlobalSearchPanel, EventBusDevTools)

**API Routes:**
- Location: `src/app/api/*/route.ts` (72 route files)
- Triggers: Client-side fetch calls via `apiFetch`/`useCRUD`
- Responsibilities: Database CRUD, CLI process spawning, file system operations, external API proxying

**CLI Service:**
- Location: `src/lib/claude-terminal/cli-service.ts`
- Triggers: POST to `/api/claude-terminal/stream`
- Responsibilities: Spawns Claude Code CLI process, parses stream-json output, manages sessions

## Error Handling

**Strategy:** Multi-layer with graceful degradation

**Patterns:**
- API envelope: All routes return `{ success, data/error }`. Client throws or returns `Result<T>`.
- `ModuleErrorBoundary` wraps every module in `ModuleRenderer.tsx` to catch render errors without crashing the app
- `Result<T, E>` type for fallible operations that shouldn't throw
- `tryApiFetch` non-throwing variant returns `Result<T, string>` instead of throwing
- CLI task callbacks validate JSON before POSTing; invalid payloads are logged but don't crash
- Store mutations use no-op guards (return `state` unchanged when nothing changes)
- `useCRUD` hook has `error` state with `retry` method for UI-level error recovery

## Cross-Cutting Concerns

**Logging:**
- Custom `logger` from `src/lib/logger.ts`. ESLint warns on raw `console.*` (except `console.error`).

**Validation:**
- Zod used for schema validation (dependency present). API routes validate request bodies manually with early-return `apiError()`.
- `checklist-expectations.ts` defines validation expectations per module.

**Authentication:**
- No authentication layer. This is a local development tool.

**Timing:**
- All UI timing constants centralized in `UI_TIMEOUTS` at `src/lib/constants.ts`.

**Colors:**
- All colors from `src/lib/chart-colors.ts` or CSS variables. ESLint enforces no hardcoded hex.

**Imports:**
- `@/` path alias maps to `src/`. ESLint enforces no relative imports.

---

*Architecture analysis: 2026-03-14*
