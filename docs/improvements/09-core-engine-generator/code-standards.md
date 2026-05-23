# 09 · Core Engine Generator — Code quality, structure & performance

Dimension 2 of the polish pass: the engineering discipline that keeps a
hundreds-of-assets authoring app maintainable and fast. These are **global
constraints** every Round-1/Round-3 CLI slice must follow, plus a lint gate that
makes them non-negotiable.

The cautionary example lives in this very repo: `FeatureMatrix.tsx` (~1431 LOC)
and `RoadmapChecklist.tsx` (~1448 LOC) are god-components — hard to reason about,
hard to test, slow to render. The catalog framework must **not** repeat that.

## 1. The 200-LOC-per-`.tsx` rule (hard)

No `.tsx` file exceeds **200 lines**. Enforced by ESLint (see §6), so it fails
`npm run validate` / CI. This is a *forcing function* for good decomposition,
not bureaucracy. How to stay under it:

- **Container / view split** — a `*View.tsx` (presentational, props-in) and a
  `use*.ts` hook (state, effects, data). Logic leaves the `.tsx`; the view
  becomes a thin render. (This alone would have halved the two god-components.)
- **Extract sub-components** — a row, a card, a facet, a chart, a drawer tab are
  each their own file. Co-locate them next to their parent.
- **Schema-driven cells** — the `CatalogView` framework renders generic cells
  from a `CatalogSchema`; a section contributes a *schema + a few small custom
  cells*, never a 1000-line bespoke list.
- **Hooks own logic** — filtering, sorting, selection, generation dispatch,
  URL-sync each live in a focused hook (`useCatalogFilter`, `useCatalogSelection`,
  `useGeneration`, `useCatalogRouting`), unit-testable without rendering.

`.ts` (non-component) files aren't capped at 200 but follow single-responsibility
— a recipe per file, a store slice per concern.

## 2. Balanced, feature-based folder structure

Co-locate by responsibility (files that change together live together), not by
technical layer. Concrete tree:

```
src/
  components/
    catalog/                 # the generic CatalogView framework
      CatalogView.tsx        # thin composition root (<200 LOC)
      tree/                  # CatalogTree + nodes
      facets/                # FacetBar + facet controls
      list/                  # VirtualCatalogList / VirtualCatalogGrid + Row/Card
      detail/                # EntityDetailDrawer + tabs (editor, preview, generation)
      bulk/                  # BulkActionBar + selection UI
    viz/                     # shared chart primitives (custom SVG) + NodeGraph wrapper
    sections/                # per-section schemas + custom cells (thin)
      spellbook/  bestiary/  items/  loot-tables/  combat-map/
      screen-flow/  zone-map/  state-graph/
  lib/
    catalog/                 # types.ts, schema.ts, recipe.ts, batch.ts
    design-tokens.ts         # the token layer over chart-colors
  stores/
    catalogStore.ts          # entities + selectors (transient state NOT persisted)
  hooks/
    useCatalogFilter.ts  useCatalogSelection.ts  useGeneration.ts  useCatalogRouting.ts
```

A **section is a folder of small files** (a schema + a couple of custom cells +
its viz composition) — never a monolith. New sections in Round 3 drop into
`sections/<name>/` without touching the framework.

## 3. Separation of concerns

- **Components are dumb** — render props, no data fetching, no business rules.
- **Hooks own behavior** — state, effects, derived data, dispatch.
- **Stores own state** — Zustand slices; follow `moduleStore` conventions
  (persist design data, **never** persist transient run-state like `isRunning`/
  generation-in-flight — the documented rehydration-instability lesson).
- **`lib/` owns logic** — recipes, batch queue, prompt assembly, schema/zod
  validation. Pure, testable, no React.
- **API** — keep the `{ success, data/error }` envelope; client uses
  `apiFetch`/`tryApiFetch` + `useCRUD`; fallible ops return `Result<T,E>`.

## 4. Performance + staggered/lazy loading

Hundreds of assets and heavy viz make this load-bearing, not optional:

