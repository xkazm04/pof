# pof-mcp — Comprehensive Test & Coverage Plan

> **Status (Phase 0 + 1 + 3 Tier-1 landed):** 44 tools across 5 families (`src/tools/`).
> Layer 0 (schema/registry/`tools/list`/example-coverage guard) **8/8**, backend-free.
> Layers 1–2 (contract examples + quality: full-catalog recipe walk, submit derive/discriminate,
> combat+economy sim sanity, gdd/feature-matrix/project-health invariants) and Layer 3 Tier-1
> green at **31/32** (1 skip = Tier-2 editor drain, gated) against a live backend on a throwaway DB.
> `TOOLS-REFERENCE.md` generated from live responses.
> **Layer 3 (UE growth) — PROVEN LIVE.** Tier 1 (`growth.live.itest.ts`) scans the REAL
> connected UE project through the MCP and ratchets non-regression — measured **320 C++ classes,
> 95 assets**, logged to `GROWTH-LOG.md`. With the UE 5.7 editor launched + the PoF bridge plugin
> live (:30040), the **full MCP→app→bridge→editor path was exercised end-to-end**: `pof_ue_status`
> (connected), `pof_ue_manifest` (real 95-asset manifest + checksum), and `pof_ue_run_tests
> {GenFireball}` → `pof_ue_test_results` ran the real C++ gate **`FVSGenFireballEffectTest` → passed**.
> Tier 2 then activated (bridge `connected`, non-regression held, garden drained). With the editor
> live the whole suite is **40/40, 0 skips**. (Drain found 0 deferred gates in the throwaway DB —
> the Items "Test Gate" is an L0 data check, not a runtime drain; seeding a deferred gate to show
> `deferred→pass` is the only remaining nicety, and runs the same framework already proven above.)
> **Found+fixed a real bug:** the GDD synthesizer crashed on a fresh DB (`no such table:
> level_design_docs`) — now ensures the table. Deviations: coverage guards live in the MCP
> package's own `npm test` (not the app's vitest `validate`); `pof_ue_manifest` is live-only
> (throws offline, unlike `pof_ue_status`). Pending: Tier-2 editor drain + live-Claude opt-in
> (need the editor running), and P2/P3 write tools.

---


**Goal: one test corpus, three simultaneous outputs ("3-in-1").** Every MCP tool call the
suite makes is recorded so it serves all three purposes at once:

1. **Documentation** — the recorded request/response becomes an example in a generated
   `TOOLS-REFERENCE.md`, so the adapter is documented *by* its tests (always fresh).
2. **Core quality** — the same response is asserted against a quality rubric, exercising
   PoF's API-backed core logic that has never been truly tested end-to-end.
3. **UE growth** — when the UE bridge is live, the same call drives the connected example
   project forward and a before/after metric proves it grew.

This plan **expands the MCP tool surface** to reach ~35 more PoF APIs (decision: breadth
now), and runs the growth step in **both** modes — deterministic in CI, live-Claude opt-in
(decision: env-gated) — skipping with a documented reason when UE is offline.

---

## 1. Architecture: the layered MCP test model

```
                         ┌─ Layer 0  SCHEMA      (no backend)        → fast, in `validate`
 one MCP call per case → ├─ Layer 1  CONTRACT    (backend, stub UE)  → records examples  (Goal 1)
 (tool + args)          ├─ Layer 2  QUALITY     (backend, stub UE)  → asserts outcomes  (Goal 2)
                         └─ Layer 3  GROWTH      (backend + live UE) → grows the project (Goal 3)
```

A single parameterized driver issues each call through the **real MCP server** (SDK
`Client` over `StdioClientTransport`, spawning `dist/index.js`). The result fans out to a
recorder (docs), an asserter (quality), and — in Layer 3 — a UE growth probe. This is the
3-in-1: write the call once, harvest three artifacts.

