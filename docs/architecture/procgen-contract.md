# The procgen contract: what a spec promises, and to which engine

The procedural-level surfaces in PoF (the wizard in `src/components/modules/content/level-design/ProceduralLevelWizard/` and the UE dungeon tab beside it) speak one request model, `ProcgenSpec` in `src/lib/level-design/procgen-spec.ts`. This doc is the **contract** that model states — deliberately narrow, because most of the value here is in what it refuses to claim.

Governing standard: ai-registry `game-production/procedural-level-planning` (techniques `algorithm-parameter-support-matrix`, `declare-what-each-engine-ignores`, `seed-determinism-contract`, `pacing-linter-rules`).

## 1. One control surface, several backends, one honest matrix

`PROCGEN_ENGINES` names every engine that can be handed a spec, what actually implements it, and **which spec fields it reads**. Everything it does not read is dropped, and `specFieldsIgnoredBy()` / `describeIgnoredFields()` return that dropped set by name and value so a surface can print it. `ProcgenSpecHandoff` does exactly that.

| Engine | Implementation | Determinism |
|---|---|---|
| `browser-preview` | `generatePreview()` — BSP / WFC / cellular / Perlin over a `CellType` grid, `FRandomStream`-seeded | deterministic |
| `ue-arpg-generator` | `build_procgen_dungeon.py` → `AARPGLevelGenerator`, room-template actors in world space | deterministic |
| `llm-codegen` | `buildProceduralLevelPrompt()` — the CLI authors a generator freehand | **unenforced** |

The browser preview narrows further **per algorithm** through `algo-params.ts`: a control that does nothing for the selected algorithm is disabled with the reason on screen, never rendered live and inert.

## 2. Connectivity is a linted property, and the lint reports what it changed

`PreviewStats.connectivity` is *largest passable region / all passable cells*. Reporting it was never the hard part; the gap was that a fragmented cave was flagged with no way to fix it.

`src/lib/level-design/procgen-connect.ts` is the fix: a **region-cull + tunnel-carve** pass.

- **Opt-in.** It runs only when the spec's `constraints.ensureConnected` is on. A spec without it produces the byte-identical grid the generators produced before the pass existed — pinned by `procgen-connect.test.ts`.
- **Cellular only, phase 1.** `ensureConnectedSupport()` in `algo-params.ts` is the single source; `bsp` / `wfc` / `perlin` carry a reason string, and `specFieldsIgnoredBy('browser-preview', …)` drops the field for them. `ue-arpg-generator` and `llm-codegen` do not implement it at all, so they list it as dropped for every algorithm — the wizard therefore never sends it into the C++ prompt.
- **It reports itself.** `PreviewStats.connectPass` carries `regionsBefore / regionsAfter / regionsCulled / cellsCulled / tunnelsCarved / cellsCarved / cellsChanged / rngDraws`, and `ProcgenPreviewCanvas` prints `describeConnectPass()` beside the verdict. **A connectivity of 100% produced by the pass can never be displayed without the sentence saying how it got there.**

### The RNG draw order is part of the seed contract

The pass draws from the **same** `FRandomStream` the generator used, continuing after the generator's own draws — never restarting a stream and never interleaving one. Its consumption is fixed and documented:

- culling a sub-threshold pocket (`MIN_REGION_CELLS = 4`): **0 draws**;
- each tunnel carved: **exactly one `randHelper` draw**, breaking the tie between equidistant merge targets;
- an already-connected grid: **0 draws**.

Consequences, all tested: same seed + same spec ⇒ the same repaired grid on every run; and turning the pass on can only change the grid *through the pass*, never by shifting a draw the generator already made.

## 3. What a seed reproduces, and where

A seed is a contract, and this one states its limits (`seed-determinism-contract`).

- Within `browser-preview`, a seed reproduces the grid **exactly**, including the repair pass.
- Across engines it reproduces **nothing but itself**. `layoutAgreement(a, b)` is the machine-readable statement: every cross-engine pair returns `agree: false` with the structural reason, because `ARPGLevelGenerator` places room-template actors from a pool and takes no algorithm parameter, and the codegen path is authored freehand by an LLM.

## Where to look

| Concern | File |
|---|---|
| The spec, engines, ignored-field matrix, `layoutAgreement` | `src/lib/level-design/procgen-spec.ts` |
| Per-algorithm parameter support + `ensureConnectedSupport` | `src/lib/level-design/algo-params.ts` |
| The generators | `src/lib/level-design/procgen-algorithms.ts` |
| Preview + stats | `src/lib/level-design/procgen-preview.ts` |
| Connectivity repair pass | `src/lib/level-design/procgen-connect.ts` |
| The UE `FRandomStream` port | `src/lib/level-design/frandom-stream.ts` |
