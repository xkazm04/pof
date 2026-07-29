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

## Catalog Pipeline Step Authoring (rules for parallel sessions)

The catalog→UE pipeline is built by many parallel CLI sessions. Every pipeline step follows the **View / Produce / Acceptance** model (see `docs/catalog/PIPELINE_REVIEW.md` for the full standard + archetype library + per-row plan). The `/layout` lab (`src/components/layout-lab/`) holds the **reference implementation** — the full Items pipeline. Before building a step, read the manifest below and reuse; do not duplicate.

**Rule 1 — Produce contract.** Every CLI/Produce component has a **text area for the user's direction** + its **own prompt logic** (a `buildPrompt(direction)` callback). Use the shared `CliProduce` (below); never hand-roll a Produce panel. It exposes the built prompt and reports the result/error.

**Rule 2 — Generated code conventions.** Code CLIs generate must be clean and **≤ 200 LOC per file**. Folder structure **mirrors the UI hierarchy** — `Catalog → <Catalog> → <PipelineStep>` (e.g. `.../items/economy/`). Filenames are **camelCase and encode hierarchy position** so a file is identifiable out of context: `itemEconomyBudget.tsx`, `itemEconomyDistribution.tsx`. The component export stays PascalCase (`ItemEconomyBudget`). Split anything over 200 LOC into sub-component files in the step folder.

**Rule 3 — Reuse, don't duplicate (Shared Component Manifest).** Check here before building UI:

| Component | Path | Use for |
|-----------|------|---------|
| `CliProduce` | `layout-lab/steps/shared/CliProduce.tsx` | the Produce face of any step (Rule 1) |
| `StepFrame` | `layout-lab/steps/StepFrame.tsx` | step shell: Acceptance banner (with optional `why` / `suggestion` / `onFix`) + responsive View panel grid. The generic `ArchetypeStep` (~330 non-Items steps) fills these for every non-pass status via `shared/genericFixCopy.ts` — a step's bespoke `StepSpec.copy` if it has one, else a neutral fallback derived only from the checker's status + `reason` (never invents catalog content). Its "⚡ Produce fix" runs the corrective direction through the step's own prompt logic (gallery → corrective batch, static → re-produce); `deferred` gets an explanatory `why` but no fix button (a runtime/visual gate isn't locally fixable). **Provenance:** pass `catalogId` + `step` and it resolves the audited `StepFact` (`getStepFact`) and renders `ProvenanceStrip` under the banner — so a shape-only "pass" can't read as verified. A step that names itself ALWAYS gets the strip: with its fact, else a loud `PROVENANCE: UNAUDITED` (an anonymous StepFrame with no catalogId/step still renders none). Display only; never touches grading. |
| `ProvenanceStrip` | `layout-lab/steps/shared/ProvenanceStrip.tsx` | compact colorblind-safe honesty strip beneath any StepFrame acceptance banner (`StatusTag`/`MicroLabel`, glyph+word not hue): engine (`trueEngine`) · judge class (loud `JUDGE: NONE`) · checker-meaningfulness (`CHECKER: SHAPE-ONLY` vs `MEANINGFUL`) · `GENERATOR: NOT WIRED`, all from `step-facts.json`; the per-step honesty `note` is reachable in an expandable `<details>`. Fed automatically by `StepFrame`'s `catalogId`+`step` — don't hand-roll a provenance display. **Selection provenance:** a gallery (L1) step also passes `selection` (`selectionSource(history)` from `genHistory`) → `SELECTION: AUTO` (the machine auto-picked the batch's first candidate) vs `SELECTION: HUMAN` (someone clicked), `unrecorded` for legacy histories; the strip renders for fact-less steps too when `selection` is given. **Verdict provenance + derivation chain:** pass `judge` (the `AcceptanceResult.judge` attribution) → `VERDICT: CURRENT / STALE / UNVERIFIED / SUPERSEDED`, so a step condemned by a verdict that judged content it no longer holds says so instead of reading as a plain failure; pass `explain` (a THUNK from `useStepAcceptance`, invoked only while the "Why this grade?" disclosure is open — never per render) → the ordered `explainAcceptance` chain (checker → server-overlay → judge-bridge, which layer won, and which `allOf` member produced the reported status/tier). Both are display-only and provably cannot move a verdict (`explainAcceptance` re-applies the same functions in the same order as `resolveStepAcceptance` and is pinned byte-identical to it). |
| `ChartPanel` | `layout-lab/steps/shared/ChartPanel.tsx` | budget bars / scatter / histogram / waveform — shared `scaleLinear` + axes + staggered grow-in entrance (reuse instead of hand-rolled SVG). **All four variants** are reachable from the generic renderer via the `chart` **view kind** (`ViewDescriptor` → `bars`/`histogram` `{ field; rows/keys; max?; highlightKey? }`, `scatter` `{ field; referenceKey; pointsKey?; xDomain; yDomain; xLabel?; yLabel? }`, `waveform` `{ field; samplesKey; activeKey? }`; supported list in `SUPPORTED_CHART_VARIANTS`): a `balance` step declares which artifact fields feed the chart and which flavor, and `ArchetypeStep`'s ViewPanel renders it through this shared component. **Every `archetype:'balance'` step now declares a chart** (bars for budgets/faucet-vs-sink, histogram for distributions e.g. `combat-map` threat sources; `materials` LOD/Perf Budget was the first) — enforced by the fleet spec linter (`src/__tests__/catalog/pipeline-spec-linter.test.ts`). A balance metric that is only expressible as a negative number (e.g. `music` −16 LUFS) writes a positive display magnitude + band edges for the bars view; acceptance still derives from the original field. |
| `DataTable` | `layout-lab/steps/shared/DataTable.tsx` | attribute / manifest key·value table: present values in `inkDeep` (+ optional `unit`), `null` flagged in `warn` with `missingText`; optional `header` row + `caption`. Backs the generic `ArchetypeStep` `table` view, the `manifest` view when its field holds a **keyed object** (columns derived from the keys; nested arrays/objects flattened for display — arrays keep the checklist-style list), and the bespoke Items `Attributes` step — build tables here, don't hand-roll. Note: a `checklist`/`manifest` field that is **present but the wrong shape** renders a loud `ShapeMismatch` (names expected vs actual shape), never the "Nothing yet" empty-state lie — only genuinely-absent data shows the empty state. **Row mode:** pass `rows` (a list of `{label?, values}`) for a real multi-column table — the shape most produce bodies actually write (a LIST of row records, or a KEYED GROUP of them). The generic `table` view resolves which mode applies through the shared pure `@/lib/catalog/tableView.ts` (`resolveTableView`), which also backs spec-linter rule **(f2)**: every declared column must resolve against the step's own produce stub, so a table can never render a grid of `— missing`. A row list nested one level down is reached with the descriptor's optional `rowsKey` (`hazards` + `rowsKey:'hazardList'`); `field` stays the top-level key so linter rules (f)/(g) are unaffected. |
| `CandidateGallery` (Gallery2D) | `layout-lab/steps/shared/CandidateGallery.tsx` | generative-step candidate browser: every re-roll **batch is kept** (not discarded), each stamped with its direction + an expandable prompt; click any candidate to re-select. Pairs with the pure `genHistory.ts` model (`readHistory`/`appendBatch`/`selectCandidate`/`historyData`) which persists in the step artifact's `data.genHistory` and projects the selected candidate's payload to top-level so derived Acceptance is unchanged. History is **bounded** — `appendBatch` prunes to the last `MAX_KEPT_BATCHES` (12) re-rolls (the batch owning the selected candidate is exempt); batch ids stay unique across pruning via `nextSeq` (never `batches.length`). Both the bespoke Items steps (`ItemArt.tsx`) and the generic `ArchetypeStep` gallery consume the ONE shared engine `shared/useGenerativeStep.ts` (generate/reselect against `produceFrom`, history memoized on the artifact data ref); their candidate generators (`shared/itemGenCandidates.ts` / `shared/genericGalleryCandidates.ts`) share one hash (`shared/hash.ts`). So every `archetype: 'gallery'` step across all catalogs gets browse→compare→select with acceptance unchanged. A candidate may carry a real `imageUrl` (served thumbnail) — the gallery renders the image over its `swatch` (else the swatch is an honest deterministic seed preview). **Pluggable generators:** a `StepSpec.genCandidates` (`{ needsAssets?, build(direction, seq, assets) }`, `shared/imageGalleryCandidates.ts`) lets a gallery step surface REAL generated thumbnails, preferred over the swatch fallback; ArchetypeStep pre-fetches the asset manifest when `needsAssets` (keeping `build` synchronous) — `assetKind:'2d'` (default) via `shared/useGeneratedImageAssets.ts` for served preview images (`shared/imageGalleryCandidates.ts`), or `assetKind:'3d'` via `shared/useGeneratedMeshAssets.ts` for real `.glb` meshes (`shared/meshGalleryCandidates.ts`, candidate carries `payload.glbUrl` → interactive GlbViewer). Empty manifest → honest swatch fallback (never a fake preview). See `icon-sets` Icon 2D Art (2D) and `character-pipeline` 3D Generation (3D). |
| `GlbViewer` | `layout-lab/steps/shared/GlbViewer.tsx` | interactive `.glb` preview (orbit/zoom, auto-framed, r3f) for 3D steps. `ArchetypeStep`'s gallery view renders it automatically when the selected candidate's `payload.glbUrl` is set. Load via `next/dynamic({ ssr:false })` (WebGL-only). Serve the `.glb` via `/api/visual-gen/asset/<name>.glb` (files under `generated/triposr/`). **Reuse `GlbPreviewPanel` (below), not GlbViewer directly** — it is the single-sourced viewer+URL-caption block ArchetypeStep uses in both preview slots. |
| `GlbPreviewPanel` | `layout-lab/steps/shared/GlbPreviewPanel.tsx` | the shared 3D preview block (dynamic `GlbViewer` + served-URL caption) + `GLB_PREVIEW_LABEL`. ArchetypeStep renders it for a gallery candidate's `payload.glbUrl` and for non-gallery `data.glbUrl`. Reach REAL generated meshes in a **generic** gallery via `StepSpec.genCandidates = { needsAssets, assetKind:'3d', build: meshGalleryCandidates(...) }` — ArchetypeStep pre-fetches the `.glb` manifest (`shared/useGeneratedMeshAssets.ts`, reuses `/api/visual-gen/assets`) and each candidate carries `payload.glbUrl`; empty manifest → honest swatch fallback (no fake 3D). See `character-pipeline` 3D Generation. |
| `RawArtifactDisclosure` | `layout-lab/steps/shared/RawArtifactDisclosure.tsx` | collapsed `<details>` "Raw artifact" panel showing EXACTLY what a step stored (`data` + `ueAssets` + the persisted server verdict), verbatim. `ArchetypeStep` appends it to every generic step's panel grid — produce bodies write 10–60× what any View renders (e.g. the `wiringContract`), and this is the honest window onto the rest. Serializes only when expanded (controlled `<details>`), so a collapsed step pays nothing. |
| `Lbl` / `LabButton` / `LabInput` / `LabTextarea` | `layout-lab/steps/controls.tsx` | themed form controls (≥14px) |
| `useStepAcceptance` | `layout-lab/steps/shared/useStepAcceptance.ts` | the ONE on-screen acceptance derivation for every step UI: unified `buildLabCheckerContext` (real siblings + live `has`) → `serverVerdictOverlay` → `bridgeJudgeVerdict`. `ArchetypeStep`, `StaticStepFrame` and `GenerativeStepFrame` all consume it — never hand-roll a `CheckerContext` in a step component. |
| `StaticStepFrame` / `GenerativeStepFrame` | `layout-lab/steps/StaticStepFrame.tsx` · `GenerativeStepFrame.tsx` | the bespoke Items step shells (static vs gallery). Each derives acceptance via `useStepAcceptance`, appends `RawArtifactDisclosure`, and (generative) passes the `selectionSource` provenance chip — so the reference pipeline carries the same honesty affordances as the generic steps. |
| `getStepComponent` | `layout-lab/steps/index.ts` | per-catalog/per-step registry lookup |

Reusable patterns still to extract to `shared/` when first needed (add to this table when you do): _(none outstanding)_. (`Gallery2D` is now `CandidateGallery`; `DataTable` is now extracted — both above.)

> **Produce contract note:** `CliProduce.onComplete` is called with an optional `{ direction, prompt }` so generative steps can stamp the batch they produce with the user's art direction. Zero-arg handlers stay valid. Dispatch is **async by default**: the button shows an in-flight "Dispatching…" state, awaits `onComplete` (which may return a promise), and surfaces a throw/rejection as the inline error reason with a **"Retry with same prompt"** affordance (Rule 4 — a failing dispatch always reports why). `onComplete` is still invoked synchronously on the click, so a stub-mode produce that writes its artifact synchronously still flips Acceptance immediately (only the success/error message resolves on the microtask). Pass `sync` to opt out to the legacy synchronous path (tests/legacy only); `minDispatchMs` sets an optional minimum in-flight hold.

**Rule 4 — Every step is tested + truthful.** Each step must: (a) **produce data to the UE5 project** and **update the UI**, (b) **fulfill a derived Acceptance** (read from UE/DB truth, never a manual toggle), and (c) if production fails, the **CLI reports the reason** (surface it, don't fail silently — `CliProduce.validate` returns the error reason). Each step ships a test asserting its View renders, Produce dispatches, and Acceptance derives.

**Rule 5 — Every pipeline is e2e-walked.** Every registered catalog pipeline is exercised end-to-end through the real `/layout` lab by the data-driven walker `e2e/catalog-pipeline-walker.spec.ts` (the Items reference pipeline by `e2e/catalog-items-reference.spec.ts`). The walker enumerates `allCatalogPipelines()`, so a **new pipeline is auto-covered** the moment it self-registers — you do not write a new spec. Your obligations when authoring a pipeline:
- Keep **≥1 seeded entity** for the catalog in `CATALOG_SECTIONS` / `NEW_CATALOGS` (the walker opens `entities[0]`).
- Each step's Produce must drive its Acceptance to a **config-complete terminal status**: `pass` for L0/L1/L2 (data/selection/static), `deferred` for L3/L4 (runtime/visual) — **never `fail`/`pending`** after a clean Produce. `deferred` must carry a reason (Rule 4).
- Keep the guard `src/__tests__/catalog/pipeline-e2e-coverage.test.ts` green (it runs in `npm run validate`). It fails if your pipeline has no seeded entity/section or is skipped without a reason.
- If a step genuinely cannot be walked in stub mode, add the catalog to `WALKER_SKIP` in `e2e/helpers/pipeline-coverage.ts` **with a precise reason** — never to mask a real failure. (Current documented gap: `player-movement` is registered but absent from `CATALOG_SECTIONS`, so the lab surfaces no entity — add a section/starter to close it.)

Run the catalog e2e with `npm run test:e2e` (Playwright, real dev server + SQLite, stub mode — no Claude CLI / UE bridge; `CliProduce` writes artifacts synchronously). It is intentionally **not** part of `npm run validate` (vitest-only); the guard test is the fast `validate`-time enforcement. The lab exposes stable test-ids for the walker: `harness-lab-ready`, `harness-catalog-<id>`, `step-dot-stamp-<i>`, `cli-produce-run`, `cli-produce-result`, and `acceptance-banner` (`data-status`); the opened entity is derived from the seed (`seedAllCatalogs()`), not a DOM hook, so the walker needs no instrumentation in `Baseline.tsx`.

## Testing

Vitest with setup file at `src/__tests__/setup.ts`. Tests live in `src/__tests__/`. Path alias `@` resolves to `src` in vitest config.
