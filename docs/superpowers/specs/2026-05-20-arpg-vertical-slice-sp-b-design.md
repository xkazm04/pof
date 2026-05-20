---
date: 2026-05-20
status: draft
sub_project: SP-B (gameplay chain live)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario — post-D9 roadmap (P0–P3)
predecessor_docs:
  - docs/features/arpg-vertical-slice/SCENARIO-REPORT.md
  - docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-a-design.md
inputs:
  - docs/features/arpg-vertical-slice/INDEX.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-d9.md
---

# Sub-project SP-B: Gameplay Chain Live

## Context

The ARPG vertical-slice initiative has, through D9 + SP-A, a reliable harness:
single-click module dispatch works, the dispatch race is fixed, idempotent
re-runs work, and the build-verify path is unblocked. The live harness has
driven steps 6–10 of the 24-step operator flow (input, animation, GAS).

SP-B is the **P1 "close the end-to-end claim"** sub-project: wire and live-run
operator-flow steps **11–16** — the ARPG gameplay chain — so PoF drives
autonomous Claude to build combat, a dummy enemy, loot-on-death, and a HUD on
top of the foundation laid by steps 6–10.

This is the substantive "actually build the game" sub-project. After SP-B the
slice has all gameplay systems generated; only packaging (SP-C) and PIE
verification (SP-E) remain.

## Goals

1. Wire operator-flow steps 11–16 into a new live e2e spec, dispatching real
   Claude sessions for: combat melee + damage, a dummy enemy, loot-on-death,
   and a GAS-bound HUD.
2. Extract the duplicated RoadmapChecklist dispatch pattern into a reusable
   helper (8 new call sites make this mandatory, not optional).
3. Stub-test the entire wiring deterministically before any live run.
4. Execute the chain in two gated live chunks, with an artifact-inspection
   checkpoint between them.
5. Capture findings per chunk.

## Non-goals

- **No packaging / cook** (that is SP-C).
- **No PIE / in-game verification** (that is SP-E).
- **No app source changes** — SP-B is harness + e2e only.
- **No fix-loop on quality findings** — the evaluator/feature-matrix are
  informational signals, not gates (see §4).
- **No retrofit of the D-era spec** (`arpg-vertical-slice-live-d2.spec.ts`) to
  use the new helper — it stays frozen as a historical artifact.
- **No new gameplay scope beyond steps 11–16** — combo systems, dodge,
  archetypes, BT/EQS, inventory screens etc. are explicitly out.

## Decision record (from brainstorming)