**Run modes** (env-selected):
| Mode | Layers | Needs | Where |
|------|--------|-------|-------|
| `schema` | 0 | nothing | `tools/pof-mcp` `node --test`; mirrored guard in app `validate` |
| `integration` | 0–2 | PoF backend (temp DB) | `npm run test:mcp` (boots backend) |
| `live` | 0–3 | backend + UE editor + bridge, `POF_LIVE_UE=1` | manual / nightly |

---

## 2. Expanded MCP tool surface (target)

Existing v1 (12): `pof_list_catalogs`, `pof_list_entities`, `pof_get_pipeline`,
`pof_get_step`, `pof_submit_artifact`, `pof_get_acceptance`, `pof_drain_gates`,
`pof_harness_{start,status,plan,control,guide}`.

New tools, grouped by family. **Role:** R=read · C=compute/quality · U=UE-truth ·
G=growth · W=write. **P** = implementation priority.

### A. Simulation & balance — quality-rich core (Goal 2 gold)
| Tool | Route | Role | P |
|------|-------|------|---|
| `pof_combat_catalog` | `GET /api/combat-simulator` | R | 1 |
| `pof_combat_simulate` | `POST /api/combat-simulator {action:simulate, scenario, config{iterations,seed}}` | C | 1 |
| `pof_economy_catalog` | `GET /api/economy-simulator` | R | 1 |
| `pof_economy_simulate` | `POST /api/economy-simulator {action:simulate, config{seed}}` | C | 1 |
| `pof_economy_sweep` | `POST /api/economy-simulator/sweep` | C | 2 |
| `pof_balance_baseline` | `GET/POST /api/balance-baseline` | R/W | 2 |
| `pof_ability_spec` | `GET/POST /api/ability-spec` | R/W | 2 |

### B. UE truth & growth (Goal 3 gold; scans are offline, bridge ops need live UE)
| Tool | Route | Role | Live? | P |
|------|-------|------|-------|---|
| `pof_ue_status` | `GET /api/pof-bridge/status` | U | yes (degrades) | 1 |
| `pof_ue_manifest` | `GET /api/pof-bridge/manifest` | U | yes | 1 |
| `pof_ue_compile` | `POST /api/pof-bridge/compile` | U/G | yes | 1 |
| `pof_ue_run_tests` / `pof_ue_test_results` | `POST/GET /api/pof-bridge/test` | U/G | yes | 2 |
| `pof_ue_snapshot` | `POST/GET /api/pof-bridge/snapshot` | U | yes (PIE) | 3 |
| `pof_ue_hot_patch` | `POST /api/pof-bridge/compile/hot-patch` | G | yes | 3 |
| `pof_ue_scan_project` | `POST /api/filesystem/scan-project` | U | no | 1 |
| `pof_ue_scan_assets` | `POST /api/filesystem/scan-assets` | U | no | 1 |
| `pof_ue_verify_semantic` | `POST /api/filesystem/verify-semantic` | C/U | no | 2 |
| `pof_ue_source_parse` | `POST /api/ue5-source/parse` | U | no | 2 |
| `pof_ue_build` / `pof_ue_build_status` | `POST/GET /api/ue5-bridge/build` | G | no (local queue) | 2 |
| `pof_ue_build_health` | `GET /api/ue5-bridge/build-health` | C | no | 2 |
| `pof_asset_code_oracle` | `POST /api/asset-code-oracle` | C | no | 2 |
| `pof_package_preflight` | `POST /api/packaging/preflight` | U/G | no | 3 |
| `pof_package_history` | `GET /api/packaging/history` | U | no | 3 |
| `pof_inject_item` | `POST /api/ue5-inject-item` | G | yes (PIE) | 3 |

