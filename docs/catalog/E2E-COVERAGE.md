# Catalog-Pipeline E2E Coverage

Every registered catalog pipeline is walked end-to-end through the real `/layout` lab UI by
Playwright, in stub mode (real Next.js dev server + real SQLite; no Claude CLI / UE
bridge — `CliProduce` writes artifacts synchronously). This is the e2e complement to the ~160
vitest unit tests, which don't see the UI → store → persistence seams.

## Hermetic by construction

The suite runs against a **throwaway database**, never `~/.pof/pof.db`:

- `playwright.config.ts` passes `POF_DB_PATH=e2e/.tmp/e2e.db` to its `webServer` and wipes that
  file (plus `-wal`/`-shm`) before launching it (`e2e/helpers/e2e-db.ts`; the reset is guarded to
  the runner process, since the config module is re-evaluated inside every worker).
- `reuseExistingServer` is **off by default** (opt in with `POF_E2E_REUSE_SERVER=1` for hand-driven
  iteration). An already-running dev server was started without `POF_DB_PATH`, so adopting one would
  silently put the real DB back under the suite.

This matters because acceptance is a function of persisted state: a `judge_verdicts` row, a drain
outcome or a leftover artifact from any earlier session used to feed straight into what the walker
asserted. The walker's verdict was therefore a property of the machine, not of the code — a fresh
clone and a long-lived dev box could not agree, and "the walker is red" carried no information.
Note this is **isolation, not erasure**: the developer's real DB is untouched; the suite just stops
reading and writing it.

## What runs

| File | Role |
|------|------|
| `e2e/catalog-pipeline-walker.spec.ts` | Data-driven walker. Enumerates `allCatalogPipelines()` and, per catalog, opens its first seeded entity and walks every step. |
| `e2e/catalog-items-reference.spec.ts` | Bespoke deep walk of the 13-step Items reference pipeline. |
| `e2e/helpers/lab-mode.ts` | Shared helpers: `gotoLab`, `openCatalog`, `selectStep`, `produceStep`, `acceptanceStatus`, `expectPersistedConfigComplete`, `expectPersistedDirection`. |
| `e2e/helpers/pipeline-coverage.ts` | `WALKER_SKIP` — the single, documented list of pipelines the generic walker skips (and why). |
| `e2e/helpers/e2e-db.ts` | The hermetic `POF_DB_PATH` seam + per-run reset (above). |
| `e2e/helpers/walk-status.ts` + `e2e/walk-status.json` | The **walk-success signal**: which pipelines the last FULL walker run took green. Committed; read by the guard. |
| `src/__tests__/catalog/pipeline-e2e-coverage.test.ts` | **Gap guard** (vitest, runs in `npm run validate`). |
| `src/__tests__/catalog/pipeline-spec-linter.test.ts` | **Fleet spec linter** (vitest, runs in `npm run validate`). Guards spec↔renderer contracts (below). |

## The assertions (per step)

- **View renders** for the selected step.
- **Produce dispatches** (type a unique direction into `cli-produce-direction`, click `cli-produce-run`; gallery steps also select the first candidate).
- **The typed direction reaches the artifact**: the persisted row carries `data.produceDirection.direction` VERBATIM (`expectPersistedDirection`) — the Direction text area is a real produce input, not a write-only box.
- **Acceptance derives a config-complete terminal status**: `status ∈ {pass, deferred}`, never
  `fail`/`pending`. `pass` for L0/L1/L2 (data/selection/static); `deferred` for L3/L4
  (runtime/visual, pending a live bridge) — and a `deferred` gate must show a reason (Rule 4). In the
  bespoke Items reference pipeline the Test Gate DERIVES its verdict from sibling-step acceptance, so
  a fully-walked item reads `Result={Success}` → `pass`; produced with nothing to derive from it is
  `deferred` at L3 with a reason (never `pending`), mirroring the registry `items.ts`
  `runtimeDeferred`.
- **Persist round-trip**: the produced artifact is `POST`ed to `/api/pipeline-artifacts` and the
  stored row is asserted config-complete **in its own right**; a second test wipes
  `localStorage['pof-lab-pipeline']`, reloads, and asserts every step hydrates back from the server.

### Two truths, asserted separately — never against each other

The walker used to assert `persisted status === on-screen status`. That is **structurally
unsatisfiable** whenever a judge verdict binds, because the two are different verdicts on purpose:

| Truth | Source | What it is |
|-------|--------|------------|
| On-screen banner | `resolveStepAcceptance` | checker → server drain overlay → **judge bridge** |
| Persisted row | `POST /api/pipeline-artifacts` | the **pure checker** verdict (`graded.raw`); judge state lives apart in `judge_verdicts` and is bridged only on read |