1. **Dummy enemy = `ae-2` only.** Dispatch just `ae-2` ("Create enemy character
   base" → `AARPGEnemyBase`) from arpg-enemy-ai; do NOT dispatch ae-1/ae-3..ae-8
   (AIController, BT, EQS, perception). Each checklist item dispatches
   independently, so dispatching one item avoids the module's over-scoping
   entirely. `AARPGEnemyBase` is the canonical enemy class the analysis docs
   name as the slice's need.
2. **Two gated live chunks.** Chunk 1 = combat + enemy foundation; Chunk 2 =
   loot + UI + verification. A checkpoint between them inspects Chunk 1's UE
   artifacts before loot/UI build on them. Each chunk ~20–35 min — under
   machine-sleep risk, vs. a single 45–90 min run.
3. **Steps 15–16 are informational.** Run feature-matrix scan + evaluator
   deep-eval, record their output, never fail a chunk on them. SP-B's hard
   pass/fail stays artifact-based.
4. **Stub-test the wiring before any live run** (the D9 lesson).

## Architecture

### New spec file: `e2e/arpg-vertical-slice-sp-b.spec.ts`

Two `test()` blocks — one per chunk — so each runs independently (via
`--grep` or by running the whole file). Reuses `setupHarnessMode`,
`completeSetupWizard`, `resetProgressForTestProject`, `waitForCliComplete`, and
the `runLiveStep`/`recordStepResult`/`writeFindings` machinery from
`e2e/helpers/harness-mode.ts`. Mirrors the D-spec's structure: `test.beforeEach`
resets PoF-side checklist progress; `runLiveStep` records per-step results;
`writeFindings` emits the chunk's findings doc.

### New helper: `dispatchRoadmapChecklistItem`

The D-spec's Steps 8 + 10 each inline ~25 lines of the RoadmapChecklist dispatch
pattern. SP-B adds 8 more dispatches of the same shape — extraction is mandatory
(8+ call sites; copy-paste would be ~200 duplicated lines).

New file `e2e/helpers/dispatch-helpers.ts`, exporting:

```ts
interface RoadmapDispatchTarget {
  categoryTestId: string;   // e.g. 'pof-sidebar-nav-item-core-engine'
  moduleTestId: string;     // e.g. 'pof-sidebar-l2-nav-item-arpg-combat'
  moduleId: string;         // e.g. 'arpg-combat' — for the checklist-item testId
  itemId: string;           // e.g. 'acb-1'
  sessionLabel: string;     // for waitForCliComplete
}

/**
 * Navigate to a module, open its Roadmap tab in Cards layout, hover the
 * checklist row, click its "Claude" button, and wait for the CLI to complete.
 * Encapsulates the RoadmapChecklist dispatch pattern proven by D-spec Steps 8/10.
 */
export async function dispatchRoadmapChecklistItem(
  page: Page,
  target: RoadmapDispatchTarget,
  timeoutMs: number,
): Promise<WaitResult>;
```

Internally: click `categoryTestId` → click `moduleTestId` → click the "Roadmap"
tab → click "Card view" → locate `pof-module-{moduleId}-checklist-item-{itemId}`
→ hover it → click its `getByRole('button', { name: /^Claude$/i })` →
`return waitForCliComplete(page, sessionLabel, timeoutMs)`. (Exact tab name and
testIds are verified during planning; the stub run catches any mismatch
deterministically.)

Steps 15 (feature-matrix) and 16 (evaluator) are distinct one-off UI patterns
used once each — they stay inline in the spec (YAGNI: only the
RoadmapChecklist pattern crosses the extraction threshold).

### The steps

**Chunk 1 — combat + enemy foundation** (`test('SP-B chunk 1: combat + enemy')`):

| Step | Item | Module | Label | Expected UE artifact (best-guess; see Risks) |
|------|------|--------|-------|----------------------------------------------|
| 11a | acb-1 | arpg-combat | Create melee attack ability | a `GA_MeleeAttack` GameplayAbility class (.h/.cpp) under `Source/PoF/` |
| 11b | acb-4 | arpg-combat | Apply damage via GAS | a `GE_Damage` GameplayEffect + damage-application code |
| 12  | ae-2  | arpg-enemy-ai | Create enemy character base | `AARPGEnemyBase` class (.h/.cpp) |

**Chunk 2 — loot + UI + verification** (`test('SP-B chunk 2: loot + ui + verify')`):

| Step | Item | Module | Label | Expected artifact / outcome |
|------|------|--------|-------|------------------------------|
| 13a | al-5 | arpg-loot | Loot drop on death | slice-mode: `AARPGWorldItem` spawned on death, 60 s `InitialLifeSpan` |
| 13b | al-6 | arpg-loot | Item pickup | slice-mode: overlap-destroy "+gold" effect, no inventory |
| 14a | au-1 | arpg-ui | Set up HUD framework | HUD widget class |
| 14b | au-2 | arpg-ui | Bind HUD to GAS attributes | HUD bound to ASC Health/MaxHealth |
| 14c | au-7 | arpg-ui | Floating damage numbers | floating damage-number widget |
| 15  | —    | feature-matrix | Scan gameplay modules | informational — record implemented/partial/missing |
| 16  | —    | evaluator | Deep-eval arpg-combat | informational — record findings count + severity |

au-3/au-4 (enemy health bars, cooldown UI) and au-5/au-6 (inventory, character
stats) are simply not dispatched — out of slice scope.

## Verification & gating

### Per dispatch step — hard pass/fail (artifact-based)

Each of the 8 dispatch steps: `success = waitForCliComplete.success && artifactsFound`.
`artifactsFound` is checked exactly as D7/D9 did — a per-step list of candidate
file paths (`stat`) plus, for code-modification steps, a `readFile` + symbol
grep. The candidate-path lists are best-guesses; see Risks.

### Steps 15–16 — informational only

Run them, read `feature-matrix` status cells / the evaluator
`pof-module-evaluator-result-findings-count` + `result-summary`, and record the
values in the chunk's findings doc. The step result is always recorded `pass`
(or an `info` note) regardless of the values — a chunk never fails on them.

### Stub-test before live (the D9 lesson)

SP-B is **wired and stub-tested before any live run**. In stub mode,
`setupHarnessMode`'s capture listener stops `pof-cli-prompt` propagation, so no
real Claude session runs and `waitForCliComplete` short-circuits to success.
A stub run therefore proves the **wiring** deterministically: every step's
navigation resolves, the Card-view/hover/"Claude"-button (or
feature-matrix/evaluator controls) are locatable and clickable, and a dispatch
is recorded. The stub run is the gate: only after both chunks pass in stub mode
does any live run happen.

### Gated live execution — two chunks

Each chunk's live run is gated behind: stub run green + `tsc` clean + a
keep-awake pre-flight (`powercfg standby/monitor-timeout-ac 0`, as in D9) + PoF
dev server up on port 3010. Run order:

1. **Chunk 1 live** (`HARNESS_MODE=live`, ~35 min cap). Produces
   `2026-05-20-live-sp-b-chunk1.md`.
2. **Artifact-inspection checkpoint** — inspect the combat + enemy UE artifacts
   on disk before proceeding. If acb-1/acb-4/ae-2 produced unexpected class
   names or paths, correct Chunk 2's candidate-path lists / dependent
   expectations first.
3. **Chunk 2 live** (~35 min cap). Produces `2026-05-20-live-sp-b-chunk2.md`.

D9's `waitForCliComplete` re-dispatch backstop and SP-A's app-level handshake
both remain in force — SP-B inherits a reliable dispatch path.

## In-scope deliverables

### Files created
- `e2e/arpg-vertical-slice-sp-b.spec.ts` — the two-chunk live spec.
- `e2e/helpers/dispatch-helpers.ts` — `dispatchRoadmapChecklistItem`.
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk1.md`
  and `-chunk2.md` — generated by the live runs.

### Files modified
- None. No app source, and no change to `e2e/helpers/harness-mode.ts` —
  `WaitResult` and the other needed types/functions are already exported there;
  `dispatch-helpers.ts` imports them.

Total: **2 files created + 2 generated findings docs, 0 modified, ~3–4 commits**
(helper+spec; stub-run fix-ups if any; chunk-1 findings; chunk-2 findings).

## Cross-cutting

- **Branch:** `master`.
- **Validation gate:** `npx tsc --noEmit` after the spec/helper; the stub run is
  the behavioral gate before live.
- **No worktree.**
- **UE5 project WILL be modified** by the live runs — Claude generates real C++
  and assets. The UE project is not a git repo; modifications are not
  rollback-able. Claude's verify-and-skip handles re-runs idempotently.
- **Port 3010**; keep-awake pre-flight before each live chunk.
- **Commit locally only** — the user pushes manually.

## Definition of done

1. `dispatchRoadmapChecklistItem` helper created; `arpg-vertical-slice-sp-b.spec.ts`
   created with two chunk `test()` blocks covering steps 11–16.
2. `npx tsc --noEmit` clean.
3. Both chunks pass in **stub mode** — every step locates its dispatch trigger
   and records a dispatch; the stub run is green.
4. Chunk 1 live run executed (keep-awake pre-flight); `2026-05-20-live-sp-b-chunk1.md`
   produced; combat + enemy artifacts inspected.
5. Chunk 2 live run executed; `2026-05-20-live-sp-b-chunk2.md` produced.
6. Findings docs record per-step pass/fail (artifact-verified) for the 8
   dispatch steps and the informational feature-matrix/evaluator output.
7. Commits on `master`; chat summary with SHAs and per-step results.

**Success criterion:** the 8 gameplay dispatch steps complete with their
expected UE artifacts verified on disk (allowing one path-correction follow-up
pass, per the D-series norm). Steps 15–16 produce recorded signals. After SP-B,
the slice's gameplay systems are all generated; only packaging (SP-C) and PIE
verification (SP-E) remain.

## Risks & mitigations

- **Artifact paths are best-guesses.** I do not know the exact files/paths
  acb-1/acb-4/ae-2/al-5/al-6/au-* will produce. D7.5 burned a cycle on
  `Character` vs `Characters`. Mitigation: per-step candidate-path lists (multiple
  plausible paths) + symbol grep, exactly as D9's Step 10; the stub run proves
  wiring independently of artifacts; a path-correction follow-up after the first
  live run is expected and budgeted (a commit, like D6.5/D7.5). The captured
  `waitForCliComplete` output excerpt reveals the actual paths.
- **The chain is dependency-ordered.** acb-4 builds on acb-1; al-5 builds on the
  enemy from ae-2; au-2 builds on the GAS attributes from step 10. A semantic
  mismatch mid-chain (e.g. acb-1 names the ability class differently than acb-4
  expects) cascades. Mitigation: the Chunk-1→Chunk-2 artifact-inspection
  checkpoint; Claude's prompts carry project context so it discovers existing
  class names; within a chunk, a failed step records `fail` and the run
  continues (D-spec behavior) so one failure does not abort the chunk.
- **Exact Roadmap-tab name / per-module testIds unverified.** arpg-gas (ag-1)
  used a `getByRole('tab', { name: 'Roadmap' })`; combat/enemy-ai/loot/ui are
  assumed to follow the same shared RoadmapChecklist pattern. Mitigation: the
  plan verifies each module's tab + testIds against source; the stub run fails
  loudly and deterministically on any mismatch — before a live run is spent.
- **Long live runs / machine sleep.** Mitigation: two chunks (not one 90-min
  run) + keep-awake pre-flight + ~35-min caps + idempotent re-runs.
- **Loot/UI slice-mode prompts.** al-5/al-6 carry slice-mode prompt text in the
  registry already (verified in exploration); au-5/au-6 are simply not
  dispatched. No prompt edits needed.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves the written spec.
3. `writing-plans` skill → implementation plan.
4. Execute (subagent-driven): helper + spec + stub run, then the two gated live
   chunks.
5. SP-B complete → refresh the scenario report → brainstorm SP-C (packaging).