### C. Design truth & quality signals (Goals 1 + 2)
| Tool | Route | Role | P |
|------|-------|------|---|
| `pof_feature_matrix` | `GET /api/feature-matrix?moduleId` | R/C | 1 |
| `pof_feature_matrix_all` | `GET /api/feature-matrix/all-statuses` | R/C | 1 |
| `pof_feature_matrix_aggregate` | `GET /api/feature-matrix/aggregate` | C | 2 |
| `pof_gdd_compliance` | `POST /api/gdd-compliance {action:audit}` | C | 1 |
| `pof_gdd` | `GET /api/game-design-doc` | R | 2 |
| `pof_project_health` | `POST /api/project-health` | C | 1 |
| `pof_project_rules` | `GET /api/project-rules` | R (canon) | 1 |
| `pof_crash_analyze` | `GET/POST /api/crash-analyzer` | C | 2 |
| `pof_regression` | `GET /api/regression-tracker?action=stats` | C | 2 |
| `pof_quests_generate` | `POST /api/quest-generation` | C | 3 |
| `pof_ai_testing` / `pof_ai_testing_record` | `GET/POST /api/ai-testing` | R/C/W | 3 |

> Target ≈ **46 tools**. P1 (~18 tools) is the meaningful breadth for the first execution
> wave; P2/P3 follow. Each tool is one thin entry in `tools.ts` + one route-contract type;
> raw UE control stays in `mcp-unreal`.

---

## 3. Layer 0 — schema & registry (fast, no backend)

In `tools/pof-mcp/test/` (`node --test`) + a mirrored guard in the app's vitest `validate`:
- Every tool: `inputSchema` is valid JSON Schema; `name` unique + `pof_`-prefixed;
  non-empty `description`; `required` ⊆ `properties`.
- `tools/list` over stdio returns exactly the registry (count + names parity).
- `pofClient` envelope-unwrap / error-map unit tests (exist; extend for query building).
- **Tool-example guard**: every registered tool must have a recorded example (§5) or an
  entry in `MCP_EXAMPLE_SKIP` with a reason — fails `validate` otherwise (mirrors the
  existing `pipeline-e2e-coverage` guard + `WALKER_SKIP` pattern).

---

## 4. Layer 1 — contract examples = the documentation engine (Goal 1)

For every tool, a **golden example** test calls it through the MCP client against the
running backend with representative args and:
- asserts the response shape (key fields present, types sane),
- writes `test/examples/<tool>.json` = `{ tool, args, response, route }` (timestamps/ids
  redacted for stable diffs),
- a generator `scripts/gen-tools-reference.mjs` stitches `examples/*.json` + the `TOOLS`
  registry into **`TOOLS-REFERENCE.md`** — one section per tool: purpose, input schema, the
  mapped route, a real request+response, error modes, and (quality tools) the rubric.

Result: the adapter is **documented by its own passing tests**, and the same run proves
every route works end-to-end through the adapter. `TOOLS-REFERENCE.md` is generated (like
`registry.generated.ts`); a guard fails if it's stale vs the examples.

---

## 5. Layer 2 — core quality ("never truly tested") (Goal 2)

### 5a. Pipeline quality walker (MCP analog of the UI walker)
Data-driven over `allCatalogPipelines()`. For each catalog × step:
- `pof_get_step` → **recipe quality**: `prompt` non-empty; canon-prefixed iff
  `canonCategories` non-empty; `acceptance` contract present with a valid tier; `archetype`
  valid; asset-bearing archetypes expose `ueAssetTargets`.
- `pof_submit_artifact` with the recipe's example data → **config-complete verdict**:
  `pass` for L0–L2, `deferred` for L3–L4, **never `fail`/`pending`** after clean data;
  every `deferred` carries a reason (Rule 4).
- `pof_get_acceptance` rollup reflects the submitted step.
- **Negative**: submit deliberately-bad data → checker returns `fail`/`pending` (proves the
  gate discriminates, not trivially passes).
- **Coverage guard** `MCP_WALKER_SKIP`: every registered pipeline is walked or skipped with
  a documented reason; a `validate`-time vitest guard reads the same map.

### 5b. Simulation quality (the computation cores)
- **Combat** (`pof_combat_simulate`, fixed seed, small iterations): `survivalRate` finite ∈
  [0,1]; `fights.length ≥ 1`; alerts well-formed (no NaN); threat `damageShare` sums ≈ 1;
  ability-heatmap keys = scenario abilities. Design-band soft-asserts (survival 40–80%, no
  100% one-shot deaths) reported, not gated.
