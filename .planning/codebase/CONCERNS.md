# Codebase Concerns

**Analysis Date:** 2026-03-14

## Tech Debt

**Massive Component Files (unique-tabs):**
- Issue: 29 component files in `src/components/modules/core-engine/unique-tabs/` total 34,058 lines. Individual files routinely exceed 1,000-2,000 lines, with `ProgressionCurve.tsx` at 2,167 lines and `GASBlueprintEditor.tsx` at 2,032 lines. These are monolithic single-file components mixing types, data, helpers, and UI.
- Files: `src/components/modules/core-engine/unique-tabs/ProgressionCurve.tsx`, `src/components/modules/core-engine/unique-tabs/GASBlueprintEditor.tsx`, `src/components/modules/core-engine/unique-tabs/ItemCatalog.tsx`, `src/components/modules/core-engine/unique-tabs/AbilitySpellbook.tsx`, `src/components/modules/core-engine/unique-tabs/LootTableVisualizer.tsx`, `src/components/modules/core-engine/unique-tabs/GASBalanceSimulator.tsx`, `src/components/modules/core-engine/unique-tabs/EnemyBestiary.tsx`
- Impact: Slow IDE performance, hard to reason about, difficult to test individual pieces. Co-editing conflicts likely.
- Fix approach: Extract types to `src/types/`, data constants to separate files, split sub-components into their own modules. Each unique-tab should be a directory with an `index.tsx` re-export.

**Zero `React.memo` Usage:**
- Issue: Only 1 file (`src/components/layout/SidebarL2.tsx`) uses `React.memo` across 213 component files. Module components are not memoized despite being in an LRU cache system.
- Files: All 213 `.tsx` files in `src/components/`
- Impact: Unnecessary re-renders cascade through the component tree. With 22 Zustand stores and 110+ `useEffect` calls in module components, this creates potential render thrashing.
- Fix approach: Wrap leaf components and list items in `React.memo`. Start with the unique-tabs components which are the most complex.

**`useSuspendableEffect` Underutilized:**
- Issue: Only 6 components use `useSuspendableEffect` while 58 module components use raw `useEffect` (140 total `useEffect` calls in modules). The suspend system exists specifically to pause timers/polling for hidden modules, but most components ignore it.
- Files: `src/hooks/useSuspend.ts` (defines the hook), `src/components/modules/core-engine/ScanTab.tsx` (one of few that uses it properly)
- Impact: Hidden modules continue running side effects, timers, and API polling. With the LRU cache holding multiple modules, this wastes resources and can cause stale state conflicts.
- Fix approach: Audit all `useEffect` calls in `src/components/modules/` and migrate timer/polling/fetch effects to `useSuspendableEffect`. The convention should be: any effect that does ongoing work (interval, polling, subscriptions) MUST use `useSuspendableEffect`.

**Dead/Empty useEffect in DodgeTimelineEditor:**
- Issue: A `useEffect` at line 527 monitors `cliStore.pendingResult` but the effect body is an empty comment block: "Applied via the sidebar 'Apply' button -- see CharacterBlueprint.tsx". The effect triggers on every `pendingResult` change but does nothing.
- Files: `src/components/modules/core-engine/unique-tabs/DodgeTimelineEditor.tsx` (lines 527-532)
- Impact: Wasted re-renders. Confusing for maintainers. The 8 `useEffect` calls in this 1,032-line file make it especially fragile.
- Fix approach: Remove the dead `useEffect` or implement the intended behavior.

**Unused Function Parameters (eslint-disable):**
- Issue: 4 components suppress `@typescript-eslint/no-unused-vars` for `moduleId` props they accept but never use.
- Files: `src/components/modules/core-engine/unique-tabs/ItemEconomySimulator.tsx` (line 304), `src/components/modules/core-engine/unique-tabs/ItemDNAGenomeEditor.tsx` (line 409), `src/components/modules/core-engine/unique-tabs/AffixCraftingWorkbench.tsx` (line 367), `src/components/modules/core-engine/unique-tabs/AILootDesigner.tsx` (line 165)
- Impact: Indicates incomplete integration. These components receive `moduleId` but do not use it for feature matrix lookups or scoping.
- Fix approach: Either use `moduleId` to scope data (likely the original intent) or remove the prop from the component interface.

