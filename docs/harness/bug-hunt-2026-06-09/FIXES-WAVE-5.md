# Bug Hunter Fix Wave 5 — UE5 codegen correctness & generated-artifact integrity

> 3 commits, 3 findings closed (1 critical, 2 high). Remaining codegen findings (cpp-parser nested-paren regex, bestiary clamp, GAS tag sanitize, symmetric semantic diff) deferred — see "Deferred".
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. Related quest + state-machine test files 21/21 pass.

## Theme

The module produces artifacts a user takes elsewhere (UE5 C++/CSV DataTables, dialogue trees). Each finding is an artifact that is silently wrong: a dialogue pointer to a node that doesn't exist, an unescaped name that breaks the CSV/C++, or duplicate enum names that won't compile — all presented as authoritative output. Fixes make the artifact correct by construction or surface the defect loudly.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|--------|----------------|----------|-------|
| 1 | `596d964` | world-quests-procgen #1 | critical | `lib/quest-generator.ts` |
| 2 | `19206ae` | character-genome-designer #1 | high | `…/genome/CharacterGenomeEditor.tsx` (+ deleted `…/genome/codegen.ts`) |
| 3 | `a47ba57` | animation-rigging #1 | high | `lib/state-machine-validator.ts` |

## What was fixed

1. **Quest dialogue dangling pointer** (`596d964`). `generateQuestDialogue` wired the "Tell me more" choice's `nextNodeId` to a fresh `did()` that was never pushed into `nodes` — a dangling reference in **100% of generated quests** that dead-ends or null-derefs any dialogue walker. The choice now points at a real `infoNode` that is pushed (per-quest-type detail text + its own accept/decline branches), so every `nextNodeId` in the tree resolves.
2. **Genome codegen wired to the unsafe module** (`19206ae`). `CharacterGenomeEditor` imported the sibling `./codegen`, which interpolated the free-text genome name into CSV rows and the C++ class name with no escaping (only `replace(/\s+/g,'')`), so a name with a comma/quote/brace/newline corrupted the generated DataTable / C++. The project already had a hardened `@/lib/genome/codegen.ts` (`sanitizeCppIdentifier` + `csvEscape`) with identical exports; the editor now imports it and the unsafe sibling file is **deleted** so the unsafe path can't be re-wired.
3. **Duplicate state names → uncompilable enums** (`a47ba57`). Each animation state name becomes a UE5 `EARPGAnimState::<name>` enum member, but `validateStateMachine` never checked for duplicate names — so two states sharing a name (the hard-coded `'NewState'` default, or a rename collision) emitted duplicate enumerators that the export presented as authoritative with no warning. Added rule 6: a `duplicate-state-name` error listing the colliding states.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors (incl. the new `WarningKind` member — no exhaustive map broke) |
| `eslint` (changed files) | 0 errors (4 pre-existing unused-import warnings in quest-generator, unrelated) |
| Related tests (quest-generation-route, state-machine-validator) | 21/21 pass |

## Deferred (not done this wave)

- **blueprint-transpiler-c-codegen #1 — cpp-parser `\([^)]*\)` drops `Meta=(...)` (high).** Needs a balanced-paren scanner to replace the brittle regex — a parser change worth its own careful pass with added tests; deferred to avoid a rushed regex rewrite.
- **bestiary-enemy-design #1 — elite-modifier clamp divergence (high).** Requires separating model from display across `applyModifiers` + the `ArchetypeBuilder` consumer; a focused UI/codegen-consistency change.
- **GAS tag-name sanitize (med)** and **blueprint semantic-diff symmetry (med)** — lower severity, batch into a future codegen pass.

## Cumulative status (across waves so far)

| Wave | Theme | Closed | Crit | High |
|------|-------|-------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| 6 | Security hardening | 2 | 2 | 0 |
| 4 | Shared-singleton concurrency | 3 | 3 | 0 |
| 2 | Atomicity & write races | 3 | 3 | 0 |
| 5 | UE5 codegen correctness | 3 | 1 | 2 |
| **Total** | | **18 / 140** | **12 / 18** | **6 / 70** |

## Patterns established (catalogue items 13–15)

13. **Every referenced id must exist by construction.** Generate (and store) the target node *before* referencing it; a fresh id that's never materialized is a dangling pointer. A post-build "every non-null ref resolves" assert turns the whole class into a build-time error.
14. **When a hardened and an unsafe copy of the same module coexist, delete the unsafe one.** Don't just rewire the import — remove the duplicate so a future edit can't reintroduce the unescaped path. One canonical implementation per concern.
15. **Generated-code identifiers and CSV from free text must be escaped, and uniqueness invariants (enum names) checked.** Output that "looks right" but won't compile is worse than an error; validate identifier-hostile characters and duplicates at generation time and surface them loudly.

## What remains

18 of 140 closed; 12 of 18 criticals. Remaining criticals (6): combat armor squared, crash-analysis substring, item double-produce, AI-testing FK cascade, project-health timestamp, build/cook sizeBytes — across Wave 3 (silent-failure gates), Wave 7 (determinism / timestamps / stale closures), and the schema/logic findings. Plus deferred highs from Waves 2/4/5.