- **Economy** (`pof_economy_simulate`, fixed seed): all metrics finite; `gini ∈ [0,1]`;
  final snapshot count = `agentCount`; no negative gold; gini stable (not oscillating).
- **Sweep** (`pof_economy_sweep`): entries sorted by |delta| desc; `baseline` finite; per
  entry `low < base < high`.

### 5c. Design-truth invariants
- `pof_gdd_compliance`: `overallScore ∈ [0,100]`; gaps have valid severity + direction.
- `pof_feature_matrix(_all)`: `implemented+missing+unknown = total` per module.
- `pof_project_health`: scores finite ∈ [0,100]; `qualityTrend ∈ {improving,stable,declining}`.
- `pof_regression` / `pof_crash_analyze`: rates ∈ [0,1]; counts non-negative & internally
  consistent.

These assert **invariants + internal consistency** (not magic numbers), so they're stable
yet catch real regressions in PoF's core math.

---

## 6. Layer 3 — UE growth: the connected project grows (Goal 3)

Gated on `POF_LIVE_UE=1` **and** `pof_ue_status` reachable; otherwise **skip with reason**
(never mask a failure — Rule 4 / `WALKER_SKIP` precedent).

### Growth metric (before/after probe)
Snapshot UE truth before a run and after:
- `pof_ue_manifest` → asset count + checksum,
- `pof_ue_scan_project` → C++ class count,
- `pof_ue_build_health` / `pof_package_history` → build success + size,
- per-entity `pof_get_acceptance` → config-complete + L3/L4 verdicts, lifecycle state.

Assert **non-regression and growth**: assets ≥ before, classes ≥ before, targeted deferred
gates upgraded `deferred → pass`, lifecycle advanced (`…→verified`). Append a row to
`GROWTH-LOG.md` (and optionally a `packaging/history` record) so cumulative growth is
visible over time.

### Two growth engines (decision: both, env-gated)
- **Deterministic (CI-capable when a headless editor is available):** scripted
  `pof_submit_artifact` with example data + `pof_drain_gates` → live editor runs the L3
  automation, verdict upgrades; assert manifest/scan reflect the new/verified asset.
- **Live-Claude (opt-in, `POF_LIVE_UE=1` + budget):** one bounded scenario where Claude
  authors a single entity end-to-end through the MCP (recipe → real generation + UE edits
  via `mcp-unreal` → submit → drain), then the growth probe proves the asset exists + gate
  passes. Uses `pof_harness_start {budgetUsd}` bounded, or a single-entity script.

### The "growth garden"
A curated target set (one entity per family — e.g. Iron Longsword (items), an ability, a
bestiary archetype, a currency) that the live suite advances each run, so the connected UE
project measurably grows. Tracked in `test/growth-garden.ts` + `GROWTH-LOG.md`.

---

## 7. Test isolation & determinism

- **Temp DB**: add a `POF_DB_PATH` env override to `src/lib/db.ts` (currently hardcoded to
  `~/.pof/pof.db`) so integration runs use a throwaway DB seeded fresh — no pollution of the
  user's real project. (Phase 0; small, benefits all integration testing.)
- **Seeds**: every simulator call passes a fixed `seed`; recorded examples redact
  timestamps/ids so diffs are stable.
- **Throwaway entities**: write tests use a `test-mcp-*` entity namespace; the growth garden
  uses real seeded entities only in `live` mode.
- **Backend lifecycle**: `integration` mode starts `next dev -p <PLAYWRIGHT_PORT>` if not
  already up (reuse the Playwright `webServer` pattern) and points `POF_APP_ORIGIN` at it.

---

## 8. Coverage guards (kept honest in `validate`)

1. **Tool-example coverage** — every tool has an example or a reasoned `MCP_EXAMPLE_SKIP`.
2. **`MCP_WALKER_SKIP`** — every registered pipeline is MCP-walked or skipped with a reason.
3. **Route-reachability matrix** — `test/coverage-matrix.ts` lists every PoF route group and
   marks `{reachable-via-tool, tested-layer, growth-contributing}`; a guard asserts the
   reachable+tested count never regresses (this is the literal "maximum APIs" ratchet).
