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

## Documentation

Full architecture documentation lives in `docs/README.md` — a whole-app map (`docs/architecture/`: overview, ui-shell, module-system, prompts-and-cli, state-and-persistence, runtime-patterns) plus the catalog-pipeline reference (`docs/catalog/`). Read the relevant doc before changing a subsystem.

**Keep the docs in sync with the code — they mirror the implementation, so treat updating them as part of the change, not an afterthought.** When your work alters architecture (a new or removed subsystem, store, API pattern, event-bus channel, acceptance or pipeline mechanism, or a project convention), update the matching `docs/architecture/*` or `docs/catalog/*` file in the **same** change — and `docs/README.md`'s doc map if you add or remove a doc. Don't land a structural change with stale docs. (The `docs/` summaries below are a quick orientation; the files in `docs/` are the maintained source of truth.)

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

## Catalog Pipeline Step Authoring (rules for parallel sessions)

The catalog→UE pipeline is built by many parallel CLI sessions. Every pipeline step follows the **View / Produce / Acceptance** model (see `docs/catalog/PIPELINE_REVIEW.md` for the full standard + archetype library + per-row plan). The `/layout` lab (`src/components/layout-lab/`) holds the **reference implementation** — the full Items pipeline. Before building a step, read the manifest below and reuse; do not duplicate.

**Rule 1 — Produce contract.** Every CLI/Produce component has a **text area for the user's direction** + its **own prompt logic** (a `buildPrompt(direction)` callback). Use the shared `CliProduce` (below); never hand-roll a Produce panel. It exposes the built prompt and reports the result/error.

**Rule 2 — Generated code conventions.** Code CLIs generate must be clean and **≤ 200 LOC per file**. Folder structure **mirrors the UI hierarchy** — `Catalog → <Catalog> → <PipelineStep>` (e.g. `.../items/economy/`). Filenames are **camelCase and encode hierarchy position** so a file is identifiable out of context: `itemEconomyBudget.tsx`, `itemEconomyDistribution.tsx`. The component export stays PascalCase (`ItemEconomyBudget`). Split anything over 200 LOC into sub-component files in the step folder.

**Rule 3 — Reuse, don't duplicate (Shared Component Manifest).** Check here before building UI:

| Component | Path | Use for |
|-----------|------|---------|
| `CliProduce` | `layout-lab/steps/shared/CliProduce.tsx` | the Produce face of any step (Rule 1) |
| `StepFrame` | `layout-lab/steps/StepFrame.tsx` | step shell: Acceptance banner (with optional `why` / `suggestion` / `onFix`) + responsive View panel grid |
| `ChartPanel` | `layout-lab/steps/shared/ChartPanel.tsx` | budget bars / scatter / histogram / waveform — shared `scaleLinear` + axes + staggered grow-in entrance (reuse instead of hand-rolled SVG) |
| `CandidateGallery` (Gallery2D) | `layout-lab/steps/shared/CandidateGallery.tsx` | generative-step candidate browser: every re-roll **batch is kept** (not discarded), each stamped with its direction + an expandable prompt; click any candidate to re-select. Pairs with the pure `genHistory.ts` model (`readHistory`/`appendBatch`/`selectCandidate`/`historyData`) which persists in the step artifact's `data.genHistory` and projects the selected candidate's payload to top-level so derived Acceptance is unchanged. Per-step candidate generators live in `shared/itemGenCandidates.ts` (bespoke Items steps in `ItemArt.tsx`); the **generic `ArchetypeStep` gallery view** uses the same loop via `shared/genericGalleryCandidates.ts`, so every `archetype: 'gallery'` step across all catalogs gets browse→compare→select with acceptance unchanged. |
| `Lbl` / `LabButton` / `LabInput` / `LabTextarea` | `layout-lab/steps/controls.tsx` | themed form controls (≥14px) |
| `getStepComponent` | `layout-lab/steps/index.ts` | per-catalog/per-step registry lookup |

Reusable patterns still to extract to `shared/` when first needed (add to this table when you do): `DataTable` (attribute/manifest tables). The table UIs recur across catalogs — build them once in `shared/` and register here. (`Gallery2D` is now `CandidateGallery`, above.)

> **Produce contract note:** `CliProduce.onComplete` is called with an optional `{ direction, prompt }` so generative steps can stamp the batch they produce with the user's art direction. Zero-arg handlers stay valid.

**Rule 4 — Every step is tested + truthful.** Each step must: (a) **produce data to the UE5 project** and **update the UI**, (b) **fulfill a derived Acceptance** (read from UE/DB truth, never a manual toggle), and (c) if production fails, the **CLI reports the reason** (surface it, don't fail silently — `CliProduce.validate` returns the error reason). Each step ships a test asserting its View renders, Produce dispatches, and Acceptance derives.

## Testing

Vitest with setup file at `src/__tests__/setup.ts`. Tests live in `src/__tests__/`. Path alias `@` resolves to `src` in vitest config.