**Relative Imports in 15 Files:**
- Issue: 15 files use relative imports (`../../`) instead of the project's `@/` path alias, violating the coding convention.
- Files: `src/components/modules/content/audio/AudioView.tsx`, `src/components/modules/content/materials/MaterialsView.tsx`, `src/components/modules/content/ui-hud/UIHudView.tsx`, `src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx`, `src/components/modules/visual-gen/material-lab/MaterialLabView.tsx`, `src/components/modules/content/animations/AnimationsView.tsx`, `src/components/modules/content/models/ModelsView.tsx`, `src/components/modules/visual-gen/import-automation/ImportAutomationView.tsx`, `src/components/modules/content/level-design/LevelDesignView.tsx`, `src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx` (and 5 more)
- Impact: Inconsistency makes imports harder to manage. If file locations change, relative paths break.
- Fix approach: Replace all `../../` imports with `@/` alias paths.

**Marketplace Integration Generator Stubs:**
- Issue: 7 `TODO` comments in generated C++ code represent unimplemented integration logic. Functions return `nullptr` with placeholder comments.
- Files: `src/lib/marketplace/integration-generator.ts` (lines 272, 277, 285, 291, 368, 376, 454)
- Impact: Generated C++ adapter code compiles but does nothing useful. Users get non-functional integration stubs.
- Fix approach: Implement the adapter mapping logic or clearly document in the UI that generated code requires manual completion.

## Security Considerations

**CLI Spawns with --dangerously-skip-permissions:**
- Risk: The CLI service spawns Claude Code with `--dangerously-skip-permissions`, granting unrestricted file system and shell access to the AI.
- Files: `src/lib/claude-terminal/cli-service.ts` (line 197)
- Current mitigation: The flag is inherent to how PoF works (it delegates file operations to Claude Code). The spawned process runs under the user's own OS permissions.
- Recommendations: Document this security model clearly. Consider adding a user-visible confirmation before first use. Log all CLI executions (already done via `logFilePath`).

**No API Route Authentication:**
- Risk: All 72 API routes are unauthenticated. Any process on the machine can call them.
- Files: All files in `src/app/api/**/route.ts`
- Current mitigation: The app runs locally (localhost). Next.js dev server binds to 127.0.0.1 by default.
- Recommendations: If the app ever becomes network-accessible, add at minimum a shared-secret header check. For now, document that PoF must only bind to localhost.

**No Rate Limiting on API Routes:**
- Risk: No rate limiting on any of the 72 API routes. The CLI terminal can spawn unlimited processes.
- Files: `src/app/api/claude-terminal/stream/route.ts`, `src/app/api/claude-terminal/query/route.ts`
- Current mitigation: Local-only deployment limits exposure.
- Recommendations: Add concurrency limits to the CLI execution system (e.g., max 3 simultaneous executions).

**Filesystem Browse API Has No Path Restriction:**
- Risk: The `/api/filesystem/browse` route can list any directory on the filesystem. While it uses `path.normalize`, there is no allowlist or path restriction.
- Files: `src/app/api/filesystem/browse/route.ts` (line 453, `handleList` function)
- Current mitigation: Local-only deployment. The route serves a legitimate purpose (browsing for UE5 projects).
- Recommendations: Consider restricting to home directory and known UE project locations.

**Only 2 API Routes Validate Input with Zod:**
- Risk: 70 of 72 API routes accept request bodies without schema validation. Body data is parsed with `await request.json()` and used directly.
- Files: `src/app/api/feature-matrix/import/route.ts` and `src/app/api/module-scan/import/route.ts` (the only 2 with Zod)
- Current mitigation: The app is a local tool, not a public API.
- Recommendations: Add Zod schemas to all POST/PUT/PATCH routes that accept JSON bodies. Prioritize routes that write to SQLite.

## Performance Bottlenecks

