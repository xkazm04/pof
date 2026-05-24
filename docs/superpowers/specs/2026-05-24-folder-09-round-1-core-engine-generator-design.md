# Folder 09 · Core Engine Generator — Round 1 Design

**Date:** 2026-05-24 · **Status:** Approved (design), pending spec review → plan.
**Provenance:** [`docs/improvements/09-core-engine-generator/`](../../improvements/09-core-engine-generator/)
(`README.md`, `pof-app.md`, `game.md`, `tests.md`, `ux-design.md`, `code-standards.md`).

---

## 0. REVISION 2026-05-24 — Extends merged "Step 1" (supersedes conflicting parts below)

**A parallel CLI already built and merged folder-09 "Step 1"** (plan
`docs/superpowers/plans/2026-05-23-catalog-step1-spellbook-retrofit.md`; commits
`b9345fa → c80d832 → f0d7810 → bfde298`). Step-1 is a *tracking layer*:

- `src/lib/catalog/types.ts` — minimal `CatalogEntityBase`
  (`id, catalogId, name, categoryPath, tags, lifecycle`) + `AbilityEntry` whose
  `data` reuses the existing `SpellbookAbility` UI shape. `LifecycleState`
  (`planned→scaffolded→generated→wired→verified|failed`) is already defined.
- `src/stores/catalogStore.ts` — Zustand+persist, **seed-only** (seeds from the
  static `SPELLBOOK_ABILITIES`), `setEntities` + `useCatalogEntities`/
  `useCatalogEntity`/`useSpellbookEntries` selectors, a re-seed `merge`.
- `src/components/catalog/LifecycleBadge.tsx`; `AbilitySpellbook` unique-tab UI
  retrofitted to read from the store; `catalog-seed` + store tests.

**This revision reuses all of Step-1 unchanged** and re-scopes Round 1 to the
*unbuilt, non-conflicting* layer that Step-1 explicitly anticipated:

| Reuse from Step-1 (do not rebuild/replace) | Add (this revised Round 1) |
|---|---|
| `types.ts` `CatalogEntityBase`/`AbilityEntry`/`LifecycleState` | **Additive optional fields only:** `ueAssets?`, `lastTestResult?`, `lastVerifiedAt?` on `CatalogEntityBase` |
| `catalogStore.ts` seed + selectors + `merge` | **Additive** gated `applyGenerationResult` action + `loadLifecycle` (merge DB lifecycle over seed) |
| `seed-spellbook.ts`, `LifecycleBadge`, Spellbook UI | (consumed as-is; badge already renders lifecycle) |

**Net Round-1 deliverables (revised):** `lifecycle.ts` (shared gate), zod
`validation.ts` (callback payload), `catalog-db.ts` + `/api/catalog`
(server-side lifecycle persistence — the dispatched-CLI `@@CALLBACK` target),
the generation engine (`recipe.ts`/`batch.ts` + `PromptBuilder.withAssetSpec` +
a `'generate'` `CLITaskType`/`TaskFactory.generate`), and the **live-UE Spellbook
generate+verify** for `GA_Fireball`.

**Corrections to the sections below:**
- D1 (routing), the full `CatalogView` UI framework (§3.5), `design-tokens.ts`,
  and `viz/` are **deferred** — Step-1 reuses the existing rich `AbilitySpellbook`
  UI, so a new generic catalog UI is not Round-1 work. Round 1 surfaces generation
  via the existing Spellbook tab (a "(Re)generate" affordance + the existing
  `LifecycleBadge`), not a new framework.
- D2 (scoped `max-lines` lint gate) still applies to any new `.tsx` (only
  `LifecycleBadge` exists so far; keep new components ≤200 LOC).
- D4/D5/D6/D7 (reuse `cli-task.ts`/`@@CALLBACK`, `ability-forge` knowledge,
  functional-test gate, runtime `ProjectContext` path) are **unchanged**.