- **Virtualize everything large** — use the already-installed **`react-window`**
  for `VirtualCatalogList`/`Grid` and for big matrices/heatmaps. Only the visible
  window is in the DOM (the explicit fix for `FeatureMatrix`'s render-all-rows
  failure mode). Stagger animations apply **only to the visible window**.
- **Code-split by section** — each `sections/<name>/` view is a
  `React.lazy` / Next `dynamic()` import behind `<Suspense>` with a skeleton.
  Switching sections loads only that section's bundle.
- **Lazy-load heavy libs** — the **`@react-three/*` 3D viewport**, the
  **`@xyflow/react` node-graph**, and **`shiki`** code preview are each
  dynamically imported *only when their pane opens* (detail drawer / graph
  section). They must never enter the catalog-list bundle. This keeps initial
  load lean despite the studio-grade viz.
- **Debounce + memoize** — search input debounced; filter/sort/group derivations
  memoized (`useMemo`/selector equality); avoid recompute on every keystroke
  (the FeatureMatrix re-filter-on-every-render pitfall).
- **Suspend/LRU** — honor the existing pattern: `useSuspendableEffect`/
  `useSuspendableSelector` so a backgrounded section (LRU cap 5) freezes its
  fetches/polling and the 3D/graph panes pause. A hidden catalog does no work.
- **Skeletons over spinners** — every async surface (list, cards, charts, 3D,
  drawer) shows a shaped skeleton, so perceived performance stays high.
- **Image/thumbnail lazy-loading** — asset icons load on scroll into view
  (native `loading="lazy"` / intersection), not all at once.
- **Bundle budgets** — a CI check on the per-section + framework chunk sizes;
  regressions (e.g. a heavy lib leaking into the list bundle) fail the build.

## 5. Type safety

- **`zod`** (already installed) for `CatalogSchema` definitions and **recipe
  callback payload validation** — the `@@CALLBACK` JSON is parsed through a zod
  schema before a lifecycle transition, so malformed/injected output can't
  advance state.
- Generic `CatalogEntity<T>` + typed per-section `data` (no `any`; ESLint already
  warns on `any`).
- `Result<T,E>` for fallible ops; the API envelope types.

## 6. Lint & CI enforcement

Extend the existing ESLint flat config (eslint v9, `eslint-config-next`; already
enforces no-raw-console + no-hardcoded-hex + warn-on-`any`):

- **`max-lines`** for `**/*.tsx` → **200** (error), with a small allowance for
  generated files if any. This is the teeth behind §1.
- Keep `@/` import-alias enforcement (no `../../`).
- Optionally `max-lines-per-function` to discourage mega-render bodies.
- `npm run validate` (typecheck + lint + test) stays the gate; add the
  bundle-budget check to CI.

## Anti-patterns (explicitly avoid)

- **God components** — if a `.tsx` nears 200 LOC, split *before* it crosses,
  don't request an exception. The two existing 1400-line files are debt to *not*
  emulate (and good candidates to refactor when next touched).
- **Eager-loading heavy libs** — `@react-three/*`, `@xyflow/react`, `shiki` must
  be lazy; importing them at module top-level regresses initial load.
- **Persisting transient state** — generation-in-flight / `isRunning` flags must
  stay out of `persist` (rehydration instability).
- **Prop-drilling deep trees** — use a focused store slice or context at the
  `CatalogView` boundary instead of threading props through 5 levels.
- **Rendering full collections** — never map over an unvirtualized 200+ array;
  the framework's virtualized list is the only sanctioned way to render a
  catalog.

## How this couples to the rest of 09

These standards are **constraints on every deliverable** in the roadmap: Round 1
builds the framework + tokens + viz primitives *already conforming* (so the
pattern is set), and the lint rule lands with it so Round-3 section CLIs
physically cannot ship a 1000-line section file. The performance rules
(virtualize, lazy, suspend) are what make the studio-grade viz in
[`ux-design.md`](ux-design.md) affordable at hundreds-of-assets scale. The
catalog-framework perf tests in [`tests.md`](tests.md) (1000-item virtualization,
debounced facets) are the automated proof these hold.
