# Bug+UI Scan Fix Wave 4 — UE5 codegen correctness

> 4 commits, 4 High findings closed (+12 new tests).
> Baseline preserved: tsc 0 src errors → 0; eslint (changed files) 0; tests (see Verification).

One mental model: **generated code is a compiler-facing artifact — every authored value crossing into C++ needs syntax formatting (literals, identifiers) and semantic mapping (what UE field does this number actually mean?), validated before export, not discovered in the engine build.**

## Commits

| # | Commit | Finding closed | What the generated C++ did wrong |
|---|---|---|---|
| 1 | `159ed51` | abilities #1 — Cooldown emitted as GE Period | an 8s cooldown turned a one-shot strike into damage re-applying every 8s; the real cooldown was dropped |
| 2 | `3a5eca3` | genome #1 — invalid float literals | `GravityScale = 1f;` / `25.5.f` — every preset's .cpp failed to compile |
| 3 | `8bdcfd2` | animation #1 — non-identifier state names pass the linter | `EARPGAnimState::Hit React` — export reports success, UE build fails |
| 4 | `865f245` | transpiler #1 — Confirm write targets undiffed paths | silent overwrite of hand-written C++ in a module the user never reviewed |

## What was fixed

1. **`cooldownSec` means ability cooldown, full stop.** Both code generators emit a Cooldown-GE guidance comment instead of `Period = FScalableFloat(...)`; `describeEffect` says "ability cooldown, NOT a GE Period"; and the bundle contract's rule 7 now consumes `scalars.cooldown` (falling back to the largest authored effect cooldown) to demand `UGE_Gen_<Name>_Cooldown` wired to `CooldownGameplayEffectClass` — replacing the `// TODO: cooldown GE` that silently dropped it.
2. **`cppFloat(v)`** (whole → `N.f`, fractional → `Nf`, non-finite → `0.f`) replaces all 22 raw literal interpolations in the genome generator. Tests regex-scan every preset's output for both invalid shapes.
3. **`invalid-state-name` / `invalid-state-flag` error rules** (`/^[A-Za-z_]\w*$/`, `(default)` sentinel exempt) sit next to the duplicate-name rule — "Hit React", "2HandAttack", empty names, and free-text flags are now caught at lint time instead of `error: expected identifier` deep in the UE build.
4. **The dry-run diff is now a contract.** Client: the open plan remembers its module; editing the Module input flips the modal to "Re-run dry run" and blocks Confirm. Server: confirm carries the approved plan (relPath + before-content) and `applyWrite` rejects when resolved paths or on-disk content drifted since review.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors in `src/` (per-fix and at wave end) |
| `eslint` (all changed files) | 0 problems |
| `vitest run` (full suite) | **3940 pass / 15 fail / 1 skip** — failure set identical to waves 1–3 (all pre-existing); +12 new tests passing (cppFloat/presets ×5, identifier lint ×4, dry-run contract ×3) |

## Cumulative status (this scan)

| Wave | Theme | Closed | Crit |
|---|---|---:|---:|
| 1 | CLI process lifecycle & abort theater | 6 | 1 |
| 2 | Fix-the-fixes (06-09 regression tail) | 7 | 0 |
| 3 | Destructive writes & data loss | 6 | 0 |
| 4 | UE5 codegen correctness | 4 | 0 |
| **Total** | | **23 / 323** | **1 / 1 (100%)** |

## Patterns established (catalogue items 39–42)

39. **One field, one meaning.** A scalar that one module authors as X and another consumes as Y (`cooldownSec` → GE Period) is a semantic injection no type system catches. When a label, a seed, and a consumer disagree, pick the user-facing meaning and make every consumer say so explicitly.
40. **JS numbers don't stringify as C++ literals.** `String(1.0) === "1"`, so `${v}f` templates emit invalid integer-suffix literals. Route every numeric interpolation in codegen through one formatter (`cppFloat`).
41. **Identifier-emitting fields need identifier linting.** Any free-text input that lands in generated code as an enumerator/variable/flag needs a `/^[A-Za-z_]\w*$/` gate at validation time — duplicate checks alone catch collisions, not syntax.
42. **A reviewed diff must pin what the write does.** When the confirm request re-reads live state, anything edited between review and confirm silently changes the write target. Carry the approved plan with the confirm and reject on drift (paths AND content).

## What remains

323 → 300 open findings. Next suggested waves: **E — queues & races** (Blender flush/drain, forge poll, inventory re-key, harness pool pause) or **F+G — trust boundaries + stale state**, then the shell/silent-failure and a11y programs.