- The richer entity model in §3.2 (`recipeId`/`links` as required fields) is
  **dropped** for Round 1 — recipe is derived from `catalogId` (YAGNI); links
  return when a section needs them.

The phases in §4 are replaced by the phases in the revised plan
(`2026-05-24-folder-09-generation-engine.md`).

---

## 1. Scope

Round 1 of the folder-09 roadmap: the **shared catalog substrate + generation
engine + studio foundation**, proven end-to-end through **one** section —
**Spellbook** (`arpg-gas`). Everything in the 8-section roadmap depends on this;
Rounds 2–3 (known-assets registry, the other 7 sections) are **out of scope**
here and become their own spec → plan cycles.

**Definition of done (operator decision):** the *live UE run is required* — the
Spellbook flow must generate a real `UGameplayAbility` (gray-box `GA_Fireball`)
into the UE project and a functional test must pass live. App-side pipeline
correctness is necessary but not sufficient.

**Build strategy (operator decision): Approach C — Hybrid.** Build the
foundation and generation engine first, **prove one ability live in UE in the
middle of the build** (de-risking the hard gate before the large UI
investment), then build the full `CatalogView` UI + viz + navigation + lint gate
+ finish the Spellbook section on top of an engine already proven.

## 2. Decisions locked

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Routing = query-param/History sync against `navigationStore`**, NOT Next app-router segments. | The app is a single client page (`src/app/page.tsx`); navigation is entirely `navigationStore`. App-router segments would restructure the whole app and collide with concurrent CLIs. |
| D2 | **`max-lines: 200` ESLint gate scoped via override** to `src/components/{catalog,sections,viz}/**/*.tsx` only. | A global gate would break `npm run validate` for the existing ~1400-LOC god-components and every concurrent CLI. Scoping holds new code to the bar without foreign breakage. |
| D3 | **Defer `@xyflow/react`** (node-graph lib). | Round-1 Spellbook needs only `StatBars`/`Radar` (custom SVG). Node graphs are Round-3 (Combat Map/Screen Flow/Zone Map/State Graph). YAGNI. |
| D4 | **Reuse `cli-task.ts` `CLITask`/`TaskFactory`/`@@CALLBACK`** + extend `PromptBuilder`; add a `'generate'` task type. | The seam already does context injection, callback registry, tamper-proof `staticFields` merge, and dispatch through the claude-terminal CLI. No new transport. |
| D5 | **Reuse `ability-forge.ts` prompt knowledge** for the Spellbook recipe's C++ scaffold step; the live generate+verify path runs through a dispatched CLI session (writes UE files, builds, runs the functional test), not the one-shot Gemini `forge-ability` route. | The Gemini route returns code text only; the live UE gate needs real on-disk generation + build + `Automation RunTests`. |
| D6 | **`verify` lifecycle transition = a real `AFunctionalTest` green**, parsed via the harness `verifier.ts`. No file-existence shortcut. | The vertical-slice lesson: the report is gameable; only a functional test that drives the real path is a true pass signal. |
| D7 | UE project path comes from **`ProjectContext.projectPath` at runtime**, never hardcoded. | Active UE project is the operator's configured project (`Source/PoF` layout; git `pof-exp`); recipes must stay project-agnostic. |