So a content-bound judge FAIL correctly turns the banner red while the row correctly still says
`pass` — and the old equality assertion called that a walker failure. Each truth is now checked
against the rule that governs it: both must be config-complete (`pass|deferred`), and neither is
compared to the other (`expectPersistedConfigComplete` carries the full rationale).

## The gap guard (enforced in `npm run validate`)

`pipeline-e2e-coverage.test.ts` fails fast if any registered pipeline can't be walked: no
`CATALOG_SECTIONS`/`NEW_CATALOGS` entry, no seeded entity, or an undocumented `WALKER_SKIP`. Because
the walker enumerates the registry, a new pipeline is auto-covered the moment it self-registers; the
guard turns "added a pipeline with no e2e path" into a red `validate` instead of a silent gap. See
**CLAUDE.md → Rule 5 — Every pipeline is e2e-walked**.

It also reads the **walk-success signal**. Registration hygiene only proves a pipeline *could* be
walked; it can't notice a walker that has rotted. So the walker writes `e2e/walk-status.json` after
a **full** green run (a `--grep`/`--shard` subset never rewrites it, so a partial run can't shrink
the record) and the guard fails when a registered, non-skipped pipeline has no green walk on record,
or when the recorded `WALKER_SKIP` set no longer matches the code. Adding or breaking a pipeline is
therefore a red `validate` until the walker is re-run.

## The fleet spec linter (enforced in `npm run validate`)

`pipeline-spec-linter.test.ts` is a pure vitest walker (no dev server) that asserts the
**spec↔renderer contracts** every registered step must honour — the fast complement to the e2e
walk. It exists because this project keeps discovering *capability-vs-adoption drift* by hand: the
shared `ChartPanel` shipped four variants but the fleet declared exactly one chart; the
keyed-manifest table silently soft-failed; the histogram variant was never used. Each such gap was a
dead capability nothing guarded — so the linter turns the next one into a red `validate`.

Per step of every `allCatalogPipelines()` pipeline it checks:

1. **Supported view kind** — `view.kind ∈ SUPPORTED_VIEW_KINDS` (the kinds `ViewPanel` actually
   renders), and a `chart` view's `variant ∈ SUPPORTED_CHART_VARIANTS` (the flavors `ChartPanel`
   renders). Both lists live in `src/lib/catalog/stepSpec.ts` as the single source of truth.
2. **Charts point at real data** — a chart step's `produce()` stub output is statically reachable
   (produce is a pure `(entity) => StepOutput`), so the linter runs it with a synthetic entity and
   asserts every declared `bars`/`histogram` key resolves to a **finite number** in `data[field]`
   (using the same coercion `ViewPanel` uses), and that a `highlightKey` is one of the declared
   keys. `scatter`/`waveform` fields must hold the array shape `ChartPanel` consumes. This is exactly
   the check that catches a column/row naming a field the produce never writes — a
   permanently-empty cell (the historical `spellbook` `burstDPS` bug class).
3. **Balance ⇒ chart** — every `archetype: 'balance'` step declares a `chart` view (a balance step
   must not regress to a number-grid table).
4. **Gallery generator contract** — a `genCandidates` (when present) has a `build` function and, when
   `needsAssets`, a valid `assetKind` (`'2d' | '3d'`, default `'2d'`), and is only set on a
   `gallery` step.

Every failure names catalog / step / field precisely. Fix surfaced violations by correcting the
descriptor (mechanical), or — only with a written reason — add an allowlist branch in the test file.

## Running

```bash
npm run test:e2e -- e2e/catalog-pipeline-walker.spec.ts e2e/catalog-items-reference.spec.ts
# or the whole e2e suite:
npm run test:e2e
```

Playwright starts its own dev server (on the throwaway DB). Set `PLAYWRIGHT_PORT` to a **free** port
— the run now refuses to adopt a foreign process, so a squatter is a loud failure, not a silently
non-hermetic run. `POF_E2E_REUSE_SERVER=1` opts back into reuse for iteration (and gives up
isolation — the reused server holds the real DB).

## Status (2026-07-29)

- **32 registered pipelines, 31 walked green** by the generic walker + Items via the reference spec
  (`62 passed / 2 skipped`, ~5 min, hermetic DB). Recorded in `e2e/walk-status.json`.
- `player-movement` is no longer a gap — it has a `NEW_CATALOGS` section + starter and walks like any
  other pipeline. `items` is the only `WALKER_SKIP` entry: the lab renders its bespoke 13-step UI,
  not the 11-label registry pipeline the generic walker would enumerate (see `ITEMS_SPEC_DUALITY`),
  so it is walked in depth by `catalog-items-reference.spec.ts` and its bespoke produce/accept pair
  is linted by `src/__tests__/catalog/items-spec-duality.test.ts`.
