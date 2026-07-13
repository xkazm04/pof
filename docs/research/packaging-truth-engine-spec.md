# Packaging Truth Engine — spec (not built)

> From `/research` 2026-07-13 (3D AI Studio Flow demo — its export node flags results into a real
> zip + a manifest txt describing everything). Status: **spec/handoff** — rollout belongs to the
> `/gap-loop` "UE packaging" themed batch, not a single research run.

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
