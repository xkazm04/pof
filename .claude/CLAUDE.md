# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PoF (Pillars of Fortune) is a Next.js 16 web application that serves as an AI-powered UE5 C++ game development assistant. It features a modular architecture with an integrated CLI terminal, feature tracking matrix, code generation, prompt engineering, and quality evaluation systems. Built with React 19, Zustand for state, better-sqlite3 for persistence, and Tailwind CSS 4.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (all tests)
npm run test:watch   # vitest in watch mode
npm run validate     # typecheck + lint + test (full CI check)
```

Run a single test file:
```bash
npx vitest run src/__tests__/stores/moduleStore.test.ts
```

## Architecture

### Module System

The app is organized around **modules** — each representing a game development domain (combat, animation, loot, etc.). Three main registries define module behavior:

- **`src/lib/module-registry.ts`** — Central registry of all sub-modules with checklists, quick actions, knowledge tips. Each checklist item has `{ id, label, description, prompt }` where prompt is a multiline template string with UE5-specific guidance.
- **`src/lib/feature-definitions.ts`** — Dependency graph of features per module. Cross-module deps use `'moduleId::featureName'` format. Drives the NBA (Next Best Action) engine.
- **`src/lib/evaluator/module-eval-prompts.ts`** — 3-pass evaluation criteria (structure → quality → performance) per module.

Module categories and their component locations:
| Category | Path | Examples |
|----------|------|----------|
| Core Engine | `src/components/modules/core-engine/` | arpg-character, arpg-combat, arpg-loot |
| Content | `src/components/modules/content/` | animations, audio, materials, level-design |
| Game Systems | `src/components/modules/game-systems/` | ai-behavior, physics, multiplayer |
| Evaluator | `src/components/modules/evaluator/` | Quality dashboards, GDD compliance |
| Game Director | `src/components/modules/game-director/` | Session tracking, regression |
| Shared | `src/components/modules/shared/` | FeatureMatrix, QuickActionsPanel |

### Prompt System

Composable prompt construction with shared context:

- **`src/lib/prompt-context.ts`** — `buildProjectContextHeader()` injects UE paths, build commands, error memory
- **`src/lib/prompts/prompt-builder.ts`** — Fluent builder with 6 sections: Project Context → Domain Context → Task Instructions → UE5 Best Practices → Output Schema → Success Criteria
- **Per-module prompt builders** in `src/lib/prompts/` (e.g., `animation-checklist.ts`, `material-configurator.ts`)

### State Management

Zustand stores with persist middleware in `src/stores/`:
- `moduleStore.ts` — Checklist progress, verification status, scan results
- `projectStore.ts` — Project setup, recent projects, dynamic UE5 context
- `navigationStore.ts` — Active module/tab navigation
- `services/ProjectModuleBridge.ts` — Breaks circular dependency between project and module stores

### Database

Single SQLite instance at `~/.pof/pof.db` via better-sqlite3. DB logic in `src/lib/*-db.ts` files. WAL mode enabled. Next.js config externalizes better-sqlite3: `serverExternalPackages: ['better-sqlite3']`.

### Event Bus

Typed pub/sub in `src/lib/event-bus.ts` with namespaced channels (`cli.*`, `eval.*`, `build.*`, `checklist.*`, `file.*`), replay buffer (200 events), and wildcard subscriptions.

### Lifecycle Pattern

`src/lib/lifecycle.ts` provides `Lifecycle<T>` protocol (init → isActive → dispose) with factories: `createLifecycle`, `createSubscriptionLifecycle`, `createGuardedLifecycle`, `createTimerLifecycle`. Use `useLifecycle()` hook for guaranteed cleanup.

### CLI Terminal & Task System

`src/lib/claude-terminal/cli-service.ts` spawns Claude Code CLI, parses stream-json output with session management. Components in `src/components/cli/`. Skills system in `skills.ts` injects domain-specific knowledge packs.

`src/lib/cli-task.ts` defines the unified task abstraction. Every CLI invocation is a `CLITask` created via `TaskFactory` methods (`.checklist()`, `.featureFix()`, `.featureReview()`, `.moduleScan()`). Tasks use a **callback system**: the prompt embeds `@@CALLBACK:<id>` markers, the terminal intercepts Claude's output, validates JSON, merges static fields, and POSTs to the app's API. Callers never build prompts manually — `buildTaskPrompt(task, ctx)` handles context injection.

`useModuleCLI` hook (in `src/hooks/useModuleCLI.ts`) is the standard way to launch CLI sessions from module components: it creates/reuses sessions, dispatches prompts, tracks running state, and records analytics.

### API Pattern

All API routes use a standardized `{ success: true, data }` / `{ success: false, error }` envelope (`src/types/api.ts`). Server-side: return via `apiSuccess(data)` / `apiError(msg)` from `src/lib/api-utils.ts`. Client-side: `apiFetch<T>(url)` unwraps the envelope and throws on error; `tryApiFetch<T>(url)` returns `Result<T, string>` instead. The `useCRUD<T>(endpoint, initial)` hook wraps fetch + loading/error state + `mutate()` with auto-refetch.

All client-side API calls use **relative URLs** (`/api/...`). For absolute URLs needed in CLI callback prompts, use `getAppOrigin()` from `@/lib/constants.ts` (reads `window.location.origin` on client, `process.env.PORT` on server). For server-side route handlers, use `getOriginFromRequest(request)`.

### Suspend / LRU Pattern

Modules are cached in an LRU when navigating. Hidden modules receive `SuspendContext = true` (from `src/hooks/useSuspend.ts`). Use `useSuspendableEffect` instead of `useEffect` for timers/polling that should pause when hidden. Use `useSuspendableSelector` for Zustand subscriptions that should freeze when suspended.

## Coding Conventions

### Import Paths
Always use `@/` alias (maps to `src/`), never relative `../../`.

### No Raw Console
Use `logger` from `@/lib/logger` — ESLint warns on `console.*` (except `console.error`).

### No Hardcoded Hex Colors
Import from `@/lib/chart-colors` (`STATUS_SUCCESS`, `MODULE_COLORS.core`, `qualityColor(score)`, opacity helpers) or use CSS variables. ESLint enforces this.

### Timing Constants
All timing values (toast duration, batch delays, heartbeat intervals) come from `UI_TIMEOUTS` in `@/lib/constants.ts`.

### Result Type
Use `Result<T, E>` from `@/types/result.ts` for fallible operations.

## Testing

Vitest with setup file at `src/__tests__/setup.ts`. Tests live in `src/__tests__/`. Path alias `@` resolves to `src` in vitest config.
