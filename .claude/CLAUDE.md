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
- **`src/lib/evaluator/module-eval-prompts.ts`** — 4-pass evaluation criteria (ground-truth → structure → quality → performance) per module, plus a 5th `combat-trace` pass for `arpg-combat` (see `EVAL_PASSES` / `getPassesForModule`).

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

## Catalog Pipeline Step Authoring (summary)

The catalog→UE pipeline is built by many parallel CLI sessions under the **View / Produce / Acceptance** model. Invariant: **every step reuses the shared manifest components; new components enter the manifest before use.**

- **Rule 1 — Produce contract:** every Produce panel is the shared `CliProduce` (direction textarea + own `buildPrompt`); never hand-rolled.
- **Rule 2 — Generated code:** ≤ 200 LOC/file, folders mirror the UI hierarchy, camelCase filenames encoding position (`itemEconomyBudget.tsx`).
- **Rule 3 — Reuse, don't duplicate:** check the 24-row Shared Component Manifest (StepFrame, ProvenanceStrip, ChartPanel, DataTable, CandidateGallery, GlbViewer, Modal, useStepAcceptance, …) before building any UI.
- **Rule 4 — Tested + truthful:** produce to the UE5 project, derived Acceptance (never a manual toggle), failures report their reason.
- **Rule 4b — Server gradability is a four-state contract** (`registered`/`bespoke`/`unservable`/`unknown`); `unknown` is a defect; never rename a step label.
- **Rule 5 — Every pipeline is e2e-walked** by `e2e/catalog-pipeline-walker.spec.ts`; keep the coverage guard test green.

The full manifest table and rules load automatically (`.claude/rules/catalog-pipeline.md`) when working under the catalog-pipeline paths (`src/components/layout-lab/`, `src/lib/catalog/`, pipeline API routes, catalog tests/e2e, `docs/catalog/`).

## Testing

Vitest with setup file at `src/__tests__/setup.ts`. Tests live in `src/__tests__/`. Path alias `@` resolves to `src` in vitest config.

## AI registry (knowledge + skills)

This repo is wired to the organization's AI registry - ONE local checkout, at the path in
`.ai/manifest.yaml` under `registry.local` (default `../ai-registry`).

- **The knowledge is already loaded.** `.claude/rules/ai-registry-*.md` are links to the
  registry's generated rules: the access contract, plus a subject map for every domain in
  `.ai/manifest.yaml` `knowledge.domains`. Rules load in every session, so the corpus is in
  front of you without invoking anything. Before a design, architecture or product decision
  in a covered domain, open the governing subject - resolve it through
  `knowledge/<domain>/index.json` (`subjects["<slug>"].file`), never by building a path from
  a slug. Where this repo falls short of the standard, that is a deviation to record, not a
  reason to lower the standard. `/consult <topic>` does the same read deliberately and logs
  it so the registry can see which knowledge is actually reached for.
- **Shared skills are links, not copies.** Every name in `.ai/manifest.yaml` `skills:` is
  linked from `.claude/skills/<name>` into the registry's lane, so there is exactly one file
  on this machine: editing a shared skill from this repo edits the registry's file, and the
  change is live in every project immediately. Never copy a registry skill in - a real
  directory under `.claude/skills/` is a project-owned skill and must carry its own name.
- **After changing the manifest**, re-link with `node <registry>/scripts/link-registry.mjs`
  (`--check` verifies without writing). Project-specific configuration for a shared skill
  lives in its committed overlay, e.g. `.claude/perfect/config.md`.
