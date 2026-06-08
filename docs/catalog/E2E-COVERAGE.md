# Catalog-Pipeline E2E Coverage

Every registered catalog pipeline is walked end-to-end through the real `/layout` lab UI by
Playwright, in stub mode (real Next.js dev server + real SQLite `~/.pof/pof.db`; no Claude CLI / UE
bridge — `CliProduce` writes artifacts synchronously). This is the e2e complement to the ~160
vitest unit tests, which don't see the UI → store → persistence seams.

## What runs

| File | Role |
|------|------|
| `e2e/catalog-pipeline-walker.spec.ts` | Data-driven walker. Enumerates `allCatalogPipelines()` and, per catalog, opens its first seeded entity and walks every step. |
| `e2e/catalog-items-reference.spec.ts` | Bespoke deep walk of the 13-step Items reference pipeline. |
| `e2e/helpers/lab-mode.ts` | Shared helpers: `gotoLab`, `openCatalog`, `selectStep`, `produceStep`, `acceptanceStatus`, `expectPersisted`. |
| `e2e/helpers/pipeline-coverage.ts` | `WALKER_SKIP` — the single, documented list of pipelines the generic walker skips (and why). |
| `src/__tests__/catalog/pipeline-e2e-coverage.test.ts` | **Gap guard** (vitest, runs in `npm run validate`). |

## The assertions (per step)

- **View renders** for the selected step.
- **Produce dispatches** (click `cli-produce-run`; gallery steps also select the first candidate).
- **Acceptance derives a config-complete terminal status**: `status ∈ {pass, deferred}`, never
  `fail`/`pending`. `pass` for L0/L1/L2 (data/selection/static); `deferred` for L3/L4
  (runtime/visual, pending a live bridge) — and a `deferred` gate must show a reason (Rule 4). The
  bespoke Items reference pipeline is a green demo (its Test Gate simulates `Result={Success}` →
  `pass`), unlike the generic registry `items.ts` which uses `runtimeDeferred`.
- **Persist round-trip**: the produced artifact is `POST`ed to `/api/pipeline-artifacts` and the
  stored status equals the in-UI status; a second test wipes `localStorage['pof-lab-pipeline']`,
  reloads, and asserts every step hydrates back from the server.

## The gap guard (enforced in `npm run validate`)

`pipeline-e2e-coverage.test.ts` fails fast if any registered pipeline can't be walked: no
`CATALOG_SECTIONS`/`NEW_CATALOGS` entry, no seeded entity, or an undocumented `WALKER_SKIP`. Because
the walker enumerates the registry, a new pipeline is auto-covered the moment it self-registers; the
guard turns "added a pipeline with no e2e path" into a red `validate` instead of a silent gap. See
**CLAUDE.md → Rule 5 — Every pipeline is e2e-walked**.

## Running

```bash
npm run test:e2e -- e2e/catalog-pipeline-walker.spec.ts e2e/catalog-items-reference.spec.ts
# or the whole e2e suite:
npm run test:e2e
```

The dev server is auto-started by Playwright's `webServer` (or reused if one is already on the
target port — set `PLAYWRIGHT_PORT` if PoF isn't on the default 3000).

## Status (2026-06-08)

- **30 of 31 pipelines covered**: 29 generic catalogs via the walker + Items via the reference spec.
- **Known gap**: `player-movement` registers a `CatalogPipeline` but has no `CATALOG_SECTIONS` /
  `NEW_CATALOGS` entry, so the lab surfaces no entity to walk. It is documented in `WALKER_SKIP`;
  closing it means adding a section + starter entity whose seed satisfies the pipeline's checkers.