**Monolithic Database Initialization:**
- Problem: `getDb()` in `src/lib/db.ts` creates 10+ tables, runs 6+ migration checks (ALTER TABLE, PRAGMA), and creates 6+ indexes on first call. All 12 `*-db.ts` files also run their own CREATE TABLE statements.
- Files: `src/lib/db.ts` (316 lines, all in `getDb()`), `src/lib/ai-testing-db.ts`, `src/lib/audio-scene-db.ts`, `src/lib/error-memory-db.ts`, `src/lib/feature-matrix-db.ts`, `src/lib/game-director-db.ts`, `src/lib/level-design-db.ts`, `src/lib/packaging/build-profiles-db.ts`, `src/lib/pattern-library-db.ts`, `src/lib/session-analytics-db.ts`, `src/lib/session-log-db.ts`, `src/lib/telemetry-db.ts`, `src/lib/visual-gen/material-db.ts`
- Cause: Every API route that touches the DB triggers the full initialization check. The migration from old CHECK constraint (line 60-84) does a full table copy every time the condition is checked.
- Improvement path: Cache the migration-done state. Consider a dedicated migration runner invoked once at startup rather than checking on every `getDb()` call.

**95,602 Lines of Module Components:**
- Problem: The `src/components/modules/` directory contains 95,602 lines across 213 files. Many components inline large data arrays, type definitions, and helper functions.
- Files: `src/components/modules/core-engine/unique-tabs/` (34,058 lines across 29 files)
- Cause: Components evolved as monoliths. No extraction pattern was established early.
- Improvement path: Extract shared data constants, types, and utility functions. The `_shared.tsx` pattern in unique-tabs is a good start but needs expansion.

**Event Bus Replay Buffer Grows Unbounded Per Session:**
- Problem: The EventBus stores up to 200 events in its replay buffer, slicing when exceeded. With high-frequency events (e.g., during CLI execution), the buffer churns through allocations.
- Files: `src/lib/event-bus.ts` (lines 48-52)
- Cause: `this.replayBuffer.slice(-this.maxReplaySize)` creates a new array on every overflow.
- Improvement path: Use a ring buffer instead of array slice. The current approach creates GC pressure with frequent events.

**SSE Stream Safety Timeout of 101+ Minutes:**
- Problem: The Claude terminal SSE stream has a 6,100,000ms (101.7 minute) safety timeout. If an execution hangs, the stream stays open for nearly 2 hours.
- Files: `src/app/api/claude-terminal/stream/route.ts` (line 150)
- Cause: Designed to be "slightly longer than the 100-minute execution timeout" per the comment.
- Improvement path: Consider client-side reconnection logic with shorter server-side timeouts (e.g., 15 minutes with auto-reconnect).

## Fragile Areas

**ProjectModuleBridge Late-Binding:**
- Files: `src/services/ProjectModuleBridge.ts`
- Why fragile: Uses late-bound store references (`let moduleStore = null`) to break a circular dependency between `projectStore` and `moduleStore`. If either store fails to register, auto-save silently does nothing. The `scheduleAutoSave()` function relies on both stores being registered.
- Safe modification: Always verify both stores are registered before adding new bridge methods. Add a development-mode warning if stores are not registered within a timeout.
- Test coverage: No direct test for the bridge. `src/__tests__/stores/moduleStore.test.ts` and `src/__tests__/stores/projectStore.test.ts` exist but do not test bridge coordination.

**CLI Service globalThis State:**
- Files: `src/lib/claude-terminal/cli-service.ts` (lines 94-102)
- Why fragile: Uses `globalThis` to persist the `activeExecutions` Map across Next.js hot reloads. This is a standard Next.js pattern but means server restart clears all execution state. Running executions become orphaned child processes.
- Safe modification: Never store non-serializable state (like `ChildProcess` handles) in ways that expect persistence across restarts.
- Test coverage: No tests for CLI service.

**Database Schema Migrations in getDb():**
- Files: `src/lib/db.ts` (lines 48-200)
- Why fragile: Schema migrations are inline in the `getDb()` function. Adding a new migration means editing a 316-line function. The CHECK constraint migration (lines 60-84) does a destructive table copy. If interrupted (e.g., process crash), data could be lost.
- Safe modification: Wrap the CHECK constraint migration in a transaction. Test with a database that has the old schema before deploying new migrations.
- Test coverage: No migration tests exist.

**DodgeTimelineEditor (8 useEffects):**
- Files: `src/components/modules/core-engine/unique-tabs/DodgeTimelineEditor.tsx`
- Why fragile: 8 `useEffect` hooks with interleaved refs, window event listeners, and animation state. One dead effect (lines 527-532). Multiple effects share mutable refs (`dragging`, `prevPlayheadRef`, `triggeredHitsRef`, `hapticTimerRef`).
- Safe modification: Avoid adding more effects. Consider extracting the playback/animation logic into a custom hook.
- Test coverage: No tests.