**Dependency notes / risks to resolve in planning:**
- `react-window` is **v2.2.7** but `@types/react-window` is **^1.8.8** (v1 types).
  v2 ships its own types and has a different API. Plan must resolve the type
  mismatch (likely drop the stale `@types/react-window` and use v2's API).
- `zod` is **v4** — `z.object`/`z.infer` usage is compatible; confirm any v3→v4
  API deltas when writing schemas.

## 3. Architecture

Three layers + a navigation tie-in, all in a feature-folder structure, every
`.tsx` ≤200 LOC (container/view split, hooks own logic, schema-driven cells).

### 3.1 Files (all additive unless noted)

```
src/lib/catalog/
  types.ts        # CatalogEntityBase, LifecycleState, CatalogId, AbilityEntry, CatalogLink
  schema.ts       # CatalogSchema type + zod schemas (entity data + @@CALLBACK payload)
  recipe.ts       # GenerationRecipe<T>, GenerationStep, buildPrompt, .withAssetSpec wiring
  batch.ts        # single-dispatch batch queue
src/lib/design-tokens.ts          # token layer over chart-colors (roles/space/type/elevation/radii/motion)
src/lib/catalog-db.ts             # better-sqlite3 catalog_entities table (follows *-db.ts pattern)
src/app/api/catalog/route.ts      # { success, data/error } envelope CRUD + lifecycle callback target
src/stores/catalogStore.ts        # entitiesByCatalog + selectors + gated lifecycle reducer
src/hooks/useCatalogFilter.ts | useCatalogSelection.ts | useGeneration.ts | useCatalogRouting.ts
src/components/catalog/
  CatalogView.tsx                 # thin composition root
  tree/  facets/  list/  detail/  bulk/   # CatalogTree, FacetBar, VirtualCatalog*, EntityDetailDrawer, BulkActionBar, CatalogBreadcrumb
src/components/viz/
  StatBars.tsx  Radar.tsx         # custom SVG, tokenized
src/components/sections/spellbook/
  schema.ts  recipe.ts  cells.tsx # the Round-1 reference section
src/app/dev/gallery/page.tsx      # dev-only token/primitive gallery

EDITED (shared, small, additive):
  src/stores/navigationStore.ts   # + activeSection, activeCategoryPath[], activeEntityId
  eslint.config.mjs               # + scoped max-lines override (D2)
  <module-view wiring for arpg-gas># register CatalogView as an ExtraTab via createTabbedModuleView
```

### 3.2 Data model (`src/lib/catalog/types.ts`)

`LifecycleState = 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed'`.

`CatalogEntityBase`: `id`, `catalogId`, `name`, `categoryPath: string[]` (the L4
hierarchy), `tags: string[]`, `lifecycle`, `ueAssets: string[]`, `links?:
CatalogLink[]`, `recipeId`, `lastVerifiedAt?`, `lastTestResult?: 'pass'|'fail'`.
`AbilityEntry extends CatalogEntityBase` with typed `data` (baseClass, cost,
cooldown, damage, tags, montage). `feature-definitions.ts` stays as the coarse
module-level dependency graph; the catalog is the fine asset inventory. An entity
may declare `featureName?` so the feature matrix can roll up its lifecycle.

### 3.3 Store (`catalogStore.ts`)

Zustand + `persist` mirroring `moduleStore` conventions.
`entitiesByCatalog[catalogId][entityId]`; selectors `useCatalogEntities(catalogId,
filter)`, `useCatalogEntity(catalogId, id)`. Lifecycle reducer is **monotonic and
gated**: `wired→verified` only on a `pass` result; `*→failed` captures the error.
**Transient generation-run state is excluded from `persist`** (the documented
`isRunning` rehydration-instability lesson). Design data persists to SQLite via
`catalog-db.ts` + `/api/catalog` + `useCRUD`; lifecycle/test results are merged in.

### 3.4 Generation engine (`recipe.ts`, `batch.ts`)

`GenerationRecipe<T>`: `{ id, catalogId, steps: GenerationStep[], buildPrompt(entity,
step, ctx), testPath? }` with steps `scaffold-cpp | author-python | wire | verify`.
Prompt construction adds a `.withAssetSpec(entity)` section to `PromptBuilder`
(serializes typed `data` into Task Instructions) atop the existing 6 sections +
folder-01 wiring requirements + binary-content tripwire. Dispatch reuses
`CLITask` + `TaskFactory.generate(entity, step)` (new `'generate'` `CLITaskType`)
+ `@@CALLBACK` POSTing produced UE asset paths + the lifecycle transition to
`/api/catalog`, with tamper-proof `staticFields: { catalogId, entityId, step }`.
`batch.ts` runs **one isolated dispatch at a time** (the SP-B single-dispatch
lesson); each entity advances only on its own step success; a mid-queue failure
marks that entity `failed` without poisoning the rest. **Lifecycle transitions
are the contract** and encode the CDO-vs-instance trap (set class-pointer props
on placed *instances*, not just CDOs) and shared-tree discipline in the recipe
prompts. The `@@CALLBACK` payload is validated through a zod schema before any
transition.

### 3.5 UI framework (`src/components/catalog/`)

One generic, schema-driven framework renders the section. Mounts as an `ExtraTab`
(`createTabbedModuleView`) on `arpg-gas`, so L1/L2/L3 nav is unchanged; it adds
L4/L5:
- `CatalogTree` (L4) — collapsible `categoryPath` hierarchy with per-node counts.
- `FacetBar` — debounced text + multi-select lifecycle/tag/type facets (reuse `ChipButton`).
- `VirtualCatalogList` / `VirtualCatalogGrid` — **virtualized** (`react-window` v2) so 200–1000 items stay smooth; grid mode for icon catalogs.
- `EntityDetailDrawer` (L5) — schema-driven editor **+** generation cockpit (lifecycle stepper, UE asset links, last functional-test output via lazy `shiki`, the `(Re)generate` action).
- `BulkActionBar` — multi-select → batch generate/regenerate, feeding `batch.ts`.
- `CatalogBreadcrumb` — L1▸…▸entity spine.

Hooks own behavior (`useCatalogFilter/Selection/Generation/Routing`), components
are dumb. Reuse `chart-colors` + `src/components/ui/` primitives + `motion.ts`.
Heavy panes (`shiki`, any future 3D) are lazy-loaded and never enter the list
bundle. Honor suspend/LRU (`useSuspendableEffect`/`useSuspendableSelector`) so a
backgrounded catalog freezes.

### 3.6 Design tokens + viz

`src/lib/design-tokens.ts` promotes `chart-colors` to a full token layer (color
roles, 4·n space scale, type ramp incl. first-class mono, elevation tiers, radii,
motion tokens). A dev-only `/dev/gallery` route renders primitives + tokens for
drift review. `src/components/viz/` ships `StatBars` + `Radar` (custom SVG,
tokenized, motion-aware) for the Spellbook codex. `@xyflow/react` deferred (D3).

### 3.7 Navigation & routing

Extend `navigationStore` with `activeSection`, `activeCategoryPath: string[]`,
`activeEntityId`. Add query-param/History sync (`useCatalogRouting`) so
`?section=spellbook&path=offensive/fire&entity=ga-fireball` round-trips (deep
links, back/forward, dispatchable target state). Extend `GlobalSearchPanel` to
search catalog entities (name/tag/path).

### 3.8 Spellbook section (`src/components/sections/spellbook/`)

A `CatalogSchema` (facets: school/element/cost-tier/lifecycle; grid codex; detail
form over `AbilityEntry.data`) + a recipe driving the GA/GE/tags path the
character CLI already shipped + a few custom cells. This is the live-UE proof
target.

## 4. Build phases (Approach C)

1. **Foundation** — `types.ts`, `schema.ts` (zod), `design-tokens.ts`,
   `catalogStore.ts` (gated lifecycle reducer, no transient persist),
   `catalog-db.ts` + `/api/catalog`. TDD: store/lifecycle-gate tests.
2. **Generation engine** — `PromptBuilder.withAssetSpec`, `'generate'` task type +
   `TaskFactory.generate`, `recipe.ts`, `batch.ts`, `/api/catalog` callback. TDD:
   recipe prompt snapshot, `@@CALLBACK` merge, batch single-dispatch isolation,
   lifecycle-gate.
3. **Live UE proof (the hard gate, pulled to the middle)** — define the Spellbook
   recipe + `AVSAbility_GA_Fireball` functional test; dispatch a live generation of
   gray-box `GA_Fireball` into the UE project; verify the functional test passes
   live. Shared-tree discipline (§6). This validates D5/D6/D7 before the UI build.
4. **UI framework** — `CatalogView` + tree/facets/virtual list/detail drawer/bulk/
   breadcrumb + hooks + viz primitives + `/dev/gallery`. TDD: faceted-filter,
   tree↔list sync, 1000-item virtualization bound, bulk-select.
5. **Nav/routing + tab integration + lint gate** — `navigationStore` fields,
   `useCatalogRouting` query-param sync, register Spellbook as an `arpg-gas`
   `ExtraTab`, `GlobalSearchPanel` extension, scoped `max-lines` override. TDD:
   URL round-trip (Playwright).
6. **Finish Spellbook + integration pass** — wire the section end-to-end on the
   proven engine; demonstrate authoring → generate → lifecycle → verified in-app.

Each phase ends green (`npm run validate`) and is committed locally (operator
pushes manually; UE side pushes to `pof-exp`).

## 5. Testing strategy

App-side (vitest + Playwright), the 12 tests from `tests.md`:
1 store reducer + monotonic lifecycle + no transient persist · 2 cross-catalog
link integrity (broken-link state, no crash) · 3 feature-matrix roll-up · 4
**1000-entity virtualization render bound** · 5 faceted-filter intersection +
debounce · 6 tree↔list sync + per-node counts at 4+ levels · 7 URL round-trip
(Playwright) · 8 bulk-select + action bar · 9 recipe prompt-assembly snapshot
(incl. `.withAssetSpec` + wiring + tripwire) · 10 `@@CALLBACK` merge tamper-proof
+ shape validation + exactly-one transition · 11 batch dispatcher single-dispatch
isolation + mid-queue failure containment · 12 lifecycle gate (`verified` only on
`Result={Success}`).

UE side: `AVSAbility_GA_Fireball` `AFunctionalTest` (the `AVSEnemyAttackTest`
pattern: activate by tag → target attribute changes), reparented onto folder-08's
`AARPGFunctionalTestBase` if/when available, else standalone.

## 6. UE-side & concurrency discipline

- **App repo is multi-session:** re-read shared files (`navigationStore.ts`,
  `eslint.config.mjs`, the module-view wiring) immediately before editing;
  `git add` only my own files; watch for foreign failures in `validate` and don't
  attribute them to my changes.
- **UE tree is one shared tree:** use `-abslog` for headless runs; commit narrowly
  to only the files this work creates (the `GA_Fireball` class + functional test +
  any Python authoring script); coordinate the single editor instance (Live Coding
  blocks full rebuilds of new `UCLASS`es).
- **Never broad-kill processes** (other Claude CLIs run on this device); kill only
  my own PIDs; prefer leaving servers for the operator.
- The CDO-vs-instance trap is encoded in the recipe prompt and caught loudly by the
  functional test if violated.

## 7. Out of scope (explicit)

- Rounds 2–3: the known-assets registry and the other 7 sections (Bestiary, Items,
  Loot Tables, Combat Map, Screen Flow, Zone Map, State Graph).
- `@xyflow/react` node graphs; 3D `@react-three` asset preview (Spellbook needs
  neither — added when a section that needs them lands).
- A global `max-lines` gate / refactor of the existing god-components.
- Bundle-budget CI check (note it; land with a later round).

## 8. Open risks

- **Live UE coordination** is the highest risk (shared tree, editor timing,
  non-determinism). Phase 3 isolates it early; if a clean editor window is
  unavailable, that phase may need an operator-coordinated slot.
- **`react-window` v2 API/type mismatch** (see §2) — resolve before the list work.
- Folder-08's `AARPGFunctionalTestBase` may be in-flight; the UE gate must work
  standalone if it isn't merged.
