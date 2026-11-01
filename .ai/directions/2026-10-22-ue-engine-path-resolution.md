---
subject: game-production/engine-integration-safety (which UnrealEditor binary the verification tooling launches)
project: pof
raised_by: App Master charter technical-decision-capture, 2026-10-22 (headless builder, branch autopilot/technical-decision-capture-03e8db22); decision made by run 25888ebc
source: commit 614536f8 "ue tooling: resolve the editor binary through resolveEditorBinary, not a UE_5.7 literal"
stage: e2e harness (e2e/helpers/ci-harness.ts, ue-verification.ts), visual-check prompt fallback, test-gate-runner/captureResolver, src/lib/ue-launch/engines.ts
size: decision record only; the change itself is merged (S)
status: accepted
---

# One resolution chain for the UE engine path

## 1. How to read this

- This records a decision already made and merged. No source was changed by this record.
- Status is `accepted`: operator-directed via the App Master channel, 2026-10-22. The code is commit 614536f8.
- Evidence is the commit diff and `resolveUEBinary` at `e2e/helpers/ci-harness.ts:42`, with its expectations at `e2e/helpers/ci-harness.test.ts:28-39`. Nothing was run for this record.

## 2. The constraint

- Three hardcoded copies of the engine path had drifted. `e2e/helpers` (ci-harness, ue-verification) and the visual-check prompt's no-`ueVersion` fallback hardcoded `UE_5.7`, while the app's resolver and `test-gate-runner/captureResolver` defaulted to `UE_5.8`. The repo contradicted itself about which engine binary its verification tooling launches.
- The production UE project is still on 5.7. That is the game project's version, a different thing from the tooling engine, and it must not move with this change.
- `docs/ue58-mcp-convergence-plan.md` makes two statements about 5.7 and 5.8. They were judged compatible from reading them (tooling on 5.8, project still 5.7); nothing was run to prove it.

## 3. The decision

Remove the hardcoded defaults instead of swapping 5.7 for 5.8. The copies collapse into one resolution chain, `resolveEditorBinary`, shared with `captureResolver`. `resolveUEBinary(windowed, env)` in `e2e/helpers/ci-harness.ts:42` resolves in this order, first hit wins:

1. `POF_UE_EDITOR` when `windowed`, else `POF_UE_CMD`: a full binary path override.
2. `POF_UE_ENGINE` when set and NOT shaped like a version: read as a `...\Win64` directory, with `UnrealEditor.exe` (windowed) or `UnrealEditor-Cmd.exe` appended. This legacy form is checked before the shared chain.
3. Otherwise `resolveEditorBinary({ windowed }, env)`, in this order: `POF_UE_CMD` / `POF_UE_EDITOR`, then `POF_UE_EDITOR_CMD`, then `POF_UE_ENGINE` as a version (`5.6`, `5.7.3`), then the `UE_5.8` install default.

So `POF_UE_EDITOR` / `POF_UE_CMD` beat everything, including a directory-form `POF_UE_ENGINE` (test line 38). A directory-form `POF_UE_ENGINE` beats `POF_UE_EDITOR_CMD`, because step 2 returns before the shared chain runs. `POF_UE_EDITOR_CMD` is reached only when `POF_UE_ENGINE` is unset or a version. The test expects the `UE_5.8` default and never 5.7 with an empty env.

Surviving `5.7` literals are commented as deliberate: the harness-mode bridge mock (`ueVersion` 5.7.3 mocks the game project's version) and the `review-module` `--ue-version` example (that flag is the project's version).

## 4. The alternative that lost

A blanket 5.7 to 5.8 string replacement. It would have fixed the three copies' disagreement for today and left three copies to drift again. It would also have rewritten the production project's own 5.7 reference, which names the game project's version, not the tooling engine. That reference is left alone on purpose; it is not an oversight.

## 5. Known duality: `POF_UE_ENGINE`

`POF_UE_ENGINE` carries two meanings: a version string, as `src/lib/ue-launch/engines.ts` reads it, and a `...\Win64` directory, as e2e's history read it. `resolveUEBinary` accepts both by checking the value's shape against a version pattern (`ENGINE_VERSION`, `^\d+\.\d+(\.\d+)?$`).

The operator has decided this duality STAYS. The directory form is not deprecated in favour of `POF_UE_EDITOR_CMD`: that variable may already be set on the operator's own machines (including Wolf), and quietly narrowing what it accepts would fail where nobody is looking. Narrowing it is the operator's call to make later. Until then do not deprecate, rename or narrow any of these variables.
