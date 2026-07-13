# Packaging Truth Engine — Tier 1 BUILT (2026-07-13)

> From `/research` 2026-07-13 (3D AI Studio Flow demo — its export node flags results into a real
> zip + a manifest txt describing everything). Status: **Tier 1 SHIPPED** same day — see
> "Built" below; Tier 2 (bridge/editor) remains the L3 gates' job as designed.

## Built (Tier 1) — how to run it

- **Engine:** `src/lib/catalog/packaging/collect.ts` (pure sibling-artifact collector: file
  refs incl. `/api/visual-gen/asset/…`→`generated/triposr/` mapping, embedded data-URL art,
  `ueAssets` declarations) + `packageArtifacts.ts` (`buildPackage` — hash referenced files in
  place, materialize data-URLs, write `generated/packages/<cat>/<ent>/manifest.json`).
- **Drain:** `src/lib/catalog/acceptance/packagingVerify.ts` (`aggregatePackaging` +
  `verifyPackagingAll`, mirror of `staticVerify`) behind
  **`GET/POST /api/pipeline-artifacts/verify-packaging`** (GET = dry-run, POST = apply).
- **Selection needed ZERO pipeline edits:** `isPackagingStep` matches the canonical
  `"UE Packaging"` label (all 30 pipelines) or an explicit `packaging: true` StepSpec flag
  (items carries it as the reference).
- **Live dry-run vs the real DB (2026-07-13):** 32 packaging artifacts graded — **30 pass with
  real staged+hashed files** (the gap-loop's injected Leonardo/Tripo art materialized:
  e.g. char-captain-vael = 9 files incl. a 3.3 MB rigged glb), **2 honestly deferred**
  (items/item-lightsaber, spellbook/off-fire-01 — siblings produced no files). Optimistic
  passes with dead references (bestiary/props) were caught, then resolved via the serve-route
  mapping. Re-run anytime: env-gated
  `POF_PACKAGING_DRYRUN=1 npx vitest run src/__tests__/catalog/packaging-verify.dryrun.integration.test.ts`.
- **Tests:** 13 unit (collect/engine/drain) + the env-gated live dry-run; guards
  (`pipeline-produce-accept`, `pipeline-e2e-coverage`) green.

**Applied same day:** verdicts written to the real DB (30 pass / 2 deferred, re-drain
idempotent) via the integration runner's `POF_PACKAGING_APPLY=1` mode, and all 30
step-facts packaging entries flipped (`trueEngine: 'Packaging engine'`,
`generatorWired: true`, `checkerMeaningful: true`) — the UNPOWERED packaging block on
/status is retired. Remaining: Tier 2 below (L3 gates verify the ueDeclarations).

## Problem (from the /status fleet gap audit + judge fleet)

Every catalog pipeline ends in a **"UE Packaging"** step — 30 of them across
`src/lib/catalog/pipelines/*.ts`. `src/lib/status/step-facts.json` classifies essentially all of
them the same way:

```json
{ "step": "UE Packaging", "trueEngine": "Claude", "deliverable": "ue-runtime",
  "generatorWired": false, "judge": "none", "checkerMeaningful": false,
  "note": "minCount(assets,2) just counts a hand-written list of expected asset names;
           produce() never invokes the UE Python bridge to actually create them." }
```

The judge fleet found the concrete consequence: **input-schemes packaging ships a PHANTOM glyph
atlas** (`glyphSet: 0`) behind a passing checker. The checker counts names in a hand-written list;
nothing ever touches disk or UE. These steps are the largest single block of the /status map's
**UNPOWERED** grade.

## Design — filesystem truth first, UE truth second

The insight worth stealing from the Flow export node: the packaging step should **produce a real
artifact bundle + a manifest that describes what is actually inside it**, and acceptance should be
derived by **reading that bundle back from disk** — never from the produce payload.

### Tier 1 (headless, no editor — buildable now)

1. **Shared engine** `src/lib/catalog/packaging/packageArtifacts.ts`:
   - Input: catalogId + entityId. Reads the row's **sibling artifacts** from
     `pipeline_artifacts` (the fix-campaign lesson: packaging must reflect sibling truth, not
     invent content).
   - Collects the *real files* those artifacts reference (generated meshes/audio/icons under
     `generated/`, seed scripts under the UE project's `Content/Python/`, DataTable CSVs…).
   - Writes `generated/packages/<catalogId>/<entityId>/manifest.json` + the staged files (zip
     optional; the directory + manifest IS the truth). Manifest entries: path, bytes, sha1,
     source-artifact id. **Files that don't exist are listed under `missing[]` — never silently
     dropped.**
2. **Shared checker** `src/lib/catalog/acceptance/packagingVerify.ts` (mirror of
   `staticVerify.ts`, the proven L2 drain pattern): re-reads the manifest, stats every file,
   recomputes hashes → `pass` only if all present and non-empty, `deferred` with reasons when
   `missing[]` is non-empty (e.g. "glyph atlas not generated yet" — honest, judge-proof).
3. **Wire ONE reference pipeline first** (items — the reference implementation per CLAUDE.md),
   flip its packaging step's produce/accept to the shared engine, keep the walker green
   (config-complete terminal status: `pass` or reasoned `deferred`, never `fail` after clean
   Produce). Then the batch rollout is mechanical.

### Tier 2 (bridge/editor — the existing L3 ladder)

Once Tier 1 is truthful, "packaged into UE" = the existing spawn/bridge executors verifying the
staged files landed as assets (`pof_ue_scan_assets` / seed scripts). That is the current L3 drain
flow — no new machinery, just pointing it at the manifest.

## Why not built in the research run

- Touches 30 parallel-session-owned pipeline files (shared-tree hazard) + the walker + the
  step-facts classifier — an L/XL rollout.
- The `/gap-loop` skill already owns "UE packaging" as a themed batch; this spec is its
  execution recipe. A lone shared engine with zero consumers would repeat the L2
  "declared-but-unconsumed" mistake.

## Status impact when executed

- Flips the ~30 "UE Packaging" cells from **UNPOWERED/shape-only** to a real engine
  (`powers-engine`) + meaningful checker (`hardens-checker`).
- Kills the phantom-deliverable class the judges flagged (input-schemes glyph atlas, icon-sets
  mip arithmetic, music size reconciliation → manifest hashes/bytes make these checkable).
