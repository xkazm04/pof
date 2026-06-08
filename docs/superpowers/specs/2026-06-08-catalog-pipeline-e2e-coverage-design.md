# Catalog-Pipeline E2E Coverage — Design

**Date:** 2026-06-08
**Status:** Approved (design), pending implementation
**Topic:** Playwright e2e coverage for every product catalog pipeline + a guard against future gaps

## Problem

The app registers **31 catalog pipelines** (`src/lib/catalog/pipelines/*.ts`) via the StepSpec
chassis. Each pipeline is a sequence of `StepSpec` steps following the View / Produce / Acceptance
model, rendered in the `/layout` lab homepage — `items` via 13 bespoke step components, the other
30 via the generic `ArchetypeStep` renderer.

These pipelines have strong **vitest unit** coverage (~160 catalog tests) but **zero Playwright
e2e** coverage: none of the 19 existing `e2e/*.spec.ts` files open the `/layout` lab or exercise a
catalog pipeline's View → Produce → Acceptance flow through the real UI. A pipeline can therefore
break at the UI/store/persistence seams (the parts unit tests don't see) without any test failing.
New catalogs are authored in parallel CLI sessions and currently ship with no e2e path at all.

## Goal

1. **Cover all 31 catalog pipelines** with e2e tests that drive the real lab UI.
2. **Deep assertions**: every step reaches its config-complete terminal acceptance *and* survives a
   server persist → reload round-trip.
3. **A guard** so future catalogs cannot ship without an e2e path — enforced in `npm run validate`
   and documented as a project rule in `CLAUDE.md`.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Architecture | **Hybrid** — data-driven walker (all 31) + bespoke Items reference spec |
| Depth | **Deep** — config-complete acceptance + persist→reload round-trip |
| Gap prevention | **Guard test (vitest/validate) + CLAUDE.md rule** |
| Run mode | **Stub/harness** (real dev server + real SQLite, no live UE/Claude CLI) |

## Key technical grounding

- **Registry is the source of truth.** `allCatalogPipelines()` (`src/lib/catalog/pipeline-registry.ts`)
  returns every registered `CatalogPipeline`. The walker enumerates this, so coverage tracks the
  registry automatically.
- **Entities are seeded client-side.** `seedAllCatalogs()` (`src/lib/catalog/sections.ts`, via
  `catalogStore.buildInitial()`) gives every catalog ≥1 openable entity with no server/bridge. A
  stub-mode walker can open an entity for every catalog.
- **Produce → persist → hydrate flow** (`Baseline.tsx` + `labPipelineStore.ts` +
  `labArtifactClient.ts`):
  - `produce(entityId, step, out)` writes the artifact to the zustand cache and fires the
    write-through sink.
  - The sink resolves acceptance via `resolveAccept` (`labAcceptance.ts`) and POSTs to
    `/api/pipeline-artifacts` (SQLite `pipeline_artifacts`) with `{ status, tier, reason }`.
  - On entity open, `fetchArtifacts` GET → `hydrateEntity` merges server artifacts back into the
    cache (add-only).
- **Acceptance status is tier-aware.** `AcceptanceStatus = 'pass' | 'pending' | 'fail' | 'deferred'`
  (`src/lib/catalog/acceptance/types.ts`). L0/L1/L2 checkers can reach `pass`; **L3 (`runtimeDeferred`)
  and L4 (`visualDeferred`) always return `deferred`** in stub mode because there is no live UE
  bridge. Asserting blanket `pass` would be a false-green; the walker asserts the **tier-expected**
  status: `pass` for L0/L1/L2, `deferred` for L3/L4.
- **Existing lab test-ids** (31): `harness-lab-ready`, `harness-catalog-${catalogId}`,
  `acceptance-banner` (StepFrame), `cli-produce-result` / `cli-produce-dispatching` (CliProduce),
  `candidate-gallery` / `candidate-${id}` (gallery), `step-dot-stamp-${i}` (PipelineRail). Gaps to
  fill: an entity-row test-id, the Produce trigger button test-id, and a machine-readable
  `data-status` on `acceptance-banner`.

## Architecture

### Component 1 — Shared lab helpers (`e2e/helpers/lab-mode.ts`)

| Helper | Responsibility |
|--------|----------------|
| `gotoLab(page)` | Go to `/`, complete the setup wizard if shown, wait for `harness-lab-ready`. |
| `openCatalogEntity(page, catalogId, entityId?)` | Click `harness-catalog-${catalogId}`, select the first seeded entity (or a named one), return its ordered step list. |
| `produceStep(page, step)` | Navigate to the step (`step-dot-stamp-${i}`), click the Produce button, wait for `cli-produce-result`. Gallery steps additionally generate a batch and select `candidate-0`. |
| `acceptanceStatus(page)` | Read the derived status from `acceptance-banner` (`data-status`). |
| `expectPersisted(page, catalogId, entityId, step, status)` | GET `/api/pipeline-artifacts?...`, assert the row persisted with the derived status; reload the page and assert hydrate restored the same acceptance. |

All helpers reuse the existing stub harness (`setupHarnessMode`, `completeSetupWizard`) so no live
Claude CLI is spawned.

### Component 2 — Minimal UI instrumentation (only app-code touch)

Add stable `data-testid`s that don't yet exist:
- Entity row in `CatalogTree.tsx` → `harness-entity-${entityId}`.
- Produce trigger button in `CliProduce.tsx` → `cli-produce-run`.
- `data-status={acceptance.status}` attribute on `acceptance-banner` in `StepFrame.tsx`.

Keep the set minimal and stable; do not restructure the DOM.

### Component 3 — Pipeline walker (`e2e/catalog-pipeline-walker.spec.ts`)

Imports `allCatalogPipelines()`. For each catalog:

```
test.describe(catalogId):
  open first seeded entity
  for each StepSpec in pipeline:
    produceStep(step)
    assert View panel rendered
    status = acceptanceStatus()
    assert status ∈ {pass, deferred}        // config-complete terminal; never fail/pending
    if status === deferred: assert a reason is shown   // Rule 4 — honest defer (L3/L4)
    expectPersisted(catalogId, entityId, step, status) // stored status === UI status; survives reload
```

The assertion is the **config-complete terminal rule**: after Produce, a step must derive `pass`
(L0/L1/L2 satisfied) or `deferred` (L3/L4 pending a live bridge, with a non-empty reason) — and must
**never** be `fail` or `pending`. This is non-circular and catches the real regressions (a broken
produce/checker surfaces as `fail`/`pending`; a silently-passing L3/L4 step that should defer
surfaces as `pass` without a reason). The persist check then asserts the stored status equals the
in-UI status and that it survives a reload (hydrate). The walker drives the generic `ArchetypeStep`
DOM for the 30 non-Items catalogs. `items` is delegated to the bespoke spec (Component 4) and listed
in the walker's `SKIP` map with reason `"covered by catalog-items-reference.spec.ts"`.

### Component 4 — Items reference spec (`e2e/catalog-items-reference.spec.ts`)

Walks the bespoke 13-step Items pipeline with tailored assertions: Economy price/power ratio shown,
gallery selection persists across re-rolls, Test Gate shows `deferred` citing
`VSItemsDefinitionsTest`, packaging lists ≥3 UE assets.

### Component 5 — Gap guard (`src/__tests__/catalog/pipeline-e2e-coverage.test.ts`, vitest)

Runs in `npm run validate` (fast, no browser). Enumerates `allCatalogPipelines()` and **fails** if
any registered pipeline is not walkable:
1. It has no seeded entity in `CATALOG_SECTIONS` (the walker would have nothing to open), **or**
2. It is listed in the walker's `SKIP` map without a documented non-empty reason.

Because the walker is data-driven, a *new* catalog is auto-walked; this guard turns "added a pipeline
with no e2e path" into a red `validate` rather than a silently-skipped e2e. The `SKIP` map is exported
from a shared module (`e2e/helpers/pipeline-coverage.ts`) so both the walker and the guard read the
same source.

### Component 6 — CLAUDE.md rule

Add **Rule 5 — Every pipeline is e2e-walked** to the *Catalog Pipeline Step Authoring* section:
new catalogs are auto-covered by the walker; authors must keep ≥1 seeded entity, keep the guard test
green, and document any stub-unwalkable step in the `SKIP` map with a reason. Document
`npm run test:e2e`, the walker/guard locations, and the tier-aware pass/deferred rule.

## Run / CI

- **Walker + Items spec**: `npm run test:e2e` (Playwright, real dev server, stub harness). Excluded
  from `npm run validate` (vitest-only), matching the existing `e2e/` convention.
- **Guard test**: in `npm run validate` (enforced on every normal check).
- The new walker is run locally to prove green before the work is considered done.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Real SQLite pollution | Writes use seeded entity ids; `/api/pipeline-artifacts` upserts are idempotent. |
| Walker runtime (31 × ~6–13 steps, `workers:1`) | Produce is stub (~200 ms/step); acceptable. Shardable later. |
| False green on L3/L4 | Tier-aware assertion (`deferred` ≠ `pass`). |
| DOM drift breaking selectors | Minimal, named `data-testid`s; no structural DOM changes. |
| Shared-tree concurrency | Narrow `git add` of only new/changed files; re-read before edit. |

## Out of scope

- Live UE bridge / L3 runtime + L4 visual gates (those have their own deferred runner —
  `src/lib/test-gate-runner/`). The walker asserts the config-complete (L0–L2) truth + that L3/L4 are
  honestly `deferred`.
- Legacy shell / `/prototype` Dzin panels (already covered by `dzin-panels.spec.ts`).
- Visual regression of the lab chrome.