4. **Docs freshness** — `TOOLS-REFERENCE.md` matches `examples/*.json`.

---

## 9. Work breakdown (phases)

**Phase 0 — Foundation.** MCP SDK `Client` test harness (spawn server + connect);
`POF_DB_PATH` override + temp-DB bootstrap; backend start/health helper; `npm run test:mcp`
script; doc-generator + coverage-matrix skeletons; the four guards (red until filled).

**Phase 1 — P1 tools + contract layer (Goals 1 + 2 start).** Implement the ~18 P1 tools
(sims, UE scans/status/compile, feature-matrix, gdd-compliance, project-health, canon).
Schema tests + a recorded example each → first `TOOLS-REFERENCE.md`. Pipeline quality
walker (5a) over all catalogs.

**Phase 2 — Quality depth (Goal 2).** Simulation rubrics (5b), design-truth invariants
(5c), P2 tools (build queue/health, semantic verify, source parse, oracle, regression,
crash, sweep, ability/balance specs). Negative-path tests. Coverage-matrix ratchet on.

**Phase 3 — UE growth (Goal 3).** Growth probe + metric; deterministic growth via
drain/scripted; the growth garden + `GROWTH-LOG.md`; P3 tools (snapshot, hot-patch,
preflight, package history, inject-item, quests, ai-testing). Live-Claude opt-in scenario.

**Phase 4 — Docs & CI wiring.** Finalize generated `TOOLS-REFERENCE.md` + coverage matrix;
wire `schema`-layer guards into `npm run validate`; document the `integration`/`live` modes
+ nightly job; update `docs/` if a doc map entry is warranted.

---

## 10. Deliverables / file map

```
tools/pof-mcp/
  src/tools/                     # tool families split by domain (sims/, ue/, design/)
  test/
    harness.ts                   # spawn server + SDK Client + backend health
    schema.test.ts               # Layer 0
    contract.test.ts             # Layer 1 (records examples)
    quality.pipeline.test.ts     # Layer 2a (MCP pipeline walker)
    quality.sims.test.ts         # Layer 2b
    quality.truth.test.ts        # Layer 2c
    growth.live.test.ts          # Layer 3 (gated)
    coverage-matrix.ts           # route reachability table
    growth-garden.ts             # target entities
    examples/<tool>.json         # recorded, redacted
  scripts/gen-tools-reference.mjs
  TOOLS-REFERENCE.md             # generated
  GROWTH-LOG.md                  # appended by live runs
src/lib/db.ts                    # + POF_DB_PATH override
src/__tests__/mcp/coverage-guard.test.ts   # validate-time guards (mirror skips)
```

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Backend required for L1–3 | harness starts/uses dev server; clear skip if unreachable |
| Live-UE flakiness | env-gated; skip-with-reason; reuse drain's non-reentrant lock |
| Live-Claude cost/slowness | opt-in only; bounded scenario; `budgetUsd` cap; never CI-gated |
| Real-DB pollution | `POF_DB_PATH` temp DB + `test-mcp-*` entity namespace |
| Sim heaviness | small iteration counts + fixed seed |
| Flaky example diffs | redact timestamps/ids; deterministic seeds |
| New tool drift | thin tools + schema/example/coverage guards in `validate` |

---

## 12. Definition of done

- ≥ P1 tool surface implemented; every tool schema-tested + example-recorded.
- `TOOLS-REFERENCE.md` generated from passing examples; docs-freshness guard green.
- Pipeline quality walker green across all non-skipped catalogs; sim + design-truth rubrics
  green; negative paths discriminate.
- Coverage matrix shows the reachable+tested API count, ratchet guard in `validate`.
- `live` mode demonstrably grows the connected UE project (a `GROWTH-LOG.md` entry: assets↑
  / classes↑ / a `deferred→pass` gate) — deterministically, with the live-Claude path proven
  at least once.
- `npm run validate` stays green (schema-layer guards only; integration/live are separate).
```