## Test Coverage Gaps

**Extremely Low Test-to-Source Ratio:**
- What's not tested: 17 test files exist for 546 source files (3.1% file coverage). No component tests exist at all. All tests are for stores and lib utilities.
- Files: `src/__tests__/` (17 files: 7 store tests, 6 lib tests, 4 generator tests)
- Risk: Any refactoring of the 213 component files, 72 API routes, or 18 hooks has zero automated verification. Regressions are only caught manually.
- Priority: High

**No API Route Tests:**
- What's not tested: All 72 API routes in `src/app/api/` have zero test coverage. This includes critical routes like `/api/filesystem/browse` (filesystem access), `/api/claude-terminal/stream` (process spawning), and `/api/feature-matrix/*` (data persistence).
- Files: `src/app/api/**/route.ts` (72 files)
- Risk: Database-writing routes could silently corrupt data. SSE streaming logic is untested.
- Priority: High

**No Hook Tests:**
- What's not tested: 18 custom hooks in `src/hooks/` have no tests. These include critical hooks like `useModuleCLI.ts` (CLI session management), `useFeatureMatrix.ts` (data loading), `useSuspend.ts` (module lifecycle), and `useCRUD.ts` (generic data fetching).
- Files: `src/hooks/*.ts` (18 files)
- Risk: Hook state management bugs (stale closures, race conditions) are common and hard to catch without tests.
- Priority: Medium

**No Tests for Database Layer:**
- What's not tested: 12 `*-db.ts` files containing all SQLite operations. The `getDb()` initialization with its inline migrations is completely untested.
- Files: `src/lib/db.ts`, `src/lib/feature-matrix-db.ts`, `src/lib/game-director-db.ts`, `src/lib/session-analytics-db.ts`, `src/lib/pattern-library-db.ts`, `src/lib/error-memory-db.ts` (and 6 more)
- Risk: Schema migrations could fail silently. The CHECK constraint migration (table copy) in `src/lib/db.ts` is especially risky without tests.
- Priority: High

**No CLI/Terminal Tests:**
- What's not tested: The entire CLI terminal system (`src/lib/claude-terminal/cli-service.ts`, `src/lib/claude-terminal/session-manager.ts`, `src/lib/cli-task.ts`) and its 7+ component files (`src/components/cli/`) are untested.
- Files: `src/lib/claude-terminal/*.ts`, `src/components/cli/*.tsx`, `src/lib/cli-task.ts`
- Risk: The CLI service spawns child processes, manages SSE streams, and parses JSON output. Bugs here can cause orphaned processes, data loss, or UI hangs.
- Priority: Medium

## Dependencies at Risk

**Zod 4 (Major Version):**
- Risk: `zod@^4.3.6` in `package.json` is a recent major version. Zod 4 has breaking API changes from Zod 3. Only 2 files use Zod currently, but expanding validation (as recommended) requires care.
- Impact: If Zod 4 API is unstable or poorly documented, schema validation expansion is slower.
- Migration plan: Not applicable -- already on v4. Ensure any new Zod usage follows v4 API patterns.

**Next.js 16 (Bleeding Edge):**
- Risk: `next@16.1.6` is very recent. Community support, third-party middleware, and deployment platform support may lag behind.
- Impact: Potential for undiscovered bugs. Deployment to platforms like Vercel should be fine, but self-hosting may have rough edges.
- Migration plan: Monitor Next.js changelogs. Keep `react@19.2.3` and `next@16.x` in sync.

## Missing Critical Features

**No Error Boundary in Module System:**
- Problem: If a module component throws during render, the entire app crashes. No `ErrorBoundary` wraps individual modules.
- Blocks: Graceful degradation. A bug in one of the 29 unique-tab components takes down the whole application.

**No Backup/Export for SQLite Database:**
- Problem: All user data (feature matrices, build history, session logs, etc.) lives in a single SQLite file at `~/.pof/pof.db`. No backup, export, or import mechanism exists.
- Blocks: Data recovery after corruption. Safe migration between machines.

---

*Concerns audit: 2026-03-14*
